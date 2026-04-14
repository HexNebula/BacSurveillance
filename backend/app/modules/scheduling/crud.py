from sqlalchemy.orm import Session

from app.modules.scheduling import models, schemas
from app.modules.assignment import models as asgn_models


# ── Exam ───────────────────────────────────────────────────────────────────

def create_exam(db: Session, data: schemas.ExamCreate) -> models.Exam:
    obj = models.Exam(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_exams(db: Session) -> list[models.Exam]:
    return db.query(models.Exam).order_by(models.Exam.year, models.Exam.start_date).all()


def get_exam(db: Session, exam_id: int) -> models.Exam | None:
    return db.query(models.Exam).filter_by(id=exam_id).first()


def update_exam(db: Session, exam_id: int, data: schemas.ExamUpdate) -> models.Exam | None:
    obj = get_exam(db, exam_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_exam(db: Session, exam_id: int) -> bool:
    obj = get_exam(db, exam_id)
    if not obj:
        return False

    # Collect IDs needed for sub-table cleanup
    slot_ids = [s.id for s in db.query(models.ExamSlot.id).filter_by(exam_id=exam_id)]
    rsa_ids  = [
        r.id for r in
        db.query(models.RoomSlotAssignment.id).filter(
            models.RoomSlotAssignment.exam_slot_id.in_(slot_ids)
        )
    ] if slot_ids else []

    # Delete assignment-side rows that have no ORM cascade from Exam/ExamSlot
    if rsa_ids:
        db.query(asgn_models.RoomAssignment).filter(
            asgn_models.RoomAssignment.room_slot_assignment_id.in_(rsa_ids)
        ).delete(synchronize_session=False)
    if slot_ids:
        db.query(asgn_models.ReserveAssignment).filter(
            asgn_models.ReserveAssignment.exam_slot_id.in_(slot_ids)
        ).delete(synchronize_session=False)
        db.query(asgn_models.MadaoumeAssignment).filter(
            asgn_models.MadaoumeAssignment.exam_slot_id.in_(slot_ids)
        ).delete(synchronize_session=False)

    db.query(asgn_models.ExamTeacher).filter_by(exam_id=exam_id).delete()
    db.query(asgn_models.TeacherExemption).filter_by(exam_id=exam_id).delete()
    db.query(asgn_models.DuoHistory).filter_by(exam_id=exam_id).delete()

    db.delete(obj)
    db.commit()
    return True


# ── ExamFiliere ────────────────────────────────────────────────────────────

def create_exam_filiere(db: Session, data: schemas.ExamFiliereCreate) -> models.ExamFiliere:
    obj = models.ExamFiliere(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_exam_filieres(db: Session, exam_id: int) -> list[models.ExamFiliere]:
    return db.query(models.ExamFiliere).filter_by(exam_id=exam_id).all()


def get_exam_filiere(db: Session, ef_id: int) -> models.ExamFiliere | None:
    return db.query(models.ExamFiliere).filter_by(id=ef_id).first()


def update_exam_filiere(db: Session, ef_id: int, data: schemas.ExamFiliereUpdate) -> models.ExamFiliere | None:
    obj = get_exam_filiere(db, ef_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_exam_filiere(db: Session, ef_id: int) -> bool:
    obj = get_exam_filiere(db, ef_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── ExamSlot ───────────────────────────────────────────────────────────────

def create_exam_slot(db: Session, data: schemas.ExamSlotCreate) -> models.ExamSlot:
    obj = models.ExamSlot(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_exam_slots(db: Session, exam_id: int) -> list[models.ExamSlot]:
    return (
        db.query(models.ExamSlot)
        .filter_by(exam_id=exam_id)
        .order_by(models.ExamSlot.day, models.ExamSlot.shift, models.ExamSlot.slot_order)
        .all()
    )


def get_slots_by_exam_filiere(db: Session, exam_filiere_id: int) -> list[models.ExamSlot]:
    return (
        db.query(models.ExamSlot)
        .filter_by(exam_filiere_id=exam_filiere_id)
        .order_by(models.ExamSlot.day, models.ExamSlot.shift, models.ExamSlot.slot_order)
        .all()
    )


def get_exam_slot(db: Session, slot_id: int) -> models.ExamSlot | None:
    return db.query(models.ExamSlot).filter_by(id=slot_id).first()


def update_exam_slot(db: Session, slot_id: int, data: schemas.ExamSlotUpdate) -> models.ExamSlot | None:
    obj = get_exam_slot(db, slot_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_exam_slot(db: Session, slot_id: int) -> bool:
    obj = get_exam_slot(db, slot_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


def copy_slots_from(
    db: Session, target_ef: models.ExamFiliere, source_ef_id: int
) -> list[models.ExamSlot]:
    """
    Replace all slots of `target_ef` with a copy of every slot in `source_ef_id`.
    Returns the newly created slots.
    """
    source_slots = get_slots_by_exam_filiere(db, source_ef_id)

    # Delete all existing slots on the target filière
    db.query(models.ExamSlot).filter_by(exam_filiere_id=target_ef.id).delete()
    db.flush()

    new_slots: list[models.ExamSlot] = []
    for s in source_slots:
        slot = models.ExamSlot(
            exam_id=target_ef.exam_id,
            exam_filiere_id=target_ef.id,
            subject_id=s.subject_id,
            day=s.day,
            shift=s.shift,
            slot_order=s.slot_order,
            is_active=s.is_active,
            reserve_count=s.reserve_count,
            start_time=s.start_time,
            end_time=s.end_time,
        )
        db.add(slot)
        new_slots.append(slot)

    db.commit()
    for slot in new_slots:
        db.refresh(slot)
    return new_slots


# ── ExamFiliereRoom ────────────────────────────────────────────────────────

def get_filiere_rooms(db: Session, exam_filiere_id: int) -> list[models.ExamFiliereRoom]:
    return db.query(models.ExamFiliereRoom).filter_by(exam_filiere_id=exam_filiere_id).all()


def add_filiere_room(db: Session, exam_filiere_id: int, data: schemas.ExamFiliereRoomCreate) -> models.ExamFiliereRoom:
    obj = models.ExamFiliereRoom(exam_filiere_id=exam_filiere_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def remove_filiere_room(db: Session, efr_id: int) -> bool:
    obj = db.query(models.ExamFiliereRoom).filter_by(id=efr_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── RoomSlotAssignment ─────────────────────────────────────────────────────

def assign_room_to_slot(db: Session, data: schemas.RoomSlotAssignmentCreate) -> models.RoomSlotAssignment:
    obj = models.RoomSlotAssignment(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_room_slot_assignments(db: Session, exam_slot_id: int) -> list[models.RoomSlotAssignment]:
    return db.query(models.RoomSlotAssignment).filter_by(exam_slot_id=exam_slot_id).all()


def delete_room_slot_assignment(db: Session, rsa_id: int) -> bool:
    obj = db.query(models.RoomSlotAssignment).filter_by(id=rsa_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
