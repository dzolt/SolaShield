#!/usr/bin/env bash
# Builds both web apps here, ships them with the attestor to the VPS and runs them as one isolated compose project.
#   deploy/ship.sh up       build, upload, (re)start
#   deploy/ship.sh urls     print the public addresses
#   deploy/ship.sh logs     follow the logs of this stack only
#   deploy/ship.sh down     stop and delete everything this script created on the VPS
# It only touches ~/proofswap-demo and the compose project "proofswap-demo"; nothing else on the server.
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@}"
REMOTE_DIR="proofswap-demo"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$ROOT/deploy/.stage"
COMPOSE="cd ~/$REMOTE_DIR && sudo docker compose -p proofswap-demo"

build_apps() {
  for app in market will; do
    echo "== building $app"
    # Same-origin paths: the browser never sees the RPC provider key, and no address is baked in before the tunnel exists.
    (cd "$ROOT/$app" && VITE_RPC_URL=/rpc VITE_ATTESTOR_URL=/api npm run build >/dev/null)
    if grep -rqE "api-key|helius" "$ROOT/$app/dist"; then
      echo "ERROR: the $app bundle contains a provider key or host; refusing to ship it" >&2
      exit 1
    fi
  done
}

stage_files() {
  rm -rf "$STAGE"
  mkdir -p "$STAGE/site" "$STAGE/attestor-image/scripts" "$STAGE/attestor-image/market/src/generated" "$STAGE/secrets"
  cp -R "$ROOT/market/dist" "$STAGE/site/market"
  cp -R "$ROOT/will/dist" "$STAGE/site/will"
  cp "$ROOT/deploy/docker-compose.yml" "$STAGE/"
  cp -R "$ROOT/deploy/nginx" "$STAGE/nginx"
  cp "$ROOT/deploy/attestor.Dockerfile" "$STAGE/attestor-image/Dockerfile"
  cp "$ROOT/package.json" "$ROOT/package-lock.json" "$STAGE/attestor-image/"
  cp -R "$ROOT/attestor" "$STAGE/attestor-image/attestor"
  rm -rf "$STAGE/attestor-image/attestor/data"
  mkdir -p "$STAGE/attestor-image/scripts/lib"
  cp "$ROOT/scripts/lib/env.ts" "$STAGE/attestor-image/scripts/lib/"
  cp "$ROOT/market/src/generated/proofswap.json" "$STAGE/attestor-image/market/src/generated/"

  # Only the attestor key goes to the server, never the deployer key. The RPC URL comes from the local app config.
  cp "$ROOT/keys/attestor.json" "$STAGE/secrets/attestor.json"
  rpc="$(grep -E '^VITE_RPC_URL=' "$ROOT/market/.env.local" 2>/dev/null | head -1 | cut -d= -f2- || true)"
  printf 'RPC_URL=%s\n' "${rpc:-https://api.devnet.solana.com}" >"$STAGE/.env"
  unset rpc
}

upload() {
  ssh "$HOST" "mkdir -p ~/$REMOTE_DIR && cd ~/$REMOTE_DIR && rm -rf site attestor-image nginx"
  COPYFILE_DISABLE=1 tar -C "$STAGE" -cf - . | ssh "$HOST" "cd ~/$REMOTE_DIR && tar -xf - && chmod 600 .env secrets/attestor.json"
  rm -rf "$STAGE/secrets" "$STAGE/.env"
}

case "${1:-}" in
up)
  build_apps
  stage_files
  upload
  ssh "$HOST" "$COMPOSE up -d --build --remove-orphans"
  echo "== waiting for the tunnels"
  sleep 15
  "$0" urls
  ;;
urls)
  for t in market will; do
    printf '%s: ' "$t"
    ssh "$HOST" "$COMPOSE logs --no-log-prefix tunnel-$t 2>&1" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1 || echo "(no address yet)"
  done
  ;;
logs)
  ssh "$HOST" "$COMPOSE logs -f --tail 100"
  ;;
down)
  ssh "$HOST" "$COMPOSE down --rmi local -v --remove-orphans; cd ~ && rm -rf ~/$REMOTE_DIR"
  ;;
*)
  echo "usage: deploy/ship.sh up|urls|logs|down" >&2
  exit 2
  ;;
esac
