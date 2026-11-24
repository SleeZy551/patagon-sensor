const express = require('express'), path = require('path');
const { pool, init } = require('./db');

const SIM = process.env.SIMULATE !== 'false', EVERY = +(process.env.SIM_EVERY || 60);
const KEEP = +(process.env.RETAIN_DAYS || 60), TZ = process.env.APP_TZ || 'America/Punta_Arenas';

// ---- Sensores, umbrales y reglas de alerta ----
const S = {
  temp: { n: 'Temperatura suelo', u: '°C', b: 4.2, src: 'Teros 12', msg: 'Riesgo de helada negra en Invernadero Norte' },
  hum: { n: 'Humedad suelo', u: '%', b: 34, src: 'Teros 12 · FDR', msg: 'Humedad de suelo baja — revisar riego' },
  vie: { n: 'Viento', u: 'km/h', b: 22, src: 'Anemómetro', msg: 'Viento fuerte — revisar estructura' },
  par: { n: 'Luz (PAR)', u: 'µmol', b: 180, src: 'LI-190R', msg: 'Luz insuficiente para fotosíntesis' },
  co2: { n: 'CO₂ ambiente', u: 'ppm', b: 410, src: 'Sensor invernadero', msg: 'CO₂ alto — ventilar invernadero' },
  fol: { n: 'Humedad foliar', u: '%', b: 12, src: 'Ecowitt WN35', msg: 'Hoja húmeda por mucho tiempo — riesgo de hongos' },
  niv: { n: 'Nivel de agua', u: '%', b: 78, src: 'Sensor de nivel', msg: 'Nivel de agua bajo — rellenar estanque' }
};
const DEF = { temp: 0, hum: 30, vie: 40, niv: 20 };
const thr = (id, T) => (id in DEF ? T[id] : id === 'co2' ? 1000 : id === 'fol' ? 85 : null);
function state(id, v, T) {
  if (v == null) return 'o';
  switch (id) {
    case 'temp': return v < T.temp ? 'r' : v < T.temp + 2 ? 'y' : 'g';
    case 'hum': return v < T.hum ? 'r' : v < T.hum + 5 ? 'y' : 'g';
    case 'vie': return v > T.vie ? 'r' : v > T.vie - 10 ? 'y' : 'g';
    case 'par': return v < 60 ? 'y' : 'g';
    case 'co2': return v > 1200 ? 'r' : v > 800 ? 'y' : 'g';
    case 'fol': return v > 85 ? 'r' : v > 60 ? 'y' : 'g';
    case 'niv': return v < T.niv ? 'r' : v < T.niv + 10 ? 'y' : 'g';
  }
}
const num = x => (x === '' || x === null || x === undefined || !Number.isFinite(+x) ? null : +x);
async function getT() {
  const r = await pool.query("select value from settings where key='thresholds'");
  return Object.assign({}, DEF, r.rows[0] && r.rows[0].value);
}
async function ingest(id, v, ts) {
  const T = await getT();
  await pool.query('insert into readings(sensor,value,ts) values($1,$2,coalesce($3::timestamptz,now()))', [id, v, ts || null]);
  const st = state(id, v, T);
  if (st === 'g' || st === 'o' || (st === 'y' && id === 'par')) return;
  const dup = await pool.query("select 1 from alerts where sensor=$1 and level=$2 and confirmed_at is null and created_at>now()-interval '1 hour' limit 1", [id, st]);
  if (dup.rowCount) return;
  const s = S[id];
  await pool.query('insert into alerts(level,sensor,message) values($1,$2,$3)',
    [st, id, st === 'r' ? s.msg : `Aviso: ${s.n} cerca del umbral (${(+v).toFixed(1)} ${s.u})`]);
}

// ---- Acceso público (sin login). Se limita la cantidad de escrituras por IP ----
const guard = (q, r, n) => n(), guardKey = guard;
const w = f => (q, r) => f(q, r).catch(e => { console.error(e); r.status(500).json({ error: 'server' }); });

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((q, r, n) => { r.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }); n(); });
const hits = {};
setInterval(() => { for (const k in hits) delete hits[k]; }, 6e5);
app.use('/api', (q, r, n) => {
  if (q.method === 'GET') return n();
  const t = Date.now(), h = (hits[q.ip] = (hits[q.ip] || []).filter(x => t - x < 6e4));
  if (h.length >= 60) return r.status(429).json({ error: 'Demasiadas acciones, espera un momento' });
  h.push(t); n();
});
app.get('/api/health', (q, r) => r.json({ ok: true }));

