/**
 * Clan War League tab: group standings, our round-by-round results and a
 * member leaderboard for the selected season.
 */
import { esc, warResult, getTHImage } from './constants.js';

let selectedSeason = null;

const seasonLabel = (s) => new Date(`${s}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Standings: stars (+10 per war won) then total destruction, as in game. */
function standings(season) {
    const table = new Map(season.group.clans.map(c => [c.tag, { ...c, stars: 0, destruction: 0, wins: 0, losses: 0, draws: 0 }]));
    for (const war of season.wars) {
        if (war.state === 'preparation') continue;
        const ended = war.state === 'warEnded';
        const result = warResult(war); // from war.clan's perspective
        for (const [side, other] of [['clan', 'opponent'], ['opponent', 'clan']]) {
            const row = table.get(war[side].tag);
            if (!row) continue;
            row.stars += war[side].stars || 0;
            row.destruction += (war[side].destructionPercentage || 0) * (war.teamSize || 0);
            if (!ended) continue;
            const won = side === 'clan' ? result === 'victory' : result === 'loss';
            const lost = side === 'clan' ? result === 'loss' : result === 'victory';
            if (won) { row.wins++; row.stars += 10; } else if (lost) row.losses++; else row.draws++;
        }
    }
    return [...table.values()].sort((a, b) => b.stars - a.stars || b.destruction - a.destruction);
}

function memberLeaderboard(ourWars) {
    const map = {};
    for (const war of ourWars) {
        for (const m of war.clan.members || []) {
            const p = map[m.tag] ??= { tag: m.tag, name: m.name, th: m.townhallLevel, wars: 0, used: 0, stars: 0, dest: 0, triples: 0, defStars: 0 };
            p.wars++;
            p.th = m.townhallLevel;
            for (const a of m.attacks || []) {
                p.used++; p.stars += a.stars; p.dest += a.destructionPercentage;
                if (a.stars === 3) p.triples++;
            }
            p.defStars += m.bestOpponentAttack?.stars || 0;
        }
    }
    return Object.values(map).sort((a, b) => b.stars - a.stars || (b.dest / (b.used || 1)) - (a.dest / (a.used || 1)));
}

export function renderCwl(seasons) {
    const content = document.getElementById('cwlContent');
    const select = document.getElementById('cwlSeason');
    const subtitle = document.getElementById('cwlSubtitle');
    if (!content || !select) return;

    if (!seasons || seasons.length === 0) {
        select.parentElement.classList.add('hidden');
        subtitle.textContent = '';
        content.innerHTML = `<div class="empty-state">
            <p class="text-gray-300 font-semibold mb-1">No CWL seasons recorded yet</p>
            <p>The Clash API only exposes the current league group, so CWL is captured live each hour during league week.<br>
            Standings, rounds and member stats will appear here from the next CWL onward.</p></div>`;
        return;
    }

    select.parentElement.classList.remove('hidden');
    if (!selectedSeason || !seasons.some(s => s.season === selectedSeason)) selectedSeason = seasons[0].season;
    select.innerHTML = seasons.map(s => `<option value="${s.season}" ${s.season === selectedSeason ? 'selected' : ''}>${seasonLabel(s.season)}</option>`).join('');
    select.onchange = () => { selectedSeason = select.value; renderCwl(seasons); };

    const season = seasons.find(s => s.season === selectedSeason);
    const ourTag = season.wars.find(w => w.ours)?.clan.tag;
    const ourWars = season.wars.filter(w => w.ours).sort((a, b) => a.round - b.round);
    const table = standings(season);
    const ourRank = table.findIndex(r => r.tag === ourTag) + 1;
    const stateLabel = { preparation: 'Preparation', inWar: 'In progress', ended: 'Finished' }[season.state] || season.state;
    subtitle.textContent = `${seasonLabel(season.season)} · ${stateLabel}${ourRank ? ` · currently ${ordinal(ourRank)} of ${table.length}` : ''}`;

    const leaders = memberLeaderboard(ourWars.filter(w => w.state !== 'preparation'));

    content.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        <section class="report-card lg:col-span-3">
            <div class="report-head"><div><h3>Group standings</h3><p>Stars include the +10 bonus for each war won.</p></div></div>
            <div class="overflow-x-auto"><table class="data-table">
                <thead><tr><th>#</th><th>Clan</th><th class="num">W-L-D</th><th class="num">Stars</th><th class="num">Destruction</th></tr></thead>
                <tbody>${table.map((c, i) => `<tr class="${c.tag === ourTag ? 'bg-gold/5' : ''}">
                    <td class="${i === 0 ? 'gold font-bold' : ''}">${i + 1}</td>
                    <td><div class="flex items-center gap-2"><img src="${c.badgeUrls?.small}" class="w-6 h-6" alt=""><span class="${c.tag === ourTag ? 'gold font-bold' : 'text-gray-200 font-semibold'}">${esc(c.name)}</span><span class="text-gray-600">Lv${c.clanLevel}</span></div></td>
                    <td class="num">${c.wins}-${c.losses}-${c.draws}</td>
                    <td class="num font-bold text-gray-100">${c.stars}</td>
                    <td class="num">${Math.round(c.destruction).toLocaleString()}%</td></tr>`).join('')}</tbody>
            </table></div>
        </section>

        <section class="report-card lg:col-span-2">
            <div class="report-head"><div><h3>Our rounds</h3><p>Tap a round for the full war breakdown.</p></div></div>
            <div class="flex flex-col gap-2">${Array.from({ length: (season.group.rounds || []).length || 7 }, (_, i) => {
                const war = ourWars.find(w => w.round === i + 1);
                if (!war) return `<div class="event-row opacity-50"><span class="pill">R${i + 1}</span><span class="text-gray-500">Not started</span></div>`;
                const r = war.state === 'warEnded' ? warResult(war) : null;
                const pill = r ? `<span class="pill ${r === 'victory' ? 'win' : r === 'loss' ? 'loss' : ''}">${r === 'victory' ? 'Win' : r === 'loss' ? 'Loss' : 'Draw'}</span>`
                    : `<span class="pill gold">${war.state === 'inWar' ? 'Live' : 'Prep'}</span>`;
                return `<button class="event-row text-left hover:bg-raised" onclick="window.openWar('${war.id}')">
                    <span class="pill">R${war.round}</span>
                    <img src="${war.opponent.badgeUrls?.small}" class="w-6 h-6" alt="">
                    <span class="flex-1 min-w-0 truncate text-gray-200 font-semibold">${esc(war.opponent.name)}</span>
                    <span class="tabular-nums text-gray-300 font-semibold">${war.clan.stars}–${war.opponent.stars}</span>
                    ${pill}</button>`;
            }).join('')}</div>
        </section>

        <section class="report-card lg:col-span-5">
            <div class="report-head"><div><h3>Member performance</h3><p>One attack per war in CWL. Defense column is stars conceded on each member's base.</p></div></div>
            ${leaders.length === 0 ? '<p class="empty-state">No attacks yet this season.</p>' : `
            <div class="overflow-x-auto"><table class="data-table">
                <thead><tr><th>Player</th><th class="num">Wars</th><th class="num">Attacks</th><th class="num">Stars</th><th class="num">3★</th><th class="num">Avg %</th><th class="num">Stars conceded</th></tr></thead>
                <tbody>${leaders.map(p => `<tr>
                    <td><div class="flex items-center gap-2"><img src="${getTHImage(p.th)}" class="w-6 h-6 object-contain" alt=""><span class="player" data-player-tag="${esc(p.tag)}">${esc(p.name)}</span></div></td>
                    <td class="num">${p.wars}</td>
                    <td class="num ${p.used < p.wars && ourWars.some(w => w.state === 'warEnded') ? 'delta-down' : ''}">${p.used} / ${p.wars}</td>
                    <td class="num gold font-bold">${p.stars}</td>
                    <td class="num">${p.triples}</td>
                    <td class="num">${p.used ? (p.dest / p.used).toFixed(0) : '—'}%</td>
                    <td class="num">${p.defStars}</td></tr>`).join('')}</tbody>
            </table></div>`}
        </section>
    </div>`;
}

function ordinal(n) {
    const suffix = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}
