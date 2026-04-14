"""add_filiere_level

Revision ID: f3a9c2d1b8e7
Revises: 1da3f61ae0f6
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a9c2d1b8e7'
down_revision: Union[str, None] = '1da3f61ae0f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('filieres', sa.Column('level', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('filieres', 'level')
