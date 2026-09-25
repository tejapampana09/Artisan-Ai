"""add artisan geo and craft cluster columns

Revision ID: f31a89b0d1e2
Revises: e63c78c66d16
Create Date: 2026-09-25 10:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f31a89b0d1e2'
down_revision: Union[str, Sequence[str], None] = 'e63c78c66d16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table('users'):
        existing_cols = {col['name'] for col in insp.get_columns('users')}
        
        if 'latitude' not in existing_cols:
            op.add_column('users', sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True))
        if 'longitude' not in existing_cols:
            op.add_column('users', sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True))
        if 'craft_cluster' not in existing_cols:
            op.add_column('users', sa.Column('craft_cluster', sa.String(length=100), nullable=True))
        if 'state' not in existing_cols:
            op.add_column('users', sa.Column('state', sa.String(length=100), nullable=True))
        if 'district' not in existing_cols:
            op.add_column('users', sa.Column('district', sa.String(length=100), nullable=True))
        if 'pincode' not in existing_cols:
            op.add_column('users', sa.Column('pincode', sa.String(length=20), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table('users'):
        existing_cols = {col['name'] for col in insp.get_columns('users')}
        for col_name in ['pincode', 'district', 'state', 'craft_cluster', 'longitude', 'latitude']:
            if col_name in existing_cols:
                op.drop_column('users', col_name)
