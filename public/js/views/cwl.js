/**
 * Clan War League: standings, our rounds, and the member scorecard.
 * Routes: #/cwl, #/cwl/<season>, #/cwl/<season>/scorecard
 */
import { store } from '../store.js';
import { esc, fmtSeason, warPhase } from '../util.js';
import { seg, bindToggle, select, bindSelect, exportButtons, noDataMessage, mountTable } from '../ui.js';
import { cwlStandings, warHistory } from '../stats.js';
import { bindExports, exportExcel, exportPdf } from '../export.js';
import { warHero, phaseBadge, resultBadge, fillPredictions, startCountdowns } from './warParts.js';
import { scorecardHtml, mountScorecard } from './cwlScorecard.js';

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function render(root, { season: seasonParam, tab = 'standings' }) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">CWL</h1>${noDataMessage()}`; return; }
    const seasons = store.cwl;
    if (!seasons.length) {
        const logged = warHistory().filter(e => e.kind === 'cwl').length;
        root.innerHTML = `<div class="page-head"><div><h1 class="page-title">Clan War League</h1></div></div>
            <div class="card empty"><strong>No CWL season recorded yet</strong>
            The Clash API only shows the current league group, so CWL is captured every hour during league week.
            Standings, rounds and the member scorecard appear here from the next CWL onward.${logged ? ` (${logged} past CWL wars appear in the war log on the Wars page.)` : ''}</div>`;
        return;
    }
    const season = seasons.find(s => s.season === seasonParam) || seasons[0];
    const ourTag = store.clan.tag;
    const ourWars = season.wars.filter(w => w.ours).sort((a, b) => a.round - b.round);
    const table = cwlStandings(season);
    const rank = table.findIndex(r => r.tag === ourTag) + 1;
    const live = ourWars.filter(w => ['preparation', 'inWar'].includes(warPhase(w)));
    const stateLabel = { preparation: 'Preparation', inWar: 'In progress', ended: 'Finished' }[season.state] || season.state;
    const go = (s, t) => { location.hash = `#/cwl/${s}${t && t !== 'standings' ? `/${t}` : ''}`; };

    root.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Clan War League</h1>
            <p class="page-sub">${fmtSeason(season.season)} · ${stateLabel}${rank ? ` · ${ordinal(rank)} of ${table.length}` : ''}</p></div>
            <div class="controls">
                ${select('season', 'Season', seasons.map(s => ({ value: s.season, label: fmtSeason(s.season) })), season.season, { hideLabel: true })}
                ${exportButtons()}
            </div>
        </div>
        <div class="stack">
            ${seg('tab', 'CWL view', [{ value: 'standings', label: 'Standings & rounds' }, { value: 'scorecard', label: 'Member scorecard' }], tab)}
            <div id="cwlBody"></div>
        </div>`;

    bindSelect(root, 'season', v => go(v, tab));
    bindToggle(root, 'tab', v => go(season.season, v));
    const body = root.querySelector('#cwlBody');
    let exporters;

    if (tab === 'scorecard') {
        body.innerHTML = `<section class="card" aria-labelledby="sc-h"><div class="card-head"><div><h2 class="card-title" id="sc-h">Member scorecard</h2>
            <p class="card-sub">Every attack per round, scored with the rules below. Sort any column; export to Excel to keep tweaking the scoring.</p></div></div>
            <div class="stack">${scorecardHtml()}</div></section>`;
        exporters = mountScorecard(body, season);
    } else {
        body.innerHTML = `
            ${live.map(w => warHero(w, { title: `Round ${w.round}` })).join('')}
            <div class="grid-3" style="margin-top:${live.length ? '16px' : '0'}">
                <section class="card span-2" aria-labelledby="st-h"><div class="card-head"><div><h2 class="card-title" id="st-h">Group standings</h2>
                    <p class="card-sub">Stars include the +10 bonus for each war won; ties break on total destruction.</p></div></div><div id="standings"></div></section>
                <section class="card" aria-labelledby="rd-h"><div class="card-head"><h2 class="card-title" id="rd-h">Our rounds</h2></div>
                    <div class="list">${Array.from({ length: (season.group.rounds || []).length || 7 }, (_, i) => {
                        const w = ourWars.find(x => x.round === i + 1);
                        if (!w) return `<div class="war-row"><span class="badge">R${i + 1}</span><div class="li-main"><p class="li-sub">Not started</p></div><span></span></div>`;
                        const phase = warPhase(w);
                        const res = phase === 'ended' ? warHistory().find(e => e.id === w.id)?.result : null;
                        return `<a class="war-row" href="#/wars/${encodeURIComponent(w.id)}">
                            <span class="badge">R${w.round}</span>
                            <div class="li-main"><p class="li-title">${esc(w.opponent.name)}</p><p class="li-sub">${w.clan.attacks || 0}/${w.teamSize} attacks used</p></div>
                            <div class="result-col"><p class="war-score">${w.clan.stars} – ${w.opponent.stars}</p><div style="margin-top:2px">${res ? resultBadge(res) : phaseBadge(phase)}</div></div></a>`;
                    }).join('')}</div></section>
            </div>`;
        const columns = [
            { key: 'rank', label: '#', num: true, value: r => r.rank, sortable: false },
            { key: 'name', label: 'Clan', value: r => r.name, render: r => `<div class="cell-player"><img src="${r.badgeUrls?.small}" alt=""><span class="${r.tag === ourTag ? 'strong' : ''}">${esc(r.name)}</span></div>` },
            { key: 'level', label: 'Level', num: true, value: r => r.clanLevel },
            { key: 'wld', label: 'W-L-D', num: true, value: r => r.win, render: r => `${r.win}-${r.loss}-${r.draw}`, exportValue: r => `${r.win}-${r.loss}-${r.draw}` },
            { key: 'stars', label: 'Stars', num: true, value: r => r.stars, render: r => `<b>${r.stars}</b>` },
            { key: 'dest', label: 'Destruction', num: true, value: r => Math.round(r.destruction), render: r => `${Math.round(r.destruction).toLocaleString()}%` }
        ];
        const rows = table.map((r, i) => ({ ...r, rank: i + 1 }));
        mountTable(body.querySelector('#standings'), { columns, rows, rowClass: r => r.tag === ourTag ? 'highlight' : '', caption: 'Group standings' });
        const header = ['Rank', 'Clan', 'Level', 'Wins', 'Losses', 'Draws', 'Stars', 'Destruction %'];
        const data = () => rows.map(r => [r.rank, r.name, r.clanLevel, r.win, r.loss, r.draw, r.stars, Math.round(r.destruction)]);
        const roundsHeader = ['Round', 'Opponent', 'Our stars', 'Their stars', 'Our destruction %', 'Their destruction %', 'Attacks used', 'Status'];
        const roundsData = () => ourWars.map(w => [w.round, w.opponent.name, w.clan.stars, w.opponent.stars, w.clan.destructionPercentage, w.opponent.destructionPercentage, w.clan.attacks || 0, warPhase(w)]);
        exporters = {
            xlsx: () => exportExcel(`CWL standings ${season.season}`, [{ name: 'Standings', header, body: data() }, { name: 'Our rounds', header: roundsHeader, body: roundsData() }]),
            pdf: () => exportPdf(`CWL standings ${season.season}`, fmtSeason(season.season), [{ title: 'Group standings', header, body: data() }, { title: 'Our rounds', header: roundsHeader, body: roundsData() }])
        };
        fillPredictions(body);
    }
    bindExports(root, exporters);
    return startCountdowns(root);
}
