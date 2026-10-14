#!/usr/bin/env bash
# Сборка и выкладка на Raspberry Pi (Caddy в Docker раздаёт ~/caddy/site/stata как /srv/stata).
set -euo pipefail
# адрес сервера — в .deploy.env (не в git): DEPLOY_HOST=user@host
[ -f "$(dirname "$0")/../.deploy.env" ] && . "$(dirname "$0")/../.deploy.env"
HOST="${DEPLOY_HOST:?Укажите DEPLOY_HOST в .deploy.env}"
cd "$(dirname "$0")/.."
npm run build
rsync -az --delete dist/ "$HOST:/tmp/stata-dist/"
ssh "$HOST" 'sudo rsync -a --delete /tmp/stata-dist/ ~/caddy/site/stata/ && rm -rf /tmp/stata-dist'
echo "Готово: https://stata.nukhtarov.ru"
