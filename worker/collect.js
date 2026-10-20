/**
 * Data collection: runs on the hourly cron (and once on a brand-new database).
 * Each step is independent so one failing endpoint doesn't block the rest.
 */
import { CocApi, encodeTag, parseCocDate } from './coc.js';
import { storeClan, storeWar, storeRaid, setMeta } from './store.js';
import { clanWarProfile } from './opponent.js';

export async function collect(env) {
    const db = env.DB;
    const report = { startedAt: new Date().toISOString(), steps: {} };

    // Configuration problems are recorded too, so /api/status shows why nothing loads.
    let api;
    try {
        if (!env.CLAN_TAG || env.CLAN_TAG.includes('REPLACE')) throw new Error('CLAN_TAG is not set in wrangler.toml');
        api = new CocApi(env);
    } catch (e) {
        report.error = e.message;
        report.finishedAt = new Date().toISOString();
        await setMeta(db, 'last_collect', report);
        return report;
    }
    const clanTag = env.CLAN_TAG;
    const tag = encodeTag(clanTag);

    const step = async (name, fn) => {
        try { report.steps[name] = (await fn()) ?? 'ok'; }
        catch (e) { report.steps[name] = `error: ${e.message}`; console.error(name, e); }
    };

    let clan = null;
    await step('clan', async () => {
        clan = await api.get(`/clans/${tag}`);
        if (!clan) throw new Error('clan not found');
        await storeClan(db, clan);
        return `${(clan.memberList || []).length} members`;
    });

    // CWL first, so the regular-war step can recognise a CWL war in /currentwar.
    await step('cwl', () => collectCwl(api, db, clanTag, tag));

    await step('currentWar', async () => {
        const war = await api.get(`/clans/${tag}/currentwar`);
        if (!war || war.state === 'notInWar') return 'not in war';
        const isCwl = await db.prepare("SELECT 1 FROM wars WHERE kind = 'cwl' AND ours = 1 AND start_time = ?")
            .bind(war.startTime).first();
        if (isCwl) return 'cwl war (stored by cwl step)';
        await attachOpponentProfile(api, db, `war_${war.startTime}`, war, war.opponent?.tag);
        await storeWar(db, war, { kind: 'regular', clanTag });
        return war.state;
    });

    await step('raids', async () => {
        const data = await api.get(`/clans/${tag}/capitalraidseasons?limit=2`);
        for (const raid of data?.items || []) await storeRaid(db, raid);
        return `${data?.items?.length || 0} weekends`;
    });

    if (clan?.isWarLogPublic) {
        await step('warlog', () => collectWarLog(api, db, tag));
    }

    report.finishedAt = new Date().toISOString();
    await setMeta(db, 'last_collect', report);
    if (clan) await setMeta(db, 'last_success', report.finishedAt);
    return report;
}

async function collectCwl(api, db, clanTag, tag) {
    const group = await api.get(`/clans/${tag}/currentwar/leaguegroup`, { nullOn: [404, 500] });
    if (!group || !group.season) return 'no active CWL';

    await db.prepare('INSERT OR REPLACE INTO cwl_groups (season, state, data, updated_at) VALUES (?, ?, ?, ?)')
        .bind(group.season, group.state, JSON.stringify(group), new Date().toISOString()).run();

    // Finished wars never change; only re-fetch wars that may still move.
    const { results } = await db.prepare('SELECT id, state FROM wars WHERE season = ?').bind(group.season).all();
    const done = new Set(results.filter(r => r.state === 'warEnded').map(r => r.id));

    let fetched = 0;
    for (const [i, round] of (group.rounds || []).entries()) {
        for (const warTag of round.warTags || []) {
            if (!warTag || warTag === '#0' || done.has(`cwl_${warTag.replace('#', '')}`)) continue;
            const war = await api.get(`/clanwarleagues/wars/${encodeTag(warTag)}`);
            if (!war || war.state === 'notInWar') continue;
            const ours = war.clan?.tag === clanTag || war.opponent?.tag === clanTag;
            if (ours) {
                const opponentTag = war.clan?.tag === clanTag ? war.opponent?.tag : war.clan?.tag;
                await attachOpponentProfile(api, db, `cwl_${warTag.replace('#', '')}`, war, opponentTag);
            }
            await storeWar(db, { attacksPerMember: 1, ...war }, {
                kind: 'cwl', ours, season: group.season, round: i + 1, warTag, clanTag
            });
            fetched++;
        }
    }
    return `${group.season} ${group.state}, ${fetched} wars updated`;
}

/**
 * Stores the public war log and uses it to finalise regular wars whose last
 * snapshot was taken before the war ended (score/result only; attacks made in
 * the final minutes are not in the log).
 */
async function collectWarLog(api, db, tag) {
    const log = await api.get(`/clans/${tag}/warlog?limit=200`);
    const items = log?.items || [];
    if (items.length === 0) return 'empty';

    await db.batch(items.map(item => db.prepare('INSERT OR REPLACE INTO warlog (end_time, result, data) VALUES (?, ?, ?)')
        .bind(item.endTime, item.result || null, JSON.stringify(item))));

    const { results } = await db.prepare("SELECT id, data, end_time FROM wars WHERE kind = 'regular' AND state = 'inWar'").all();
    let finalised = 0;
    for (const row of results) {
        if (parseCocDate(row.end_time) > new Date()) continue;
        const war = JSON.parse(row.data);
        const entry = findLogEntry(items, war);
        if (!entry) continue;
        for (const side of ['clan', 'opponent']) {
            Object.assign(war[side], {
                stars: entry[side].stars,
                destructionPercentage: entry[side].destructionPercentage,
                attacks: entry[side].attacks ?? war[side].attacks
            });
        }
        war.state = 'warEnded';
        war.finalizedFromWarLog = true;
        await db.prepare("UPDATE wars SET state = 'warEnded', data = ? WHERE id = ?").bind(JSON.stringify(war), row.id).run();
        finalised++;
    }
    return `${items.length} entries, ${finalised} wars finalised`;
}

/**
 * Adds the opponent's clan profile and war-log summary to a war (input for
 * the win predictor). Fetched once per war and carried over on later updates.
 */
async function attachOpponentProfile(api, db, id, war, opponentTag) {
    const row = await db.prepare('SELECT data FROM wars WHERE id = ?').bind(id).first();
    const existing = row ? JSON.parse(row.data).opponentProfile : null;
    if (existing) { war.opponentProfile = existing; return; }
    if (!opponentTag || war.state === 'warEnded') return;
    try {
        war.opponentProfile = await clanWarProfile(api, opponentTag);
    } catch (e) {
        console.error('opponent profile', e);
    }
}

/**
 * The war log's end time can differ from the war's by a second, so match on
 * the opponent and an end time within an hour.
 */
export function findLogEntry(items, war) {
    const end = parseCocDate(war.endTime).getTime();
    return items.find(i => i.opponent?.tag === war.opponent?.tag
        && Math.abs(parseCocDate(i.endTime).getTime() - end) < 3600_000);
}
