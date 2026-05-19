from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.assignment import models, schemas
from app.modules.center import models as center_models
from app.modules.scheduling import models as sm


# ── Teacher ────────────────────────────────────────────────────────────────

def _next_ordinal(db: Session) -> int:
    """Return max(ordinal) + 1, or 1 if the table is empty."""
    max_ord = db.query(func.max(models.Teacher.ordinal)).scalar()
    return (max_ord or 0) + 1


def teacher_out(db: Session, teacher: models.Teacher) -> schemas.TeacherOut:
    subject_name = None
    if teacher.subject_id:
        subject_name = db.query(center_models.Subject.name_fr).filter_by(id=teacher.subject_id).scalar()

    return schemas.TeacherOut.model_validate(teacher).model_copy(
        update={"subject_name": subject_name}
    )


def create_teacher(db: Session, data: schemas.TeacherCreate) -> models.Teacher:
    payload = data.model_dump()
    if payload.get("ordinal") is None:
        payload["ordinal"] = _next_ordinal(db)
    obj = models.Teacher(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def bulk_create_teachers(db: Session, teachers: list[schemas.TeacherCreate]) -> list[models.Teacher]:
    next_ord = _next_ordinal(db)
    payloads = []
    for i, t in enumerate(teachers):
        p = t.model_dump()
        if p.get("ordinal") is None:
            p["ordinal"] = next_ord + i
        payloads.append(p)
    objs = [models.Teacher(**p) for p in payloads]
    db.add_all(objs)
    db.commit()
    for obj in objs:
        db.refresh(obj)
    return objs


def get_all_teachers(db: Session) -> list[models.Teacher]:
    return (
        db.query(models.Teacher)
        .order_by(models.Teacher.ordinal, models.Teacher.name_fr)
        .all()
    )


def get_teachers_for_exam(db: Session, exam_id: int) -> list[models.Teacher]:
    return (
        db.query(models.Teacher)
        .join(models.ExamTeacher, models.Teacher.id == models.ExamTeacher.teacher_id)
        .filter(models.ExamTeacher.exam_id == exam_id)
        .order_by(models.Teacher.ordinal, models.Teacher.name_fr)
        .all()
    )


def get_teacher(db: Session, teacher_id: int) -> models.Teacher | None:
    return db.query(models.Teacher).filter_by(id=teacher_id).first()


def update_teacher(db: Session, teacher_id: int, data: schemas.TeacherUpdate) -> models.Teacher | None:
    obj = get_teacher(db, teacher_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_teacher(db: Session, teacher_id: int) -> bool:
    obj = get_teacher(db, teacher_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── ExamTeacher ────────────────────────────────────────────────────────────

def enroll_teacher(db: Session, exam_id: int, data: schemas.ExamTeacherCreate) -> models.ExamTeacher:
    obj = models.ExamTeacher(exam_id=exam_id, teacher_id=data.teacher_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_exam_teachers(db: Session, exam_id: int) -> list[models.ExamTeacher]:
    return db.query(models.ExamTeacher).filter_by(exam_id=exam_id).all()


def remove_exam_teacher(db: Session, et_id: int) -> bool:
    obj = db.query(models.ExamTeacher).filter_by(id=et_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


def remove_exam_teacher_by_teacher_id(db: Session, exam_id: int, teacher_id: int) -> bool:
    obj = db.query(models.ExamTeacher).filter_by(exam_id=exam_id, teacher_id=teacher_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── TeacherExemption ───────────────────────────────────────────────────────

def create_exemption(db: Session, data: schemas.ExemptionCreate) -> models.TeacherExemption:
    obj = models.TeacherExemption(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_exemptions(db: Session, exam_id: int) -> list[models.TeacherExemption]:
    return db.query(models.TeacherExemption).filter_by(exam_id=exam_id).all()


def get_teacher_exemptions(db: Session, teacher_id: int) -> list[models.TeacherExemption]:
    return db.query(models.TeacherExemption).filter_by(teacher_id=teacher_id).all()


def delete_exemption(db: Session, exemption_id: int) -> bool:
    obj = db.query(models.TeacherExemption).filter_by(id=exemption_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── RoomAssignment ─────────────────────────────────────────────────────────

def get_room_assignments(db: Session, exam_id: int) -> list[models.RoomAssignment]:
    from app.modules.scheduling.models import RoomSlotAssignment, ExamSlot
    return (
        db.query(models.RoomAssignment)
        .join(RoomSlotAssignment, models.RoomAssignment.room_slot_assignment_id == RoomSlotAssignment.id)
        .join(ExamSlot, RoomSlotAssignment.exam_slot_id == ExamSlot.id)
        .filter(ExamSlot.exam_id == exam_id)
        .all()
    )


def get_room_assignments_rich(db: Session, exam_id: int) -> list[schemas.RoomAssignmentRich]:
    from app.modules.scheduling.models import RoomSlotAssignment, ExamSlot, ExamFiliere
    from app.modules.center.models import Room, Filiere

    rows = (
        db.query(models.RoomAssignment, RoomSlotAssignment, ExamSlot, Room, Filiere)
        .join(RoomSlotAssignment, models.RoomAssignment.room_slot_assignment_id == RoomSlotAssignment.id)
        .join(ExamSlot, RoomSlotAssignment.exam_slot_id == ExamSlot.id)
        .join(ExamFiliere, ExamSlot.exam_filiere_id == ExamFiliere.id)
        .join(Filiere, ExamFiliere.filiere_id == Filiere.id)
        .join(Room, RoomSlotAssignment.room_id == Room.id)
        .filter(ExamSlot.exam_id == exam_id)
        .order_by(ExamSlot.day, ExamSlot.shift, ExamSlot.slot_order, Room.name)
        .all()
    )

    return [
        schemas.RoomAssignmentRich(
            id=ra.id,
            room_slot_assignment_id=ra.room_slot_assignment_id,
            room_id=room.id,
            room_name=room.name,
            exam_slot_id=slot.id,
            day=slot.day,
            shift=slot.shift.value,
            slot_order=slot.slot_order,
            exam_filiere_id=slot.exam_filiere_id,
            filiere_name=filiere.name_fr,
            supervisor_1_id=ra.supervisor_1_id,
            supervisor_2_id=ra.supervisor_2_id,
            status=ra.status,
            is_validated=ra.is_validated,
        )
        for ra, rsa, slot, room, filiere in rows
    ]


def update_room_assignment(db: Session, ra_id: int, data: schemas.RoomAssignmentUpdate) -> models.RoomAssignment | None:
    obj = db.query(models.RoomAssignment).filter_by(id=ra_id).first()
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    if data.supervisor_1_id or data.supervisor_2_id:
        obj.status = models.AssignmentStatusEnum.OVERRIDDEN
    db.commit()
    db.refresh(obj)
    return obj


# ── Teacher schedule ───────────────────────────────────────────────────────

def get_teacher_schedule(db: Session, exam_id: int) -> schemas.TeacherScheduleOut:
    from app.modules.scheduling.models import ExamSlot, ExamFiliere, RoomSlotAssignment
    from app.modules.center.models import Filiere, Room

    # Active slots ordered chronologically
    slots: list[ExamSlot] = (
        db.query(ExamSlot)
        .filter(ExamSlot.exam_id == exam_id, ExamSlot.is_active == True)
        .order_by(ExamSlot.day, ExamSlot.shift, ExamSlot.slot_order)
        .all()
    )

    # Filiere names for slots
    filiere_by_ef: dict[int, str] = {}
    for ef, fil in (
        db.query(ExamFiliere, Filiere)
        .join(Filiere, ExamFiliere.filiere_id == Filiere.id)
        .filter(ExamFiliere.exam_id == exam_id)
        .all()
    ):
        filiere_by_ef[ef.id] = fil.name_fr

    # Enrolled teachers ordered by ordinal then name
    teachers = (
        db.query(models.Teacher)
        .join(models.ExamTeacher, models.Teacher.id == models.ExamTeacher.teacher_id)
        .filter(models.ExamTeacher.exam_id == exam_id)
        .order_by(models.Teacher.ordinal, models.Teacher.name_fr)
        .all()
    )

    # Build lookup maps: slot_id → teacher_id → role/room
    # supervisors: slot_id → {teacher_id: room_name}
    supervisor_map: dict[int, dict[int, str]] = {}
    for ra, rsa, room in (
        db.query(models.RoomAssignment, RoomSlotAssignment, Room)
        .join(RoomSlotAssignment, models.RoomAssignment.room_slot_assignment_id == RoomSlotAssignment.id)
        .join(Room, RoomSlotAssignment.room_id == Room.id)
        .filter(RoomSlotAssignment.exam_slot_id.in_([s.id for s in slots]))
        .all()
    ):
        slot_id = rsa.exam_slot_id
        supervisor_map.setdefault(slot_id, {})
        if ra.supervisor_1_id:
            supervisor_map[slot_id][ra.supervisor_1_id] = room.name
        if ra.supervisor_2_id:
            supervisor_map[slot_id][ra.supervisor_2_id] = room.name

    slot_by_id = {s.id: s for s in slots}

    # reserves: teacher_id → concrete session keys
    reserve_session_map: dict[int, set[tuple[int, str, int]]] = {}
    for res in db.query(models.ReserveAssignment).filter(
        models.ReserveAssignment.exam_slot_id.in_([s.id for s in slots])
    ).all():
        slot = slot_by_id.get(res.exam_slot_id)
        if slot:
            reserve_session_map.setdefault(res.teacher_id, set()).add(
                (slot.day, slot.shift.value, slot.slot_order)
            )

    # madaoum: teacher_id → session-subject keys
    madaoum_session_subject_map: dict[int, set[tuple[int, str, int, int]]] = {}
    for mad in db.query(models.MadaoumeAssignment).filter(
        models.MadaoumeAssignment.exam_slot_id.in_([s.id for s in slots])
    ).all():
        slot = slot_by_id.get(mad.exam_slot_id)
        if slot:
            madaoum_session_subject_map.setdefault(mad.teacher_id, set()).add(
                (slot.day, slot.shift.value, slot.slot_order, slot.subject_id)
            )

    rows: list[schemas.TeacherScheduleRow] = []
    for t in teachers:
        cells: list[schemas.TeacherSlotCell] = []
        total_sup = total_res = total_mad = 0
        counted_reserve_sessions: set[tuple[int, str, int]] = set()
        counted_madaoum_subjects: set[tuple[int, str, int, int]] = set()
        for slot in slots:
            sid = slot.id
            session_key = (slot.day, slot.shift.value, slot.slot_order)
            session_subject_key = (*session_key, slot.subject_id)
            if t.id in supervisor_map.get(sid, {}):
                role = "SUPERVISOR"
                room_name = supervisor_map[sid][t.id]
                total_sup += 1
            elif session_key in reserve_session_map.get(t.id, set()):
                role = "RESERVE"
                room_name = None
                if session_key not in counted_reserve_sessions:
                    total_res += 1
                    counted_reserve_sessions.add(session_key)
            elif session_subject_key in madaoum_session_subject_map.get(t.id, set()):
                role = "MADAOUM"
                room_name = None
                if session_subject_key not in counted_madaoum_subjects:
                    total_mad += 1
                    counted_madaoum_subjects.add(session_subject_key)
            else:
                role = None
                room_name = None
            cells.append(schemas.TeacherSlotCell(
                slot_id=sid,
                day=slot.day,
                shift=slot.shift.value,
                slot_order=slot.slot_order,
                filiere_name=filiere_by_ef.get(slot.exam_filiere_id, "?"),
                role=role,
                room_name=room_name,
            ))
        rows.append(schemas.TeacherScheduleRow(
            teacher_id=t.id,
            name_fr=t.name_fr,
            gender=t.gender,
            school=t.school,
            ordinal=t.ordinal,
            cin=t.cin,
            cells=cells,
            total_supervisor=total_sup,
            total_reserve=total_res,
            total_madaoum=total_mad,
        ))

    return schemas.TeacherScheduleOut(teachers=rows)


# ── WorkloadLedger ─────────────────────────────────────────────────────────

def get_workload_ledger(db: Session, year: str) -> list[models.WorkloadLedger]:
    rebuild_workload_ledger(db, year)
    return db.query(models.WorkloadLedger).filter_by(year=year).order_by(models.WorkloadLedger.total_count.desc()).all()


def rebuild_workload_ledger(db: Session, year: str) -> None:
    """
    Rebuild annual workload from the current assignment tables.
    This is the source of truth repair path when exams or assignments changed
    outside the normal reset flow.
    """
    from app.modules.assignment.algorithm import _get_or_create_ledger, _increment_ledger

    db.query(models.WorkloadLedger).filter_by(year=year).delete(synchronize_session=False)
    db.flush()

    def add_activity(cin: str, shift: sm.ShiftEnum, level: sm.LevelEnum, role: str = "SUPERVISOR") -> None:
        _increment_ledger(_get_or_create_ledger(db, cin, year), shift, level, role=role)

    for supervisor_field in (models.RoomAssignment.supervisor_1_id, models.RoomAssignment.supervisor_2_id):
        rows = (
            db.query(models.Teacher.cin, sm.ExamSlot.shift, sm.Exam.level)
            .join(models.RoomAssignment, models.Teacher.id == supervisor_field)
            .join(sm.RoomSlotAssignment, models.RoomAssignment.room_slot_assignment_id == sm.RoomSlotAssignment.id)
            .join(sm.ExamSlot, sm.RoomSlotAssignment.exam_slot_id == sm.ExamSlot.id)
            .join(sm.Exam, sm.ExamSlot.exam_id == sm.Exam.id)
            .filter(sm.Exam.year == year)
            .all()
        )
        for cin, shift, level in rows:
            add_activity(cin, shift, level)

    reserve_rows = (
        db.query(models.Teacher.cin, sm.ExamSlot.shift, sm.Exam.level)
        .join(models.ReserveAssignment, models.Teacher.id == models.ReserveAssignment.teacher_id)
        .join(sm.ExamSlot, models.ReserveAssignment.exam_slot_id == sm.ExamSlot.id)
        .join(sm.Exam, sm.ExamSlot.exam_id == sm.Exam.id)
        .filter(sm.Exam.year == year)
        .all()
    )
    for cin, shift, level in reserve_rows:
        add_activity(cin, shift, level, role="RESERVE")

    madaoume_rows = (
        db.query(models.Teacher.cin, sm.ExamSlot.shift, sm.Exam.level)
        .join(models.MadaoumeAssignment, models.Teacher.id == models.MadaoumeAssignment.teacher_id)
        .join(sm.ExamSlot, models.MadaoumeAssignment.exam_slot_id == sm.ExamSlot.id)
        .join(sm.Exam, sm.ExamSlot.exam_id == sm.Exam.id)
        .filter(sm.Exam.year == year)
        .all()
    )
    for cin, shift, level in madaoume_rows:
        add_activity(cin, shift, level, role="MADAOUM")

    db.commit()


# ── Reset ──────────────────────────────────────────────────────────────────

def reset_assignments(db: Session, exam: sm.Exam) -> None:
    """
    Clear all assignment outputs for an exam and roll back the workload ledger.
    Mirrors the clearing block in algorithm.run_assignment().
    """
    from app.modules.assignment.algorithm import _get_or_create_ledger, _decrement_ledger

    year  = exam.year
    level = exam.level

    all_slot_ids = [s.id for s in db.query(sm.ExamSlot.id).filter_by(exam_id=exam.id)]
    if all_slot_ids:
        slot_shift_map = {
            row.id: row.shift
            for row in db.query(sm.ExamSlot.id, sm.ExamSlot.shift)
                         .filter(sm.ExamSlot.id.in_(all_slot_ids))
        }

        # Rollback madaoume ledger
        old_madaoume = db.query(models.MadaoumeAssignment).filter(
            models.MadaoumeAssignment.exam_slot_id.in_(all_slot_ids)
        ).all()
        if old_madaoume:
            ma_cin_map = {
                t.id: t.cin for t in db.query(models.Teacher).filter(
                    models.Teacher.id.in_({ma.teacher_id for ma in old_madaoume})
                )
            }
            for ma in old_madaoume:
                cin   = ma_cin_map.get(ma.teacher_id)
                shift = slot_shift_map.get(ma.exam_slot_id)
                if cin and shift:
                    _decrement_ledger(_get_or_create_ledger(db, cin, year), shift, level, role="MADAOUM")

        # Rollback reserve ledger
        old_reserves = db.query(models.ReserveAssignment).filter(
            models.ReserveAssignment.exam_slot_id.in_(all_slot_ids)
        ).all()
        if old_reserves:
            res_cin_map = {
                t.id: t.cin for t in db.query(models.Teacher).filter(
                    models.Teacher.id.in_({ra.teacher_id for ra in old_reserves})
                )
            }
            for ra in old_reserves:
                cin   = res_cin_map.get(ra.teacher_id)
                shift = slot_shift_map.get(ra.exam_slot_id)
                if cin and shift:
                    _decrement_ledger(_get_or_create_ledger(db, cin, year), shift, level, role="RESERVE")

        # Rollback room supervisor ledger
        old_rsa_ids = [
            r.id for r in db.query(sm.RoomSlotAssignment.id).filter(
                sm.RoomSlotAssignment.exam_slot_id.in_(all_slot_ids)
            )
        ]
        if old_rsa_ids:
            rsa_slot_map = {
                row.id: row.exam_slot_id
                for row in db.query(sm.RoomSlotAssignment.id, sm.RoomSlotAssignment.exam_slot_id)
                             .filter(sm.RoomSlotAssignment.id.in_(old_rsa_ids))
            }
            old_ras = db.query(models.RoomAssignment).filter(
                models.RoomAssignment.room_slot_assignment_id.in_(old_rsa_ids)
            ).all()
            if old_ras:
                all_sup_ids = {
                    sid for ra in old_ras
                    for sid in (ra.supervisor_1_id, ra.supervisor_2_id) if sid
                }
                sup_cin_map = {
                    t.id: t.cin for t in db.query(models.Teacher).filter(
                        models.Teacher.id.in_(all_sup_ids)
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
            db.query(models.RoomAssignment).filter(
                models.RoomAssignment.room_slot_assignment_id.in_(old_rsa_ids)
            ).delete(synchronize_session=False)
            db.query(sm.RoomSlotAssignment).filter(
                sm.RoomSlotAssignment.id.in_(old_rsa_ids)
            ).delete(synchronize_session=False)

        db.query(models.ReserveAssignment).filter(
            models.ReserveAssignment.exam_slot_id.in_(all_slot_ids)
        ).delete(synchronize_session=False)
        db.query(models.MadaoumeAssignment).filter(
            models.MadaoumeAssignment.exam_slot_id.in_(all_slot_ids)
        ).delete(synchronize_session=False)

    db.query(models.DuoHistory).filter_by(exam_id=exam.id).delete(synchronize_session=False)
    db.flush()
    db.commit()
