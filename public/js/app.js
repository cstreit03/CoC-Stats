/**
 * Main Application Module
 * Orchestrates the data loading flow, global event listeners, and view switching.
 */
import { roleWeight, parseCoCDate } from './constants.js';
import {
    fetchClanData,
    fetchMemberDates,
    fetchMembersOn,
    fetchWars,
    fetchRaids,
    fetchCwl,
    fetchHistory,
    fetchStatus,
    requestRefresh
} from './api.js';
import { 
    renderMembers, 
    renderWarHistory, 
    renderWarDetail, 
    renderAbout,
    renderRaidSummary,
    renderRaidAttacks,
    renderRaidDefenses,
    setRaidSort,
    resetRaidSort
} from './render.js';
import { renderCharts, renderOverviewKpis } from './charts.js';
import { renderCwl } from './cwl.js';
import { openPlayer, closePlayer } from './player.js';

// Global state variables
let allMembers = [];           
let latestClanData = null;     
let currentRoleFilter = 'all'; 
let currentWarFilter = 'all';  
let fullWarHistory = [];       
let fullRaidHistory = [];      
let availableMemberDates = []; 
let fp = null;                 
let raidFp = null;             
let activeWarFilename = null;  
let warHistoryPickers = []; 
let currentRaidIndex = 0;      
let history = null;            // { clanDaily, events, joinedAt, warlog }
let cwlSeasons = [];
let lastCollectAt = null;

/**
 * UI View Controllers
 */
function switchView(viewId, updateHash = true) {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    const target = document.getElementById(`section-${viewId}`);
    if (target) target.classList.remove('hidden-section');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeTab = document.getElementById(`tab-${viewId}`);
    if (activeTab) activeTab.classList.add('active');
    if (updateHash) window.location.hash = viewId;
}

function switchSubView(subviewId, updateHash = true) {
    const isHistory = subviewId === 'history';
    document.getElementById('warListView')?.classList.toggle('hidden', !isHistory);
    document.getElementById('warStatsView')?.classList.toggle('hidden', isHistory);
    document.getElementById('warDetailView')?.classList.add('hidden');
    document.getElementById('warHistoryControls')?.classList.toggle('hidden', !isHistory);
    document.getElementById('warStatsControls')?.classList.toggle('hidden', isHistory);
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`subtab-${subviewId}`)?.classList.add('active');
    if (updateHash) window.location.hash = `war/${subviewId}`;
}

