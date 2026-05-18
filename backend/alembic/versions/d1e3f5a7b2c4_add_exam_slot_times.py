"""add exam slot times

Revision ID: d1e3f5a7b2c4
Revises: f3a9c2d1b8e7
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1e3f5a7b2c4'
down_revision: Union[str, None] = 'f3a9c2d1b8e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columns already exist in DB — added manually before this file was recreated
    op.execute("SELECT 1")


def downgrade() -> None:
    op.drop_column('exam_slots', 'end_time')
    op.drop_column('exam_slots', 'start_time')
