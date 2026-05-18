"""
Greedy assignment algorithm.

Per concrete session (day ASC, shift ASC, slot_order ASC):
  1. Pick المداوم per subject in the session from subject teachers
  2. Pick supervisors for all RoomSlotAssignments respecting constraints
  3. Pick session reserves from the remaining pool
  4. Update WorkloadLedger (keyed by CIN + academic year)
  5. Emit warnings on constraint violations

WorkloadLedger is keyed by (cin, year) so fairness spans all 3 exam periods
within an academic year — a teacher re-imported in 2Bac carries their 1Bac workload.
"""
import math
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.modules.assignment import models as am
from app.modules.scheduling import models as sm
from app.modules.scheduling.models import ExamFiliereRoom, LevelEnum, ShiftEnum


@dataclass
class Warning:
    type:    str
    code:    str
    message: str
    context: dict = field(default_factory=dict)


@dataclass
class AssignmentResult:
    room_assignments:  list[am.RoomAssignment]    = field(default_factory=list)
    madaoume:          list[am.MadaoumeAssignment] = field(default_factory=list)
    reserves:          list[am.ReserveAssignment]  = field(default_factory=list)
    warnings:          list[Warning]               = field(default_factory=list)
    total_activities:  int = 0
    fair_target_floor: int = 0
    fair_target_ceil:  int = 0


# ── WorkloadLedger helpers (keyed by CIN) ──────────────────────────────────

def _get_or_create_ledger(db: Session, cin: str, year: str) -> am.WorkloadLedger:
    ledger = db.query(am.WorkloadLedger).filter_by(cin=cin, year=year).first()
    if not ledger:
        ledger = am.WorkloadLedger(cin=cin, year=year)
        db.add(ledger)
        db.flush()
    return ledger


def _increment_ledger(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum, role: str = "SUPERVISOR"):
    ledger.total_count += 1
    if level == LevelEnum.BAC1:
        ledger.bac1_count += 1
    else:
        ledger.bac2_count += 1
    if shift == ShiftEnum.MORNING:
        ledger.morning_count += 1
    else:
        ledger.afternoon_count += 1

    if role == "MADAOUM":
        ledger.madaoume_count += 1
    elif role == "RESERVE":
        ledger.reserve_count += 1


def _decrement_ledger(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum, role: str = "SUPERVISOR"):
    ledger.total_count = max(0, ledger.total_count - 1)
    if level == LevelEnum.BAC1:
        ledger.bac1_count = max(0, ledger.bac1_count - 1)
    else:
        ledger.bac2_count = max(0, ledger.bac2_count - 1)
    if shift == ShiftEnum.MORNING:
        ledger.morning_count = max(0, ledger.morning_count - 1)
    else:
        ledger.afternoon_count = max(0, ledger.afternoon_count - 1)

    if role == "MADAOUM":
        ledger.madaoume_count = max(0, ledger.madaoume_count - 1)
    elif role == "RESERVE":
        ledger.reserve_count = max(0, ledger.reserve_count - 1)


# ── Sort key ───────────────────────────────────────────────────────────────

def _sort_key(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum, tie_breaker: int = 0, role_penalty: bool = False) -> tuple:
    level_count = ledger.bac1_count if level == LevelEnum.BAC1 else ledger.bac2_count
    shift_count = ledger.morning_count if shift == ShiftEnum.MORNING else ledger.afternoon_count

    # If role_penalty is True, we are picking for MADAOUM or RESERVE.
    # We want to prioritize those who have 0 madaoume/reserve count.
    # We use (madaoume_count + reserve_count) as the primary sort key in that case.
    benefit_count = ledger.madaoume_count + ledger.reserve_count

    return (benefit_count if role_penalty else 0, ledger.total_count, level_count, shift_count, tie_breaker)


# ── Duo helpers ────────────────────────────────────────────────────────────

def _duo_key(a: int, b: int) -> tuple[int, int]:
    return (min(a, b), max(a, b))


def _hard_duo(history: dict, t1: int, t2: int, room_id: int) -> bool:
    """Returns True if this pair has already been in this exact room."""
    key = _duo_key(t1, t2)
    return history.get(key, {}).get(room_id, 0) > 0


def _soft_duo(history: dict, t1: int, t2: int) -> bool:
    """Returns True if this pair has been together anywhere."""
    return _duo_key(t1, t2) in history


def _record_duo(history: dict, t1: int, t2: int, room_id: int):
    key = _duo_key(t1, t2)
    history.setdefault(key, {})
    history[key][room_id] = history[key].get(room_id, 0) + 1
    history[key][None]    = history[key].get(None, 0) + 1