function switchRaidSubView(subviewId, updateHash = true) {
    document.getElementById('raidSummaryView')?.classList.toggle('hidden', subviewId !== 'summary');
    document.getElementById('raidAttacksView')?.classList.toggle('hidden', subviewId !== 'attacks');
    document.getElementById('raidDefensesView')?.classList.toggle('hidden', subviewId !== 'defenses');
    document.querySelectorAll('#section-raids .sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`raid-subtab-${subviewId}`)?.classList.add('active');
    const raid = fullRaidHistory[currentRaidIndex];
    if (raid) {
        if (subviewId === 'summary') renderRaidSummary(raid, allMembers);
        else if (subviewId === 'attacks') renderRaidAttacks(raid);
        else if (subviewId === 'defenses') renderRaidDefenses(raid);
    }
    if (updateHash) window.location.hash = `raids/${subviewId}`;
}

function updateMemberCount(count) {
    const el = document.getElementById('memberCount');
    if (el) el.innerText = `${count} / ${allMembers.length}`;
}

function updateWarCount(filtered, total) {
    const el = document.getElementById('warCount');
    if (el) el.innerText = `${filtered} / ${total}`;
}

function updateHeader(clan) {
    const title = document.getElementById('pageTitle');
    const badge = document.getElementById('clanBadge');
    const meta = document.getElementById('headerMeta');
    const badgeUrl = clan.badgeUrls?.medium || clan.badgeUrls?.small;
    if (title) title.innerText = clan.name;
    document.title = `${clan.name} · Clan Stats`;
    if (badge && badgeUrl) {
        badge.src = badgeUrl;
        badge.classList.remove('hidden');
    }
    if (meta) {
        const chips = [
            `<span class="font-mono">${clan.tag}</span>`,
            `<span>Level ${clan.clanLevel}</span>`,
            `<span>${(clan.memberList || []).length} members</span>`,
            clan.warLeague?.name ? `<span>${clan.warLeague.name}</span>` : '',
            clan.warWinStreak ? `<span class="gold">${clan.warWinStreak} war win streak</span>` : ''
        ].filter(Boolean);
        meta.innerHTML = chips.join('<span class="meta-sep">•</span>');
    }
}

function timeAgo(iso) {
    const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
    return `${Math.round(hrs / 24)} days ago`;
}

function updateFreshness() {
    const el = document.getElementById('lastUpdated');
    const dot = document.querySelector('.live-dot');
    if (!el) return;
    if (!lastCollectAt) { el.innerText = 'Refresh'; dot?.classList.add('stale'); return; }
    el.innerText = `Updated ${timeAgo(lastCollectAt)}`;
    dot?.classList.toggle('stale', Date.now() - Date.parse(lastCollectAt) > 2 * 3600000);
}

window.syncData = async () => {
    const btns = document.querySelectorAll('.sync-btn');
    btns.forEach(b => b.classList.add('syncing'));
    try {
        await requestRefresh();
        await init();
        if (activeWarFilename) {
            const warData = fullWarHistory.find(w => w.filename === activeWarFilename);
            if (warData) renderWarDetail(warData, fullWarHistory);
        }
    } catch (e) { console.error("Sync failed", e); } finally {
        setTimeout(() => btns.forEach(b => b.classList.remove('syncing')), 500);
    }
};

function preRoute() {
    const hash = window.location.hash.replace('#', '');
    const tabAbout = document.getElementById('tab-about');
    const tabMembers = document.getElementById('tab-members');
    const tabWar = document.getElementById('tab-war');
    const tabStats = document.getElementById('tab-stats');
    const tabRaids = document.getElementById('tab-raids');
    const tabCwl = document.getElementById('tab-cwl');
    if (!tabAbout || !tabMembers || !tabWar || !tabStats || !tabRaids || !tabCwl) return;
    [tabAbout, tabMembers, tabWar, tabStats, tabRaids, tabCwl].forEach(t => t.classList.remove('active'));
    if (!hash || hash === 'about') tabAbout.classList.add('active');
    else if (hash === 'members') tabMembers.classList.add('active');
    else if (hash.startsWith('war')) tabWar.classList.add('active');
    else if (hash === 'stats') tabStats.classList.add('active');
    else if (hash.startsWith('raids')) tabRaids.classList.add('active');
    else if (hash === 'cwl') tabCwl.classList.add('active');
}

/** Everything the Overview/Reports/CWL views need, in one object. */
function reportContext() {
    return { clan: latestClanData, members: latestClanData?.memberList || [], wars: fullWarHistory, raids: fullRaidHistory, history, cwl: cwlSeasons };
}

async function init() {
    const [clanRes, datesRes, warsRes, raidsRes, historyRes, cwlRes, statusRes] = await Promise.allSettled([
        fetchClanData(), fetchMemberDates(), fetchWars(), fetchRaids(), fetchHistory(), fetchCwl(), fetchStatus()
    ]);
    const ok = (r, label) => {
        if (r.status === 'fulfilled') return r.value;
        console.error(`Could not load ${label}.`, r.reason);
        return null;
    };

    history = ok(historyRes, 'roster history');
    cwlSeasons = ok(cwlRes, 'CWL') || [];
    const status = ok(statusRes, 'status');
    lastCollectAt = status?.lastSuccess || null;
    updateFreshness();

    const clanData = ok(clanRes, 'latest clan data');
    if (clanData) {
        latestClanData = clanData;
        allMembers = clanData.memberList || [];
        if (!lastCollectAt && clanData.snapshotDate) {
            document.getElementById('lastUpdated').innerText = `Snapshot ${clanData.snapshotDate}`;
        }
        updateDisplay();
        renderAbout(latestClanData);
        bindAboutPageEvents();
        updateHeader(clanData);
    }

    const dates = ok(datesRes, 'member snapshot dates');
    if (dates) {
        availableMemberDates = dates;
        if (fp) fp.destroy();
        fp = flatpickr("#memberDate", {
            defaultDate: availableMemberDates[0], enable: availableMemberDates, dateFormat: "Y-m-d",
            disableMobile: true,
            onChange: function(selectedDates, dateStr) { handleMemberDateChange(dateStr); }
        });
    }

    const wars = ok(warsRes, 'war history');
    if (wars) {
        fullWarHistory = wars.reverse(); // newest first
        filterWarHistory();
        setupWarHistoryPickers();
    }

    const raids = ok(raidsRes, 'raid history');
    if (raids) {
        fullRaidHistory = raids;
        setupRaidCalendar();
    }
    renderOverviewKpis(reportContext());
    handleInitialRoute();
}

function setupRaidCalendar() {
    const calendarEl = document.getElementById('raidWeekendCalendar');
    if (!calendarEl || fullRaidHistory.length === 0) return;

    const getDateStr = (d) => {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const enabledDates = [];
    fullRaidHistory.forEach(r => {
        let current = parseCoCDate(r.startTime);
        const end = parseCoCDate(r.endTime);
        while (current <= end) {
            enabledDates.push(getDateStr(current));
            current.setUTCDate(current.getUTCDate() + 1);
        }
    });

    if (raidFp) raidFp.destroy();
    raidFp = flatpickr(calendarEl, {
        enable: enabledDates,
        dateFormat: "Y-m-d",
        defaultDate: enabledDates[0],
        disableMobile: true,
        onChange: (selectedDates) => {
            if (selectedDates.length === 0) return;
            const sel = selectedDates[0];
            const selectedStr = `${sel.getFullYear()}-${String(sel.getMonth() + 1).padStart(2, '0')}-${String(sel.getDate()).padStart(2, '0')}`;
            
            const idx = fullRaidHistory.findIndex(r => {
                let check = parseCoCDate(r.startTime);
                const rEnd = parseCoCDate(r.endTime);
                while (check <= rEnd) {
                    if (getDateStr(check) === selectedStr) return true;
                    check.setUTCDate(check.getUTCDate() + 1);
                }
                return false;
            });

            if (idx !== -1) {
                currentRaidIndex = idx;
                const activeSubTab = document.querySelector('#section-raids .sub-tab-btn.active')?.id.replace('raid-subtab-', '') || 'summary';
                switchRaidSubView(activeSubTab);
            }
        }
    });

    currentRaidIndex = 0;
    switchRaidSubView('summary', false);
}

function setupWarHistoryPickers() {
    warHistoryPickers.forEach(p => p.destroy());
    const startEl = document.getElementById('warStartDate');
    const endEl = document.getElementById('warEndDate');
    if (!startEl || !endEl) return;
    const sP = flatpickr(startEl, { 
        dateFormat: "Y-m-d", 
        disableMobile: true,
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) eP.set('minDate', selectedDates[0]);
            filterWarHistory(); 
        } 
    });
    const eP = flatpickr(endEl, { 
        dateFormat: "Y-m-d", 
        disableMobile: true,
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) sP.set('maxDate', selectedDates[0]);
            filterWarHistory(); 
        } 
    });
    warHistoryPickers = [sP, eP];
}

