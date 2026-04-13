"""
Greedy assignment algorithm with backtracking.

Per active ExamSlot (ordered by day ASC, shift ASC, slot_order ASC):
  1. Pick المداوم from subject teachers (lowest workload)
  2. Pick reserves (configurable per slot, fallback to exam.max_reserves)
  3. For each RoomSlotAssignment: pick 2 supervisors respecting constraints
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


def _increment_ledger(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum):
    ledger.total_count += 1
    if level == LevelEnum.BAC1:
        ledger.bac1_count += 1
    else:
        ledger.bac2_count += 1
    if shift == ShiftEnum.MORNING:
        ledger.morning_count += 1
    else:
        ledger.afternoon_count += 1


def _decrement_ledger(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum):
    ledger.total_count = max(0, ledger.total_count - 1)
    if level == LevelEnum.BAC1:
        ledger.bac1_count = max(0, ledger.bac1_count - 1)
    else:
        ledger.bac2_count = max(0, ledger.bac2_count - 1)
    if shift == ShiftEnum.MORNING:
        ledger.morning_count = max(0, ledger.morning_count - 1)
    else:
        ledger.afternoon_count = max(0, ledger.afternoon_count - 1)


# ── Sort key ───────────────────────────────────────────────────────────────

def _sort_key(ledger: am.WorkloadLedger, shift: ShiftEnum, level: LevelEnum) -> tuple:
    level_count = ledger.bac1_count if level == LevelEnum.BAC1 else ledger.bac2_count
    shift_count = ledger.morning_count if shift == ShiftEnum.MORNING else ledger.afternoon_count
    return (ledger.total_count, level_count, shift_count)


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

def _pick_pair(
    candidates: list[am.Teacher],
    history: dict,
    room_id: int,
    result: AssignmentResult,
) -> tuple | None:
    if len(candidates) < 2:
        return None

    # Prefer pairs with no history at all
    for i, t1 in enumerate(candidates):
        for t2 in candidates[i + 1:]:
            if _hard_duo(history, t1.id, t2.id, room_id):
                continue
            if not _soft_duo(history, t1.id, t2.id):
                return (t1, t2)

    # Relax soft — allow duo repeat across different rooms, fire warning
    for i, t1 in enumerate(candidates):
        for t2 in candidates[i + 1:]:
            if _hard_duo(history, t1.id, t2.id, room_id):
                continue
            result.warnings.append(Warning(
                type="SOFT", code="DUO_REPEATED",
                message=f"Teachers {t1.id} and {t2.id} have been paired before",
                context={"teacher_1_id": t1.id, "teacher_2_id": t2.id, "room_id": room_id},
            ))
            return (t1, t2)

    return None


# ── Fair target computation ────────────────────────────────────────────────

def compute_fair_targets(total: int, n: int) -> tuple[int, int]:
    if n == 0:
        return (0, 0)
    avg = total / n
    return (math.floor(avg), math.ceil(avg))


# ── Main entry ─────────────────────────────────────────────────────────────

def run_assignment(db: Session, exam: sm.Exam) -> AssignmentResult:
    result = AssignmentResult()
    year  = exam.year
    level = exam.level

    # ── 0. Clear previous run data ────────────────────────────────────────
    all_slot_ids: list[int] = [
        s.id for s in db.query(sm.ExamSlot.id).filter_by(exam_id=exam.id)
    ]
    if all_slot_ids:
        old_rsa_ids = [
            r.id for r in db.query(sm.RoomSlotAssignment.id).filter(
                sm.RoomSlotAssignment.exam_slot_id.in_(all_slot_ids)
            )
        ]
        if old_rsa_ids:
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

    # In-memory duo history (fresh — cleared above)
    duo_history: dict[tuple, dict] = {}

    # Track teacher occupation per (day, shift) to prevent double-booking
    teacher_busy: dict[str, set] = {}  # {cin: {(day, shift)}}

    def is_busy(cin: str, day: int, shift: ShiftEnum) -> bool:
        return (day, shift) in teacher_busy.get(cin, set())

    def mark_busy(cin: str, day: int, shift: ShiftEnum):
        teacher_busy.setdefault(cin, set()).add((day, shift))

    for slot in slots:
        shift = slot.shift
        day   = slot.day

        # Teachers of this subject are ineligible for supervision + reserve
        subject_teacher_ids: set[int] = {
            t.id for t in all_teachers if t.subject_id == slot.subject_id
        }

        # ── 1. Pick المداوم ──────────────────────────────────────────────
        subject_teachers = sorted(
            [t for t in all_teachers if t.subject_id == slot.subject_id],
            key=lambda t: _sort_key(_get_or_create_ledger(db, t.cin, year), shift, level),
        )
        madaoum_id: int | None = None
        if not subject_teachers:
            result.warnings.append(Warning(
                type="SOFT", code="NO_MADAOUM_AVAILABLE",
                message=f"No teacher found for subject {slot.subject_id}",
                context={"exam_slot_id": slot.id, "subject_id": slot.subject_id},
            ))
        else:
            madaoum = subject_teachers[0]
            ma = am.MadaoumeAssignment(exam_slot_id=slot.id, teacher_id=madaoum.id)
            db.add(ma)
            db.flush()
            result.madaoume.append(ma)
            ledger = _get_or_create_ledger(db, madaoum.cin, year)
            _increment_ledger(ledger, shift, level)
            madaoum_id = madaoum.id
            mark_busy(madaoum.cin, day, shift)

        # ── 2. Pick reserves ─────────────────────────────────────────────
        reserve_count = slot.reserve_count if slot.reserve_count is not None else exam.max_reserves
        excluded: set[int] = subject_teacher_ids.copy()
        if madaoum_id:
            excluded.add(madaoum_id)

        reserve_pool = sorted(
            [
                t for t in all_teachers
                if t.id not in excluded
                and not is_busy(t.cin, day, shift)
                and not _is_exempted(exemption_index, t.id, slot)
            ],
            key=lambda t: _sort_key(_get_or_create_ledger(db, t.cin, year), shift, level),
        )
        actual_reserves = min(reserve_count, len(reserve_pool))
        if actual_reserves < reserve_count:
            result.warnings.append(Warning(
                type="SOFT", code="INSUFFICIENT_RESERVES",
                message=f"Requested {reserve_count} reserves, only {actual_reserves} available",
                context={"exam_slot_id": slot.id},
            ))

        for i in range(actual_reserves):
            t = reserve_pool[i]
            ra = am.ReserveAssignment(exam_slot_id=slot.id, teacher_id=t.id, order=i)
            db.add(ra)
            db.flush()
            result.reserves.append(ra)
            ledger = _get_or_create_ledger(db, t.cin, year)
            _increment_ledger(ledger, shift, level)
            excluded.add(t.id)
            mark_busy(t.cin, day, shift)

        # ── 3. Assign supervisors per room ───────────────────────────────
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
            if t.id not in excluded
            and not is_busy(t.cin, day, shift)
            and not _is_exempted(exemption_index, t.id, slot)
        ])
        if eligible_count < needed_total:
            result.warnings.append(Warning(
                type="HARD", code="INSUFFICIENT_TEACHERS",
                message=f"Need {needed_total} supervisors, only {eligible_count} eligible",
                context={"exam_slot_id": slot.id, "needed": needed_total, "available": eligible_count},
            ))

        for rsa in rsas:
            n_supervisors = rsa.supervisors_override or exam.supervisors_per_room

            pool = sorted(
                [
                    t for t in all_teachers
                    if t.id not in excluded
                    and not is_busy(t.cin, day, shift)
                    and not _is_exempted(exemption_index, t.id, slot)
                ],
                key=lambda t: _sort_key(_get_or_create_ledger(db, t.cin, year), shift, level),
            )

            # Default: pick 2. Extra supervisors (library case) picked greedily.
            pair = _pick_pair(pool, duo_history, rsa.room_id, result)
            if pair is None:
                result.warnings.append(Warning(
                    type="HARD", code="CANNOT_FILL_ROOM",
                    message=f"Cannot fill room {rsa.room_id} for slot {slot.id}",
                    context={"exam_slot_id": slot.id, "room_id": rsa.room_id},
                ))
                continue

            t1, t2 = pair
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
                ledger = _get_or_create_ledger(db, t.cin, year)
                _increment_ledger(ledger, shift, level)
                mark_busy(t.cin, day, shift)
                excluded.add(t.id)

            _record_duo(duo_history, t1.id, t2.id, rsa.room_id)
            _persist_duo(db, exam.id, t1.id, t2.id, rsa.room_id)

            # Handle extra supervisors beyond the default pair (e.g. library = 3)
            if n_supervisors > 2:
                extra_pool = sorted(
                    [
                        t for t in all_teachers
                        if t.id not in excluded
                        and not is_busy(t.cin, day, shift)
                        and not _is_exempted(exemption_index, t.id, slot)
                    ],
                    key=lambda t: _sort_key(_get_or_create_ledger(db, t.cin, year), shift, level),
                )
                for t in extra_pool[:n_supervisors - 2]:
                    ledger = _get_or_create_ledger(db, t.cin, year)
                    _increment_ledger(ledger, shift, level)
                    mark_busy(t.cin, day, shift)
                    excluded.add(t.id)

    db.commit()
    return result
