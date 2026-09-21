"""add addresses and payout_accounts

Revision ID: e63c78c66d16
Revises: 7028678c0ed6
Create Date: 2026-09-21 12:53:58.322482

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e63c78c66d16'
down_revision: Union[str, Sequence[str], None] = '7028678c0ed6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create addresses table if not exists
    if not insp.has_table('addresses'):
        op.create_table(
            'addresses',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('phone', sa.String(), nullable=True),
            sa.Column('pincode', sa.String(length=10), nullable=False),
            sa.Column('address_line', sa.Text(), nullable=False),
            sa.Column('city', sa.String(), nullable=True),
            sa.Column('state', sa.String(), nullable=True),
            sa.Column('tag', sa.String(), nullable=False, server_default='HOME'),
            sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_addresses_id', 'addresses', ['id'], unique=False)
        op.create_index('ix_addresses_user_id', 'addresses', ['user_id'], unique=False)

    # 2. Create payout_accounts table if not exists
    if not insp.has_table('payout_accounts'):
        op.create_table(
            'payout_accounts',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('artisan_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('upi_id', sa.String(), nullable=True),
            sa.Column('account_holder_name', sa.String(), nullable=True),
            sa.Column('account_number', sa.String(), nullable=True),
            sa.Column('ifsc_code', sa.String(), nullable=True),
            sa.Column('bank_name', sa.String(), nullable=True),
            sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_payout_accounts_id', 'payout_accounts', ['id'], unique=False)
        op.create_index('ix_payout_accounts_artisan_id', 'payout_accounts', ['artisan_id'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('payout_accounts'):
        op.drop_table('payout_accounts')
    if insp.has_table('addresses'):
        op.drop_table('addresses')
