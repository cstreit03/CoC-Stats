/**
 * D1 writes used by the collector.
 */
import { normalizeWar, isoDay } from './coc.js';

const now = () => new Date().toISOString();

/** Saves the clan's state for `date`: clan counters + full roster rows. */
export async function storeClan(db, clan, date = isoDay()) {
    const members = clan.memberList || clan.members || [];
    const { memberList, ...clanOnly } = clan;
    const stmts = [
        db.prepare(`INSERT OR REPLACE INTO clan_daily
            (date, member_count, clan_level, clan_points, capital_points, war_wins, war_losses, war_ties, war_win_streak, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            date, members.length, clan.clanLevel ?? null, clan.clanPoints ?? null, clan.clanCapitalPoints ?? null,
            clan.warWins ?? null, clan.warLosses ?? null, clan.warTies ?? null, clan.warWinStreak ?? null,
            JSON.stringify(clanOnly), now()),
        // Members who left earlier today must not linger in today's roster.
        db.prepare('DELETE FROM member_daily WHERE date = ?').bind(date)
    ];
    for (const m of members) {
        const { playerHouse, ...slim } = m;
        stmts.push(db.prepare(`INSERT INTO member_daily
            (date, tag, name, role, town_hall, exp_level, trophies, donations, donations_received, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            date, m.tag, m.name, m.role, m.townHallLevel ?? null, m.expLevel ?? null, m.trophies ?? null,
            m.donations ?? null, m.donationsReceived ?? null, JSON.stringify(slim)));
    }
    await db.batch(stmts);
}

/** Saves one war. `opts`: { kind, ours, season, round, warTag, clanTag } */
export async function storeWar(db, rawWar, opts = {}) {
    const kind = opts.kind || 'regular';
    const war = opts.clanTag ? normalizeWar(rawWar, opts.clanTag) : rawWar;
    const id = kind === 'cwl' ? `cwl_${opts.warTag.replace('#', '')}` : `war_${war.startTime}`;
    await db.prepare(`INSERT OR REPLACE INTO wars
        (id, kind, ours, season, round, state, start_time, end_time, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        id, kind, opts.ours === false ? 0 : 1, opts.season ?? null, opts.round ?? null,
        war.state, war.startTime, war.endTime, JSON.stringify(war), now()).run();
    return id;
}

export async function storeRaid(db, raid) {
    await db.prepare(`INSERT OR REPLACE INTO raids (start_time, end_time, state, data, updated_at)
        VALUES (?, ?, ?, ?, ?)`).bind(raid.startTime, raid.endTime, raid.state, JSON.stringify(raid), now()).run();
}

export async function setMeta(db, key, value) {
    await db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(key, JSON.stringify(value)).run();
}

export async function getMeta(db, key) {
    const row = await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first();
    return row ? JSON.parse(row.value) : null;
}
