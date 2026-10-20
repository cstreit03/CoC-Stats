/**
 * D1 schema. Applied automatically (idempotent) before the Worker first touches
 * the database, so a fresh deploy needs no migration step.
 */
const STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS wars ( id TEXT PRIMARY KEY, kind TEXT NOT NULL, ours INTEGER NOT NULL DEFAULT 1, season TEXT, round INTEGER, state TEXT, start_time TEXT, end_time TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL )`,
    `CREATE INDEX IF NOT EXISTS wars_start ON wars (ours, start_time)`,
    `CREATE INDEX IF NOT EXISTS wars_season ON wars (season)`,
    `CREATE TABLE IF NOT EXISTS cwl_groups ( season TEXT PRIMARY KEY, state TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS raids ( start_time TEXT PRIMARY KEY, end_time TEXT, state TEXT, data TEXT NOT NULL, updated_at TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS warlog ( end_time TEXT PRIMARY KEY, result TEXT, data TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS clan_daily ( date TEXT PRIMARY KEY, member_count INTEGER, clan_level INTEGER, clan_points INTEGER, capital_points INTEGER, war_wins INTEGER, war_losses INTEGER, war_ties INTEGER, war_win_streak INTEGER, data TEXT NOT NULL, updated_at TEXT NOT NULL )`,
    `CREATE TABLE IF NOT EXISTS member_daily ( date TEXT NOT NULL, tag TEXT NOT NULL, name TEXT, role TEXT, town_hall INTEGER, exp_level INTEGER, trophies INTEGER, donations INTEGER, donations_received INTEGER, data TEXT NOT NULL, PRIMARY KEY (date, tag) )`,
    `CREATE INDEX IF NOT EXISTS member_daily_tag ON member_daily (tag, date)`,
    `CREATE TABLE IF NOT EXISTS meta ( key TEXT PRIMARY KEY, value TEXT )`
];

let ready = null;

export function ensureSchema(db) {
    ready ??= db.batch(STATEMENTS.map(s => db.prepare(s))).catch(e => { ready = null; throw e; });
    return ready;
}
