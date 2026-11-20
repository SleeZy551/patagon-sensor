const { Pool } = require('pg');
const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta la variable DATABASE_URL'); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });

async function init() {
  await pool.query(`
  create table if not exists readings(
    id bigserial primary key, sensor text not null, value double precision not null,
    ts timestamptz not null default now());
  create index if not exists readings_sensor_ts on readings(sensor, ts desc);
  create table if not exists alerts(
    id bigserial primary key, level text not null, sensor text, message text not null,
    created_at timestamptz not null default now(), confirmed_at timestamptz);
  create index if not exists alerts_created on alerts(created_at desc);
  create table if not exists crops(
    id serial primary key, name text not null, type text not null, system text, zone text,
    planted_on date not null default current_date, active boolean not null default true);
  create table if not exists measurements(
    id serial primary key, crop_id int not null references crops(id) on delete cascade,
    height double precision not null, width double precision not null, ts timestamptz not null default now());
  create table if not exists yields(season text primary key, kg double precision not null);
  create table if not exists settings(key text primary key, value jsonb not null);`);
}
module.exports = { pool, init };
