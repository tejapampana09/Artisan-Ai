"""review composite uniqueness constraint

Revision ID: 0003_review_uniqueness
Revises: 0002_add_payments
Create Date: 2026-09-15 18:19:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_review_uniqueness'
down_revision: Union[str, None] = '0002_add_payments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    uqs = [c['name'] for c in insp.get_unique_constraints('reviews')]
    if 'uq_review_order_product_buyer' not in uqs:
        try:
            op.create_unique_constraint(
                'uq_review_order_product_buyer',
                'reviews',
                ['order_id', 'product_id', 'buyer_id']
            )
        except Exception:
            # In SQLite or existing datasets with constraints, ignore if already present
            pass

def downgrade() -> None:
    try:
        op.drop_constraint('uq_review_order_product_buyer', 'reviews', type_='unique')
    except Exception:
        pass
