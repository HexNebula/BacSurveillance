from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CenterSettings(Base):
    """Singleton row (id=1). Stores establishment-level config."""
    __tablename__ = "center_settings"

    id:                    Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    name_fr:               Mapped[str] = mapped_column(String(200), nullable=False, default="")
    name_ar:               Mapped[str] = mapped_column(String(200), nullable=False, default="")
    convocation_template:  Mapped[str] = mapped_column(Text, nullable=False, default="")
    supervisors_per_room:  Mapped[int] = mapped_column(Integer, default=2)


class Room(Base):
    """Physical rooms in the establishment. Defined once, reused across exam periods."""
    __tablename__ = "rooms"

    id:       Mapped[int] = mapped_column(Integer, primary_key=True)
    name:     Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, default=30)


class Subject(Base):
    """Global subject list. Shared across all exam periods."""
    __tablename__ = "subjects"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    name_fr: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ar: Mapped[str] = mapped_column(String(100), nullable=False)


class Filiere(Base):
    """
    Global filière catalog (e.g. Sciences Maths, Lettres).
    Defined once; enrolled into exams via ExamFiliere (in scheduling.models).
    level: 'BAC1' | 'BAC2' | None (null = applies to any level)
    """
    __tablename__ = "filieres"

    id:             Mapped[int] = mapped_column(Integer, primary_key=True)
    name_fr:        Mapped[str] = mapped_column(String(100), nullable=False)
    name_ar:        Mapped[str] = mapped_column(String(100), nullable=False, default="")
    candidate_type: Mapped[str] = mapped_column(String(20), nullable=False, default="OFFICIEL")
    level:          Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)

    filiere_subjects: Mapped[list["FiliereSubject"]] = relationship(
        back_populates="filiere", cascade="all, delete-orphan", order_by="FiliereSubject.order"
    )


class FiliereSubject(Base):
    """Ordered list of subjects for a given Filiere."""
    __tablename__ = "filiere_subjects"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True)
    filiere_id: Mapped[int] = mapped_column(ForeignKey("filieres.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    order:      Mapped[int] = mapped_column(Integer, default=0)

    filiere: Mapped["Filiere"] = relationship(back_populates="filiere_subjects")
