from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.center import models, schemas


# ── CenterSettings (singleton) ─────────────────────────────────────────────

def get_or_create_settings(db: Session) -> models.CenterSettings:
    obj = db.query(models.CenterSettings).first()
    if not obj:
        obj = models.CenterSettings(id=1)
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def update_settings(db: Session, data: schemas.CenterSettingsUpdate) -> models.CenterSettings:
    obj = get_or_create_settings(db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


# ── Room ───────────────────────────────────────────────────────────────────

def create_room(db: Session, data: schemas.RoomCreate) -> models.Room:
    obj = models.Room(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_rooms(db: Session) -> list[models.Room]:
    # Natural sort: length first so "Salle 2" < "Salle 10", then alphabetical
    return (
        db.query(models.Room)
        .order_by(func.length(models.Room.name), models.Room.name)
        .all()
    )


def get_room(db: Session, room_id: int) -> models.Room | None:
    return db.query(models.Room).filter_by(id=room_id).first()


def update_room(db: Session, room_id: int, data: schemas.RoomUpdate) -> models.Room | None:
    obj = get_room(db, room_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_room(db: Session, room_id: int) -> bool:
    obj = get_room(db, room_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── Subject ────────────────────────────────────────────────────────────────

def create_subject(db: Session, data: schemas.SubjectCreate) -> models.Subject:
    obj = models.Subject(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_subjects(db: Session) -> list[models.Subject]:
    return db.query(models.Subject).order_by(models.Subject.name_fr).all()


def get_subject(db: Session, subject_id: int) -> models.Subject | None:
    return db.query(models.Subject).filter_by(id=subject_id).first()


def update_subject(db: Session, subject_id: int, data: schemas.SubjectUpdate) -> models.Subject | None:
    obj = get_subject(db, subject_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_subject(db: Session, subject_id: int) -> bool:
    obj = get_subject(db, subject_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# ── Filiere ────────────────────────────────────────────────────────────────

def create_filiere(db: Session, data: schemas.FiliereCreate) -> models.Filiere:
    obj = models.Filiere(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_filieres(db: Session) -> list[models.Filiere]:
    return db.query(models.Filiere).order_by(models.Filiere.name_fr).all()


def get_filiere(db: Session, filiere_id: int) -> models.Filiere | None:
    return db.query(models.Filiere).filter_by(id=filiere_id).first()


def update_filiere(db: Session, filiere_id: int, data: schemas.FiliereUpdate) -> models.Filiere | None:
    obj = get_filiere(db, filiere_id)
    if not obj:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


def delete_filiere(db: Session, filiere_id: int) -> bool:
    obj = get_filiere(db, filiere_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


def add_filiere_subject(db: Session, filiere_id: int, data: schemas.FiliereSubjectCreate) -> models.FiliereSubject:
    obj = models.FiliereSubject(filiere_id=filiere_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def remove_filiere_subject(db: Session, fs_id: int) -> bool:
    obj = db.query(models.FiliereSubject).filter_by(id=fs_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True
