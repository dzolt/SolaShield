#!/usr/bin/env bash
# The primitives in market/src/ui and will/src/ui are one set of files kept in two places; fail when they drift apart.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if diff -rq market/src/ui will/src/ui; then
  echo "ui primitives are identical in market/ and will/"
else
  echo "market/src/ui and will/src/ui differ: copy the changed files to the other app" >&2
  exit 1
fi
