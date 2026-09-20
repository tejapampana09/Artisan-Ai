#!/usr/bin/env bash
# =============================================================================
# deploy.sh — One-Shot Local Full Deploy Script
# =============================================================================
# Deploys the complete Artisan AI stack to AWS from your local machine.
#
# Usage:
#   ./scripts/deploy.sh                 # full deploy (tests + migrate + frontend + backend)
#   ./scripts/deploy.sh --skip-tests    # skip pytest (faster, use only if tests just passed)
#   ./scripts/deploy.sh --backend-only  # skip frontend S3 sync
#   ./scripts/deploy.sh --frontend-only # skip backend EB deploy
#   ./scripts/deploy.sh --migrate-only  # only run RDS migration
#
# Required env vars (or set in .env.deploy):
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION         (default: ap-south-1)
#   DATABASE_URL               Full PostgreSQL RDS connection string
#   VITE_GOOGLE_CLIENT_ID      (optional — uses default if not set)
#   VITE_RAZORPAY_KEY_ID       (optional — uses default if not set)
#
# AWS resources used (from existing config):
#   EB App       : artisan-ai-backend
#   EB Env       : artisan-ai-backend-prod
#   EB S3 Bucket : artisan-ai-eb-ap-south-1-339954341605
#   Frontend S3  : artisan-ai-frontend-ap-south-1-339954341605
#   CloudFront   : E8OV8X242WBXH
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[deploy]${NC} $*"; }
success() { echo -e "${GREEN}[deploy]${NC} ✓ $*"; }
warn()    { echo -e "${YELLOW}[deploy]${NC} ⚠ $*"; }
error()   { echo -e "${RED}[deploy]${NC} ✗ $*" >&2; exit 1; }
step()    { echo ""; echo -e "${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Load optional .env.deploy ─────────────────────────────────────────────────
if [[ -f "${PROJECT_ROOT}/.env.deploy" ]]; then
  info "Loading .env.deploy"
  # shellcheck disable=SC1091
  set -a; source "${PROJECT_ROOT}/.env.deploy"; set +a
fi

# ── Defaults ──────────────────────────────────────────────────────────────────
AWS_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
EB_APP="artisan-ai-backend"
EB_ENV="artisan-ai-backend-prod"
EB_S3_BUCKET="artisan-ai-eb-ap-south-1-339954341605"
FRONTEND_S3="artisan-ai-frontend-ap-south-1-339954341605"
CLOUDFRONT_ID="E8OV8X242WBXH"

SKIP_TESTS=false
BACKEND_ONLY=false
FRONTEND_ONLY=false
MIGRATE_ONLY=false

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tests)    SKIP_TESTS=true; shift ;;
    --backend-only)  BACKEND_ONLY=true; shift ;;
    --frontend-only) FRONTEND_ONLY=true; shift ;;
    --migrate-only)  MIGRATE_ONLY=true; shift ;;
    --help|-h)       sed -n '2,26p' "$0"; exit 0 ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# ── Validate prerequisites ────────────────────────────────────────────────────
step "Pre-flight checks"

command -v aws    >/dev/null 2>&1 || error "AWS CLI not found. Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
command -v python >/dev/null 2>&1 || error "Python not found."
command -v zip    >/dev/null 2>&1 || error "zip not found (install via your OS package manager)."

if ! $FRONTEND_ONLY && ! $MIGRATE_ONLY; then
  [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]     || error "AWS_ACCESS_KEY_ID is not set."
  [[ -n "${AWS_SECRET_ACCESS_KEY:-}" ]] || error "AWS_SECRET_ACCESS_KEY is not set."
fi

if ! $FRONTEND_ONLY; then
  [[ -n "${DATABASE_URL:-}" ]] || error "DATABASE_URL is not set (needed for RDS migration)."
  echo "$DATABASE_URL" | grep -qi "sqlite" && error "DATABASE_URL must be PostgreSQL, not SQLite."
fi

success "All pre-flight checks passed."

# ── Activate venv ─────────────────────────────────────────────────────────────
if [[ -d "${PROJECT_ROOT}/.venv" ]]; then
  source "${PROJECT_ROOT}/.venv/bin/activate" 2>/dev/null || \
  source "${PROJECT_ROOT}/.venv/Scripts/activate" 2>/dev/null || true
fi

cd "$PROJECT_ROOT"

# ── 1. Run tests ──────────────────────────────────────────────────────────────
if ! $SKIP_TESTS && ! $MIGRATE_ONLY; then
  step "Backend Tests (pytest)"
  PYTHONPATH="." ENVIRONMENT="test" DEMO_MODE="true" DATABASE_URL="sqlite:///./test_deploy.db" \
    python -m pytest backend/tests -q --tb=short
  rm -f test_deploy.db
  success "All tests passed."
fi

# ── 2. RDS Migration ──────────────────────────────────────────────────────────
if ! $FRONTEND_ONLY; then
  step "RDS Schema Migration (alembic upgrade head)"
  info "Database: $(echo "$DATABASE_URL" | sed 's/:\/\/[^:]*:[^@]*@/:\\/\\/<hidden>@/')"
  PYTHONPATH="." python -m alembic upgrade head
  info "Current revision:"
  PYTHONPATH="." python -m alembic current
  success "Migrations applied."

  if $MIGRATE_ONLY; then
    success "Migration-only mode complete."
    exit 0
  fi
