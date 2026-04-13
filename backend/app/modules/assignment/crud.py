from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.assignment import models, schemas


# ── Teacher ────────────────────────────────────────────────────────────────

def _next_ordinal(db: Session) -> int:
    """Return max(ordinal) + 1, or 1 if the table is empty."""
    max_ord = db.query(func.max(models.Teacher.ordinal)).scalar()
    return (max_ord or 0) + 1


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

    # reserves: slot_id → set of teacher_ids
    reserve_map: dict[int, set[int]] = {}
    for res in db.query(models.ReserveAssignment).filter(
        models.ReserveAssignment.exam_slot_id.in_([s.id for s in slots])
    ).all():
        reserve_map.setdefault(res.exam_slot_id, set()).add(res.teacher_id)

    # madaoum: slot_id → set of teacher_ids
    madaoum_map: dict[int, set[int]] = {}
    for mad in db.query(models.MadaoumeAssignment).filter(
        models.MadaoumeAssignment.exam_slot_id.in_([s.id for s in slots])
    ).all():
        madaoum_map.setdefault(mad.exam_slot_id, set()).add(mad.teacher_id)

    rows: list[schemas.TeacherScheduleRow] = []
    for t in teachers:
        cells: list[schemas.TeacherSlotCell] = []
        total_sup = total_res = total_mad = 0
        for slot in slots:
            sid = slot.id
            if t.id in supervisor_map.get(sid, {}):
                role = "SUPERVISOR"
                room_name = supervisor_map[sid][t.id]
                total_sup += 1
            elif t.id in reserve_map.get(sid, set()):
                role = "RESERVE"
                room_name = None
                total_res += 1
            elif t.id in madaoum_map.get(sid, set()):
                role = "MADAOUM"
                room_name = None
                total_mad += 1
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
    return db.query(models.WorkloadLedger).filter_by(year=year).order_by(models.WorkloadLedger.total_count.desc()).all()
