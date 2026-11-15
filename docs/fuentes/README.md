# Material que entregó el área

| Archivo | Qué es | Para qué sirve |
|---|---|---|
| `DIM360-checklist-prueba-funcional-2026-11-05.pdf` | Checklist de prueba funcional de DIM360 para el traspaso a la DIM (15 páginas, noviembre de 2026) | **Fuente oficial del catálogo**: 217 pruebas en 22 módulos, con código, perfil (C, O, A, S, P), qué probar y resultado esperado; los cuatro resultados posibles y lo que queda fuera de la prueba |

## Cambios que esto implica

- `npm run catalogo:extraer` genera `src/domain/catalogo/catalogo-dim360.json` a partir de este PDF. La app carga ese JSON en la base al arrancar (idempotente, por código).
- `npm run catalogo:verificar` comprueba que el JSON versionado siga coincidiendo con el PDF y con el índice (cantidad por módulo).
- Si llega una versión nueva del PDF: reemplazar el archivo, correr `npm run catalogo:extraer`, revisar el diff del JSON y desplegar. Los códigos nunca se renumeran; una prueba que desaparezca del PDF no se borra de la base (conserva su historial).

## Módulos (índice del PDF)

| Código | Módulo | Pruebas |
|---|---|---|
| ACC | Acceso y sesión | 10 |
| USR | Usuarios, roles y representaciones | 10 |
| PAD | Contribuyentes y padrón de actividad económica | 21 |
| TRA | Trámites, certificados y habilitaciones | 17 |
| OT | Órdenes de trabajo y fiscalización | 18 |
| PAT | Patrimonios: inmuebles, cementerio y elementos | 9 |
| PAR | Tributos y parametría | 8 |
| TEM | TEM: declaración jurada mensual | 13 |
| TEA | TEM: declaración jurada anual y recategorización | 7 |
| OTR | Otros Tributos: publicidad, ocupación y tasas | 6 |
| CTA | Obligaciones y cuenta corriente | 10 |
| BOL | Boletas y pago en línea | 10 |
| INT | Intereses | 3 |
| PLA | Planes de pago | 13 |
| EXE | Exenciones | 6 |
| AGE | Agentes de retención y percepción | 10 |
| ADH | Adhesiones: débito automático y cesión de haberes | 5 |
| JUD | Cuentas judiciales y expedientes | 6 |
| DFE | Domicilio fiscal electrónico y notificaciones | 8 |
| REC | Recaudación y conciliación | 10 |
| AUT | Procesos automáticos | 6 |
| MIG | Cotejo de datos con los sistemas actuales | 11 |
| | **Total** | **217** |
