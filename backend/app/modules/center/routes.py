from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.center import crud, schemas
from app.modules.center.models import FiliereSubject
from app.modules.assignment.models import Teacher
from app.modules.scheduling.models import ExamSlot

router = APIRouter(prefix="/center", tags=["Center"])


# ── Settings ───────────────────────────────────────────────────────────────

@router.get("/settings", response_model=schemas.CenterSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return crud.get_or_create_settings(db)


@router.patch("/settings", response_model=schemas.CenterSettingsOut)
def update_settings(data: schemas.CenterSettingsUpdate, db: Session = Depends(get_db)):
    return crud.update_settings(db, data)


# ── Rooms ──────────────────────────────────────────────────────────────────

@router.post("/rooms", response_model=schemas.RoomOut, status_code=201)
def create_room(data: schemas.RoomCreate, db: Session = Depends(get_db)):
    return crud.create_room(db, data)


@router.get("/rooms", response_model=list[schemas.RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    return crud.get_rooms(db)


@router.patch("/rooms/{room_id}", response_model=schemas.RoomOut)
def update_room(room_id: int, data: schemas.RoomUpdate, db: Session = Depends(get_db)):
    obj = crud.update_room(db, room_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Room not found")
    return obj


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    if not crud.delete_room(db, room_id):
        raise HTTPException(status_code=404, detail="Room not found")


# ── Subjects ───────────────────────────────────────────────────────────────

@router.post("/subjects", response_model=schemas.SubjectOut, status_code=201)
def create_subject(data: schemas.SubjectCreate, db: Session = Depends(get_db)):
    return crud.create_subject(db, data)


@router.get("/subjects", response_model=list[schemas.SubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    return crud.get_subjects(db)


@router.patch("/subjects/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(subject_id: int, data: schemas.SubjectUpdate, db: Session = Depends(get_db)):
    obj = crud.update_subject(db, subject_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    return obj


@router.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    if not crud.get_subject(db, subject_id):
        raise HTTPException(status_code=404, detail="Subject not found")
    # Pre-check all FK references and give a specific message
    if db.query(FiliereSubject).filter_by(subject_id=subject_id).first():
        raise HTTPException(status_code=409, detail="Cette matière est utilisée par une ou plusieurs filières.")
    if db.query(Teacher).filter_by(subject_id=subject_id).first():
        raise HTTPException(status_code=409, detail="Cette matière est la spécialité d'un ou plusieurs surveillants. Modifiez-les d'abord.")
    if db.query(ExamSlot).filter_by(subject_id=subject_id).first():
        raise HTTPException(status_code=409, detail="Cette matière est planifiée dans un ou plusieurs examens. Retirez-la du planning d'abord.")
    try:
        crud.delete_subject(db, subject_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cette matière est encore utilisée ailleurs.")


# ── Filieres ───────────────────────────────────────────────────────────────

@router.post("/filieres", response_model=schemas.FiliereOut, status_code=201)
def create_filiere(data: schemas.FiliereCreate, db: Session = Depends(get_db)):
    return crud.create_filiere(db, data)


@router.get("/filieres", response_model=list[schemas.FiliereOut])
def list_filieres(db: Session = Depends(get_db)):
    return crud.get_filieres(db)


@router.patch("/filieres/{filiere_id}", response_model=schemas.FiliereOut)
def update_filiere(filiere_id: int, data: schemas.FiliereUpdate, db: Session = Depends(get_db)):
    obj = crud.update_filiere(db, filiere_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Filière not found")
    return obj


@router.delete("/filieres/{filiere_id}", status_code=204)
def delete_filiere(filiere_id: int, db: Session = Depends(get_db)):
    if not crud.get_filiere(db, filiere_id):
        raise HTTPException(status_code=404, detail="Filière not found")
    try:
        crud.delete_filiere(db, filiere_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cette filière est utilisée par un ou plusieurs examens. Retirez-la des examens avant de la supprimer.",
        )


@router.post("/filieres/{filiere_id}/subjects", response_model=schemas.FiliereSubjectOut, status_code=201)
def add_filiere_subject(filiere_id: int, data: schemas.FiliereSubjectCreate, db: Session = Depends(get_db)):
    return crud.add_filiere_subject(db, filiere_id, data)


@router.delete("/filiere-subjects/{fs_id}", status_code=204)
def remove_filiere_subject(fs_id: int, db: Session = Depends(get_db)):
    if not crud.remove_filiere_subject(db, fs_id):
        raise HTTPException(status_code=404, detail="Not found")
