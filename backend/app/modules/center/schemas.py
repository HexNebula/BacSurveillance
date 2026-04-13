from pydantic import BaseModel


# ── CenterSettings ─────────────────────────────────────────────────────────

class CenterSettingsUpdate(BaseModel):
    name_fr:              str | None = None
    name_ar:              str | None = None
    convocation_template: str | None = None
    supervisors_per_room: int | None = None

class CenterSettingsOut(BaseModel):
    id:                   int
    name_fr:              str
    name_ar:              str
    convocation_template: str
    supervisors_per_room: int
    model_config = {"from_attributes": True}


# ── Room ───────────────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name:     str
    capacity: int = 30

class RoomUpdate(BaseModel):
    name:     str | None = None
    capacity: int | None = None

class RoomOut(BaseModel):
    id:       int
    name:     str
    capacity: int
    model_config = {"from_attributes": True}


# ── Subject ────────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name_fr: str
    name_ar: str = ""

class SubjectUpdate(BaseModel):
    name_fr: str | None = None
    name_ar: str | None = None

class SubjectOut(BaseModel):
    id:      int
    name_fr: str
    name_ar: str
    model_config = {"from_attributes": True}


# ── Filiere ────────────────────────────────────────────────────────────────

class FiliereSubjectCreate(BaseModel):
    subject_id: int
    order:      int = 0

class FiliereSubjectOut(BaseModel):
    id:         int
    filiere_id: int
    subject_id: int
    order:      int
    model_config = {"from_attributes": True}

class FiliereCreate(BaseModel):
    name_fr:        str
    name_ar:        str = ""
    candidate_type: str = "OFFICIEL"

class FiliereUpdate(BaseModel):
    name_fr:        str | None = None
    name_ar:        str | None = None
    candidate_type: str | None = None

class FiliereOut(BaseModel):
    id:               int
    name_fr:          str
    name_ar:          str
    candidate_type:   str
    filiere_subjects: list[FiliereSubjectOut] = []
    model_config = {"from_attributes": True}
