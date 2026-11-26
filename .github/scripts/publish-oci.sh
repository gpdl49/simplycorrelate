#!/usr/bin/env bash
set -euo pipefail

: "${IMAGE_DIGEST:?}" "${REGISTRY_USER:?}" "${REGISTRY_PASSWORD:?}" "${RUNNER_TEMP:?}" "${1:?Destination required}"

auth_dir=$(mktemp -d "$RUNNER_TEMP/publish-auth.XXXXXX")
trap 'rm -rf "$auth_dir"' EXIT
auth_file="$auth_dir/config.json"
registry=${1%%/*}
source="$RUNNER_TEMP/quiz.oci.tar@$IMAGE_DIGEST"

tls=()
destination_tls=()
if [[ -n "${REGISTRY_CA_PEM:-}" ]]; then
  ca="$auth_dir/ca.crt"
  printf '%s\n' "$REGISTRY_CA_PEM" > "$ca"
  tls=(--ca-file "$ca")
  destination_tls=(--to-ca-file "$ca")
fi

printf '%s' "$REGISTRY_PASSWORD" | oras login --registry-config "$auth_file" \
  --username "$REGISTRY_USER" --password-stdin "${tls[@]}" "$registry"
unset REGISTRY_PASSWORD

for destination in "$@"; do
  oras cp --from-oci-layout --to-registry-config "$auth_file" \
    "${destination_tls[@]}" "$source" "$destination"
  actual=$(oras resolve --registry-config "$auth_file" "${tls[@]}" "$destination")
  if [[ "$actual" != "$IMAGE_DIGEST" ]]; then
    echo "::error::$destination resolved to $actual, expected $IMAGE_DIGEST" >&2
    exit 1
  fi
  message="Published $destination@$actual at $(date -u +%FT%TZ)"
  printf '%s\n' "$message"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$message" >> "$GITHUB_STEP_SUMMARY"
  fi
done