def _persist_duo(db: Session, exam_id: int, t1: int, t2: int, room_id: int):
    a, b = min(t1, t2), max(t1, t2)
    for rid in (room_id, None):
        existing = db.query(am.DuoHistory).filter_by(
            exam_id=exam_id, teacher_a_id=a, teacher_b_id=b, room_id=rid
        ).first()
        if existing:
            existing.occurrences += 1
        else:
            db.add(am.DuoHistory(exam_id=exam_id, teacher_a_id=a, teacher_b_id=b,
                                  room_id=rid, occurrences=1))
    db.flush()


# ── Exemption check ────────────────────────────────────────────────────────

def _build_exemption_index(exemptions: list[am.TeacherExemption]) -> dict[int, list[am.TeacherExemption]]:
    """Maps teacher_id → list of their exemptions."""
    index: dict[int, list[am.TeacherExemption]] = {}
    for e in exemptions:
        index.setdefault(e.teacher_id, []).append(e)
    return index


def _is_exempted(exemption_index: dict, teacher_id: int, slot: sm.ExamSlot) -> bool:
    for ex in exemption_index.get(teacher_id, []):
        if ex.exemption_type == am.ExemptionTypeEnum.SLOT and ex.ref_value == str(slot.id):
            return True
        if ex.exemption_type == am.ExemptionTypeEnum.SHIFT and ex.ref_value == slot.shift.value:
            return True
        if ex.exemption_type == am.ExemptionTypeEnum.DAY and ex.ref_value == str(slot.day):
            return True
    return False


# ── Pair picker ────────────────────────────────────────────────────────────

PAIR_BRANCH_LIMIT = 120
PAIR_FALLBACK_BRANCH_LIMIT = 600
PAIR_SEARCH_NODE_LIMIT = 25_000


def _pair_score(
    t1: am.Teacher,
    t2: am.Teacher,
    history: dict,
    room_id: int,
    ledger_by_cin: dict[str, am.WorkloadLedger],
    shift: ShiftEnum,
    level: LevelEnum,
    allow_hard_repeat: bool = False,
) -> tuple | None:
    hard_repeated = _hard_duo(history, t1.id, t2.id, room_id)
    if hard_repeated and not allow_hard_repeat:
        return None

    l1 = ledger_by_cin[t1.cin]
    l2 = ledger_by_cin[t2.cin]
    l1_level = l1.bac1_count if level == LevelEnum.BAC1 else l1.bac2_count
    l2_level = l2.bac1_count if level == LevelEnum.BAC1 else l2.bac2_count
    l1_shift = l1.morning_count if shift == ShiftEnum.MORNING else l1.afternoon_count
    l2_shift = l2.morning_count if shift == ShiftEnum.MORNING else l2.afternoon_count
    soft_repeated = _soft_duo(history, t1.id, t2.id)

    return (
        100_000 if hard_repeated else 0,
        10_000 if soft_repeated else 0,
        l1.total_count + l2.total_count,
        l1_level + l2_level,
        l1_shift + l2_shift,
        max(l1.total_count, l2.total_count),
        t1.ordinal or t1.id,
        t2.ordinal or t2.id,
    )


def _score_sum(a: tuple, b: tuple) -> tuple:
    return tuple(x + y for x, y in zip(a, b))


def _room_pair_candidates(
    rsa: sm.RoomSlotAssignment,
    candidates: list[am.Teacher],
    history: dict,
    ledger_by_cin: dict[str, am.WorkloadLedger],
    shift: ShiftEnum,
    level: LevelEnum,
    branch_limit: int,
    allow_hard_repeat: bool = False,
) -> list[tuple[tuple, am.Teacher, am.Teacher, bool, bool]]:
    pairs: list[tuple[tuple, am.Teacher, am.Teacher, bool, bool]] = []
    for i, t1 in enumerate(candidates):
        for t2 in candidates[i + 1:]:
            hard_repeated = _hard_duo(history, t1.id, t2.id, rsa.room_id)
            score = _pair_score(
                t1,
                t2,
                history,
                rsa.room_id,
                ledger_by_cin,
                shift,
                level,
                allow_hard_repeat=allow_hard_repeat,
            )
            if score is None:
                continue
            pairs.append((score, t1, t2, _soft_duo(history, t1.id, t2.id), hard_repeated))
    return sorted(pairs, key=lambda item: item[0])[:branch_limit]


