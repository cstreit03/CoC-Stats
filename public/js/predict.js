/**
 * War outcome predictor.
 *
 * Simulates every remaining attack thousands of times and counts how often we
 * win, draw or lose. Each attack's star outcome depends on:
 *  - the attacker's skill: expected stars against an equal Town Hall.
 *      Our members: their tracked war attacks, shrunk toward the clan average.
 *      Opponents: their public war log (star rate converted to per-attack skill),
 *      else their win/loss record, refined by attacks they make in this war.
 *  - the Town Hall gap between attacker and target (attacking up is penalised
 *    and capped; attacking down helps a little).
 *  - attack usage: how often each side's members actually use their attacks.
 * Each simulation also draws both clans' level from their recent wars, so a
 * clan that sometimes clears every base and sometimes doesn't is modelled that
 * way: this is what produces realistic numbers of draws and upsets (checked
 * against our own last 30 wars).
 * Stars and destruction already on the board are kept; only remaining attacks
 * are simulated. Targets are picked greedily for the most new stars, lower map
 * positions attacking first, which approximates mirror-then-cleanup play.
 */
import { warPhase } from './util.js';
import { ourWarLogSummary } from './stats.js';

const PRIOR_SKILL = 2.2;      // league-average expected stars vs. an equal TH
const SHRINK = 5;             // pseudo-attacks pulling a member toward their clan average
const USAGE_SHRINK = 4;

/* P(0..3 stars) anchored by expected stars; linear in between. */
const ANCHORS = [
    [0.0, [1, 0, 0, 0]],
    [0.6, [0.45, 0.5, 0.05, 0]],
    [1.2, [0.15, 0.5, 0.33, 0.02]],
    [1.8, [0.05, 0.2, 0.65, 0.1]],
    [2.2, [0.02, 0.08, 0.56, 0.34]],
    [2.6, [0.01, 0.03, 0.28, 0.68]],
    [3.0, [0, 0, 0, 1]]
];

export function starDist(mu) {
    const m = Math.min(3, Math.max(0, mu));
    for (let i = 1; i < ANCHORS.length; i++) {
        const [x1, p1] = ANCHORS[i];
        if (m <= x1) {
            const [x0, p0] = ANCHORS[i - 1];
            const t = (m - x0) / (x1 - x0);
            return p0.map((p, k) => p + (p1[k] - p) * t);
        }
    }
    return ANCHORS[ANCHORS.length - 1][1];
}

/** Linear Town Hall effect; d = attacker TH - defender TH. */
const thShift = (d) => d > 0 ? 0.25 * Math.min(d, 3) : 0.6 * d;

/** Expected stars for a matchup, with hard caps when attacking well above own TH. */
export function matchupSkill(skill, d) {
    const cap = d >= -1 ? 3 : d === -2 ? 2.4 : d === -3 ? 2.0 : 1.6;
    return Math.max(0.05, Math.min(cap, skill + thShift(d)));
}

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

function sampleDestruction(stars, r) {
    if (stars === 3) return 100;
    if (stars === 2) return 55 + 44 * r();
    if (stars === 1) return 30 + 40 * r();
    return 8 + 41 * r();
}

/**
 * Simulates one side attacking the other's bases.
 * attackers: [{ skill, th, usage, remaining, pos }]; defenders: [{ th, best, bestDest }]
 * Returns per-simulation callback that writes total stars and destruction.
 */
