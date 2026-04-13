from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/documents", tags=["Documents"])


# Document generation routes — implemented after algorithm is validated on real data.
# See ARCHITECTURE.md section 12 (Build Order).

@router.get("/exams/{exam_id}/convocations")
def generate_convocations(exam_id: int, db: Session = Depends(get_db)):
    raise NotImplementedError("Document export — coming after algorithm validation")


@router.get("/exams/{exam_id}/room-sheet")
def generate_room_sheet(exam_id: int, db: Session = Depends(get_db)):
    raise NotImplementedError("Document export — coming after algorithm validation")