fi

# ── 3. Frontend Build + S3 deploy ─────────────────────────────────────────────
if ! $BACKEND_ONLY; then
  step "Frontend Build & S3 Deploy"

  if [[ ! -d "${PROJECT_ROOT}/frontend" ]]; then
    warn "frontend/ directory not found — skipping frontend deploy."
  else
    command -v npm >/dev/null 2>&1 || error "npm not found — needed to build frontend."

    info "Installing frontend dependencies..."
    (cd "${PROJECT_ROOT}/frontend" && npm install --silent)

    info "Building production bundle..."
    VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-26058075206-on14bkf0hlrenshpogiglj07ftb8qgba.apps.googleusercontent.com}" \
    VITE_RAZORPAY_KEY_ID="${VITE_RAZORPAY_KEY_ID:-rzp_test_ArtisanAI2026}" \
      (cd "${PROJECT_ROOT}/frontend" && npm run build)

    info "Syncing static assets to S3 (immutable cache)..."
    aws s3 sync frontend/dist "s3://${FRONTEND_S3}" \
      --delete \
      --exclude "index.html" \
      --cache-control "public, max-age=31536000, immutable" \
      --region "$AWS_REGION"

    info "Uploading index.html (short TTL)..."
    aws s3 cp frontend/dist/index.html "s3://${FRONTEND_S3}/index.html" \
      --cache-control "public, max-age=0, s-maxage=60, must-revalidate" \
      --region "$AWS_REGION"

    info "Invalidating CloudFront distribution ${CLOUDFRONT_ID}..."
    aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*"

    success "Frontend deployed to S3 and CloudFront invalidation triggered."
  fi
fi

# ── 4. Backend EB Deploy ──────────────────────────────────────────────────────
if ! $FRONTEND_ONLY; then
  step "Backend Elastic Beanstalk Deploy"

  SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
  TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
  VERSION_LABEL="v-local-${TIMESTAMP}-${SHORT_SHA}"
  BUNDLE_NAME="deploy-${VERSION_LABEL}.zip"

  info "Creating deployment bundle: ${BUNDLE_NAME}"
  zip -r "$BUNDLE_NAME" backend requirements.txt Procfile .ebextensions \
    -x "*.pyc" "*__pycache__*" "*.db" "*.db-shm" "*.db-wal" "backend/tests/*" "backend/.env" \
    > /dev/null
  success "Bundle created: $(du -sh "$BUNDLE_NAME" | cut -f1)"

  info "Uploading bundle to S3..."
  aws s3 cp "$BUNDLE_NAME" "s3://${EB_S3_BUCKET}/${BUNDLE_NAME}" --region "$AWS_REGION"
  rm -f "$BUNDLE_NAME"

  info "Creating EB application version: ${VERSION_LABEL}"
  aws elasticbeanstalk create-application-version \
    --application-name "$EB_APP" \
    --version-label "$VERSION_LABEL" \
    --source-bundle "S3Bucket=${EB_S3_BUCKET},S3Key=${BUNDLE_NAME}" \
    --description "Local deploy ${SHORT_SHA} at ${TIMESTAMP}" \
    --region "$AWS_REGION"

  info "Deploying to EB environment: ${EB_ENV}"
  aws elasticbeanstalk update-environment \
    --environment-name "$EB_ENV" \
    --version-label "$VERSION_LABEL" \
    --region "$AWS_REGION"

  # ── Poll EB health ────────────────────────────────────────────────────────
  info "Polling EB environment health (max 5 min)..."
  TIMEOUT=300
  ELAPSED=0
  POLL_INTERVAL=15
  while [[ $ELAPSED -lt $TIMEOUT ]]; do
    STATUS=$(aws elasticbeanstalk describe-environments \
      --environment-names "$EB_ENV" \
      --region "$AWS_REGION" \
      --query "Environments[0].Status" \
      --output text 2>/dev/null)
    HEALTH_COLOR=$(aws elasticbeanstalk describe-environments \
      --environment-names "$EB_ENV" \
      --region "$AWS_REGION" \
      --query "Environments[0].Health" \
      --output text 2>/dev/null)
    echo -ne "\r  ${CYAN}[deploy]${NC} Status: ${STATUS} | Health: ${HEALTH_COLOR}  (${ELAPSED}s / ${TIMEOUT}s)   "
    if [[ "$STATUS" == "Ready" && "$HEALTH_COLOR" == "Green" ]]; then
      echo ""
      success "EB environment is Green and Ready!"
      break
    fi
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo ""
    warn "Timeout waiting for EB to reach Green/Ready. Check the AWS console."
    warn "  https://ap-south-1.console.aws.amazon.com/elasticbeanstalk/home?region=ap-south-1"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══ Deploy Complete ══${NC}"
$FRONTEND_ONLY || echo -e "  ${GREEN}✓${NC} RDS migration applied"
$BACKEND_ONLY  || echo -e "  ${GREEN}✓${NC} Frontend → S3 + CloudFront"
$FRONTEND_ONLY || echo -e "  ${GREEN}✓${NC} Backend  → Elastic Beanstalk (${EB_ENV})"
echo ""
