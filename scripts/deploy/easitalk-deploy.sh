#!/usr/bin/env bash
set -euo pipefail

REBUILD=0
PULL=0
LOGS=0
DOWN=0
SKIP_HEALTH=0
TIMEOUT_SECONDS=180

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild) REBUILD=1 ;;
    --pull) PULL=1 ;;
    --logs) LOGS=1 ;;
    --down) DOWN=1 ;;
    --skip-health) SKIP_HEALTH=1 ;;
    --timeout)
      TIMEOUT_SECONDS="${2:-180}"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.easytalk.yml"
ENV_FILE="$REPO_ROOT/.env.easytalk"
ENV_EXAMPLE="$REPO_ROOT/.env.easytalk.example"

step() { printf '\n==> %s\n' "$1"; }
ok() { printf '[OK] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_command() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[ERROR] $name is not installed or not in PATH. $hint" >&2
    exit 1
  fi
}

wait_http_health() {
  local name="$1"
  local url="$2"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  local last_error=""

  step "Waiting for $name health: $url"
  while [[ $SECONDS -lt $deadline ]]; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      ok "$name is healthy"
      return 0
    fi
    last_error="curl failed"
    sleep 3
  done

  echo "[ERROR] $name did not become healthy within ${TIMEOUT_SECONDS}s. Last error: $last_error" >&2
  exit 1
}

step "EasiTalk deploy root: $REPO_ROOT"
cd "$REPO_ROOT"

[[ -f "$COMPOSE_FILE" ]] || { echo "[ERROR] Compose file not found: $COMPOSE_FILE" >&2; exit 1; }
[[ -f "$ENV_EXAMPLE" ]] || { echo "[ERROR] Env example file not found: $ENV_EXAMPLE" >&2; exit 1; }

step "Checking required tools"
require_command docker "Install Docker Desktop or Docker Engine with Compose v2."
docker --version
docker compose version >/dev/null
ok "Docker Compose is available"

step "Preparing environment file"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  ok "Created .env.easytalk from .env.easytalk.example"
  warn "OPENAI_API_KEY is empty by default. The AI service will use mock responses until you fill it."
else
  ok ".env.easytalk already exists; keeping your local values"
fi

if [[ "$DOWN" == "1" ]]; then
  step "Stopping EasiTalk target stack"
  compose down
  ok "Stack stopped"
  exit 0
fi

if [[ "$PULL" == "1" ]]; then
  step "Pulling base images"
  compose pull
fi

step "Starting EasiTalk target stack"
if [[ "$REBUILD" == "1" ]]; then
  compose up -d --build
else
  compose up -d --build
fi

step "Current service status"
compose ps

if [[ "$SKIP_HEALTH" != "1" ]]; then
  wait_http_health "Go API" "http://localhost:3001/health"
  wait_http_health "Python AI Service" "http://localhost:3002/health"
else
  warn "Health checks skipped by --skip-health"
fi

step "Deployment completed"
cat <<'URLS'
Service URLs:
  Go API Health:       http://localhost:3001/health
  AI Service Health:   http://localhost:3002/health
  API Swagger/OpenAPI: http://localhost:3002/docs
  MinIO API:           http://localhost:9000
  MinIO Console:       http://localhost:9001
  MySQL:               localhost:3306
  Redis:               localhost:6379

Useful commands:
  View logs:  docker compose --env-file .env.easytalk -f docker-compose.easytalk.yml logs -f api ai-service
  Stop stack: ./scripts/deploy/easitalk-deploy.sh --down
  Rebuild:    ./scripts/deploy/easitalk-deploy.sh --rebuild
URLS

if [[ "$LOGS" == "1" ]]; then
  step "Streaming API and AI logs. Press Ctrl+C to stop log streaming."
  compose logs -f api ai-service
fi