def _pick_room_pairs(
    tasks: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment]],
    candidates_by_rsa: dict[int, list[am.Teacher]],
    history: dict,
    ledger_by_cin: dict[str, am.WorkloadLedger],
    shift: ShiftEnum,
    level: LevelEnum,
    branch_limit: int = PAIR_BRANCH_LIMIT,
    allow_hard_repeat: bool = False,
) -> list[tuple[sm.ExamSlot, sm.RoomSlotAssignment, am.Teacher, am.Teacher, bool, bool]] | None:
    if not tasks:
        return []

    pairs_by_rsa = {
        rsa.id: _room_pair_candidates(
            rsa,
            candidates_by_rsa.get(rsa.id, []),
            history,
            ledger_by_cin,
            shift,
            level,
            branch_limit,
            allow_hard_repeat=allow_hard_repeat,
        )
        for _, rsa in tasks
    }
    if any(not pairs_by_rsa[rsa.id] for _, rsa in tasks):
        return None

    ordered_tasks = sorted(tasks, key=lambda task: (len(pairs_by_rsa[task[1].id]), task[1].room_id))
    zero_score = (0, 0, 0, 0, 0, 0, 0, 0)
    best_score: tuple | None = None
    best_choices: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment, am.Teacher, am.Teacher, bool, bool]] | None = None
    visited_nodes = 0
    search_limited = False

    def backtrack(
        index: int,
        used_teacher_ids: set[int],
        current_score: tuple,
        choices: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment, am.Teacher, am.Teacher, bool, bool]],
    ) -> None:
        nonlocal best_score, best_choices, visited_nodes, search_limited

        if search_limited:
            return
        visited_nodes += 1
        if visited_nodes > PAIR_SEARCH_NODE_LIMIT:
            search_limited = True
            return

        if best_score is not None and current_score >= best_score:
            return
        if index == len(ordered_tasks):
            best_score = current_score
            best_choices = choices.copy()
            return

        slot, rsa = ordered_tasks[index]
        for score, t1, t2, soft_repeated, hard_repeated in pairs_by_rsa[rsa.id]:
            if t1.id in used_teacher_ids or t2.id in used_teacher_ids:
                continue
            choices.append((slot, rsa, t1, t2, soft_repeated, hard_repeated))
            backtrack(
                index + 1,
                used_teacher_ids | {t1.id, t2.id},
                _score_sum(current_score, score),
                choices,
            )
            choices.pop()

    backtrack(0, set(), zero_score, [])
    if best_choices is None and (search_limited or branch_limit < PAIR_FALLBACK_BRANCH_LIMIT):
        return _pick_room_pairs_greedy(
            tasks,
            candidates_by_rsa,
            history,
            ledger_by_cin,
            shift,
            level,
            branch_limit=PAIR_FALLBACK_BRANCH_LIMIT,
            allow_hard_repeat=allow_hard_repeat,
        )
    return best_choices


def _pick_room_pairs_greedy(
    tasks: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment]],
    candidates_by_rsa: dict[int, list[am.Teacher]],
    history: dict,
    ledger_by_cin: dict[str, am.WorkloadLedger],
    shift: ShiftEnum,
    level: LevelEnum,
    branch_limit: int,
    allow_hard_repeat: bool = False,
) -> list[tuple[sm.ExamSlot, sm.RoomSlotAssignment, am.Teacher, am.Teacher, bool, bool]] | None:
    pairs_by_rsa = {
        rsa.id: _room_pair_candidates(
            rsa,
            candidates_by_rsa.get(rsa.id, []),
            history,
            ledger_by_cin,
            shift,
            level,
            branch_limit,
            allow_hard_repeat=allow_hard_repeat,
        )
        for _, rsa in tasks
    }
    if any(not pairs_by_rsa[rsa.id] for _, rsa in tasks):
        return None

    ordered_tasks = sorted(tasks, key=lambda task: (len(pairs_by_rsa[task[1].id]), task[1].room_id))
    used_teacher_ids: set[int] = set()
    choices: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment, am.Teacher, am.Teacher, bool, bool]] = []

    for slot, rsa in ordered_tasks:
        selected = None
        for _, t1, t2, soft_repeated, hard_repeated in pairs_by_rsa[rsa.id]:
            if t1.id in used_teacher_ids or t2.id in used_teacher_ids:
                continue
            selected = (slot, rsa, t1, t2, soft_repeated, hard_repeated)
            break
        if selected is None:
            return None
        choices.append(selected)
        used_teacher_ids.update({selected[2].id, selected[3].id})

    return choices


# ── Fair target computation ────────────────────────────────────────────────

def compute_fair_targets(total: int, n: int) -> tuple[int, int]:
    if n == 0:
        return (0, 0)
    avg = total / n
    return (math.floor(avg), math.ceil(avg))


# ── Preflight validation ──────────────────────────────────────────────────

def _session_key(slot: sm.ExamSlot) -> tuple[int, ShiftEnum, int]:
    return (slot.day, slot.shift, slot.slot_order)


