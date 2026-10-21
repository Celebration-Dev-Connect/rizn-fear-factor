#!/usr/bin/env bash
# One-command deploy (Constitution IX): builds the app image and (re)starts the stack.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill it in first." >&2
  exit 1
fi
set -a; source .env; set +a
for v in DOMAIN POSTGRES_PASSWORD CREW_PASSCODE SESSION_SECRET SCREEN_TOKEN PUBLIC_URL EVENT_START EVENT_END PHOTO_DELETE_AT; do
  if [[ -z "${!v:-}" ]]; then echo "Missing $v in .env" >&2; exit 1; fi
done

docker compose up -d --build

echo -n "Waiting for https://$DOMAIN/healthz "
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    echo; echo "✅ Deployed: https://$DOMAIN"
    exit 0
  fi
  echo -n "."
  sleep 1
done
echo; echo "❌ Health check failed. Inspect: docker compose logs app caddy" >&2
exit 1
