from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.assignment import crud, schemas
from app.modules.assignment.algorithm import run_assignment
from app.modules.scheduling.crud import get_exam
from app.modules.scheduling import models as sm
from app.modules.scheduling.models import ExamStatusEnum, LevelEnum

router = APIRouter(prefix="/assignment", tags=["Assignment"])


# ── Teachers (global) ──────────────────────────────────────────────────────

@router.get("/teachers", response_model=list[schemas.TeacherOut])
def list_all_teachers(db: Session = Depends(get_db)):
    return crud.get_all_teachers(db)


@router.post("/teachers", response_model=schemas.TeacherOut, status_code=201)
def create_teacher(data: schemas.TeacherCreate, db: Session = Depends(get_db)):
    return crud.create_teacher(db, data)


@router.post("/teachers/bulk", response_model=list[schemas.TeacherOut], status_code=201)
def bulk_create_teachers(teachers: list[schemas.TeacherCreate], db: Session = Depends(get_db)):
    return crud.bulk_create_teachers(db, teachers)


@router.patch("/teachers/{teacher_id}", response_model=schemas.TeacherOut)
def update_teacher(teacher_id: int, data: schemas.TeacherUpdate, db: Session = Depends(get_db)):
    obj = crud.update_teacher(db, teacher_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return obj


@router.delete("/teachers/{teacher_id}", status_code=204)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    if not crud.get_teacher(db, teacher_id):
        raise HTTPException(status_code=404, detail="Teacher not found")
    try:
        crud.delete_teacher(db, teacher_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ce surveillant est inscrit à un ou plusieurs examens. Retirez-le des examens avant de le supprimer.",
        )


# ── ExamTeacher enrollment ─────────────────────────────────────────────────

@router.get("/exams/{exam_id}/teachers", response_model=list[schemas.TeacherOut])
def list_exam_teachers(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_teachers_for_exam(db, exam_id)


@router.post("/exams/{exam_id}/teachers", response_model=schemas.ExamTeacherOut, status_code=201)
def enroll_teacher(exam_id: int, data: schemas.ExamTeacherCreate, db: Session = Depends(get_db)):
    return crud.enroll_teacher(db, exam_id, data)


@router.delete("/exam-teachers/{et_id}", status_code=204)
def remove_exam_teacher(et_id: int, db: Session = Depends(get_db)):
    if not crud.remove_exam_teacher(db, et_id):
        raise HTTPException(status_code=404, detail="Enrollment not found")


@router.delete("/exams/{exam_id}/teachers/{teacher_id}", status_code=204)
def remove_exam_teacher_by_teacher(exam_id: int, teacher_id: int, db: Session = Depends(get_db)):
    if not crud.remove_exam_teacher_by_teacher_id(db, exam_id, teacher_id):
        raise HTTPException(status_code=404, detail="Enrollment not found")


# ── Exemptions ─────────────────────────────────────────────────────────────

@router.post("/exemptions", response_model=schemas.ExemptionOut, status_code=201)
def create_exemption(data: schemas.ExemptionCreate, db: Session = Depends(get_db)):
    return crud.create_exemption(db, data)


@router.get("/exams/{exam_id}/exemptions", response_model=list[schemas.ExemptionOut])
def list_exemptions(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_exemptions(db, exam_id)


@router.get("/teachers/{teacher_id}/exemptions", response_model=list[schemas.ExemptionOut])
def list_teacher_exemptions(teacher_id: int, db: Session = Depends(get_db)):
    return crud.get_teacher_exemptions(db, teacher_id)


@router.delete("/exemptions/{exemption_id}", status_code=204)
def delete_exemption(exemption_id: int, db: Session = Depends(get_db)):
    if not crud.delete_exemption(db, exemption_id):
        raise HTTPException(status_code=404, detail="Exemption not found")


# ── Algorithm ──────────────────────────────────────────────────────────────

@router.post("/exams/{exam_id}/run", response_model=schemas.AssignmentResultOut)
def run(exam_id: int, db: Session = Depends(get_db)):
    exam = get_exam(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # ── Prerequisite gate ─────────────────────────────────────────────────
    if exam.level == LevelEnum.BAC2_NORMALE:
        prereq = db.query(sm.Exam).filter_by(year=exam.year, level=LevelEnum.BAC1).first()
        if not prereq or prereq.status == ExamStatusEnum.DRAFT:
            raise HTTPException(
                status_code=422,
                detail=f"Distribuez d'abord l'examen 1BAC {exam.year} avant de lancer celui-ci.",
            )

    result = run_assignment(db, exam)

    # ── Mark exam as active after successful run ───────────────────────────
    if exam.status == ExamStatusEnum.DRAFT:
        exam.status = ExamStatusEnum.ACTIVE
        db.commit()

    return schemas.AssignmentResultOut(
        room_assignments=[schemas.RoomAssignmentOut.model_validate(r) for r in result.room_assignments],
        madaoume=[schemas.MadaoumeAssignmentOut.model_validate(m) for m in result.madaoume],
        reserves=[schemas.ReserveAssignmentOut.model_validate(r) for r in result.reserves],
        warnings=[schemas.WarningOut(**w.__dict__) for w in result.warnings],
        total_activities=result.total_activities,
        fair_target_floor=result.fair_target_floor,
        fair_target_ceil=result.fair_target_ceil,
    )


# ── Room Assignments (review + override) ───────────────────────────────────

@router.get("/exams/{exam_id}/room-assignments", response_model=list[schemas.RoomAssignmentRich])
def list_room_assignments(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_room_assignments_rich(db, exam_id)


@router.get("/exams/{exam_id}/teacher-schedule", response_model=schemas.TeacherScheduleOut)
def get_teacher_schedule(exam_id: int, db: Session = Depends(get_db)):
    return crud.get_teacher_schedule(db, exam_id)


@router.patch("/room-assignments/{ra_id}", response_model=schemas.RoomAssignmentOut)
def update_room_assignment(ra_id: int, data: schemas.RoomAssignmentUpdate, db: Session = Depends(get_db)):
    obj = crud.update_room_assignment(db, ra_id, data)
    if not obj:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return obj


# ── WorkloadLedger ─────────────────────────────────────────────────────────

@router.get("/workload/{year}", response_model=list[schemas.WorkloadLedgerOut])
def get_workload(year: str, db: Session = Depends(get_db)):
    return crud.get_workload_ledger(db, year)
