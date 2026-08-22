#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${DEPLOY_MODE:-}"
DOMAIN="${INTRANET_DOMAIN:-}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
DATABASE_URL_OVERRIDE="${DATABASE_URL:-}"
BOOTSTRAP_DEFAULT_ADMIN="${BOOTSTRAP_DEFAULT_ADMIN:-true}"

usage() {
  cat <<'EOF'
Usage: deploy/install.sh --mode docker|native|managed [--domain intranet.example.org] [options]

  docker   Build and launch the VPS stack with MySQL, Caddy TLS, and the scheduler.
  native   Build, migrate, and optionally install a systemd service on a Node 22 VPS.
  managed  Build and migrate for Hostinger's managed Node.js Web App runtime.

Options:
  --database-url URL                  Required for a fresh native or managed install.
  --bootstrap-default-admin true|false  Create admin/admin only on a fresh installation (default: true).

Set DATABASE_URL before native or managed installation, or pass --database-url. Docker mode creates a dedicated
database URL from generated .env credentials. Existing .env files are never overwritten.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --service-user) SERVICE_USER="${2:-}"; shift 2 ;;
    --database-url) DATABASE_URL_OVERRIDE="${2:-}"; shift 2 ;;
    --bootstrap-default-admin) BOOTSTRAP_DEFAULT_ADMIN="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  if [[ -t 0 ]]; then
    read -r -p "Deployment mode (docker/native/managed): " MODE
  else
    usage
    exit 1
  fi
fi

random_secret() { openssl rand -hex 32; }

create_docker_env() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    echo "Using existing $ROOT_DIR/.env"
    return
  fi
  [[ -n "$DOMAIN" ]] || { echo "--domain is required for Docker TLS deployment." >&2; exit 1; }
  local db_password root_password jwt_secret cron_secret
  db_password="$(random_secret)"
  root_password="$(random_secret)"
  jwt_secret="$(random_secret)"
  cron_secret="$(random_secret)"
  umask 077
  cat > "$ROOT_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
INTRANET_DOMAIN=$DOMAIN
MYSQL_DATABASE=welfare_pride
MYSQL_USER=welfare_pride
MYSQL_PASSWORD=$db_password
MYSQL_ROOT_PASSWORD=$root_password
DATABASE_URL=mysql://welfare_pride:$db_password@database:3306/welfare_pride
JWT_SECRET=$jwt_secret
CRON_SECRET=$cron_secret
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/app/data/uploads
RUN_MIGRATIONS_ON_START=true
COMPOSE_PROJECT_NAME=welfare-pride-intranet
AI_ALLOW_PRIVATE_ENDPOINTS=false
BOOTSTRAP_DEFAULT_ADMIN=$BOOTSTRAP_DEFAULT_ADMIN
EOF
  echo "Created $ROOT_DIR/.env with mode 600. Fresh installations create a temporary local admin/admin account. The first sign-in forces a password change and TOTP MFA enrollment."
}

create_native_env() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    echo "Using existing $ROOT_DIR/.env"
    return
  fi
  [[ -n "$DATABASE_URL_OVERRIDE" ]] || { echo "--database-url is required for a fresh native or managed installation." >&2; exit 1; }
  local jwt_secret cron_secret
  jwt_secret="$(random_secret)"
  cron_secret="$(random_secret)"
  umask 077
  cat > "$ROOT_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=$DATABASE_URL_OVERRIDE
JWT_SECRET=$jwt_secret
CRON_SECRET=$cron_secret
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=$ROOT_DIR/data/uploads
RUN_MIGRATIONS_ON_START=false
BOOTSTRAP_DEFAULT_ADMIN=$BOOTSTRAP_DEFAULT_ADMIN
AI_ALLOW_PRIVATE_ENDPOINTS=false
EOF
  echo "Created $ROOT_DIR/.env with mode 600. Fresh installations create temporary admin/admin credentials; first sign-in requires a password change and TOTP MFA enrollment."
}

require_node() {
  command -v node >/dev/null || { echo "Node.js 22 is required." >&2; exit 1; }
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" -ge 20 ]] || { echo "Node.js 20 or newer is required; Node.js 22 is recommended." >&2; exit 1; }
  command -v corepack >/dev/null || { echo "Corepack is required." >&2; exit 1; }
}

install_node_app() {
  require_node
  cd "$ROOT_DIR"
  create_native_env
  if [[ -f .env ]]; then
    set -a
    source .env
    set +a
  fi
  corepack enable
  corepack pnpm install --frozen-lockfile
  corepack pnpm run build
  [[ -n "${DATABASE_URL:-}" || -f .env ]] || { echo "Set DATABASE_URL in the environment or .env before installation." >&2; exit 1; }
  corepack pnpm run db:migrate
}

case "$MODE" in
  docker)
    command -v docker >/dev/null || { echo "Docker Engine is required." >&2; exit 1; }
    docker compose version >/dev/null || { echo "Docker Compose v2 is required." >&2; exit 1; }
    command -v openssl >/dev/null || { echo "OpenSSL is required to generate secrets." >&2; exit 1; }
    create_docker_env
    cd "$ROOT_DIR/deploy/hostinger"
    docker compose --env-file "$ROOT_DIR/.env" up -d --build
    echo "Welfare Pride is starting at https://$DOMAIN"
    ;;
  native)
    install_node_app
    if [[ "$(id -u)" -eq 0 ]]; then
      cat > /etc/systemd/system/welfare-pride-intranet.service <<EOF
[Unit]
Description=Welfare Pride Intranet
After=network-online.target mysql.service
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$ROOT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$ROOT_DIR/.env
ExecStartPre=/usr/bin/env node $ROOT_DIR/scripts/migrate.mjs
ExecStart=/usr/bin/env node $ROOT_DIR/dist/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
      systemctl daemon-reload
      systemctl enable --now welfare-pride-intranet
      echo "Installed and started welfare-pride-intranet.service"
    else
      echo "Build and migration complete. Re-run as root to install systemd, or start with: pnpm start"
    fi
    ;;
  managed)
    install_node_app
    echo "Build and migration complete. Configure Hostinger's start command as: pnpm start"
    ;;
  *) usage; exit 1 ;;
esac
