"""product draft default status

Revision ID: 0004_product_draft
Revises: 0003_review_uniqueness
Create Date: 2026-09-15 18:19:30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_product_draft'
down_revision: Union[str, None] = '0003_review_uniqueness'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    prod_cols = [c['name'] for c in insp.get_columns('products')]
    if 'status' in prod_cols:
        try:
            op.alter_column('products', 'status', server_default='DRAFT')
        except Exception:
            pass

def downgrade() -> None:
    pass
