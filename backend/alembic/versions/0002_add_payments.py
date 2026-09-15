"""add payments table and order payment_status

Revision ID: 0002_add_payments
Revises: 0001_v3_auth
Create Date: 2026-09-15 18:18:30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_add_payments'
down_revision: Union[str, None] = '0001_v3_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Add payment_status column to orders if missing
    order_cols = [c['name'] for c in insp.get_columns('orders')]
    if 'payment_status' not in order_cols:
        op.add_column('orders', sa.Column('payment_status', sa.String(), nullable=False, server_default='UNPAID'))

    # 2. Create payments table if missing
    if not insp.has_table('payments'):
        op.create_table(
            'payments',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False, index=True),
            sa.Column('provider', sa.String(), nullable=False),
            sa.Column('provider_order_id', sa.String(), nullable=True, index=True),
            sa.Column('provider_payment_id', sa.String(), nullable=True, index=True),
            sa.Column('amount', sa.Numeric(12, 2), nullable=False),
            sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
            sa.Column('status', sa.String(), nullable=False, server_default='CREATED'),
            sa.Column('signature_verified', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('idempotency_key', sa.String(), nullable=True, unique=True, index=True),
            sa.Column('raw_payload', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('verified_at', sa.DateTime(), nullable=True)
        )

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('payments'):
        op.drop_table('payments')