def _add_preflight_warnings(
    result: AssignmentResult,
    all_teachers: list[am.Teacher],
    slots: list[sm.ExamSlot],
    slot_to_rsas: dict[int, list[sm.RoomSlotAssignment]],
    exam: sm.Exam,
    exemption_index: dict[int, list[am.TeacherExemption]],
) -> None:
    """
    Validate obvious impossibilities before greedy choices start.
    These warnings explain capacity issues early; the assignment still runs.
    """
    session_needed: dict[tuple[int, ShiftEnum, int], int] = {}
    session_slots: dict[tuple[int, ShiftEnum, int], list[sm.ExamSlot]] = {}

    for slot in slots:
        rsas = slot_to_rsas.get(slot.id, [])
        needed = sum(rsa.supervisors_override or exam.supervisors_per_room for rsa in rsas)
        key = _session_key(slot)
        session_needed[key] = session_needed.get(key, 0) + needed
        session_slots.setdefault(key, []).append(slot)

        if not rsas:
            result.warnings.append(Warning(
                type="HARD",
                code="PREFLIGHT_NO_ROOMS_ASSIGNED",
                message=f"No rooms assigned to slot {slot.id}",
                context={"exam_slot_id": slot.id},
            ))
            continue

        subject_teacher_ids = {t.id for t in all_teachers if t.subject_id == slot.subject_id}
        eligible_supervisors = [
            t for t in all_teachers
            if t.id not in subject_teacher_ids
            and not _is_exempted(exemption_index, t.id, slot)
        ]
        if len(eligible_supervisors) < needed:
            result.warnings.append(Warning(
                type="HARD",
                code="PREFLIGHT_INSUFFICIENT_SLOT_SUPERVISORS",
                message=f"Slot {slot.id} needs {needed} supervisors, only {len(eligible_supervisors)} eligible",
                context={
                    "exam_slot_id": slot.id,
                    "needed": needed,
                    "available": len(eligible_supervisors),
                },
            ))

        madaoum_candidates = [
            t for t in all_teachers
            if t.subject_id == slot.subject_id
            and not _is_exempted(exemption_index, t.id, slot)
        ]
        if not madaoum_candidates:
            result.warnings.append(Warning(
                type="SOFT",
                code="PREFLIGHT_NO_MADAOUM_AVAILABLE",
                message=f"No madaoum candidate found for subject {slot.subject_id}",
                context={"exam_slot_id": slot.id, "subject_id": slot.subject_id},
            ))

    for key, needed in session_needed.items():
        slots_in_session = session_slots.get(key, [])
        if needed == 0 or not slots_in_session:
            continue
        available = [
            t for t in all_teachers
            if any(not _is_exempted(exemption_index, t.id, slot) for slot in slots_in_session)
        ]
        if len(available) < needed:
            day, shift, slot_order = key
            result.warnings.append(Warning(
                type="HARD",
                code="PREFLIGHT_INSUFFICIENT_SESSION_CAPACITY",
                message=f"Session day {day} {shift.value} S{slot_order} needs {needed} supervisors, only {len(available)} teachers available",
                context={
                    "day": day,
                    "shift": shift.value,
                    "slot_order": slot_order,
                    "needed": needed,
                    "available": len(available),
                },
            ))


# ── Main entry ─────────────────────────────────────────────────────────────