// Recibir lecturas (desde el panel o desde los sensores con cabecera x-api-key)
app.post('/api/readings', guardKey, w(async (q, r) => {
  const arr = (Array.isArray(q.body) ? q.body : [q.body]).slice(0, 100);
  let n = 0;
  for (const x of arr) {
    const v = num(x && x.value);
    if (!x || !S[x.sensor] || v === null) continue;
    const ts = x.ts && !isNaN(new Date(x.ts)) ? new Date(x.ts).toISOString() : null;
    await ingest(x.sensor, v, ts); n++;
  }
  if (!n) return r.status(400).json({ error: 'Lectura inválida. Sensores: ' + Object.keys(S).join(', ') });
  r.json({ saved: n });
}));

app.get('/api/state', guard, w(async (q, r) => {
  const T = await getT();
  const [l, h, a] = await Promise.all([
    pool.query("select distinct on (sensor) sensor, value, ts from readings where ts>now()-interval '2 days' order by sensor, ts desc"),
    pool.query("select sensor, value from (select sensor, value, ts, row_number() over(partition by sensor order by ts desc) rn from readings where ts>now()-interval '2 days') t where rn<=24 order by sensor, ts"),
    pool.query('select id, level, sensor, message, created_at, confirmed_at from alerts order by created_at desc limit 60')]);
  const cur = {}, hist = {};
  l.rows.forEach(x => cur[x.sensor] = x);
  h.rows.forEach(x => (hist[x.sensor] = hist[x.sensor] || []).push(x.value));
  const sensors = Object.keys(S).map(id => {
    const v = cur[id] ? cur[id].value : null;
    return { id, n: S[id].n, u: S[id].u, src: S[id].src, msg: S[id].msg, v, ts: cur[id] && cur[id].ts, st: state(id, v, T), thr: thr(id, T), h: hist[id] || [] };
  });
  r.json({ sensors, alerts: a.rows, settings: T, sim: { on: SIM, frost } });
}));

app.get('/api/daily', guard, w(async (q, r) => {
  const id = String(q.query.sensor), d = Math.min(+q.query.days || 14, 90);
  if (!S[id]) return r.status(400).json({ error: 'sensor' });
  const x = await pool.query(`select to_char((ts at time zone $3)::date,'YYYY-MM-DD') d, avg(value) avg, min(value) min, max(value) max, count(*)::int n
    from readings where sensor=$1 and ts>now()-make_interval(days=>$2::int) group by 1 order by 1`, [id, d, TZ]);
  r.json(x.rows);
}));
app.get('/api/alerts/daily', guard, w(async (q, r) => {
  const x = await pool.query(`select to_char((created_at at time zone $2)::date,'YYYY-MM-DD') d, level, count(*)::int n
    from alerts where created_at>now()-make_interval(days=>$1::int) group by 1,2 order by 1`, [Math.min(+q.query.days || 14, 90), TZ]);
  r.json(x.rows);
}));
app.patch('/api/alerts/:id', guard, w(async (q, r) => {
  await pool.query('update alerts set confirmed_at=now() where id=$1 and confirmed_at is null', [+q.params.id]);
  r.json({ ok: true });
}));

app.put('/api/settings', guard, w(async (q, r) => {
  if (q.body.reset) await pool.query("delete from settings where key='thresholds'");
  else {
    const T = await getT();
    Object.keys(DEF).forEach(k => { const v = num(q.body[k]); if (v !== null) T[k] = v; });
    await pool.query("insert into settings values('thresholds',$1) on conflict(key) do update set value=$1", [JSON.stringify(T)]);
  }
  r.json(await getT());
}));

// ---- Cultivos y mediciones ----
app.get('/api/crops', guard, w(async (q, r) => {
  const c = await pool.query("select id,name,type,system,zone,to_char(planted_on,'YYYY-MM-DD') planted from crops where active order by id");
  const m = await pool.query("select crop_id, height h, width w, to_char(ts at time zone $1,'DD/MM') d from measurements order by ts", [TZ]);
  c.rows.forEach(x => x.meas = m.rows.filter(y => y.crop_id === x.id));
  r.json(c.rows);
}));
app.post('/api/crops', guard, w(async (q, r) => {
  const b = q.body || {}, name = String(b.name || '').trim().slice(0, 60);
  if (!name) return r.status(400).json({ error: 'nombre' });
  const x = await pool.query('insert into crops(name,type,system,zone) values($1,$2,$3,$4) returning id',
    [name, String(b.type || 'otro').slice(0, 30), String(b.system || '').slice(0, 30), String(b.zone || '').slice(0, 40)]);
  r.json(x.rows[0]);
}));
app.patch('/api/crops/:id', guard, w(async (q, r) => {
  await pool.query('update crops set active=false where id=$1', [+q.params.id]); r.json({ ok: true });
}));
app.post('/api/crops/:id/measurements', guard, w(async (q, r) => {
  const h = num(q.body.height), wd = num(q.body.width);
  if (h === null || wd === null) return r.status(400).json({ error: 'medidas' });
  await pool.query('insert into measurements(crop_id,height,width) values($1,$2,$3)', [+q.params.id, h, wd]); r.json({ ok: true });
}));
app.get('/api/yields', guard, w(async (q, r) => r.json((await pool.query('select season, kg from yields order by season')).rows)));
app.post('/api/yields', guard, w(async (q, r) => {
  const s = String(q.body.season || '').trim().slice(0, 12), k = num(q.body.kg);
  if (!s || k === null) return r.status(400).json({ error: 'datos' });
  await pool.query('insert into yields values($1,$2) on conflict(season) do update set kg=$2', [s, k]); r.json({ ok: true });
}));

