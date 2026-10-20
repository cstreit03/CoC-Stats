/**
 * Clan-level war stats for a clan we don't track (our war opponents):
 * profile counters plus a summary of its public war log.
 */
import { encodeTag } from './coc.js';

export async function clanWarProfile(api, tag) {
    const clan = await api.get(`/clans/${encodeTag(tag)}`);
    if (!clan) return null;
    const profile = {
        tag,
        fetchedAt: new Date().toISOString(),
        clanLevel: clan.clanLevel,
        members: clan.members,
        warWins: clan.warWins ?? null,
        warLosses: clan.warLosses ?? null,
        warTies: clan.warTies ?? null,
        warWinStreak: clan.warWinStreak ?? null,
        warLeague: clan.warLeague?.name || null,
        isWarLogPublic: !!clan.isWarLogPublic,
        recent: null
    };
    if (clan.isWarLogPublic) {
        const log = await api.get(`/clans/${encodeTag(tag)}/warlog?limit=30`);
        profile.recent = summarizeWarLog(log?.items || []);
    }
    return profile;
}

/** Regular wars only (CWL entries have one attack each and no result). */
export function summarizeWarLog(items) {
    const wars = items.filter(i => i.result && (i.attacksPerMember || 2) === 2 && i.teamSize);
    if (wars.length === 0) return null;
    const sum = (fn) => wars.reduce((s, w) => s + fn(w), 0);
    return {
        wars: wars.length,
        wins: wars.filter(w => w.result === 'win').length,
        losses: wars.filter(w => w.result === 'lose').length,
        ties: wars.filter(w => w.result === 'tie').length,
        // Share of available stars won, attack usage and destruction, averaged per war.
        starRate: sum(w => w.clan.stars / (w.teamSize * 3)) / wars.length,
        concededRate: sum(w => (w.opponent?.stars ?? 0) / (w.teamSize * 3)) / wars.length,
        attackUsage: sum(w => Math.min(1, (w.clan.attacks ?? w.teamSize * 2) / (w.teamSize * 2))) / wars.length,
        destruction: sum(w => w.clan.destructionPercentage || 0) / wars.length,
        // Per-war star rates, so the predictor can sample good and bad days.
        starRates: wars.map(w => Math.round(w.clan.stars / (w.teamSize * 3) * 1000) / 1000),
        avgTeamSize: Math.round(sum(w => w.teamSize) / wars.length)
    };
}
