#!/bin/zsh

set -e

DEFAULT_PROJECT_DIR="/Users/maiconsilvasantos/Downloads/Projetos/pecuaria/Grupos"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Se o .command for movido para outro lugar (ex: Desktop),
# usa o diretório padrão do projeto.
if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  PROJECT_DIR="$DEFAULT_PROJECT_DIR"
fi

cd "$PROJECT_DIR"

PORT_FROM_ENV=""
if [[ -f "$PROJECT_DIR/.env" ]]; then
  PORT_FROM_ENV="$(grep -E '^PORT=' .env | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)"
fi

PORT="${PORT_FROM_ENV:-4000}"

echo "Iniciando app em: $PROJECT_DIR"
echo "Porta detectada: $PORT"
echo ""

npm run dev &
DEV_PID=$!

sleep 2
open "http://localhost:${PORT}"

wait $DEV_PID
