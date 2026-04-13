from pydantic import BaseModel

from app.modules.assignment.models import AssignmentStatusEnum, ExemptionTypeEnum, GenderEnum


# ── Teacher ────────────────────────────────────────────────────────────────

class TeacherCreate(BaseModel):
    name_fr:    str
    name_ar:    str = ""
    gender:     GenderEnum
    cin:        str
    som:        str | None = None
    school:     str | None = None
    subject_id: int | None = None
    ordinal:    int | None = None

class TeacherUpdate(BaseModel):
    name_fr:    str | None = None
    name_ar:    str | None = None
    gender:     GenderEnum | None = None
    som:        str | None = None
    school:     str | None = None
    subject_id: int | None = None
    ordinal:    int | None = None

class TeacherOut(BaseModel):
    id:         int
    name_fr:    str
    name_ar:    str
    gender:     GenderEnum
    cin:        str
    som:        str | None
    school:     str | None
    subject_id: int | None
    ordinal:    int | None
    model_config = {"from_attributes": True}


# ── ExamTeacher ────────────────────────────────────────────────────────────

class ExamTeacherCreate(BaseModel):
    teacher_id: int

class ExamTeacherOut(BaseModel):
    id:         int
    exam_id:    int
    teacher_id: int
    model_config = {"from_attributes": True}


# ── TeacherExemption ───────────────────────────────────────────────────────

class ExemptionCreate(BaseModel):
    teacher_id:     int
    exam_id:        int
    exemption_type: ExemptionTypeEnum
    ref_value:      str

class ExemptionOut(BaseModel):
    id:             int
    teacher_id:     int
    exam_id:        int
    exemption_type: ExemptionTypeEnum
    ref_value:      str
    model_config = {"from_attributes": True}


# ── Assignments (output) ───────────────────────────────────────────────────

class RoomAssignmentOut(BaseModel):
    id:                      int
    room_slot_assignment_id: int
    supervisor_1_id:         int
    supervisor_2_id:         int
    status:                  AssignmentStatusEnum
    is_validated:            bool
    model_config = {"from_attributes": True}


class RoomAssignmentRich(BaseModel):
    """Enriched view joining through RSA → ExamSlot → ExamFiliere → Filiere + Room."""
    id:                      int
    room_slot_assignment_id: int
    room_id:                 int
    room_name:               str
    exam_slot_id:            int
    day:                     int
    shift:                   str        # "MORNING" | "AFTERNOON"
    slot_order:              int        # 1 or 2
    exam_filiere_id:         int
    filiere_name:            str
    supervisor_1_id:         int | None
    supervisor_2_id:         int | None
    status:                  AssignmentStatusEnum
    is_validated:            bool
    model_config = {"from_attributes": False}

class RoomAssignmentUpdate(BaseModel):
    supervisor_1_id: int | None = None
    supervisor_2_id: int | None = None
    is_validated:    bool | None = None

class MadaoumeAssignmentOut(BaseModel):
    id:           int
    exam_slot_id: int
    teacher_id:   int
    model_config = {"from_attributes": True}

class ReserveAssignmentOut(BaseModel):
    id:           int
    exam_slot_id: int
    teacher_id:   int
    order:        int
    model_config = {"from_attributes": True}


# ── Teacher schedule (per-teacher distribution view) ───────────────────────

class TeacherSlotCell(BaseModel):
    slot_id:      int
    day:          int
    shift:        str        # "MORNING" | "AFTERNOON"
    slot_order:   int
    filiere_name: str
    role:         str | None  # "SUPERVISOR" | "RESERVE" | "MADAOUM" | None
    room_name:    str | None  # only when role == SUPERVISOR
    model_config = {"from_attributes": False}

class TeacherScheduleRow(BaseModel):
    teacher_id:      int
    name_fr:         str
    ordinal:         int | None
    cin:             str
    cells:           list[TeacherSlotCell]
    total_supervisor: int
    total_reserve:   int
    total_madaoum:   int
    model_config = {"from_attributes": False}

class TeacherScheduleOut(BaseModel):
    teachers: list[TeacherScheduleRow]
    model_config = {"from_attributes": False}


# ── WorkloadLedger ─────────────────────────────────────────────────────────

class WorkloadLedgerOut(BaseModel):
    id:              int
    cin:             str
    year:            str
    total_count:     int
    bac1_count:      int
    bac2_count:      int
    morning_count:   int
    afternoon_count: int
    model_config = {"from_attributes": True}


# ── Algorithm result ───────────────────────────────────────────────────────

class WarningOut(BaseModel):
    type:    str
    code:    str
    message: str
    context: dict

class AssignmentResultOut(BaseModel):
    room_assignments:  list[RoomAssignmentOut]
    madaoume:          list[MadaoumeAssignmentOut]
    reserves:          list[ReserveAssignmentOut]
    warnings:          list[WarningOut]
    total_activities:  int
    fair_target_floor: int
    fair_target_ceil:  int
