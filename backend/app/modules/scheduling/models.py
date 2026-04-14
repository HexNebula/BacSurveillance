from enum import Enum as PyEnum

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class LevelEnum(str, PyEnum):
    BAC1             = "BAC1"
    BAC2_NORMALE     = "BAC2_NORMALE"
    BAC2_RATTRAPAGE  = "BAC2_RATTRAPAGE"


class ShiftEnum(str, PyEnum):
    MORNING   = "MORNING"
    AFTERNOON = "AFTERNOON"


class ExamStatusEnum(str, PyEnum):
    DRAFT     = "DRAFT"
    ACTIVE    = "ACTIVE"
    VALIDATED = "VALIDATED"


class CandidateTypeEnum(str, PyEnum):
    OFFICIEL = "OFFICIEL"
    LIBRE    = "LIBRE"


# ── Exam ───────────────────────────────────────────────────────────────────

class Exam(Base):
    """
    One exam period — e.g. '1Bac Session Mai 2025'.
    There are 3 per academic year: BAC1, BAC2_NORMALE, BAC2_RATTRAPAGE.
    """
    __tablename__ = "exams"

    id:                       Mapped[int]            = mapped_column(Integer, primary_key=True)
    year:                     Mapped[str]            = mapped_column(String(9), nullable=False)
    name_fr:                  Mapped[str]            = mapped_column(String(200), nullable=False)
    name_ar:                  Mapped[str]            = mapped_column(String(200), nullable=False)
    level:                    Mapped[LevelEnum]      = mapped_column(Enum(LevelEnum), nullable=False)
    start_date:               Mapped[Date]           = mapped_column(Date, nullable=False)
    end_date:                 Mapped[Date]           = mapped_column(Date, nullable=False)
    supervisor_arrival_delay: Mapped[int]            = mapped_column(Integer, default=30)
    student_arrival_delay:    Mapped[int]            = mapped_column(Integer, default=30)
    supervisors_per_room:     Mapped[int]            = mapped_column(Integer, default=2)
    max_reserves:             Mapped[int]            = mapped_column(Integer, default=4)
    status:                   Mapped[ExamStatusEnum] = mapped_column(Enum(ExamStatusEnum), default=ExamStatusEnum.DRAFT)

    exam_filieres: Mapped[list["ExamFiliere"]] = relationship(back_populates="exam", cascade="all, delete-orphan")
    exam_slots:    Mapped[list["ExamSlot"]]    = relationship(back_populates="exam", cascade="all, delete-orphan")


# ── ExamFiliere ────────────────────────────────────────────────────────────

class ExamFiliere(Base):
    """
    Enrolls a global Filiere into a specific Exam with a room_count.
    Replaces the old per-exam Niveau model.
    """
    __tablename__ = "exam_filieres"
    __table_args__ = (
        UniqueConstraint("exam_id", "filiere_id", name="uq_exam_filiere"),
    )

    id:         Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id:    Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    filiere_id: Mapped[int] = mapped_column(ForeignKey("filieres.id"), nullable=False)
    room_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    exam:          Mapped["Exam"]                  = relationship(back_populates="exam_filieres")
    filiere:       Mapped["Filiere"]               = relationship("Filiere")  # type: ignore[name-defined]
    exam_slots:    Mapped[list["ExamSlot"]]        = relationship(back_populates="exam_filiere")
    filiere_rooms: Mapped[list["ExamFiliereRoom"]] = relationship(back_populates="exam_filiere", cascade="all, delete-orphan")


# ── ExamSlot ───────────────────────────────────────────────────────────────

class ExamSlot(Base):
    """
    One subject examined for one exam_filiere on a given day/shift.
    slot_order (1|2) handles back-to-back séances within the same shift.
    """
    __tablename__ = "exam_slots"
    __table_args__ = (
        UniqueConstraint("exam_id", "exam_filiere_id", "day", "shift", "slot_order", name="uq_slot"),
    )

    id:               Mapped[int]        = mapped_column(Integer, primary_key=True)
    exam_id:          Mapped[int]        = mapped_column(ForeignKey("exams.id"), nullable=False)
    exam_filiere_id:  Mapped[int]        = mapped_column(ForeignKey("exam_filieres.id"), nullable=False)
    subject_id:       Mapped[int]        = mapped_column(ForeignKey("subjects.id"), nullable=False)
    day:              Mapped[int]        = mapped_column(Integer, nullable=False)
    shift:            Mapped[ShiftEnum]  = mapped_column(Enum(ShiftEnum), nullable=False)
    slot_order:       Mapped[int]        = mapped_column(Integer, default=1)   # 1 = S1, 2 = S2
    is_active:        Mapped[bool]       = mapped_column(Boolean, default=True)
    reserve_count:    Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_time:       Mapped[str | None] = mapped_column(String(5), nullable=True)   # "HH:MM"
    end_time:         Mapped[str | None] = mapped_column(String(5), nullable=True)   # "HH:MM"

    exam:          Mapped["Exam"]         = relationship(back_populates="exam_slots")
    exam_filiere:  Mapped["ExamFiliere"]  = relationship(back_populates="exam_slots")
    room_slot_assignments: Mapped[list["RoomSlotAssignment"]] = relationship(
        back_populates="exam_slot", cascade="all, delete-orphan"
    )


# ── RoomSlotAssignment ─────────────────────────────────────────────────────

# ── ExamFiliereRoom ────────────────────────────────────────────────────────

class ExamFiliereRoom(Base):
    """Assigns a physical room to an exam filière for the whole exam (all slots)."""
    __tablename__ = "exam_filiere_rooms"
    __table_args__ = (
        UniqueConstraint("exam_filiere_id", "room_id", name="uq_efr_filiere_room"),
    )

    id:                   Mapped[int]      = mapped_column(Integer, primary_key=True)
    exam_filiere_id:      Mapped[int]      = mapped_column(ForeignKey("exam_filieres.id", ondelete="CASCADE"), nullable=False)
    room_id:              Mapped[int]      = mapped_column(ForeignKey("rooms.id"), nullable=False)
    supervisors_override: Mapped[int|None] = mapped_column(Integer, nullable=True)

    exam_filiere: Mapped["ExamFiliere"] = relationship(back_populates="filiere_rooms")


# ── RoomSlotAssignment ─────────────────────────────────────────────────────

class RoomSlotAssignment(Base):
    """Assigns a physical room to an exam slot."""
    __tablename__ = "room_slot_assignments"

    id:                   Mapped[int]      = mapped_column(Integer, primary_key=True)
    exam_slot_id:         Mapped[int]      = mapped_column(ForeignKey("exam_slots.id"), nullable=False)
    room_id:              Mapped[int]      = mapped_column(ForeignKey("rooms.id"), nullable=False)
    supervisors_override: Mapped[int | None] = mapped_column(Integer, nullable=True)

    exam_slot: Mapped["ExamSlot"] = relationship(back_populates="room_slot_assignments")
