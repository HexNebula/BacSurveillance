"""v2 global teachers and filieres

Revision ID: a1b2c3d4e5f6
Revises: 0b63504fb2a0
Create Date: 2026-04-13 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0b63504fb2a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Drop old tables (order matters for FK constraints) ─────────────────
    op.drop_table('duo_history')
    op.drop_table('reserve_assignments')
    op.drop_table('madaoume_assignments')
    op.drop_table('room_assignments')
    op.drop_table('teacher_exemptions')
    op.drop_table('room_slot_assignments')
    op.drop_table('exam_slots')
    op.drop_table('teachers')
    op.drop_table('niveau_subjects')
    op.drop_table('niveaux')

    # ── Create filieres (global catalog) ───────────────────────────────────
    op.create_table(
        'filieres',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name_fr', sa.String(100), nullable=False),
        sa.Column('name_ar', sa.String(100), nullable=False, server_default=''),
        sa.Column('candidate_type', sa.String(20), nullable=False, server_default='OFFICIEL'),
    )

    # ── Create filiere_subjects ────────────────────────────────────────────
    op.create_table(
        'filiere_subjects',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('filiere_id', sa.Integer(), sa.ForeignKey('filieres.id'), nullable=False),
        sa.Column('subject_id', sa.Integer(), sa.ForeignKey('subjects.id'), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
    )

    # ── Create exam_filieres (per-exam enrollment) ─────────────────────────
    op.create_table(
        'exam_filieres',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_id', sa.Integer(), sa.ForeignKey('exams.id'), nullable=False),
        sa.Column('filiere_id', sa.Integer(), sa.ForeignKey('filieres.id'), nullable=False),
        sa.Column('room_count', sa.Integer(), nullable=False, server_default='1'),
        sa.UniqueConstraint('exam_id', 'filiere_id', name='uq_exam_filiere'),
    )

    # ── Create teachers (global pool) ──────────────────────────────────────
    op.create_table(
        'teachers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name_fr', sa.String(100), nullable=False),
        sa.Column('name_ar', sa.String(100), nullable=False, server_default=''),
        sa.Column('gender', sa.Enum('M', 'F', name='genderenum', create_type=False), nullable=False),
        sa.Column('cin', sa.String(20), nullable=False, unique=True),
        sa.Column('som', sa.String(50), nullable=True),
        sa.Column('school', sa.String(150), nullable=True),
        sa.Column('subject_id', sa.Integer(), sa.ForeignKey('subjects.id'), nullable=True),
        sa.Column('ordinal', sa.Integer(), nullable=True),
    )

    # ── Create exam_teachers (enrollment junction) ─────────────────────────
    op.create_table(
        'exam_teachers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_id', sa.Integer(), sa.ForeignKey('exams.id'), nullable=False),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.UniqueConstraint('exam_id', 'teacher_id', name='uq_exam_teacher'),
    )

    # ── Create exam_slots (uses exam_filiere_id) ───────────────────────────
    op.create_table(
        'exam_slots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_id', sa.Integer(), sa.ForeignKey('exams.id'), nullable=False),
        sa.Column('exam_filiere_id', sa.Integer(), sa.ForeignKey('exam_filieres.id'), nullable=False),
        sa.Column('subject_id', sa.Integer(), sa.ForeignKey('subjects.id'), nullable=False),
        sa.Column('day', sa.Integer(), nullable=False),
        sa.Column('shift', sa.Enum('MORNING', 'AFTERNOON', name='shiftenum', create_type=False), nullable=False),
        sa.Column('slot_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('reserve_count', sa.Integer(), nullable=True),
        sa.UniqueConstraint('exam_id', 'exam_filiere_id', 'day', 'shift', 'slot_order', name='uq_slot'),
    )

    # ── Create room_slot_assignments ───────────────────────────────────────
    op.create_table(
        'room_slot_assignments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_slot_id', sa.Integer(), sa.ForeignKey('exam_slots.id'), nullable=False),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id'), nullable=False),
        sa.Column('supervisors_override', sa.Integer(), nullable=True),
    )

    # ── Create teacher_exemptions ──────────────────────────────────────────
    op.create_table(
        'teacher_exemptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('exam_id', sa.Integer(), sa.ForeignKey('exams.id'), nullable=False),
        sa.Column('exemption_type', sa.Enum('SLOT', 'SHIFT', 'DAY', name='exemptiontypeenum', create_type=False), nullable=False),
        sa.Column('ref_value', sa.String(50), nullable=False),
    )

    # ── Create room_assignments ────────────────────────────────────────────
    op.create_table(
        'room_assignments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_slot_assignment_id', sa.Integer(), sa.ForeignKey('room_slot_assignments.id'), nullable=False),
        sa.Column('supervisor_1_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('supervisor_2_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('status', sa.Enum('AUTO', 'OVERRIDDEN', name='assignmentstatusenum', create_type=False), nullable=False, server_default='AUTO'),
        sa.Column('is_validated', sa.Boolean(), nullable=False, server_default='false'),
    )

    # ── Create madaoume_assignments ────────────────────────────────────────
    op.create_table(
        'madaoume_assignments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_slot_id', sa.Integer(), sa.ForeignKey('exam_slots.id'), nullable=False),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
    )

    # ── Create reserve_assignments ─────────────────────────────────────────
    op.create_table(
        'reserve_assignments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_slot_id', sa.Integer(), sa.ForeignKey('exam_slots.id'), nullable=False),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
    )

    # ── Create duo_history ─────────────────────────────────────────────────
    op.create_table(
        'duo_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('exam_id', sa.Integer(), sa.ForeignKey('exams.id'), nullable=False),
        sa.Column('teacher_a_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('teacher_b_id', sa.Integer(), sa.ForeignKey('teachers.id'), nullable=False),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id'), nullable=True),
        sa.Column('occurrences', sa.Integer(), nullable=False, server_default='1'),
    )


def downgrade() -> None:
    op.drop_table('duo_history')
    op.drop_table('reserve_assignments')
    op.drop_table('madaoume_assignments')
    op.drop_table('room_assignments')
    op.drop_table('teacher_exemptions')
    op.drop_table('room_slot_assignments')
    op.drop_table('exam_slots')
    op.drop_table('exam_teachers')
    op.drop_table('teachers')
    op.drop_table('exam_filieres')
    op.drop_table('filiere_subjects')
    op.drop_table('filieres')
