"""v3 auth domains and audit logs

Revision ID: 0001_v3_auth
Revises: 
Create Date: 2026-09-15 18:18:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_v3_auth'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Ensure status column in users table
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = [c['name'] for c in insp.get_columns('users')]
    if 'status' not in columns:
        op.add_column('users', sa.Column('status', sa.String(), nullable=False, server_default='ACTIVE'))

    # 2. Create audit_logs table if not exists
    if not insp.has_table('audit_logs'):
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('actor_id', sa.Integer(), nullable=True, index=True),
            sa.Column('actor_email', sa.String(), nullable=True),
            sa.Column('action', sa.String(), nullable=False, index=True),
            sa.Column('resource_type', sa.String(), nullable=False, index=True),
            sa.Column('resource_id', sa.String(), nullable=True),
            sa.Column('before_state', sa.Text(), nullable=True),
            sa.Column('after_state', sa.Text(), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('ip_metadata', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True)
        )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('audit_logs'):
        op.drop_table('audit_logs')
