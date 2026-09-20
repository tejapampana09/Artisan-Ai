#!/usr/bin/env bash
# =============================================================================
# migrate.sh — Standalone RDS Schema Migration Runner
# =============================================================================
# Usage:
#   ./scripts/migrate.sh                        # uses DATABASE_URL from env
#   DATABASE_URL="postgresql://..." ./scripts/migrate.sh
#   ./scripts/migrate.sh --revision <rev>       # upgrade to specific revision
#   ./scripts/migrate.sh --check                # show current revision only
#
# Required env vars:
#   DATABASE_URL  — Full PostgreSQL connection string:
#                   postgresql://user:password@host:5432/dbname
#
# Never runs against SQLite — fails fast to prevent accidental local DB writes.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[migrate]${NC} $*"; }
success() { echo -e "${GREEN}[migrate]${NC} ✓ $*"; }
warn()    { echo -e "${YELLOW}[migrate]${NC} ⚠ $*"; }
error()   { echo -e "${RED}[migrate]${NC} ✗ $*" >&2; exit 1; }

# ── Parse args ───────────────────────────────────────────────────────────────
REVISION="head"
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --revision|-r) REVISION="$2"; shift 2 ;;
    --check|-c)    CHECK_ONLY=true; shift ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# ── Validate DATABASE_URL ─────────────────────────────────────────────────────
DB_URL="${DATABASE_URL:-}"

if [[ -z "$DB_URL" ]]; then
  error "DATABASE_URL is not set.\nExport it or run:\n  DATABASE_URL=\"postgresql://user:pass@host:5432/db\" $0"
fi

if echo "$DB_URL" | grep -qi "sqlite"; then
  error "DATABASE_URL points to SQLite. This script only runs against PostgreSQL (RDS).\nSet DATABASE_URL to a PostgreSQL connection string."
fi

if ! echo "$DB_URL" | grep -qiE "^postgresql://|^postgres://"; then
  warn "DATABASE_URL does not look like a PostgreSQL URL. Proceeding anyway..."
fi

# ── Activate venv if present ──────────────────────────────────────────────────
if [[ -d "${PROJECT_ROOT}/.venv" ]]; then
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.venv/bin/activate" 2>/dev/null || \
  source "${PROJECT_ROOT}/.venv/Scripts/activate" 2>/dev/null || true
fi

cd "$PROJECT_ROOT"

# ── Check-only mode ───────────────────────────────────────────────────────────
if $CHECK_ONLY; then
  info "Current Alembic revision on RDS:"
  PYTHONPATH="." python -m alembic current
  exit 0
fi

# ── Run migration ─────────────────────────────────────────────────────────────
info "Target database: $(echo "$DB_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\\/\\/<user>:<hidden>@/')"
info "Running: alembic upgrade ${REVISION}"
echo ""

PYTHONPATH="." python -m alembic upgrade "$REVISION"

echo ""
success "Migration complete."
info "Current revision:"
PYTHONPATH="." python -m alembic current
