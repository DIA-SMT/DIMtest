#!/usr/bin/env bash
# Despliega un commit de main (por defecto, el último) en la VPS. Como root.
#   bash /srv/dim360-qa/desplegar.sh            # último commit de main
#   bash /srv/dim360-qa/desplegar.sh <sha>      # un commit puntual
# Si la versión trae una migración nueva, primero `npm run db:migrar` (README §5).
# Volver atrás: apuntar `actual` a la versión anterior y `pm2 reload` (docs/DESPLIEGUE-VPS.md).
set -euo pipefail

PROYECTO=dim360-qa
USUARIO=dim360qa
RAIZ=/srv/$PROYECTO
REPO=https://github.com/DIA-SMT/DIMtest.git
COMMIT=${1:-main}

como() { sudo -u "$USUARIO" -H bash -c "cd '$RAIZ' && $1"; }

[ -f "$RAIZ/compartido/.env" ] || { echo "Falta $RAIZ/compartido/.env"; exit 1; }

TEMP=$(mktemp -d "$RAIZ/versiones/.nueva-XXXX")
chown "$USUARIO:$USUARIO" "$TEMP"
como "git clone --quiet --filter=blob:none '$REPO' '$TEMP' && git -C '$TEMP' checkout --quiet '$COMMIT'"
# Como el dueño del clon: root no lee un repo ajeno («dubious ownership»).
SHA=$(sudo -u "$USUARIO" git -C "$TEMP" rev-parse --short HEAD)
DESTINO="$RAIZ/versiones/$(date +%Y%m%d-%H%M%S)-$SHA"
mv "$TEMP" "$DESTINO"
chmod 755 "$DESTINO"
echo "Versión $SHA en $DESTINO"

ln -sfn "$RAIZ/compartido/.env" "$DESTINO/.env"
como "cd '$DESTINO' && npm ci --no-audit --no-fund --loglevel=error && npm run build"
rm -rf "$DESTINO/.git"

# pm2 corre bajo su servicio de systemd (así vuelve después de un reinicio), no suelto.
systemctl is-active --quiet "pm2-$USUARIO" || systemctl start "pm2-$USUARIO"

ANTERIOR=$(readlink -f "$RAIZ/actual" 2>/dev/null || true)
ln -sfn "$DESTINO" "$RAIZ/actual"
if como "PM2_HOME=$RAIZ/.pm2 pm2 describe $PROYECTO >/dev/null 2>&1"; then
  como "PM2_HOME=$RAIZ/.pm2 pm2 reload $PROYECTO --update-env"
else
  como "PM2_HOME=$RAIZ/.pm2 pm2 start ecosystem.config.js"
fi
como "PM2_HOME=$RAIZ/.pm2 pm2 save --force >/dev/null"

# Esperar a que responda; si no, volver a la anterior.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3017/; then OK=1; break; fi
  sleep 2
done
if [ -z "${OK:-}" ]; then
  echo "La versión nueva no responde."
  if [ -n "$ANTERIOR" ]; then
    ln -sfn "$ANTERIOR" "$RAIZ/actual"
    como "PM2_HOME=$RAIZ/.pm2 pm2 reload $PROYECTO --update-env"
    echo "Se volvió a $ANTERIOR."
  fi
  exit 1
fi

# Quedan las 3 versiones más nuevas.
ls -1dt "$RAIZ"/versiones/2* | tail -n +4 | xargs -r rm -rf
echo "Desplegado $SHA."
