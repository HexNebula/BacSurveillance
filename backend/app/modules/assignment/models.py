from enum import Enum as PyEnum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class GenderEnum(str, PyEnum):
    M = "M"
    F = "F"


class AssignmentStatusEnum(str, PyEnum):
    AUTO       = "AUTO"
    OVERRIDDEN = "OVERRIDDEN"


class ExemptionTypeEnum(str, PyEnum):
    SLOT  = "SLOT"   # ref_value = exam_slot_id (as string)
    SHIFT = "SHIFT"  # ref_value = "MORNING" | "AFTERNOON"
    DAY   = "DAY"    # ref_value = day ordinal (as string)


# ── Teacher ────────────────────────────────────────────────────────────────

class Teacher(Base):
    """
    Global supervisor pool. Not tied to any specific exam.
    Enrolled into exams via ExamTeacher junction table.
    CIN is unique globally.
    """
    __tablename__ = "teachers"

    id:         Mapped[int]             = mapped_column(Integer, primary_key=True)
    name_fr:    Mapped[str]             = mapped_column(String(100), nullable=False)
    name_ar:    Mapped[str]             = mapped_column(String(100), nullable=False, default="")
    gender:     Mapped[GenderEnum]      = mapped_column(Enum(GenderEnum), nullable=False)
    cin:        Mapped[str]             = mapped_column(String(20), nullable=False, unique=True)
    som:        Mapped[str | None]      = mapped_column(String(50), nullable=True)
    school:     Mapped[str | None]      = mapped_column(String(150), nullable=True)
    subject_id: Mapped[int | None]      = mapped_column(ForeignKey("subjects.id"), nullable=True)
    ordinal:    Mapped[int | None]      = mapped_column(Integer, nullable=True)

    exam_enrollments: Mapped[list["ExamTeacher"]]      = relationship(back_populates="teacher", cascade="all, delete-orphan")
    exemptions:       Mapped[list["TeacherExemption"]] = relationship(back_populates="teacher", cascade="all, delete-orphan")


# ── ExamTeacher ────────────────────────────────────────────────────────────

class ExamTeacher(Base):
    """
    Enrolls a global Teacher into a specific Exam.
    The distribution algorithm uses this to know which teachers participate.
    """
    __tablename__ = "exam_teachers"
    __table_args__ = (
        UniqueConstraint("exam_id", "teacher_id", name="uq_exam_teacher"),
    )

    id:         Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id:    Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False)

    teacher: Mapped["Teacher"] = relationship(back_populates="exam_enrollments")


# ── TeacherExemption ───────────────────────────────────────────────────────

class TeacherExemption(Base):
    """
    Exempts a teacher from supervision for a specific slot, shift, or day within an exam.
    """
    __tablename__ = "teacher_exemptions"

    id:              Mapped[int]               = mapped_column(Integer, primary_key=True)
    teacher_id:      Mapped[int]               = mapped_column(ForeignKey("teachers.id"), nullable=False)
    exam_id:         Mapped[int]               = mapped_column(ForeignKey("exams.id"), nullable=False)
    exemption_type:  Mapped[ExemptionTypeEnum] = mapped_column(Enum(ExemptionTypeEnum), nullable=False)
    ref_value:       Mapped[str]               = mapped_column(String(50), nullable=False)

    teacher: Mapped["Teacher"] = relationship(back_populates="exemptions")


# ── Assignment outputs ─────────────────────────────────────────────────────

class RoomAssignment(Base):
    """Two supervisors assigned to a physical room for one exam slot."""
    __tablename__ = "room_assignments"

    id:                      Mapped[int]                   = mapped_column(Integer, primary_key=True)
    room_slot_assignment_id: Mapped[int]                   = mapped_column(ForeignKey("room_slot_assignments.id"), nullable=False)
    supervisor_1_id:         Mapped[int]                   = mapped_column(ForeignKey("teachers.id"), nullable=False)
    supervisor_2_id:         Mapped[int]                   = mapped_column(ForeignKey("teachers.id"), nullable=False)
    status:                  Mapped[AssignmentStatusEnum]  = mapped_column(Enum(AssignmentStatusEnum), default=AssignmentStatusEnum.AUTO)
    is_validated:            Mapped[bool]                  = mapped_column(Boolean, default=False)

    supervisor_1: Mapped["Teacher"] = relationship(foreign_keys=[supervisor_1_id])
    supervisor_2: Mapped["Teacher"] = relationship(foreign_keys=[supervisor_2_id])


class MadaoumeAssignment(Base):
    """One المداوم per exam slot — chosen from subject teachers."""
    __tablename__ = "madaoume_assignments"

    id:           Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_slot_id: Mapped[int] = mapped_column(ForeignKey("exam_slots.id"), nullable=False)
    teacher_id:   Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False)


class ReserveAssignment(Base):
    """Reserve teachers for an exam slot."""
    __tablename__ = "reserve_assignments"

    id:           Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_slot_id: Mapped[int] = mapped_column(ForeignKey("exam_slots.id"), nullable=False)
    teacher_id:   Mapped[int] = mapped_column(ForeignKey("teachers.id"), nullable=False)
    order:        Mapped[int] = mapped_column(Integer, default=0)


# ── WorkloadLedger ─────────────────────────────────────────────────────────

class WorkloadLedger(Base):
    """
    Tracks supervision activity count per teacher per academic year.
    Keyed by (cin, year) so fairness spans all 3 exam periods within a year.
    """
    __tablename__ = "workload_ledger"
    __table_args__ = (
        UniqueConstraint("cin", "year", name="uq_ledger_cin_year"),
    )

    id:              Mapped[int] = mapped_column(Integer, primary_key=True)
    cin:             Mapped[str] = mapped_column(String(20), nullable=False)
    year:            Mapped[str] = mapped_column(String(9), nullable=False)
    total_count:     Mapped[int] = mapped_column(Integer, default=0)
    bac1_count:      Mapped[int] = mapped_column(Integer, default=0)
    bac2_count:      Mapped[int] = mapped_column(Integer, default=0)
    morning_count:   Mapped[int] = mapped_column(Integer, default=0)
    afternoon_count: Mapped[int] = mapped_column(Integer, default=0)


# ── DuoHistory ─────────────────────────────────────────────────────────────

class DuoHistory(Base):
    """Records teacher pairs assigned together to avoid repeats."""
    __tablename__ = "duo_history"

    id:           Mapped[int]        = mapped_column(Integer, primary_key=True)
    exam_id:      Mapped[int]        = mapped_column(ForeignKey("exams.id"), nullable=False)
    teacher_a_id: Mapped[int]        = mapped_column(ForeignKey("teachers.id"), nullable=False)
    teacher_b_id: Mapped[int]        = mapped_column(ForeignKey("teachers.id"), nullable=False)
    room_id:      Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    occurrences:  Mapped[int]        = mapped_column(Integer, default=1)
