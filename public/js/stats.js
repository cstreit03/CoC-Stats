/**
 * Aggregations shared by views and reports.
 */
import { store, members } from './store.js';
import { parseCoc, cocDay, warPhase, warResult, scoreResult } from './util.js';

const DAY = 86400000;

/** Tracked wars inside a time range: 'all' | '7d' | '30d' | '90d' | 'month' */
export function inRange(wars, range) {
    if (!range || range === 'all') return wars;
    const now = Date.now();
    if (range === 'month') {
        const ym = new Date().toISOString().slice(0, 7).replace('-', '');
        return wars.filter(w => w.startTime.slice(0, 6) === ym);
    }
    const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
    return wars.filter(w => parseCoc(w.startTime) >= now - days * DAY);
}

export const rangeOptions = [
    { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' },
    { value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }
];

/**
 * One list of every war we know about: tracked wars (with full detail) plus
 * war-log entries from before tracking or missed snapshots. Newest first.
 */
export function warHistory() {
    const logged = [];
    for (const w of store.history?.warlog || []) {
        const cwl = !w.opponent?.name;
        logged.push({
            id: null, endTime: w.endTime, kind: cwl ? 'cwl' : 'regular', teamSize: w.teamSize,
            opponent: w.opponent || {}, clanStars: w.clan.stars, oppStars: w.opponent?.stars,
            clanDest: w.clan.destructionPercentage, oppDest: w.opponent?.destructionPercentage,
            phase: 'ended',
            result: w.result === 'win' ? 'win' : w.result === 'lose' ? 'loss' : w.result === 'tie' ? 'draw' : null
        });
    }
    // The log's end time can be a second off the war's; match on opponent + time instead.
    const near = (a, b) => Math.abs(parseCoc(a) - parseCoc(b)) < 3600000;
    const merged = [];
    for (const w of store.wars) {
        const phase = warPhase(w);
        const i = logged.findIndex(e => near(e.endTime, w.endTime) && (e.opponent?.tag ? e.opponent.tag === w.opponent.tag : w.kind === 'cwl'));
        const log = i >= 0 ? logged.splice(i, 1)[0] : null;
        merged.push({
            id: w.id, war: w, endTime: w.endTime, startTime: w.startTime, kind: w.kind, round: w.round, teamSize: w.teamSize,
            opponent: w.opponent, clanStars: w.clan.stars, oppStars: w.opponent.stars,
            clanDest: w.clan.destructionPercentage, oppDest: w.opponent.destructionPercentage, phase,
            // The war log is authoritative for results; otherwise only ended wars have one.
            result: log?.result ?? (phase === 'ended' ? warResult(w) : null),
            // Final score from the log when our last snapshot predates the end.
            ...(phase === 'unconfirmed' && log ? { clanStars: log.clanStars, oppStars: log.oppStars, clanDest: log.clanDest, oppDest: log.oppDest } : {})
        });
    }
    return [...merged, ...logged].sort((a, b) => b.endTime.localeCompare(a.endTime));
}

/** Wins/losses/draws and win rate over war-history entries. */
export function record(entries) {
    const r = { win: 0, loss: 0, draw: 0 };
    for (const e of entries) if (e.result) r[e.result]++;
    const total = r.win + r.loss + r.draw;
    return { ...r, total, winRate: total ? r.win / total : null };
}

/** Per-member attack and defense stats across tracked wars. */
export function memberWarStats(wars) {
    const map = new Map();
    const roster = new Map(members().map(m => [m.tag, m]));
    for (const war of wars) {
        const phase = warPhase(war);
        if (phase === 'preparation') continue;
        const apm = war.attacksPerMember || 2;
        const oppTh = new Map((war.opponent.members || []).map(m => [m.tag, m.townhallLevel]));
        for (const m of war.clan.members || []) {
            const p = map.get(m.tag) || {
                tag: m.tag, name: m.name, th: m.townhallLevel, wars: 0, used: 0, available: 0, missed: 0,
                stars: 0, triples: 0, twos: 0, ones: 0, zeros: 0, destruction: 0, thDiff: 0,
                defended: 0, starsConceded: 0, current: roster.has(m.tag)
            };
            p.name = m.name;
            p.th = Math.max(p.th, m.townhallLevel);
            p.wars++;
            const atks = m.attacks || [];
            p.used += atks.length;
            // Unused attacks only count as missed once the war has ended.
            if (phase === 'ended') { p.available += apm; p.missed += apm - atks.length; }
            else p.available += atks.length;
            for (const a of atks) {
                p.stars += a.stars;
                p.destruction += a.destructionPercentage;
                if (a.stars === 3) p.triples++; else if (a.stars === 2) p.twos++; else if (a.stars === 1) p.ones++; else p.zeros++;
                p.thDiff += (oppTh.get(a.defenderTag) || m.townhallLevel) - m.townhallLevel;
            }
            if (m.bestOpponentAttack) { p.defended++; p.starsConceded += m.bestOpponentAttack.stars; }
            map.set(m.tag, p);
        }
    }
    return [...map.values()].map(p => ({
        ...p,
        avgStars: p.used ? p.stars / p.used : null,
        tripleRate: p.used ? p.triples / p.used : null,
        avgDestruction: p.used ? p.destruction / p.used : null,
        usage: p.available ? p.used / p.available : null,
        avgThDiff: p.used ? p.thDiff / p.used : null,
        avgConceded: p.defended ? p.starsConceded / p.defended : null
    }));
}

/** Clan-level totals across tracked wars. */
export function clanWarTotals(wars) {
    const ended = wars.filter(w => warPhase(w) === 'ended');
    let attacks = 0, stars = 0, triples = 0, dest = 0, available = 0;
    for (const w of wars) {
        if (warPhase(w) === 'preparation') continue;
        for (const m of w.clan.members || []) for (const a of m.attacks || []) {
            attacks++; stars += a.stars; dest += a.destructionPercentage; if (a.stars === 3) triples++;
        }
    }
    for (const w of ended) available += (w.attacksPerMember || 2) * w.teamSize;
    const usedInEnded = ended.reduce((s, w) => s + (w.clan.attacks || 0), 0);
    return {
        wars: ended.length, attacks, stars, triples,
        avgStars: attacks ? stars / attacks : null,
        tripleRate: attacks ? triples / attacks : null,
        avgDestruction: attacks ? dest / attacks : null,
        missed: available - usedInEnded,
        starRate: ended.length ? ended.reduce((s, w) => s + w.clan.stars / (w.teamSize * 3), 0) / ended.length : null
    };
}

/** War results grouped by month (YYYY-MM), oldest first. */
export function recordByMonth(entries) {
    const months = new Map();
    for (const e of [...entries].reverse()) {
        if (!e.result) continue;
        const ym = `${e.endTime.slice(0, 4)}-${e.endTime.slice(4, 6)}`;
        const m = months.get(ym) || { win: 0, loss: 0, draw: 0 };
        m[e.result]++;
        months.set(ym, m);
    }
    return months;
}

/* ---------------- CWL ---------------- */

export const defaultWeights = {
    star: 2,          // points per star
    destruction: 0.02, // points per % destruction (100% = 2 pts)
    triple: 1,        // bonus for a three-star
    thDiff: 0.5,      // per Town Hall level attacked above own (negative when attacking down)
    missed: -4,       // per missed attack (war ended, no attack)
    conceded: 0       // per star conceded on own base (use a negative number to penalise)
};
export const weightLabels = {
    star: 'Points per star', destruction: 'Points per % destruction', triple: 'Three-star bonus',
    thDiff: 'Per TH level attacked up', missed: 'Missed attack', conceded: 'Per star conceded on defense'
};

/**
 * Row per lineup slot per round: the attack (or miss) and the defense.
 * rows: { tag, name, th, round, opponent, mapPos, defPos, defTh, thDiff, stars, destruction, triple, missed, pending, conceded, concededDest, score }
 */
export function cwlAttackRows(season, weights = defaultWeights) {
    const rows = [];
    const ours = season.wars.filter(w => w.ours).sort((a, b) => a.round - b.round);
    for (const war of ours) {
        const phase = warPhase(war);
        if (phase === 'preparation') continue;
        const opp = new Map((war.opponent.members || []).map(m => [m.tag, m]));
        for (const m of war.clan.members || []) {
            const a = (m.attacks || [])[0];
            const def = a ? opp.get(a.defenderTag) : null;
            const row = {
                tag: m.tag, name: m.name, th: m.townhallLevel, round: war.round, opponent: war.opponent.name, warId: war.id,
                mapPos: m.mapPosition, defPos: def?.mapPosition ?? null, defTh: def?.townhallLevel ?? null,
                thDiff: def ? def.townhallLevel - m.townhallLevel : null,
                stars: a ? a.stars : null, destruction: a ? a.destructionPercentage : null,
                triple: a ? (a.stars === 3 ? 1 : 0) : 0,
                missed: !a && phase === 'ended' ? 1 : 0,
                pending: !a && phase !== 'ended',
                conceded: m.bestOpponentAttack?.stars ?? 0,
                concededDest: m.bestOpponentAttack?.destructionPercentage ?? 0
            };
            row.score = scoreRow(row, weights);
            rows.push(row);
        }
    }
    return rows;
}

export function scoreRow(r, w) {
    return (r.stars || 0) * w.star + (r.destruction || 0) * w.destruction + r.triple * w.triple
        + (r.thDiff || 0) * w.thDiff + r.missed * w.missed + r.conceded * w.conceded;
}

/** Per-member totals from attack rows, with a per-round lookup. */
export function cwlSummary(rows) {
    const map = new Map();
    for (const r of rows) {
        const p = map.get(r.tag) || { tag: r.tag, name: r.name, th: r.th, wars: 0, attacks: 0, missed: 0, stars: 0, triples: 0, destruction: 0, conceded: 0, score: 0, rounds: {} };
        p.wars++;
        if (r.stars != null) { p.attacks++; p.stars += r.stars; p.destruction += r.destruction; p.triples += r.triple; }
        p.missed += r.missed;
        p.conceded += r.conceded;
        p.score += r.score;
        p.rounds[r.round] = r;
        map.set(r.tag, p);
    }
    return [...map.values()].map(p => ({ ...p, avgDestruction: p.attacks ? p.destruction / p.attacks : null }))
        .sort((a, b) => b.score - a.score);
}

/** Group standings: stars (+10 per war won) then total destruction. */
export function cwlStandings(season) {
    const table = new Map((season.group.clans || []).map(c => [c.tag, { ...c, stars: 0, destruction: 0, win: 0, loss: 0, draw: 0 }]));
    for (const war of season.wars) {
        const phase = warPhase(war);
        if (phase === 'preparation') continue;
        for (const [side, other] of [['clan', 'opponent'], ['opponent', 'clan']]) {
            const row = table.get(war[side].tag);
            if (!row) continue;
            row.stars += war[side].stars || 0;
            row.destruction += (war[side].destructionPercentage || 0) * (war.teamSize || 0);
            if (phase !== 'ended') continue;
            const res = scoreResult(war[side].stars, war[other].stars, war[side].destructionPercentage, war[other].destructionPercentage);
            row[res]++;
            if (res === 'win') row.stars += 10;
        }
    }
    return [...table.values()].sort((a, b) => b.stars - a.stars || b.destruction - a.destruction);
}

/* ---------------- Roster ---------------- */

export function membershipDelta(days) {
    const daily = store.history?.clanDaily || [];
    if (!daily.length) return null;
    const last = daily[daily.length - 1];
    const cutoff = new Date(Date.parse(`${last.date}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10);
    const base = daily.find(d => d.date >= cutoff) || daily[0];
    return { now: last.member_count, delta: last.member_count - base.member_count, since: base.date };
}

export function weekStart(iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
}

/** Our clan's war-log summary (same shape the Worker stores for opponents). */
export function ourWarLogSummary() {
    const wars = (store.history?.warlog || []).filter(i => i.result && (i.attacksPerMember || 2) === 2 && i.teamSize).slice(-30);
    if (!wars.length) return null;
    const avg = (fn) => wars.reduce((s, w) => s + fn(w), 0) / wars.length;
    return {
        wars: wars.length,
        wins: wars.filter(w => w.result === 'win').length,
        losses: wars.filter(w => w.result === 'lose').length,
        ties: wars.filter(w => w.result === 'tie').length,
        starRate: avg(w => w.clan.stars / (w.teamSize * 3)),
        concededRate: avg(w => (w.opponent?.stars ?? 0) / (w.teamSize * 3)),
        attackUsage: avg(w => Math.min(1, (w.clan.attacks ?? w.teamSize * 2) / (w.teamSize * 2))),
        destruction: avg(w => w.clan.destructionPercentage || 0),
        starRates: wars.map(w => w.clan.stars / (w.teamSize * 3)),
        concededRates: wars.map(w => (w.opponent?.stars ?? 0) / (w.teamSize * 3))
    };
}

export { cocDay };
