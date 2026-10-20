/**
 * Members: searchable, filterable roster for any snapshot date.
 */
import { store, members, fetchMembersOn } from '../store.js';
import { esc, num, thImg, roleNames, roleWeight, fmtDate, debounce, icons } from '../util.js';
import { seg, bindToggle, select, bindSelect, noDataMessage, mountList } from '../ui.js';

const state = { role: 'all', sort: 'league', q: '', date: null, list: null };

const SORTS = [
    { value: 'league', label: 'League & trophies' },
    { value: 'th', label: 'Town Hall' },
    { value: 'donations', label: 'Donated' },
    { value: 'received', label: 'Received' },
    { value: 'role', label: 'Role' },
    { value: 'name', label: 'Name' }
];

const sorters = {
    league: (a, b) => ((b.leagueTier?.id || b.league?.id || 0) - (a.leagueTier?.id || a.league?.id || 0)) || (b.trophies - a.trophies),
    th: (a, b) => b.townHallLevel - a.townHallLevel || b.expLevel - a.expLevel,
    donations: (a, b) => b.donations - a.donations,
    received: (a, b) => b.donationsReceived - a.donationsReceived,
    role: (a, b) => (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name)
};

function card(m) {
    const league = m.leagueTier || m.league;
    return `<a class="member-card" href="#/members/${encodeURIComponent(m.tag.slice(1))}">
        <img class="th-img" src="${thImg(m.townHallLevel)}" alt="Town Hall ${m.townHallLevel}">
        <div class="li-main">
            <p class="li-title">${esc(m.name)}</p>
            <p class="li-sub">${roleNames[m.role] || ''} · TH${m.townHallLevel} · XP ${m.expLevel}</p>
            <p class="member-stats"><span>Donated <b>${num(m.donations)}</b></span><span>Received <b>${num(m.donationsReceived)}</b></span></p>
        </div>
        <div class="league">
            ${league?.iconUrls?.small ? `<img src="${league.iconUrls.small}" alt="">` : '<span class="league-icon-gap"></span>'}
            <span class="league-name">${esc(league?.name || 'Unranked')}</span>
            <span class="league-trophies" aria-label="${m.trophies} trophies">${icons.trophy}${num(m.trophies)}</span>
        </div>
    </a>`;
}

export function render(root) {
    if (!store.clan) { root.innerHTML = `<h1 class="sr-only">Members</h1>${noDataMessage()}`; return; }
    const latest = store.memberDates[0];
    if (!state.date || !store.memberDates.includes(state.date)) { state.date = latest; state.list = null; }
    const roster = () => state.list || members();

    root.innerHTML = `
        <div class="page-head">
            <div><h1 class="page-title">Members</h1><p class="page-sub" id="memberCount"></p></div>
        </div>
        <div class="stack">
            <div class="controls">
                <label class="field" style="flex:1;min-width:200px"><span>Search</span>
                    <input class="input" type="search" id="memberSearch" placeholder="Player name or tag" value="${esc(state.q)}" autocomplete="off"></label>
                ${select('sort', 'Sort by', SORTS, state.sort)}
                ${select('date', 'Roster on', store.memberDates.map((d, i) => ({ value: d, label: i === 0 ? `${fmtDate(d)} (latest)` : fmtDate(d) })), state.date)}
            </div>
            ${seg('role', 'Filter by role', [{ value: 'all', label: 'All' }, { value: 'leader', label: 'Leader' }, { value: 'coLeader', label: 'Co-leaders' }, { value: 'admin', label: 'Elders' }, { value: 'member', label: 'Members' }], state.role)}
            <div id="memberGrid"></div>
        </div>`;

    const grid = mountList(root.querySelector('#memberGrid'), { className: 'member-grid', step: 12, noun: 'members', emptyHtml: '<p class="empty">No members match.</p>' });
    const draw = () => {
        const q = state.q.trim().toLowerCase();
        const all = roster();
        const list = all
            .filter(m => state.role === 'all' || m.role === state.role)
            .filter(m => !q || m.name.toLowerCase().includes(q) || m.tag.toLowerCase().includes(q))
            .sort(sorters[state.sort]);
        grid.setItems(list.map(card));
        root.querySelector('#memberCount').textContent = `${list.length === all.length ? `${all.length} members` : `${list.length} of ${all.length} members`}${state.date !== latest ? ` on ${fmtDate(state.date)}` : ''}`;
    };

    bindToggle(root, 'role', v => { state.role = v; draw(); });
    bindSelect(root, 'sort', v => { state.sort = v; draw(); });
    bindSelect(root, 'date', async v => {
        state.date = v;
        state.list = v === latest ? null : (await fetchMembersOn(v)).members;
        draw();
    });
    root.querySelector('#memberSearch').addEventListener('input', debounce(e => { state.q = e.target.value; draw(); }, 120));
    draw();
}
