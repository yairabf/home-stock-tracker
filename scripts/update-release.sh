#!/bin/sh
# Run from the directory containing the release Compose file and runtime .env.
set -eu

compose() {
  docker compose -f docker-compose.release.yml "$@"
}

compose config --quiet
compose pull app migrate
# Read only image names; never print the resolved environment configuration.
release_image=$(compose config --images | awk '/^ghcr.io\/yairabf\/home-stock-tracker[:@]/ { print; exit }')
if [ -z "$release_image" ]; then
  echo 'Expected the Home Stock Tracker GHCR image.' >&2
  exit 1
fi
release_digest=$(docker image inspect "$release_image" --format '{{range .RepoDigests}}{{println .}}{{end}}' |
  awk '/^ghcr.io\/yairabf\/home-stock-tracker@sha256:/ { print; exit }')
if [ -z "$release_digest" ]; then
  echo 'Cannot resolve the pulled image digest; app unchanged.' >&2
  exit 1
fi
export IMAGE_REF="$release_digest"
compose up --detach --wait postgres
compose run --rm --no-deps migrate
compose up --detach --wait --wait-timeout 120 --no-deps --force-recreate app
echo "Running $IMAGE_REF"
