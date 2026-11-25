# DIM360 QA en la VPS de la Dirección

Desde D-018, la app corre en la VPS de la Dirección (ya no hay Vercel), con la misma forma que los demás proyectos (guía «Migrar proyectos a la VPS»). **La base y las evidencias siguen en Supabase**: la VPS solo corre la app.

| | |
|---|---|
| Dirección | https://dim360.195-35-42-168.sslip.io (provisoria, hasta tener el dominio oficial) |
| Usuario del sistema | `dim360qa` |
| Carpeta | `/srv/dim360-qa` (751): `versiones/`, `actual` → la versión en uso, `compartido/.env` (600), `registros/` |
| Proceso | pm2 `dim360-qa` en `127.0.0.1:3017`, servicio `pm2-dim360qa` (vuelve solo después de un reinicio) |
| nginx | `/etc/nginx/sites-available/dim360-qa` y `snippets/dim360-qa-*.conf`, certificado de Let's Encrypt (`certbot`) |
| Base | Pooler de sesión de Supabase (`DATABASE_URL`, IPv4, puerto 5432) |
| Evidencias | Bucket privado de Supabase (`SUPABASE_URL` y `SUPABASE_SECRET_KEY`) |

Los archivos están en [`despliegue/`](../despliegue/). Todo se corre **como root** por SSH. Desde PowerShell, mejor subir los scripts con `scp` y correrlos allá (las comillas se rompen al pasar por SSH).

## Desplegar una versión nueva

1. Si la versión trae una migración nueva: `npm run db:migrar` (desde la computadora, con `.env.local`), **antes** del deploy.
2. En la VPS:

```bash
bash /srv/dim360-qa/desplegar.sh          # el último commit de main
bash /srv/dim360-qa/desplegar.sh 1a2b3c4  # un commit puntual
```

Clona el commit en `versiones/<fecha>-<sha>`, enlaza el `.env`, corre `npm ci` y `npm run build` como `dim360qa`, apunta `actual` a la versión nueva y hace `pm2 reload`. Si la versión nueva no responde en 60 segundos, vuelve sola a la anterior. Quedan las 3 versiones más nuevas.

### Volver a la versión anterior a mano

```bash
ls -1dt /srv/dim360-qa/versiones/2*                    # la primera es la actual
ln -sfn /srv/dim360-qa/versiones/<anterior> /srv/dim360-qa/actual
sudo -u dim360qa -H bash -c 'cd /srv/dim360-qa && PM2_HOME=/srv/dim360-qa/.pm2 pm2 reload dim360-qa --update-env'
```

## Instalación desde cero

1. `scp -r despliegue root@<vps>:/root/dim360-qa-despliegue` y, allá, `bash /root/dim360-qa-despliegue/preparar-servidor.sh`: crea el usuario, las carpetas, copia `ecosystem.config.js` y `desplegar.sh`, y registra el servicio `pm2-dim360qa`.
2. **`.env`** en `/srv/dim360-qa/compartido/.env`, dueño `dim360qa`, modo 600. Lleva `DATABASE_URL` (el pooler de sesión de Supabase, el mismo que `DIRECT_URL` en `.env.local`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ENCABEZADOS_SEGURIDAD=nginx` y un `SESSION_SECRET` nuevo, generado en la VPS: `openssl rand -base64 48`. Nunca se copia por chat ni se versiona.
3. `bash /srv/dim360-qa/desplegar.sh`.
4. nginx, primero solo HTTP para sacar el certificado:

```bash
cp /root/dim360-qa-despliegue/nginx-dim360-qa-http.conf /etc/nginx/sites-available/dim360-qa
ln -s /etc/nginx/sites-available/dim360-qa /etc/nginx/sites-enabled/dim360-qa
nginx -t && systemctl reload nginx
certbot certonly --nginx -d dim360.195-35-42-168.sslip.io
install -m 644 /root/dim360-qa-despliegue/nginx-dim360-qa-encabezados.conf /etc/nginx/snippets/dim360-qa-encabezados.conf
install -m 644 /root/dim360-qa-despliegue/nginx-dim360-qa-proxy.conf /etc/nginx/snippets/dim360-qa-proxy.conf
cp /root/dim360-qa-despliegue/nginx-dim360-qa.conf /etc/nginx/sites-available/dim360-qa
nginx -t && systemctl reload nginx
```

5. Verificar (abajo).

## Verificar

- `https://…/` da 200, y un CSS de `/_next/static/` también da 200. Cada encabezado de seguridad sale **una sola vez** (`curl -sI`), con `X-Frame-Options: SAMEORIGIN`. Un 403 es la carpeta en 750: tiene que ser 751.
- `/.env`, `/.git/config` y `/package.json` dan 404.
- `/admin` lleva al ingreso del panel y `/relevamiento` al del portal.
- Ingresar al portal y al panel, y abrir una evidencia (la lee del bucket).
- `systemctl is-enabled pm2-dim360qa` dice `enabled`.

## Cuidado

- **Encabezados de seguridad**: los pone nginx (`snippets/dim360-qa-encabezados.conf` en cada `location`) y la app corre con `ENCABEZADOS_SEGURIDAD=nginx`, que se lee **al compilar**: si se cambia, hay que volver a desplegar. Si la app también los mandara, se sumarían a los globales de la VPS (`conf.d/seguridad-panel.conf`, con `X-Frame-Options DENY`) y saldrían repetidos o en choque.
- **X-Forwarded-For**: el sitio de nginx lo pisa con la IP real (`$remote_addr`). La app toma la primera IP de ese encabezado para el límite de intentos del ingreso del panel; si nginx agregara a lo que manda el cliente, se podría inventar una IP.
- **Cookies**: cambiar de dirección (por ejemplo, de sslip.io al dominio oficial) cierra todas las sesiones y vacía la lista de nombres de cada navegador. Los relevadores vuelven a escribir su nombre y eligen su perfil en «¿Sos vos?»: no se pierde nada.
- **El agente** usa `PANEL_URL` en su máquina (`agente/.env`): tiene que ser la dirección de la VPS. Si cambia la dirección, hay que cambiarlo ahí también.
- **Mergear no despliega**: sin Vercel, un cambio en `main` llega a la VPS solo cuando alguien corre `desplegar.sh`.
- **pm2** se usa siempre como `dim360qa` y con `PM2_HOME=/srv/dim360-qa/.pm2`, después de un `cd` a la carpeta del proyecto (desde `/root` da EACCES).
