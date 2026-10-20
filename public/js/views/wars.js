/**
 * Wars: the current war (with prediction) and the full war history.
 */
import { store, members } from '../store.js';
import { esc, debounce } from '../util.js';
import { seg, chips, bindToggle, kpi, noDataMessage, mountPagedList, select, bindSelect } from '../ui.js';
import { warHistory, record } from '../stats.js';
import { warHero, warRow, fillPredictions, startCountdowns } from './warParts.js';

const state = { result: 'all', kind: 'all', q: '', member: '' };

export function render(root) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">Wars</h1>${noDataMessage()}`; return; }
    const history = warHistory();
    const active = history.filter(e => e.phase === 'preparation' || e.phase === 'inWar');
    const past = history.filter(e => !active.includes(e));
    const rec = record(past);

    root.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Wars</h1>
            <p class="page-sub">${rec.total ? `${rec.win} wins, ${rec.loss} losses, ${rec.draw} draws in ${rec.total} recorded wars` : 'No finished wars yet'}</p></div>
        </div>
        <div class="stack">
            ${active.map(e => warHero(e.war, { title: 'Current war' })).join('')}
            <div class="kpis">
                ${kpi('Win rate', rec.total ? `${Math.round(rec.winRate * 100)}%` : '—', `${rec.total} wars`)}
                ${kpi('Wins', rec.win)}
                ${kpi('Losses', rec.loss)}
                ${kpi('Draws', rec.draw)}
            </div>
            <section class="card" aria-labelledby="hist-h">
                <div class="card-head"><div><h2 class="card-title" id="hist-h">War history</h2>
                <p class="card-sub">Tracked wars open a full breakdown; older wars come from the war log.</p></div></div>
                <div class="controls" style="margin-bottom:12px">
                    ${seg('result', 'Filter by result', [{ value: 'all', label: 'All' }, { value: 'win', label: 'Wins' }, { value: 'loss', label: 'Losses' }, { value: 'draw', label: 'Draws' }], state.result)}
                    ${chips('kind', 'War type', [{ value: 'all', label: 'All types' }, { value: 'regular', label: 'Regular' }, { value: 'cwl', label: 'CWL' }], state.kind)}
                    <label class="field" style="flex:1;min-width:180px"><span class="sr-only">Search opponent clan</span>
                        <input class="input" type="search" id="warSearch" placeholder="Search clan name or tag" value="${esc(state.q)}" autocomplete="off"></label>
                    ${select('member', 'Member in war', [{ value: '', label: 'Any member' }, ...[...members()].sort((a, b) => a.name.localeCompare(b.name)).map(m => ({ value: m.tag, label: `With ${m.name}` }))], state.member, { hideLabel: true })}
                </div>
                <div id="warList"></div>
            </section>
        </div>`;

    const warList = mountPagedList(root.querySelector('#warList'), { className: 'list', pageSize: 10, noun: 'wars', emptyHtml: '<p class="empty">No wars match these filters.</p>' });
    const draw = () => {
        const q = state.q.trim().toLowerCase();
        const list = past
            .filter(e => state.result === 'all' || e.result === state.result)
            .filter(e => state.kind === 'all' || e.kind === state.kind)
            .filter(e => !q || (e.opponent?.name || '').toLowerCase().includes(q) || (e.opponent?.tag || '').toLowerCase().includes(q))
            // Only tracked wars have line-ups, so a member filter shows tracked wars only.
            .filter(e => !state.member || e.war?.clan.members?.some(m => m.tag === state.member));
        warList.setItems(list.map(warRow));
    };

    bindToggle(root, 'result', v => { state.result = v; draw(); });
    bindToggle(root, 'kind', v => { state.kind = v; draw(); });
    bindSelect(root, 'member', v => { state.member = v; draw(); });
    root.querySelector('#warSearch').addEventListener('input', debounce(e => { state.q = e.target.value; draw(); }, 120));
    draw();

    fillPredictions(root);
    return startCountdowns(root);
}
