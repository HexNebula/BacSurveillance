from datetime import date
from pydantic import BaseModel

from app.modules.scheduling.models import ExamStatusEnum, LevelEnum, ShiftEnum


# ── Exam ───────────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    year:                     str
    name_fr:                  str
    name_ar:                  str = ""
    level:                    LevelEnum
    start_date:               date
    end_date:                 date
    supervisor_arrival_delay: int = 30
    student_arrival_delay:    int = 30
    supervisors_per_room:     int = 2
    max_reserves:             int = 4

class ExamUpdate(BaseModel):
    name_fr:                  str | None = None
    name_ar:                  str | None = None
    start_date:               date | None = None
    end_date:                 date | None = None
    supervisor_arrival_delay: int | None = None
    student_arrival_delay:    int | None = None
    supervisors_per_room:     int | None = None
    max_reserves:             int | None = None
    status:                   ExamStatusEnum | None = None

class ExamOut(BaseModel):
    id:                       int
    year:                     str
    name_fr:                  str
    name_ar:                  str
    level:                    LevelEnum
    start_date:               date
    end_date:                 date
    supervisor_arrival_delay: int
    student_arrival_delay:    int
    supervisors_per_room:     int
    max_reserves:             int
    status:                   ExamStatusEnum
    model_config = {"from_attributes": True}


# ── ExamFiliere ────────────────────────────────────────────────────────────

class ExamFiliereCreate(BaseModel):
    exam_id:    int
    filiere_id: int
    room_count: int = 1

class ExamFiliereUpdate(BaseModel):
    room_count: int | None = None

class ExamFiliereOut(BaseModel):
    id:         int
    exam_id:    int
    filiere_id: int
    room_count: int
    model_config = {"from_attributes": True}


# ── ExamSlot ───────────────────────────────────────────────────────────────

class ExamSlotCreate(BaseModel):
    exam_id:         int
    exam_filiere_id: int
    subject_id:      int
    day:             int
    shift:           ShiftEnum
    slot_order:      int = 1
    is_active:       bool = True
    reserve_count:   int | None = None

class ExamSlotUpdate(BaseModel):
    subject_id:    int | None = None
    day:           int | None = None
    shift:         ShiftEnum | None = None
    slot_order:    int | None = None
    is_active:     bool | None = None
    reserve_count: int | None = None

class ExamSlotOut(BaseModel):
    id:               int
    exam_id:          int
    exam_filiere_id:  int
    subject_id:       int
    day:              int
    shift:            ShiftEnum
    slot_order:       int
    is_active:        bool
    reserve_count:    int | None
    model_config = {"from_attributes": True}


# ── ExamFiliereRoom ────────────────────────────────────────────────────────

class ExamFiliereRoomCreate(BaseModel):
    room_id:              int
    supervisors_override: int | None = None

class ExamFiliereRoomOut(BaseModel):
    id:                   int
    exam_filiere_id:      int
    room_id:              int
    supervisors_override: int | None
    model_config = {"from_attributes": True}


# ── RoomSlotAssignment ─────────────────────────────────────────────────────

class RoomSlotAssignmentCreate(BaseModel):
    exam_slot_id:         int
    room_id:              int
    supervisors_override: int | None = None

class RoomSlotAssignmentOut(BaseModel):
    id:                   int
    exam_slot_id:         int
    room_id:              int
    supervisors_override: int | None
    model_config = {"from_attributes": True}
