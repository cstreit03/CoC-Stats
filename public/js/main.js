/**
 * App shell: navigation, routing, theme and data freshness.
 * Routes are hash-based (#/wars/war_2026...) so the static site needs no server routing.
 */
import { store, loadAll, collectError } from './store.js';
import { icons, timeAgo, prefs } from './util.js';
import { destroyCharts } from './charts.js';
import * as overview from './views/overview.js';
import * as members from './views/members.js';
import * as player from './views/player.js';
import * as wars from './views/wars.js';
import * as war from './views/war.js';
import * as cwl from './views/cwl.js';
import * as raids from './views/raids.js';
import * as reports from './views/reports.js';

const NAV = [
    { path: '', label: 'Overview', icon: icons.overview },
    { path: 'members', label: 'Members', icon: icons.members },
    { path: 'wars', label: 'Wars', icon: icons.wars },
    { path: 'cwl', label: 'CWL', icon: icons.cwl },
    { path: 'raids', label: 'Raids', icon: icons.raids },
    { path: 'reports', label: 'Reports', icon: icons.reports }
];

function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [section = '', a, b] = parts;
    switch (section) {
        case 'members': return a ? { view: player, section, params: { tag: `#${a}` } } : { view: members, section };
        case 'wars': return a ? { view: war, section, params: { id: a } } : { view: wars, section };
        case 'cwl': return { view: cwl, section, params: { season: a, tab: b } };
        case 'raids': return { view: raids, section, params: { start: a } };
        case 'reports': return { view: reports, section, params: { id: a } };
        default: return { view: overview, section: '' };
    }
}

function renderNav(section) {
    const links = NAV.map(n => {
        const current = n.path === section ? 'aria-current="page"' : '';
        return { top: `<a href="#/${n.path}" ${current}>${n.label}</a>`, bottom: `<a href="#/${n.path}" ${current}>${n.icon}<span>${n.label}</span></a>` };
    });
    document.querySelector('.topnav').innerHTML = links.map(l => l.top).join('');
    document.querySelector('.bottomnav').innerHTML = links.map(l => l.bottom).join('');
}

let cleanup = null;
let lastSection = null;

function render({ keepScroll = false } = {}) {
    const { view, section, params } = route();
    const main = document.getElementById('main');
    cleanup?.();
    cleanup = null;
    destroyCharts();
    renderNav(section);
    cleanup = view.render(main, params || {}) || null;
    if (!keepScroll) window.scrollTo(0, 0);
    // Move focus to the new page heading only on real navigation, not first load.
    if (lastSection !== null && !keepScroll) main.querySelector('h1')?.focus({ preventScroll: true });
    lastSection = section;
}

function renderHeader() {
    const c = store.clan;
    if (c) {
        document.getElementById('clanName').textContent = c.name;
        document.getElementById('clanSub').textContent = `${c.tag} · Level ${c.clanLevel} · ${(c.memberList || []).length} members`;
        const badge = document.getElementById('clanBadge');
        badge.src = c.badgeUrls?.small || badge.src;
        badge.alt = '';
    }
    updateFreshness();
}

function updateFreshness() {
    const text = document.getElementById('freshness');
    const dot = document.getElementById('freshDot');
    const btn = document.getElementById('reloadBtn');
    const last = store.status?.lastSuccess;
    const err = collectError();
    const collecting = store.status?.lastCollect && !store.status.lastCollect.finishedAt;
    dot.className = 'dot';
    if (collecting && !last) {
        text.textContent = 'Collecting first data…';
        dot.classList.add('stale');
    } else if (err && !last) {
        text.textContent = 'Update failed';
        dot.classList.add('error');
    } else if (!last) {
        text.textContent = 'Waiting for first update';
        dot.classList.add('stale');
    } else {
        text.textContent = `Updated ${timeAgo(last)}`;
        if (Date.now() - Date.parse(last) > 2 * 3600000) dot.classList.add('stale');
    }
    btn.title = err ? `Last update failed: ${err}` : 'Reload the latest data (collected hourly)';
    btn.setAttribute('aria-label', `${text.textContent}. Reload data`);
}

async function reload() {
    const btn = document.getElementById('reloadBtn');
    btn.disabled = true;
    try {
        await loadAll();
        renderHeader();
        render({ keepScroll: true });
    } finally {
        btn.disabled = false;
    }
}

function currentTheme() {
    return document.documentElement.dataset.theme
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function renderThemeButton() {
    const btn = document.getElementById('themeBtn');
    const dark = currentTheme() === 'dark';
    btn.innerHTML = dark ? icons.sun : icons.moon;
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

let bootstrapChecks = 0;

async function boot() {
    document.getElementById('reloadIcon').innerHTML = icons.reload;
    document.getElementById('reloadBtn').addEventListener('click', reload);
    document.getElementById('themeBtn').addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        prefs.set('theme', next);
        renderThemeButton();
        render({ keepScroll: true });
    });
    renderThemeButton();
    renderNav(route().section);
    document.getElementById('main').innerHTML = '<div class="kpis"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';

    await loadAll();
    renderHeader();
    render({ keepScroll: true });
    window.addEventListener('hashchange', () => render());
    setInterval(updateFreshness, 60000);

    // A brand-new deployment collects its first data in the background; re-check until it lands.
    const poll = async () => {
        if (store.clan || bootstrapChecks++ > 12) return;
        if (!store.status?.lastCollect || store.status.lastCollect.finishedAt) return;
        setTimeout(async () => { await loadAll(); renderHeader(); render({ keepScroll: true }); poll(); }, 5000);
    };
    poll();
}

boot();
