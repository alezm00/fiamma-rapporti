#!/usr/bin/env bash
# Prove nel browser (Playwright + Chromium). Uso: tests/e2e/run.sh [prova ...]
# Prove: reports pdf send folder backup offline form nav save trash long-list units settings-folder (senza argomenti: tutte)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=${OUT:-/tmp/testoqr-e2e}
PORT=${PORT:-8811}
export NODE_PATH=${NODE_PATH:-$(npm root -g)}

python3 tests/e2e/make-fixtures.py "$OUT"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1

TESTS=("$@")
[ ${#TESTS[@]} -eq 0 ] && TESTS=(reports pdf send folder backup offline form nav save trash long-list units settings-folder)
for t in "${TESTS[@]}"; do
    echo "== $t"
    node "tests/e2e/$t.cjs" "$OUT" "$OUT" "http://localhost:$PORT/"
done
echo "PDF, immagini e schermate in $OUT"
