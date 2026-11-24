# Patagón Sensor

Panel de monitoreo para cultivos hidropónicos (INDAP Magallanes) con servidor Node.js + PostgreSQL.

## Qué guarda en la base de datos
- **Lecturas** de cada sensor (humedad, temperatura, viento, luz, CO₂, humedad foliar, **nivel de agua**) y su **promedio/mín/máx por día**.
- **Alertas** (con fecha, nivel y confirmación) y su **conteo por día**.
- **Cultivos** (tipo, sistema, zona, fecha de siembra), sus **medidas** y el **rendimiento por temporada**.
- **Umbrales** de alerta configurables.
Las tablas se crean solas al iniciar.

## Estructura
- `server.js` API + reglas de alerta + simulador · `db.js` conexión y tablas
- `public/` panel web (resumen, sensores, mapa, historial, alertas, pronóstico, cultivos, ajustes)
- `render.yaml` configuración del servicio en Render

## Variables de entorno
| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Internal Database URL de tu PostgreSQL en Render |
| `SIMULATE` | `true` = datos de demostración; `false` = solo datos reales |
| `SIM_EVERY` / `RETAIN_DAYS` | Segundos entre lecturas simuladas (60) / días que se conservan las lecturas (60) |

## Conectar sensores reales
Envía lecturas con `POST /api/readings` (acceso abierto, con límite de 60 escrituras por minuto por IP):
```
curl -X POST https://TU-APP.onrender.com/api/readings \
  -H "Content-Type: application/json" \
  -d '[{"sensor":"temp","value":3.8},{"sensor":"niv","value":72}]'
```
Sensores válidos: `temp, hum, vie, par, co2, fol, niv`. Cuando envíes datos reales, pon `SIMULATE=false`.

## Correr en tu PC
1. Instala Node 18+ y ten un PostgreSQL. 2. `npm install` 3. Define las variables de `.env.example` 4. `node server.js` → http://localhost:3000

## Acceso
La página es pública (sin login): quien tenga el enlace o el QR puede ver y registrar datos. Si más adelante quieres restringirla, se puede volver a agregar una clave.
