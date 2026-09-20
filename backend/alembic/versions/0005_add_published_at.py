"""add published_at and missing columns to products and orders

Revision ID: 0005_add_published_at
Revises: 0004_product_draft
Create Date: 2026-09-20 16:55:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005_add_published_at'
down_revision: Union[str, None] = '0004_product_draft'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    prod_cols = [c['name'] for c in insp.get_columns('products')]

    if 'published_at' not in prod_cols:
        op.add_column('products', sa.Column('published_at', sa.DateTime(), nullable=True))
    if 'created_at' not in prod_cols:
        op.add_column('products', sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True))
    if 'updated_at' not in prod_cols:
        op.add_column('products', sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True))
    if 'seller_id' not in prod_cols:
        op.add_column('products', sa.Column('seller_id', sa.Integer(), nullable=True))
    if 'enhanced_image_url' not in prod_cols:
        op.add_column('products', sa.Column('enhanced_image_url', sa.String(), nullable=True))
    if 'min_margin_pct' not in prod_cols:
        op.add_column('products', sa.Column('min_margin_pct', sa.Numeric(5, 4), server_default='0.2000', nullable=True))

    order_cols = [c['name'] for c in insp.get_columns('orders')]
    if 'created_at' not in order_cols:
        op.add_column('orders', sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=True))
    if 'user_id' not in order_cols:
        op.add_column('orders', sa.Column('user_id', sa.Integer(), nullable=True))

def downgrade() -> None:
    pass
