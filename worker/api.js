/**
 * Read-only JSON endpoints consumed by the dashboard.
 */
import { getMeta } from './store.js';
import { parseCocDate } from './coc.js';

const parseRows = (rows, extra = () => ({})) => rows.map(r => ({ ...JSON.parse(r.data), ...extra(r) }));

async function latestDate(db) {
    const row = await db.prepare('SELECT MAX(date) AS d FROM member_daily').first();
    return row?.d || null;
}

async function membersOn(db, date) {
    const { results } = await db.prepare('SELECT data FROM member_daily WHERE date = ?').bind(date).all();
    return parseRows(results);
}

/** Latest clan profile with its current roster. */
export async function getClan(db) {
    const row = await db.prepare('SELECT date, data FROM clan_daily ORDER BY date DESC LIMIT 1').first();
    if (!row) return null;
    const date = await latestDate(db);
    return { ...JSON.parse(row.data), memberList: date ? await membersOn(db, date) : [], snapshotDate: row.date };
}

export async function getMemberDates(db) {
    const { results } = await db.prepare('SELECT DISTINCT date FROM member_daily ORDER BY date DESC').all();
    return results.map(r => r.date);
}

export async function getMembers(db, date) {
    const d = date || await latestDate(db);
    return { date: d, members: d ? await membersOn(db, d) : [] };
}

export async function getWars(db) {
    const { results } = await db.prepare(
        'SELECT id, kind, season, round, state, end_time, data FROM wars WHERE ours = 1 ORDER BY start_time').all();
    const now = new Date();
    return parseRows(
        // A preparation snapshot whose end has passed was a cancelled/re-matched search.
        results.filter(r => !(r.state === 'preparation' && parseCocDate(r.end_time) < now)),
        r => ({ id: r.id, filename: r.id, kind: r.kind, season: r.season, round: r.round })
    );
}

export async function getRaids(db) {
    const { results } = await db.prepare('SELECT data FROM raids ORDER BY start_time DESC').all();
    return parseRows(results);
}

/** Every CWL season we have, with the group and all wars in it (not only ours). */
export async function getCwl(db) {
    const groups = (await db.prepare('SELECT season, state, data FROM cwl_groups ORDER BY season DESC').all()).results;
    const wars = (await db.prepare(
        'SELECT id, ours, season, round, data FROM wars WHERE kind = \'cwl\' ORDER BY round').all()).results;
    return groups.map(g => ({
        season: g.season,
        state: g.state,
        group: JSON.parse(g.data),
        wars: parseRows(wars.filter(w => w.season === g.season),
            w => ({ id: w.id, filename: w.id, kind: 'cwl', ours: !!w.ours, season: w.season, round: w.round }))
    }));
}

/**
 * Clan counters per day, roster joins/leaves derived from consecutive daily
 * snapshots, each current member's join date, and the API war log.
 */
export async function getHistory(db) {
    const clanDaily = (await db.prepare(`SELECT date, member_count, clan_level, clan_points, capital_points,
        war_wins, war_losses, war_ties, war_win_streak FROM clan_daily ORDER BY date`).all()).results;
    const rows = (await db.prepare('SELECT date, tag, name, town_hall, role FROM member_daily ORDER BY date').all()).results;

    const byDate = new Map();
    for (const r of rows) {
        if (!byDate.has(r.date)) byDate.set(r.date, new Map());
        byDate.get(r.date).set(r.tag, r);
    }

    const events = [];
    const joinedAt = {};
    let prev = null;
    for (const [date, roster] of byDate) {
        if (!prev) {
            for (const tag of roster.keys()) joinedAt[tag] = { date, beforeTracking: true };
        } else {
            for (const [tag, m] of roster) {
                if (!prev.has(tag)) {
                    events.push({ date, type: 'join', tag, name: m.name, townHall: m.town_hall });
                    joinedAt[tag] = { date, beforeTracking: false };
                }
            }
            for (const [tag, m] of prev) {
                if (!roster.has(tag)) events.push({ date, type: 'leave', tag, name: m.name, townHall: m.town_hall, role: m.role });
            }
        }
        prev = roster;
    }

    const warlog = parseRows((await db.prepare('SELECT data FROM warlog ORDER BY end_time').all()).results);
    return { clanDaily, events, joinedAt, warlog, trackingSince: byDate.keys().next().value || null };
}

export async function getPlayer(db, tag) {
    const { results } = await db.prepare(`SELECT date, name, role, town_hall, exp_level, trophies, donations, donations_received
        FROM member_daily WHERE tag = ? ORDER BY date`).bind(tag).all();
    return { tag, daily: results };
}

export async function getStatus(db) {
    return { lastCollect: await getMeta(db, 'last_collect'), lastSuccess: await getMeta(db, 'last_success') };
}
