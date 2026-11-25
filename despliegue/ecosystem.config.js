// pm2 para DIM360 QA en la VPS. preparar-servidor.sh lo copia a /srv/dim360-qa/ecosystem.config.js.
module.exports = {
  apps: [
    {
      name: "dim360-qa",
      cwd: "/srv/dim360-qa/actual",
      script: "node_modules/next/dist/bin/next",
      // -H 127.0.0.1: sin eso next escucha en todas las interfaces. Se entra solo por nginx.
      args: "start -p 3017 -H 127.0.0.1",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      error_file: "/srv/dim360-qa/registros/error.log",
      out_file: "/srv/dim360-qa/registros/salida.log",
    },
  ],
};
