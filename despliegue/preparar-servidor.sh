#!/usr/bin/env bash
# DIM360 QA en la VPS: usuario, carpetas, pm2 y su servicio. Una sola vez, como root.
# Idempotente: se puede volver a correr. No toca la base (sigue en Supabase) ni nginx.
#   bash preparar-servidor.sh
set -euo pipefail

PROYECTO=dim360-qa
USUARIO=dim360qa
RAIZ=/srv/$PROYECTO
AQUI=$(cd "$(dirname "$0")" && pwd)

if ! id "$USUARIO" >/dev/null 2>&1; then
  useradd --system --home-dir "$RAIZ" --create-home --shell /bin/bash "$USUARIO"
fi
mkdir -p "$RAIZ"/{versiones,compartido,registros}
chown "$USUARIO:$USUARIO" "$RAIZ" "$RAIZ"/{versiones,compartido,registros}
# 751: nginx (www-data) tiene que poder atravesarla para servir .next/static. Con 750, los estáticos dan 403.
chmod 751 "$RAIZ"
chmod 755 "$RAIZ/versiones" "$RAIZ/registros"
chmod 750 "$RAIZ/compartido"

install -o "$USUARIO" -g "$USUARIO" -m 644 "$AQUI/ecosystem.config.js" "$RAIZ/ecosystem.config.js"
install -o root -g root -m 755 "$AQUI/desplegar.sh" "$RAIZ/desplegar.sh"

# El .env no viaja en el repo: se sube aparte (docs/DESPLIEGUE-VPS.md).
if [ ! -f "$RAIZ/compartido/.env" ]; then
  echo "Falta $RAIZ/compartido/.env (modo 600, dueño $USUARIO). Ver docs/DESPLIEGUE-VPS.md."
fi

# Servicio de systemd para que pm2 vuelva después de un reinicio (pm2-dim360qa.service).
if ! systemctl list-unit-files | grep -q "^pm2-$USUARIO.service"; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USUARIO" --hp "$RAIZ" >/dev/null
fi
echo "Listo: $RAIZ y pm2-$USUARIO.service."
