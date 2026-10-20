/**
 * Data collection: runs on the hourly cron and on throttled visitor refreshes.
 * Each step is independent so one failing endpoint doesn't block the rest.
 */
import { CocApi, encodeTag, parseCocDate } from './coc.js';
import { storeClan, storeWar, storeRaid, setMeta } from './store.js';

export async function collect(env) {
    const api = new CocApi(env);
    const db = env.DB;
    const clanTag = env.CLAN_TAG;
    const tag = encodeTag(clanTag);
    const report = { startedAt: new Date().toISOString(), steps: {} };

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
    const group = await api.get(`/clans/${tag}/currentwar/leaguegroup`);
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

    const byEnd = new Map(items.map(i => [i.endTime, i]));
    const { results } = await db.prepare("SELECT id, data, end_time FROM wars WHERE kind = 'regular' AND state != 'warEnded'").all();
    let finalised = 0;
    for (const row of results) {
        const entry = byEnd.get(row.end_time);
        if (!entry || parseCocDate(row.end_time) > new Date()) continue;
        const war = JSON.parse(row.data);
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
