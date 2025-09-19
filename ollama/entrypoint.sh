#!/usr/bin/env sh
set -euo pipefail

MODEL="${OLLAMA_MODEL:-llama3.1:8b}"

echo "[entrypoint] starting ollama server..."
ollama serve &
SERVER_PID=$!

echo "[entrypoint] waiting for ollama API..."
for i in $(seq 1 60); do
  if curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "[entrypoint] ollama API did not come up in time" >&2
  kill "$SERVER_PID" || true
  exit 1
fi

if curl -fsS http://localhost:11434/api/tags | grep -q "\"name\":\"${MODEL}\""; then
  echo "[entrypoint] model '${MODEL}' already present; skipping pull."
else
  echo "[entrypoint] pulling model '${MODEL}'..."
  # Use API to pull, stream progress to stdout
  curl -fsS -N -H "Content-Type: application/json" \
    -d "{\"name\":\"${MODEL}\"}" \
    http://localhost:11434/api/pull | sed -u 's/.*/[pull] &/'
  echo "[entrypoint] pull completed."
fi

echo "[entrypoint] serving on 0.0.0.0:11434"
wait "$SERVER_PID"