function handleInitialRoute() {
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === 'about') { switchView('about', false); return; }
    if (hash === 'cwl') { switchView('cwl', false); renderCwl(cwlSeasons, fullWarHistory); return; }
    if (hash === 'members') { switchView(hash, false); }
    else if (hash === 'stats') {
        switchView('stats', false);
        renderCharts(reportContext(), document.getElementById('statsTimeRange')?.value || 'all');
    }
    else if (hash.startsWith('raids')) {
        const parts = hash.split('/');
        const subview = parts[1] || 'summary';
        switchView('raids', false);
        switchRaidSubView(subview, false);
    }
    else if (hash.startsWith('war/')) {
        const parts = hash.split('/');
        let detailFile = parts[2];
        switchView('war', false);
        if (detailFile) loadWarDetail(detailFile, false); 
    } else if (hash === 'war') { switchView('war', false); }
}

function bindAboutPageEvents() {
    const btn = document.getElementById('viewWarHistoryBtn');
    if (btn) btn.onclick = () => { switchView('war'); };
}

async function handleMemberDateChange(dateValue) {
    if (!dateValue) return;
    try {
        const data = await fetchMembersOn(dateValue);
        allMembers = data.members || [];
    } catch (e) {
        allMembers = latestClanData?.memberList || [];
    }
    updateDisplay();
}