function makeSide(attackers, defenders) {
    const A = attackers.length, D = defenders.length;
    // Cumulative star distributions per attacker/defender pair.
    const cdf = new Float64Array(A * D * 4);
    const gain = new Float64Array(A * D * 4); // expected new stars given the base's current best
    for (let a = 0; a < A; a++) for (let t = 0; t < D; t++) {
        const p = starDist(matchupSkill(attackers[a].skill, attackers[a].th - defenders[t].th));
        let c = 0;
        for (let k = 0; k < 4; k++) { c += p[k]; cdf[(a * D + t) * 4 + k] = c; }
        for (let b = 0; b < 4; b++) {
            let g = 0;
            for (let k = b + 1; k < 4; k++) g += (k - b) * p[k];
            gain[(a * D + t) * 4 + b] = g + p[3] * 0.01; // slight preference for clean triples
        }
    }
    // Lower map positions attack first; second attacks (cleanup) come after.
    const order = attackers.map((x, i) => i).sort((i, j) => attackers[j].pos - attackers[i].pos);

    const best = new Int8Array(D), dest = new Float64Array(D);
    return (r) => {
        for (let t = 0; t < D; t++) { best[t] = defenders[t].best; dest[t] = defenders[t].bestDest; }
        for (let round = 0; round < 2; round++) {
            for (const a of order) {
                if (attackers[a].remaining <= round) continue;
                if (r() > attackers[a].usage) continue;
                // Greedy target choice with a little noise for imperfect coordination.
                let bestT = -1, bestG = -1;
                for (let t = 0; t < D; t++) {
                    const g = gain[(a * D + t) * 4 + best[t]] * (0.9 + 0.2 * r());
                    if (g > bestG) { bestG = g; bestT = t; }
                }
                if (bestT < 0) continue;
                const u = r(), base = (a * D + bestT) * 4;
                const s = u < cdf[base] ? 0 : u < cdf[base + 1] ? 1 : u < cdf[base + 2] ? 2 : 3;
                const d = sampleDestruction(s, r);
                if (s > best[bestT] || (s === best[bestT] && d > dest[bestT])) { best[bestT] = s; dest[bestT] = d; }
            }
        }
        let stars = 0, dsum = 0;
        for (let t = 0; t < D; t++) { stars += best[t]; dsum += dest[t]; }
        return [stars, dsum / D];
    };
}

/* ---- Converting a war-log star rate into per-attack skill ---- */
const grids = new Map();

/** Star rate a clan of uniform skill reaches in an even 15 v 15 war, on a 0.05 skill grid. */
function rateGrid(usage) {
    const key = Math.round(usage * 50) / 50;
    if (grids.has(key)) return grids.get(key);
    const n = 15, runs = 120, grid = [];
    for (let skill = 0.3; skill <= 3.0001; skill += 0.05) {
        const attackers = Array.from({ length: n }, (_, i) => ({ skill, th: 16, usage: key, remaining: 2, pos: i + 1 }));
        const defenders = Array.from({ length: n }, () => ({ th: 16, best: 0, bestDest: 0 }));
        const sim = makeSide(attackers, defenders), r = rng(42);
        let total = 0;
        for (let i = 0; i < runs; i++) total += sim(r)[0];
        grid.push([skill, total / runs / (n * 3)]);
    }
    grids.set(key, grid);
    return grid;
}

/** What skill produces this star rate? (Interpolated on the calibration grid.) */
export function skillFromStarRate(rate, usage) {
    const grid = rateGrid(usage);
    if (rate <= grid[0][1]) return grid[0][0];
    for (let i = 1; i < grid.length; i++) {
        const [s1, r1] = grid[i];
        if (rate <= r1) {
            const [s0, r0] = grid[i - 1];
            return r1 === r0 ? s1 : s0 + (s1 - s0) * (rate - r0) / (r1 - r0);
        }
    }
    return 3;
}

/** Attack-weighted average of TH-neutralised stars. */
function neutralStars(attacks) {
    if (!attacks.length) return null;
    return attacks.reduce((s, a) => s + Math.min(3, Math.max(0, a.stars - thShift(a.d))), 0) / attacks.length;
}