app.get('/api/export.csv', guard, w(async (q, r) => {
  const x = await pool.query("select ts, sensor, value from readings where ts>now()-make_interval(days=>$1::int) order by ts limit 200000", [Math.min(+q.query.days || 7, 365)]);
  r.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="patagon-lecturas.csv"' });
  r.send('fecha,sensor,valor\n' + x.rows.map(y => `${y.ts.toISOString()},${y.sensor},${y.value}`).join('\n'));
}));

// ---- Simulador (solo demostración; apágalo con SIMULATE=false al conectar sensores reales) ----
let frost = false; const cur = {};
app.post('/api/sim/frost', guard, (q, r) => { if (!SIM) return r.status(400).json({ error: 'sim off' }); frost = !!q.body.on; r.json({ frost }); });
async function simTick() {
  for (const id in S) {
    const s = S[id]; if (cur[id] == null) cur[id] = s.b;
    let tg = s.b; if (frost && id === 'temp') tg = -4.5; if (frost && id === 'vie') tg = 48;
    let v = cur[id] + (tg - cur[id]) * 0.15 + (Math.random() - 0.5) * (Math.abs(s.b) * 0.02 + 0.15);
    if (v < 0 && id !== 'temp') v = 0; if (s.u === '%' && v > 100) v = 100;
    cur[id] = v; await ingest(id, Math.round(v * 100) / 100);
  }
}
async function seed() {
  const c = await pool.query('select count(*)::int n from readings');
  if (c.rows[0].n) return;
  const sensors = [], vals = [], tss = [], now = Date.now();
  for (let i = 7 * 24; i >= 1; i--) for (const id in S) {
    const b = S[id].b; sensors.push(id); tss.push(new Date(now - i * 36e5).toISOString());
    vals.push(+(b + Math.sin(i / 3.8) * Math.abs(b) * 0.12 + (Math.random() - 0.5) * Math.abs(b) * 0.06).toFixed(2));
  }
  await pool.query('insert into readings(sensor,value,ts) select * from unnest($1::text[],$2::float8[],$3::timestamptz[])', [sensors, vals, tss]);
  const al = [['r', 'temp', 'Riesgo de helada negra en Invernadero Norte', 5], ['y', 'vie', 'Aviso: Viento cerca del umbral (33.0 km/h)', 4], ['y', 'hum', 'Aviso: Humedad suelo cerca del umbral (33.5 %)', 3], ['r', 'niv', 'Nivel de agua bajo — rellenar estanque', 2], ['y', 'temp', 'Aviso: Temperatura suelo cerca del umbral (1.4 °C)', 1]];
  for (const a of al) await pool.query("insert into alerts(level,sensor,message,created_at,confirmed_at) values($1,$2,$3,now()-make_interval(days=>$4),now()-make_interval(days=>$4))", a);
  if (!(await pool.query('select 1 from crops limit 1')).rowCount) {
    const k = await pool.query("insert into crops(name,type,system,zone,planted_on) values('Frutilla hidropónica','frutilla','NFT','Invernadero Norte',current_date-30) returning id");
    await pool.query("insert into measurements(crop_id,height,width,ts) values($1,12,14,now()-interval '14 days'),($1,15,18,now()-interval '7 days')", [k.rows[0].id]);
    await pool.query("insert into yields values('2022-23',1.2),('2023-24',1.5),('2024-25',1.7),('2025-26',1.9)");
  }
}

app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (r, p) => { if (/(index\.html|sw\.js)$/.test(p)) r.set('Cache-Control', 'no-cache'); } }));

(async () => {
  await init();
  if (SIM) { await seed(); setInterval(() => simTick().catch(console.error), EVERY * 1000); }
  setInterval(() => pool.query('delete from readings where ts<now()-make_interval(days=>$1::int)', [KEEP]).catch(console.error), 864e5);
  app.listen(process.env.PORT || 3000, () => console.log('Patagón Sensor listo' + (SIM ? ' (modo simulado)' : '')));
})().catch(e => { console.error(e); process.exit(1); });
