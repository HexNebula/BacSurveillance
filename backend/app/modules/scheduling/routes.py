from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.scheduling import crud, schemas, models as sm

router = APIRouter(prefix="/scheduling", tags=["Scheduling"])


# ── Exams ──────────────────────────────────────────────────────────────────

@router.post("/exams", response_model=schemas.ExamOut, status_code=201)
def create_exam(data: schemas.ExamCreate, db: Session = Depends(get_db)):
    return crud.create_exam(db, data)


@router.get("/exams", response_model=list[schemas.ExamOut])
def list_exams(db: Session = Depends(get_db)):
    return crud.get_exams(db)


@router.get("/exams/{exam_id}", response_model=schemas.ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    obj = crud.get_exam(db, exam_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Exam not found")
    return obj


@router.patch("/exams/{exam_id}", response_model=schemas.ExamOut)
def update_exam(exam_id: int, data: schemas.ExamUpdate, db: Session = Depends(get_db)):
    obj = crud.update_exam(db, exam_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Exam not found")
    return obj


@router.delete("/exams/{exam_id}", status_code=204)
def delete_exam(exam_id: int, db: Session = Depends(get_db)):
    if not crud.delete_exam(db, exam_id):
        raise HTTPException(status_code=404, detail="Exam not found")


# ── ExamFilieres ───────────────────────────────────────────────────────────

@router.post("/exam-filieres", response_model=schemas.ExamFiliereOut, status_code=201)
def create_exam_filiere(data: schemas.ExamFiliereCreate, db: Session = Depends(get_db)):
    if db.query(sm.ExamFiliere).filter_by(exam_id=data.exam_id, filiere_id=data.filiere_id).first():
        raise HTTPException(status_code=409, detail="Cette filière est déjà inscrite à cet examen.")
    return crud.create_exam_filiere(db, data)


@router.get("/exams/{exam_id}/filieres", response_model=list[schemas.ExamFiliereOut])
def list_exam_filieres(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_exam_filieres(db, exam_id)


@router.patch("/exam-filieres/{ef_id}", response_model=schemas.ExamFiliereOut)
def update_exam_filiere(ef_id: int, data: schemas.ExamFiliereUpdate, db: Session = Depends(get_db)):
    obj = crud.update_exam_filiere(db, ef_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="ExamFiliere not found")
    return obj


@router.delete("/exam-filieres/{ef_id}", status_code=204)
def delete_exam_filiere(ef_id: int, db: Session = Depends(get_db)):
    if not crud.delete_exam_filiere(db, ef_id):
        raise HTTPException(status_code=404, detail="ExamFiliere not found")


# ── ExamSlots ──────────────────────────────────────────────────────────────

@router.post("/exam-slots", response_model=schemas.ExamSlotOut, status_code=201)
def create_exam_slot(data: schemas.ExamSlotCreate, db: Session = Depends(get_db)):
    return crud.create_exam_slot(db, data)


@router.get("/exams/{exam_id}/slots", response_model=list[schemas.ExamSlotOut])
def list_exam_slots(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_exam_slots(db, exam_id)


@router.get("/exam-filieres/{ef_id}/slots", response_model=list[schemas.ExamSlotOut])
def list_slots_by_exam_filiere(ef_id: int, db: Session = Depends(get_db)):
    return crud.get_slots_by_exam_filiere(db, ef_id)


@router.patch("/exam-slots/{slot_id}", response_model=schemas.ExamSlotOut)
def update_exam_slot(slot_id: int, data: schemas.ExamSlotUpdate, db: Session = Depends(get_db)):
    obj = crud.update_exam_slot(db, slot_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Slot not found")
    return obj


@router.delete("/exam-slots/{slot_id}", status_code=204)
def delete_exam_slot(slot_id: int, db: Session = Depends(get_db)):
    if not crud.delete_exam_slot(db, slot_id):
        raise HTTPException(status_code=404, detail="Slot not found")


@router.post("/exam-filieres/{ef_id}/copy-slots-from", response_model=list[schemas.ExamSlotOut])
def copy_slots_from(ef_id: int, data: schemas.CopySlotsFrom, db: Session = Depends(get_db)):
    target = crud.get_exam_filiere(db, ef_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target ExamFiliere not found")
    source = crud.get_exam_filiere(db, data.source_ef_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source ExamFiliere not found")
    if source.exam_id != target.exam_id:
        raise HTTPException(status_code=400, detail="Source and target must belong to the same exam")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="Source and target cannot be the same filière")
    return crud.copy_slots_from(db, target, data.source_ef_id)


# ── ExamFiliereRooms ───────────────────────────────────────────────────────

@router.get("/exams/{exam_id}/filiere-rooms", response_model=list[schemas.ExamFiliereRoomOut])
def list_all_exam_filiere_rooms(exam_id: int, db: Session = Depends(get_db)):
    """All room assignments across every filière of an exam."""
    ef_ids = [ef.id for ef in crud.get_exam_filieres(db, exam_id)]
    if not ef_ids:
        return []
    return db.query(sm.ExamFiliereRoom).filter(sm.ExamFiliereRoom.exam_filiere_id.in_(ef_ids)).all()


@router.get("/exam-filieres/{ef_id}/rooms", response_model=list[schemas.ExamFiliereRoomOut])
def list_filiere_rooms(ef_id: int, db: Session = Depends(get_db)):
    return crud.get_filiere_rooms(db, ef_id)


@router.post("/exam-filieres/{ef_id}/rooms", response_model=schemas.ExamFiliereRoomOut, status_code=201)
def add_filiere_room(ef_id: int, data: schemas.ExamFiliereRoomCreate, db: Session = Depends(get_db)):
    ef = crud.get_exam_filiere(db, ef_id)
    if not ef:
        raise HTTPException(status_code=404, detail="ExamFiliere not found")
    return crud.add_filiere_room(db, ef_id, data)


@router.delete("/exam-filiere-rooms/{efr_id}", status_code=204)
def remove_filiere_room(efr_id: int, db: Session = Depends(get_db)):
    if not crud.remove_filiere_room(db, efr_id):
        raise HTTPException(status_code=404, detail="Not found")


# ── RoomSlotAssignments ────────────────────────────────────────────────────

@router.post("/room-slot-assignments", response_model=schemas.RoomSlotAssignmentOut, status_code=201)
def assign_room_to_slot(data: schemas.RoomSlotAssignmentCreate, db: Session = Depends(get_db)):
    return crud.assign_room_to_slot(db, data)


@router.get("/exam-slots/{slot_id}/rooms", response_model=list[schemas.RoomSlotAssignmentOut])
def list_room_slot_assignments(slot_id: int, db: Session = Depends(get_db)):
    return crud.get_room_slot_assignments(db, slot_id)


@router.delete("/room-slot-assignments/{rsa_id}", status_code=204)
def delete_room_slot_assignment(rsa_id: int, db: Session = Depends(get_db)):
    if not crud.delete_room_slot_assignment(db, rsa_id):
        raise HTTPException(status_code=404, detail="Not found")