/** Our members' skill and usage from every tracked war (current war included). */
function ourMemberModel(wars) {
    const perMember = new Map();
    const all = [];
    let used = 0, available = 0;
    for (const w of wars) {
        const phase = warPhase(w);
        if (phase === 'preparation') continue;
        const oppTh = new Map((w.opponent.members || []).map(m => [m.tag, m.townhallLevel]));
        for (const m of w.clan.members || []) {
            const rec = perMember.get(m.tag) || { attacks: [], used: 0, available: 0 };
            for (const a of m.attacks || []) {
                const x = { stars: a.stars, d: m.townhallLevel - (oppTh.get(a.defenderTag) ?? m.townhallLevel) };
                rec.attacks.push(x); all.push(x);
            }
            if (phase === 'ended') {
                const apm = w.attacksPerMember || 2;
                rec.used += (m.attacks || []).length; rec.available += apm;
                used += (m.attacks || []).length; available += apm;
            }
            perMember.set(m.tag, rec);
        }
    }
    // The clan's level comes from its war log (same measure as the opponent's);
    // tracked attacks only say how each member compares to the clan average.
    const log = ourWarLogSummary();
    const attackAvg = all.length ? neutralStars(all) : null;
    const clanUsage = available >= 20 ? used / available : log?.attackUsage ?? 0.9;
    const logUsage = log?.attackUsage || clanUsage;
    const clanSkill = log ? skillFromStarRate(log.starRate, logUsage) : attackAvg ?? PRIOR_SKILL;
    return {
        clanSkill, clanUsage, attackCount: all.length, source: log ? `our last ${log.wars} wars: ${Math.round(log.starRate * 100)}% of stars won` : 'tracked attacks',
        // One clan level per past war, so simulations reflect good and bad days.
        draws: log ? log.starRates.map(r => skillFromStarRate(r, logUsage)) : [clanSkill],
        member(tag, base = clanSkill) {
            const rec = perMember.get(tag);
            const n = rec?.attacks.length || 0;
            const relative = n && attackAvg != null ? (neutralStars(rec.attacks) - attackAvg) * n / (n + SHRINK) : 0;
            const skill = Math.max(0.3, Math.min(3, base + relative));
            const usage = rec ? (rec.used + clanUsage * USAGE_SHRINK) / (rec.available + USAGE_SHRINK) : clanUsage;
            return { skill, usage, attacks: n };
        }
    };
}

/**
 * Opponent clan skill: their war log > their win/loss record > how our recent
 * opponents have actually performed against us (matchmaking pairs similar clans).
 */
function opponentClanModel(war) {
    const p = war.opponentProfile;
    const ours = ourWarLogSummary();
    const typical = ours ? {
        skill: skillFromStarRate(ours.concededRate, 0.9),
        draws: ours.concededRates.map(r => skillFromStarRate(r, 0.9)),
        text: `our last ${ours.wars} opponents took ${Math.round(ours.concededRate * 100)}% of the stars against us`
    } : null;
    // Spread around a point estimate: our past opponents' spread, re-centred.
    const spread = (skill) => typical ? typical.draws.map(d => Math.max(0.3, Math.min(3, d - typical.skill + skill))) : [skill];
    if (p?.recent?.wars >= 3) {
        const usage = Math.max(0.5, p.recent.attackUsage || 0.9);
        const skill = skillFromStarRate(p.recent.starRate, usage);
        return {
            skill, usage,
            draws: p.recent.starRates?.length ? p.recent.starRates.map(r => skillFromStarRate(r, usage)) : spread(skill),
            source: `their last ${p.recent.wars} wars: ${Math.round(p.recent.starRate * 100)}% of stars won, ${Math.round(usage * 100)}% of attacks used`
        };
    }
    const total = (p?.warWins || 0) + (p?.warLosses || 0) + (p?.warTies || 0);
    if (total >= 10) {
        // Shift the typical-opponent level by how their win rate compares with an even record.
        const wr = p.warWins / total;
        const base = typical?.skill ?? PRIOR_SKILL;
        const skill = Math.max(0.5, Math.min(3, base + 0.6 * (wr - 0.5)));
        return { skill, usage: 0.9, draws: spread(skill),
            source: `their war log is private; ${typical ? typical.text : 'a league-average clan'}, adjusted for their ${p.warWins}W–${p.warLosses}L record (${Math.round(wr * 100)}% wins)` };
    }
    if (typical) return { skill: typical.skill, usage: 0.9, draws: typical.draws, source: `no opponent history yet; ${typical.text}` };
    return { skill: PRIOR_SKILL, usage: 0.88, source: 'no opponent history available; using a league-average estimate' };
}

/**
 * Predicts the result of a war that hasn't ended.
 * Returns null for ended wars.
 */