function filterWarHistory() {
    const startVal = document.getElementById('warStartDate')?.value.replace(/-/g, '') || '';
    const endVal = document.getElementById('warEndDate')?.value.replace(/-/g, '') || '';
    let filtered = fullWarHistory.filter(w => {
        const warDate = w.startTime.substring(0, 8);
        if (startVal && warDate < startVal) return false;
        if (endVal && warDate > endVal) return false;
        
        if (currentWarFilter !== 'all') {
            const clanStars = w.clan.stars || 0;
            const oppStars = w.opponent.stars || 0;
            const clanDest = w.clan.destructionPercentage || 0;
            const oppDest = w.opponent.destructionPercentage || 0;
            
            let result = 'draw';
            if (clanStars > oppStars) result = 'victory';
            else if (clanStars < oppStars) result = 'loss';
            else {
                if (clanDest > oppDest) result = 'victory';
                else if (clanDest < oppDest) result = 'loss';
            }
            
            if (result !== currentWarFilter) return false;
        }
        
        return true;
    });
    updateWarCount(filtered.length, fullWarHistory.length);
    renderWarHistory(filtered);
}

function updateDisplay() {
    const sortKey = document.getElementById('sortBy')?.value || 'league';
    let filtered = allMembers.filter(m => currentRoleFilter === 'all' || m.role === currentRoleFilter);
    updateMemberCount(filtered.length);
    filtered.sort((a, b) => {
        if (sortKey === 'role') return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
        if (sortKey === 'league') {
            const lA = a.leagueTier?.id || a.league?.id || 0; const lB = b.leagueTier?.id || b.league?.id || 0;
            return lA !== lB ? lB - lA : (b.trophies || 0) - (a.trophies || 0);
        }
        return (b[sortKey] || 0) - (a[sortKey] || 0);
    });
    renderMembers(filtered);
}

