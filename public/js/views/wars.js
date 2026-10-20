/**
 * Wars: the current regular war (with prediction) and the regular war history.
 * CWL wars live on the CWL tab only.
 */
import { store, members } from '../store.js';
import { esc, debounce } from '../util.js';
import { seg, bindToggle, kpi, noDataMessage, mountPagedList, mountMultiSelect } from '../ui.js';
import { warHistory, record } from '../stats.js';
import { warHero, warRow, fillPredictions, startCountdowns } from './warParts.js';

const state = { result: 'all', q: '', members: [], match: 'any' };

/** Current members plus anyone who appears in a tracked war line-up. */
function memberOptions() {
    const current = new Map(members().map(m => [m.tag, m]));
    const all = new Map();
    for (const m of current.values()) all.set(m.tag, { value: m.tag, label: m.name, sub: `TH${m.townHallLevel}` });
    for (const w of store.wars.filter(x => x.kind !== 'cwl')) for (const m of w.clan.members || []) {
        if (!all.has(m.tag)) all.set(m.tag, { value: m.tag, label: m.name, sub: `TH${m.townhallLevel} · former` });
    }
    return [...all.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function render(root) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">Wars</h1>${noDataMessage()}`; return; }
    const history = warHistory().filter(e => e.kind !== 'cwl');
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
                <p class="card-sub">Regular wars. Tracked wars open a full breakdown; older wars come from the war log. CWL is on the <a class="player-link" href="#/cwl">CWL tab</a>.</p></div></div>
                <div class="controls" style="margin-bottom:12px">
                    ${seg('result', 'Filter by result', [{ value: 'all', label: 'All' }, { value: 'win', label: 'Wins' }, { value: 'loss', label: 'Losses' }, { value: 'draw', label: 'Draws' }], state.result)}
                    <label class="field" style="flex:1;min-width:180px"><span class="sr-only">Search opponent clan</span>
                        <input class="input" type="search" id="warSearch" placeholder="Search clan name or tag" value="${esc(state.q)}" autocomplete="off"></label>
                </div>
                <div class="controls" style="margin-bottom:12px">
                    <div id="memberFilter" style="flex:1;min-width:240px"></div>
                    <div id="matchMode"></div>
                </div>
                <div id="warList"></div>
            </section>
        </div>`;

    const warList = mountPagedList(root.querySelector('#warList'), { className: 'list', pageSize: 10, noun: 'wars', emptyHtml: '<p class="empty">No wars match these filters.</p>' });
    const draw = () => {
        const q = state.q.trim().toLowerCase();
        const list = past
            .filter(e => state.result === 'all' || e.result === state.result)
            .filter(e => !q || (e.opponent?.name || '').toLowerCase().includes(q) || (e.opponent?.tag || '').toLowerCase().includes(q))
            // Only tracked wars have line-ups, so a member filter shows tracked wars only.
            .filter(e => {
                if (!state.members.length) return true;
                const lineup = new Set((e.war?.clan.members || []).map(m => m.tag));
                return state.match === 'all' ? state.members.every(t => lineup.has(t)) : state.members.some(t => lineup.has(t));
            });
        warList.setItems(list.map(warRow));
    };

    bindToggle(root, 'result', v => { state.result = v; draw(); });
    // "Any of / All of" only matters once two or more members are picked.
    const drawMatch = () => {
        const el = root.querySelector('#matchMode');
        el.innerHTML = state.members.length > 1 ? seg('match', 'Match wars with', [{ value: 'any', label: 'Any of them' }, { value: 'all', label: 'All of them' }], state.match) : '';
        bindToggle(el, 'match', v => { state.match = v; draw(); });
    };
    const picker = mountMultiSelect(root.querySelector('#memberFilter'), {
        label: 'Filter by members in the war', placeholder: 'Filter by member in war…',
        options: memberOptions(), selected: state.members,
        onChange: (tags) => { state.members = tags; drawMatch(); draw(); }
    });
    drawMatch();
    root.querySelector('#warSearch').addEventListener('input', debounce(e => { state.q = e.target.value; draw(); }, 120));
    draw();

    fillPredictions(root);
    const stop = startCountdowns(root);
    return () => { stop(); picker.destroy(); };
}