export function predictWar(war, allWars, { sims = 2000 } = {}) {
    const phase = warPhase(war);
    if (phase === 'ended' || phase === 'unconfirmed') return null;
    const apm = war.attacksPerMember || 2;

    const ours = ourMemberModel(allWars);
    const oppClan = opponentClanModel(war);

    const ourMembers = war.clan.members || [];
    const theirMembers = war.opponent.members || [];
    const thOf = new Map([...ourMembers, ...theirMembers].map(m => [m.tag, m.townhallLevel]));

    // Per-member settings for a given clan level; opponents are refined by attacks already made in this war.
    const theirAttackersFor = (base) => theirMembers.map(m => {
        const atks = (m.attacks || []).map(a => ({ stars: a.stars, d: m.townhallLevel - (thOf.get(a.defenderTag) ?? m.townhallLevel) }));
        const n = atks.length;
        const skill = n ? (neutralStars(atks) * n + base * SHRINK) / (n + SHRINK) : base;
        return { skill, th: m.townhallLevel, usage: oppClan.usage, remaining: apm - n, pos: m.mapPosition };
    });
    const ourAttackersFor = (base) => ourMembers.map(m => {
        const model = ours.member(m.tag, base);
        return { skill: model.skill, th: m.townhallLevel, usage: model.usage, remaining: apm - (m.attacks || []).length, pos: m.mapPosition };
    });

    // A base's best result so far is stored on the defender as bestOpponentAttack.
    const defendersOf = (list) => list.map(m => ({ th: m.townhallLevel, best: m.bestOpponentAttack?.stars ?? 0, bestDest: m.bestOpponentAttack?.destructionPercentage ?? 0 }));
    const ourBases = defendersOf(ourMembers), theirBases = defendersOf(theirMembers);

    // Each simulation draws both clans' level from their recent wars (how good a day they have),
    // which is what produces realistic numbers of perfect clears, draws and upsets.
    const bucket = (x) => Math.round(x * 20) / 20;
    const cache = new Map();
    const side = (who, level) => {
        const key = `${who}:${bucket(level)}`;
        if (!cache.has(key)) cache.set(key, who === 'us'
            ? makeSide(ourAttackersFor(bucket(level)), theirBases)
            : makeSide(theirAttackersFor(bucket(level)), ourBases));
        return cache.get(key);
    };
    const ourDraws = ours.draws, theirDraws = oppClan.draws || [oppClan.skill];

    const r = rng(hash(`${war.id}:${war.clan.attacks}:${war.opponent.attacks}`));
    let win = 0, draw = 0;
    const usStars = [], themStars = [];
    let usDest = 0, themDest = 0;
    for (let i = 0; i < sims; i++) {
        const [s1, d1] = side('us', ourDraws[Math.floor(r() * ourDraws.length)])(r);
        const [s2, d2] = side('them', theirDraws[Math.floor(r() * theirDraws.length)])(r);
        usStars.push(s1); themStars.push(s2); usDest += d1; themDest += d2;
        if (s1 > s2 || (s1 === s2 && d1 - d2 > 0.005)) win++;
        else if (s1 === s2 && Math.abs(d1 - d2) <= 0.005) draw++;
    }
    const ourAttackers = ourAttackersFor(ours.clanSkill), theirAttackers = theirAttackersFor(oppClan.skill);
    const stat = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        return { mean: arr.reduce((a, b) => a + b, 0) / arr.length, lo: s[Math.floor(s.length * 0.1)], hi: s[Math.floor(s.length * 0.9)] };
    };
    const pWin = win / sims, pDraw = draw / sims, pLoss = 1 - pWin - pDraw;
    const outcome = pWin >= pLoss && pWin >= pDraw ? 'win' : pLoss >= pDraw ? 'loss' : 'draw';

    const avg = (list, k) => list.reduce((s, x) => s + x[k], 0) / (list.length || 1);
    return {
        pWin, pDraw, pLoss, outcome,
        us: { ...stat(usStars), dest: usDest / sims },
        them: { ...stat(themStars), dest: themDest / sims },
        maxStars: war.teamSize * 3,
        inputs: {
            ourSkill: avg(ourAttackers, 'skill'), ourUsage: avg(ourAttackers, 'usage'), ourAttacksTracked: ours.attackCount, ourSource: ours.source,
            theirSkill: avg(theirAttackers, 'skill'), theirUsage: oppClan.usage, theirSource: oppClan.source,
            ourAvgTh: avg(ourAttackers, 'th'), theirAvgTh: avg(theirAttackers, 'th')
        }
    };
}