function setRoleFilter(role, btn) {
    currentRoleFilter = role;
    document.querySelectorAll('#section-members .sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); updateDisplay();
}

function setWarResultFilter(filter, btn) {
    currentWarFilter = filter;
    document.querySelectorAll('#section-war .sub-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterWarHistory();
}

async function loadWarDetail(filename, updateHash = true) {
    const warData = fullWarHistory.find(w => w.filename === filename);
    if (warData) {
        activeWarFilename = filename;
        document.getElementById('warMainHeader')?.classList.add('hidden');
        document.getElementById('warListView')?.classList.add('hidden');
        document.getElementById('warStatsView')?.classList.add('hidden');
        document.getElementById('warDetailView')?.classList.remove('hidden');
        document.getElementById('warHistoryControls')?.classList.add('hidden');
        renderWarDetail(warData, fullWarHistory);
        if (updateHash) window.location.hash = `war/details/${filename.replace('.json', '')}`;
    }
}

function showWarList() {
    activeWarFilename = null;
    switchView('war', false);
    document.getElementById('warMainHeader')?.classList.remove('hidden');
    document.getElementById('warListView')?.classList.remove('hidden');
    document.getElementById('warDetailView')?.classList.add('hidden');
    document.getElementById('warHistoryControls')?.classList.remove('hidden');
    window.location.hash = `war`;
}

window.loadWarDetail = loadWarDetail;
window.openWar = (id) => { switchView('war', false); loadWarDetail(id); };

document.addEventListener('DOMContentLoaded', () => {
    preRoute(); boot();
    document.getElementById('tab-about')?.addEventListener('click', () => { switchView('about'); if (latestClanData) { renderAbout(latestClanData); renderOverviewKpis(reportContext()); } bindAboutPageEvents(); });
    document.getElementById('tab-members')?.addEventListener('click', () => {
        switchView('members');
        currentRoleFilter = 'all';
        document.querySelectorAll('#section-members .sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#section-members [data-role="all"]')?.classList.add('active');
        updateDisplay();
    });
    document.getElementById('tab-war')?.addEventListener('click', () => { 
        showWarList();
        currentWarFilter = 'all';
        document.querySelectorAll('#section-war .sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#section-war [data-war-filter="all"]')?.classList.add('active');
        filterWarHistory();
    });
    document.getElementById('tab-stats')?.addEventListener('click', () => { 
        switchView('stats'); 
        renderCharts(reportContext(), document.getElementById('statsTimeRange')?.value || 'all');
    });
    document.getElementById('tab-cwl')?.addEventListener('click', () => { switchView('cwl'); renderCwl(cwlSeasons, fullWarHistory); });
    document.getElementById('tab-raids')?.addEventListener('click', () => { switchView('raids'); switchRaidSubView('summary'); });
    document.getElementById('raid-subtab-summary')?.addEventListener('click', () => switchRaidSubView('summary'));
    document.getElementById('raid-subtab-attacks')?.addEventListener('click', () => switchRaidSubView('attacks'));
    document.getElementById('raid-subtab-defenses')?.addEventListener('click', () => switchRaidSubView('defenses'));
    
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.raid-sort-btn');
        if (btn) {
            const table = btn.getAttribute('data-table');
            const sortKey = btn.getAttribute('data-sort');
            setRaidSort(table, sortKey);
            switchRaidSubView(table, false);
        }
    });

    document.getElementById('resetRaidSort')?.addEventListener('click', () => {
        const activeSubTab = document.querySelector('#section-raids .sub-tab-btn.active')?.id.replace('raid-subtab-', '') || 'summary';
        resetRaidSort(activeSubTab);
        switchRaidSubView(activeSubTab, false);
    });

    document.getElementById('statsTimeRange')?.addEventListener('change', (e) => { renderCharts(reportContext(), e.target.value); });
    document.getElementById('sortBy')?.addEventListener('change', updateDisplay);
    document.getElementById('backToWarList')?.addEventListener('click', showWarList);
    document.getElementById('resetMembersFilters')?.addEventListener('click', () => {
        currentRoleFilter = 'all'; 
        document.querySelectorAll('#section-members .sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#section-members [data-role="all"]')?.classList.add('active');
        document.getElementById('sortBy').value = 'league';
        updateDisplay();
    });
    document.getElementById('resetWarFilters')?.addEventListener('click', () => {
        const start = document.getElementById('warStartDate');
        const end = document.getElementById('warEndDate');
        if (start) start.value = '';
        if (end) end.value = '';
        warHistoryPickers.forEach(p => { p.clear(); p.set('minDate', null); p.set('maxDate', null); });
        currentWarFilter = 'all';
        document.querySelectorAll('#section-war .sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#section-war [data-war-filter="all"]')?.classList.add('active');
        filterWarHistory();
    });
    document.querySelectorAll('#section-members .sub-tab-btn').forEach(btn => { 
        if (btn.hasAttribute('data-role')) {
            btn.addEventListener('click', () => setRoleFilter(btn.getAttribute('data-role'), btn)); 
        }
    });
    document.querySelectorAll('#section-war .sub-tab-btn').forEach(btn => {
        if (btn.hasAttribute('data-war-filter')) {
            btn.addEventListener('click', () => setWarResultFilter(btn.getAttribute('data-war-filter'), btn));
        }
    });
    document.addEventListener('click', () => { document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('active')); });

    // Player profiles: any element with data-player-tag opens the drawer.
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-player-tag]');
        if (el) openPlayer(el.getAttribute('data-player-tag'), reportContext());
        if (e.target.closest('[data-close]')) closePlayer();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });
    setInterval(updateFreshness, 60000);
});

/** Shows cached data immediately, then asks the Worker for fresh data. */
async function boot() {
    await init();
    if (await requestRefresh()) await init();
}
