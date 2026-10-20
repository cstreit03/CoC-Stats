/**
 * Wars: the current war (with prediction) and the full war history.
 */
import { store } from '../store.js';
import { esc, debounce } from '../util.js';
import { seg, chips, bindToggle, kpi, noDataMessage } from '../ui.js';
import { warHistory, record } from '../stats.js';
import { warHero, warRow, fillPredictions, startCountdowns } from './warParts.js';

const state = { result: 'all', kind: 'all', q: '', shown: 30 };

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
                    <label class="field" style="flex:1;min-width:180px"><span class="sr-only">Search opponent</span>
                        <input class="input" type="search" id="warSearch" placeholder="Search opponent" value="${esc(state.q)}" autocomplete="off"></label>
                </div>
                <div class="list" id="warList" aria-live="polite"></div>
                <div class="row" style="justify-content:center;margin-top:12px"><button type="button" class="btn" id="moreWars">Show more</button></div>
            </section>
        </div>`;

    const draw = () => {
        const q = state.q.trim().toLowerCase();
        const list = past
            .filter(e => state.result === 'all' || e.result === state.result)
            .filter(e => state.kind === 'all' || e.kind === state.kind)
            .filter(e => !q || (e.opponent?.name || '').toLowerCase().includes(q));
        root.querySelector('#warList').innerHTML = list.slice(0, state.shown).map(warRow).join('') || '<p class="empty">No wars match these filters.</p>';
        root.querySelector('#moreWars').hidden = list.length <= state.shown;
    };

    bindToggle(root, 'result', v => { state.result = v; state.shown = 30; draw(); });
    bindToggle(root, 'kind', v => { state.kind = v; state.shown = 30; draw(); });
    root.querySelector('#warSearch').addEventListener('input', debounce(e => { state.q = e.target.value; draw(); }, 120));
    root.querySelector('#moreWars').addEventListener('click', () => { state.shown += 30; draw(); });
    draw();

    fillPredictions(root);
    return startCountdowns(root);
}