def run_assignment(db: Session, exam: sm.Exam) -> AssignmentResult:
    result = AssignmentResult()
    year  = exam.year
    level = exam.level

    # ── 0. Clear previous run data (with ledger rollback) ────────────────
    all_slot_ids: list[int] = [
        s.id for s in db.query(sm.ExamSlot.id).filter_by(exam_id=exam.id)
    ]
    if all_slot_ids:
        # Build slot→shift lookup for correct ledger decrement
        slot_shift_map: dict[int, ShiftEnum] = {
            row.id: row.shift
            for row in db.query(sm.ExamSlot.id, sm.ExamSlot.shift)
                         .filter(sm.ExamSlot.id.in_(all_slot_ids))
        }

        # ── Rollback madaoume ledger ──────────────────────────────────────
        old_madaoume = (
            db.query(am.MadaoumeAssignment)
            .filter(am.MadaoumeAssignment.exam_slot_id.in_(all_slot_ids))
            .all()
        )
        if old_madaoume:
            ma_cin_map = {
                t.id: t.cin for t in db.query(am.Teacher).filter(
                    am.Teacher.id.in_({ma.teacher_id for ma in old_madaoume})
                )
            }
            for ma in old_madaoume:
                cin   = ma_cin_map.get(ma.teacher_id)
                shift = slot_shift_map.get(ma.exam_slot_id)
                if cin and shift:
                    _decrement_ledger(_get_or_create_ledger(db, cin, year), shift, level, role="MADAOUM")

        # ── Rollback reserve ledger ───────────────────────────────────────
        old_reserves = (
            db.query(am.ReserveAssignment)
            .filter(am.ReserveAssignment.exam_slot_id.in_(all_slot_ids))
            .all()
        )
        if old_reserves:
            res_cin_map = {
                t.id: t.cin for t in db.query(am.Teacher).filter(
                    am.Teacher.id.in_({ra.teacher_id for ra in old_reserves})
                )
            }
            for ra in old_reserves:
                cin   = res_cin_map.get(ra.teacher_id)
                shift = slot_shift_map.get(ra.exam_slot_id)
                if cin and shift:
                    _decrement_ledger(_get_or_create_ledger(db, cin, year), shift, level, role="RESERVE")

        # ── Rollback room supervisor ledger ──────────────────────────────
        old_rsa_ids = [
            r.id for r in db.query(sm.RoomSlotAssignment.id).filter(
                sm.RoomSlotAssignment.exam_slot_id.in_(all_slot_ids)
            )
        ]
        if old_rsa_ids:
            rsa_slot_map: dict[int, int] = {
                row.id: row.exam_slot_id
                for row in db.query(sm.RoomSlotAssignment.id, sm.RoomSlotAssignment.exam_slot_id)
                             .filter(sm.RoomSlotAssignment.id.in_(old_rsa_ids))
            }
            old_ras = (
                db.query(am.RoomAssignment)
                .filter(am.RoomAssignment.room_slot_assignment_id.in_(old_rsa_ids))
                .all()
            )
            if old_ras:
                all_sup_ids = {
                    sid for ra in old_ras
                    for sid in (ra.supervisor_1_id, ra.supervisor_2_id) if sid
                }
                sup_cin_map = {
                    t.id: t.cin for t in db.query(am.Teacher).filter(
                        am.Teacher.id.in_(all_sup_ids)
                    )
                }
                for ra in old_ras:
                    slot_id = rsa_slot_map.get(ra.room_slot_assignment_id)
                    shift   = slot_shift_map.get(slot_id) if slot_id else None
                    if not shift:
                        continue
                    for sup_id in (ra.supervisor_1_id, ra.supervisor_2_id):
                        if sup_id:
                            cin = sup_cin_map.get(sup_id)
                            if cin:
                                _decrement_ledger(_get_or_create_ledger(db, cin, year), shift, level)

            db.query(am.RoomAssignment).filter(
                am.RoomAssignment.room_slot_assignment_id.in_(old_rsa_ids)
            ).delete(synchronize_session=False)
            db.query(sm.RoomSlotAssignment).filter(
                sm.RoomSlotAssignment.id.in_(old_rsa_ids)
            ).delete(synchronize_session=False)

        db.query(am.ReserveAssignment).filter(
            am.ReserveAssignment.exam_slot_id.in_(all_slot_ids)
        ).delete(synchronize_session=False)
        db.query(am.MadaoumeAssignment).filter(
            am.MadaoumeAssignment.exam_slot_id.in_(all_slot_ids)
        ).delete(synchronize_session=False)

    db.query(am.DuoHistory).filter_by(exam_id=exam.id).delete(synchronize_session=False)
    db.flush()

    # Load all teachers enrolled in this exam (via exam_teachers junction)
    all_teachers: list[am.Teacher] = (
        db.query(am.Teacher)
        .join(am.ExamTeacher, am.Teacher.id == am.ExamTeacher.teacher_id)
        .filter(am.ExamTeacher.exam_id == exam.id)
        .all()
    )
    ledger_by_cin = {
        t.cin: _get_or_create_ledger(db, t.cin, year)
        for t in all_teachers
    }

    # Build exemption index
    all_exemptions = db.query(am.TeacherExemption).filter_by(exam_id=exam.id).all()
    exemption_index = _build_exemption_index(all_exemptions)

    # Load active slots ordered by day, shift, slot_order
    slots: list[sm.ExamSlot] = (
        db.query(sm.ExamSlot)
        .filter(sm.ExamSlot.exam_id == exam.id, sm.ExamSlot.is_active == True)
        .order_by(sm.ExamSlot.day, sm.ExamSlot.shift, sm.ExamSlot.slot_order)
        .all()
    )

    if not slots:
        result.warnings.append(Warning(
            type="SOFT", code="NO_SLOTS",
            message="No active exam slots for this exam",
            context={"exam_id": exam.id},
        ))
        return result

    # ── Generate RoomSlotAssignments from filière-level room assignments ──
    # Load all ExamFiliereRoom entries for this exam's filieres
    ef_ids = list({slot.exam_filiere_id for slot in slots})
    filiere_rooms: list[ExamFiliereRoom] = (
        db.query(ExamFiliereRoom)
        .filter(ExamFiliereRoom.exam_filiere_id.in_(ef_ids))
        .all()
    )
    # Map exam_filiere_id → list of ExamFiliereRoom
    efr_by_filiere: dict[int, list[ExamFiliereRoom]] = {}
    for efr in filiere_rooms:
        efr_by_filiere.setdefault(efr.exam_filiere_id, []).append(efr)

    # For each active slot, create one RSA per assigned room
    slot_to_rsas: dict[int, list[sm.RoomSlotAssignment]] = {}
    for slot in slots:
        rsas_for_slot: list[sm.RoomSlotAssignment] = []
        for efr in efr_by_filiere.get(slot.exam_filiere_id, []):
            rsa = sm.RoomSlotAssignment(
                exam_slot_id=slot.id,
                room_id=efr.room_id,
                supervisors_override=efr.supervisors_override,
            )
            db.add(rsa)
            db.flush()
            rsas_for_slot.append(rsa)
        slot_to_rsas[slot.id] = rsas_for_slot

    # Compute total supervisor activities for fair target
    total_activities = sum(
        rsa.supervisors_override or exam.supervisors_per_room
        for rsas in slot_to_rsas.values()
        for rsa in rsas
    )
    result.total_activities = total_activities

    floor_t, ceil_t = compute_fair_targets(total_activities, len(all_teachers))
    result.fair_target_floor = floor_t
    result.fair_target_ceil  = ceil_t

    _add_preflight_warnings(
        result=result,
        all_teachers=all_teachers,
        slots=slots,
        slot_to_rsas=slot_to_rsas,
        exam=exam,
        exemption_index=exemption_index,
    )

    # In-memory duo history (fresh — cleared above)
    duo_history: dict[tuple, dict] = {}

    # Track teacher occupation per concrete session to prevent double-booking.
    # Workload still counts by shift, but availability is per S1/S2 session.
    teacher_busy: dict[str, set[tuple[int, ShiftEnum, int]]] = {}

    def slot_busy_key(slot: sm.ExamSlot) -> tuple[int, ShiftEnum, int]:
        return _session_key(slot)

    def is_busy(cin: str, busy_key: tuple[int, ShiftEnum, int]) -> bool:
        return busy_key in teacher_busy.get(cin, set())

    def mark_busy(cin: str, busy_key: tuple[int, ShiftEnum, int]):
        teacher_busy.setdefault(cin, set()).add(busy_key)

    def pick_session_reserves(
        session_slots: list[sm.ExamSlot],
        busy_key: tuple[int, ShiftEnum, int],
        shift: ShiftEnum,
    ) -> None:
        requested_by_slot = {
            slot.id: slot.reserve_count if slot.reserve_count is not None else exam.max_reserves
            for slot in session_slots
        }
        requested = max(requested_by_slot.values(), default=0)
        if requested <= 0:
            return

        session_subject_ids = {slot.subject_id for slot in session_slots}
        record_slots = [
            slot for slot in session_slots
            if requested_by_slot[slot.id] > 0
        ] or session_slots
        reserve_order = {slot.id: 0 for slot in record_slots}

        subject_blocked = [
            teacher for teacher in all_teachers
            if teacher.subject_id in session_subject_ids
        ]
        busy_blocked = [
            teacher for teacher in all_teachers
            if teacher.subject_id not in session_subject_ids
            and is_busy(teacher.cin, busy_key)
        ]
        exempted_blocked = [
            teacher for teacher in all_teachers
            if teacher.subject_id not in session_subject_ids
            and not is_busy(teacher.cin, busy_key)
            and any(
                _is_exempted(exemption_index, teacher.id, slot)
                for slot in session_slots
            )
        ]
        exempted_blocked_ids = {teacher.id for teacher in exempted_blocked}
        reserve_pool = sorted(
            [
                teacher for teacher in all_teachers
                if teacher.subject_id not in session_subject_ids
                and not is_busy(teacher.cin, busy_key)
                and teacher.id not in exempted_blocked_ids
            ],
            key=lambda teacher: _sort_key(
                ledger_by_cin[teacher.cin],
                shift,
                level,
                tie_breaker=teacher.ordinal or teacher.id,
                role_penalty=True,
            ),
        )

        actual = min(requested, len(reserve_pool))
        if actual < requested:
            result.warnings.append(Warning(
                type="SOFT",
                code="INSUFFICIENT_SESSION_RESERVES",
                message=(
                    f"Session day {busy_key[0]} {busy_key[1].value} S{busy_key[2]} "
                    f"requested {requested} reserves, only {actual} available after "
                    "excluding session subject teachers, already assigned teachers, and exemptions"
                ),
                context={
                    "day": busy_key[0],
                    "shift": busy_key[1].value,
                    "slot_order": busy_key[2],
                    "exam_slot_ids": [slot.id for slot in session_slots],
                    "requested": requested,
                    "available": len(reserve_pool),
                    "enrolled_teachers": len(all_teachers),
                    "excluded_subject_teachers": len(subject_blocked),
                    "excluded_busy_teachers": len(busy_blocked),
                    "excluded_exempted_teachers": len(exempted_blocked),
                    "requested_by_slot": requested_by_slot,
                },
            ))

        for i, teacher in enumerate(reserve_pool[:actual]):
            # Reserves are session-level, but the current schema stores a slot id.
            slot = record_slots[i % len(record_slots)]
            ra = am.ReserveAssignment(
                exam_slot_id=slot.id,
                teacher_id=teacher.id,
                order=reserve_order[slot.id],
            )
            db.add(ra)
            db.flush()
            result.reserves.append(ra)
            ledger = ledger_by_cin[teacher.cin]
            _increment_ledger(ledger, shift, level, role="RESERVE")
            mark_busy(teacher.cin, busy_key)
            reserve_order[slot.id] += 1

    def pick_session_madaoums(
        session_slots: list[sm.ExamSlot],
        busy_key: tuple[int, ShiftEnum, int],
        shift: ShiftEnum,
    ) -> None:
        slots_by_subject: dict[int, list[sm.ExamSlot]] = {}
        for slot in session_slots:
            slots_by_subject.setdefault(slot.subject_id, []).append(slot)

        for subject_id, subject_slots in slots_by_subject.items():
            subject_teachers = sorted(
                [
                    teacher for teacher in all_teachers
                    if teacher.subject_id == subject_id
                    and not is_busy(teacher.cin, busy_key)
                    and not any(
                        _is_exempted(exemption_index, teacher.id, slot)
                        for slot in subject_slots
                    )
                ],
                key=lambda teacher: _sort_key(
                    ledger_by_cin[teacher.cin],
                    shift,
                    level,
                    tie_breaker=teacher.ordinal or teacher.id,
                    role_penalty=True,
                ),
            )
            if not subject_teachers:
                result.warnings.append(Warning(
                    type="SOFT",
                    code="NO_SESSION_MADAOUM_AVAILABLE",
                    message=(
                        f"No madaoum candidate found for subject {subject_id} "
                        f"in day {busy_key[0]} {busy_key[1].value} S{busy_key[2]}"
                    ),
                    context={
                        "day": busy_key[0],
                        "shift": busy_key[1].value,
                        "slot_order": busy_key[2],
                        "subject_id": subject_id,
                        "exam_slot_ids": [slot.id for slot in subject_slots],
                    },
                ))
                continue

            madaoum = subject_teachers[0]
            # Madaoum is session-subject-level, but the current schema stores a slot id.
            ma = am.MadaoumeAssignment(exam_slot_id=subject_slots[0].id, teacher_id=madaoum.id)
            db.add(ma)
            db.flush()
            result.madaoume.append(ma)
            ledger = ledger_by_cin[madaoum.cin]
            _increment_ledger(ledger, shift, level, role="MADAOUM")
            mark_busy(madaoum.cin, busy_key)

    sessions: dict[tuple[int, ShiftEnum, int], list[sm.ExamSlot]] = {}
    for slot in slots:
        sessions.setdefault(slot_busy_key(slot), []).append(slot)

    for busy_key, session_slots in sessions.items():
        day, shift, slot_order = busy_key

        # ── 1. Pick المداوم per subject for the whole session ─────────────
        pick_session_madaoums(session_slots, busy_key, shift)

        # ── 2. Assign all room supervisors for the whole session ──────────
        room_tasks: list[tuple[sm.ExamSlot, sm.RoomSlotAssignment]] = []
        candidates_by_rsa: dict[int, list[am.Teacher]] = {}

        for slot in session_slots:
            subject_teacher_ids = {
                t.id for t in all_teachers if t.subject_id == slot.subject_id
            }
            rsas = slot_to_rsas.get(slot.id, [])

            if not rsas:
                result.warnings.append(Warning(
                    type="HARD", code="NO_ROOMS_ASSIGNED",
                    message=f"No rooms assigned to slot {slot.id}",
                    context={"exam_slot_id": slot.id},
                ))
                continue

            needed_total = sum(rsa.supervisors_override or exam.supervisors_per_room for rsa in rsas)
            eligible_count = len([
                t for t in all_teachers
                if t.id not in subject_teacher_ids
                and not is_busy(t.cin, busy_key)
                and not _is_exempted(exemption_index, t.id, slot)
            ])
            if eligible_count < needed_total:
                result.warnings.append(Warning(
                    type="HARD", code="INSUFFICIENT_TEACHERS",
                    message=f"Need {needed_total} supervisors, only {eligible_count} eligible",
                    context={"exam_slot_id": slot.id, "needed": needed_total, "available": eligible_count},
                ))

            for rsa in rsas:
                candidates_by_rsa[rsa.id] = sorted(
                    [
                        t for t in all_teachers
                        if t.id not in subject_teacher_ids
                        and not is_busy(t.cin, busy_key)
                        and not _is_exempted(exemption_index, t.id, slot)
                    ],
                    key=lambda t: _sort_key(ledger_by_cin[t.cin], shift, level),
                )
                room_tasks.append((slot, rsa))

        used_hard_repeat_fallback = False
        room_pairs = _pick_room_pairs(room_tasks, candidates_by_rsa, duo_history, ledger_by_cin, shift, level)
        if room_pairs is None:
            room_pairs = _pick_room_pairs(
                room_tasks,
                candidates_by_rsa,
                duo_history,
                ledger_by_cin,
                shift,
                level,
                branch_limit=PAIR_FALLBACK_BRANCH_LIMIT,
                allow_hard_repeat=True,
            )
            used_hard_repeat_fallback = room_pairs is not None

        if room_pairs is None:
            total_supervisors_needed = sum(
                rsa.supervisors_override or exam.supervisors_per_room
                for _, rsa in room_tasks
            )
            available_teacher_ids = {
                teacher.id
                for teachers in candidates_by_rsa.values()
                for teacher in teachers
            }
            room_candidate_counts = [
                {
                    "exam_slot_id": slot.id,
                    "room_slot_assignment_id": rsa.id,
                    "room_id": rsa.room_id,
                    "needed": rsa.supervisors_override or exam.supervisors_per_room,
                    "candidate_count": len(candidates_by_rsa.get(rsa.id, [])),
                }
                for slot, rsa in room_tasks
            ]
            result.warnings.append(Warning(
                type="HARD", code="CANNOT_FILL_SESSION_ROOMS",
                message=f"Cannot fill all rooms for day {day} {shift.value} S{slot_order}",
                context={
                    "day": day,
                    "shift": shift.value,
                    "slot_order": slot_order,
                    "exam_slot_ids": [slot.id for slot in session_slots],
                    "room_ids": [rsa.room_id for _, rsa in room_tasks],
                    "room_count": len(room_tasks),
                    "needed_supervisors": total_supervisors_needed,
                    "available_distinct_candidates": len(available_teacher_ids),
                    "room_candidate_counts": room_candidate_counts,
                },
            ))
            room_pairs = []
        elif used_hard_repeat_fallback:
            hard_repeated_pairs = [
                {
                    "exam_slot_id": slot.id,
                    "room_slot_assignment_id": rsa.id,
                    "room_id": rsa.room_id,
                    "teacher_1_id": t1.id,
                    "teacher_1_name": t1.name_fr,
                    "teacher_2_id": t2.id,
                    "teacher_2_name": t2.name_fr,
                }
                for slot, rsa, t1, t2, _, hard_repeated in room_pairs
                if hard_repeated
            ]
            result.warnings.append(Warning(
                type="SOFT",
                code="ROOM_DUO_HARD_REPEAT_USED",
                message=(
                    f"Session day {day} {shift.value} S{slot_order} required repeating "
                    f"{len(hard_repeated_pairs)} duo(s) in the same room to fill all rooms"
                ),
                context={
                    "day": day,
                    "shift": shift.value,
                    "slot_order": slot_order,
                    "exam_slot_ids": [slot.id for slot in session_slots],
                    "room_ids": [rsa.room_id for _, rsa in room_tasks],
                    "repeated_pairs": hard_repeated_pairs,
                },
            ))

        for slot, rsa, t1, t2, soft_repeated, hard_repeated in room_pairs:
            n_supervisors = rsa.supervisors_override or exam.supervisors_per_room
            if soft_repeated:
                result.warnings.append(Warning(
                    type="SOFT", code="DUO_REPEATED",
                    message=f"Teachers {t1.id} and {t2.id} have been paired before",
                    context={
                        "teacher_1_id": t1.id,
                        "teacher_1_name": t1.name_fr,
                        "teacher_2_id": t2.id,
                        "teacher_2_name": t2.name_fr,
                        "room_id": rsa.room_id,
                        "same_room_repeat": hard_repeated,
                    },
                ))

            assignment = am.RoomAssignment(
                room_slot_assignment_id=rsa.id,
                supervisor_1_id=t1.id,
                supervisor_2_id=t2.id,
                status=am.AssignmentStatusEnum.AUTO,
            )
            db.add(assignment)
            db.flush()
            result.room_assignments.append(assignment)

            for t in (t1, t2):
                ledger = ledger_by_cin[t.cin]
                _increment_ledger(ledger, shift, level)
                mark_busy(t.cin, busy_key)

            _record_duo(duo_history, t1.id, t2.id, rsa.room_id)
            _persist_duo(db, exam.id, t1.id, t2.id, rsa.room_id)

            # Handle extra supervisors beyond the default pair (e.g. library = 3)
            if n_supervisors > 2:
                subject_teacher_ids = {
                    t.id for t in all_teachers if t.subject_id == slot.subject_id
                }
                extra_pool = sorted(
                    [
                        t for t in all_teachers
                        if t.id not in subject_teacher_ids
                        and not is_busy(t.cin, busy_key)
                        and not _is_exempted(exemption_index, t.id, slot)
                    ],
                    key=lambda t: _sort_key(ledger_by_cin[t.cin], shift, level),
                )
                for t in extra_pool[:n_supervisors - 2]:
                    ledger = ledger_by_cin[t.cin]
                    _increment_ledger(ledger, shift, level)
                    mark_busy(t.cin, busy_key)

        # ── 3. Pick reserves globally after all session rooms ─────────────
        pick_session_reserves(session_slots, busy_key, shift)

    db.commit()
    return result
