#!/usr/bin/env bash
# =============================================================================
# rollback.sh — Alembic Migration Rollback Helper
# =============================================================================
# Usage:
#   ./scripts/rollback.sh <revision>            # downgrade to specific revision
#   ./scripts/rollback.sh -1                    # downgrade one step back
#   ./scripts/rollback.sh base                  # downgrade all the way to base
#
# Find available revisions with:
#   PYTHONPATH=. python -m alembic history
#
# Required env vars:
#   DATABASE_URL  — Full PostgreSQL connection string
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[rollback]${NC} $*"; }
success() { echo -e "${GREEN}[rollback]${NC} ✓ $*"; }
error()   { echo -e "${RED}[rollback]${NC} ✗ $*" >&2; exit 1; }

# ── Args ──────────────────────────────────────────────────────────────────────
if [[ $# -lt 1 || "$1" == "--help" || "$1" == "-h" ]]; then
  sed -n '2,15p' "$0"
  echo ""
  echo "Available revisions:"
  PYTHONPATH="." python -m alembic history --verbose 2>/dev/null || true
  exit 0
fi

REVISION="$1"

# ── Validate DATABASE_URL ─────────────────────────────────────────────────────
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
  error "DATABASE_URL is not set."
fi
if echo "$DB_URL" | grep -qi "sqlite"; then
  error "DATABASE_URL points to SQLite — rollback only runs against PostgreSQL (RDS)."
fi

# ── Activate venv ─────────────────────────────────────────────────────────────
if [[ -d "${PROJECT_ROOT}/.venv" ]]; then
  source "${PROJECT_ROOT}/.venv/bin/activate" 2>/dev/null || \
  source "${PROJECT_ROOT}/.venv/Scripts/activate" 2>/dev/null || true
fi

cd "$PROJECT_ROOT"

# ── Confirm ───────────────────────────────────────────────────────────────────
echo -e "${YELLOW}⚠  WARNING: You are about to DOWNGRADE the database schema.${NC}"
echo -e "   Target revision : ${YELLOW}${REVISION}${NC}"
echo -e "   Database        : $(echo "$DB_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\\/\\/<hidden>@/')"
echo ""
read -rp "Type 'yes' to confirm rollback: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Rollback cancelled."
  exit 0
fi

info "Running: alembic downgrade ${REVISION}"
PYTHONPATH="." python -m alembic downgrade "$REVISION"

echo ""
success "Rollback complete."
info "Current revision:"
PYTHONPATH="." python -m alembic current
