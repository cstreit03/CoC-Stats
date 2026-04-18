/**
 * Main Application Module
 * Orchestrates the data loading flow, global event listeners, and view switching.
 */
import { roleWeight, parseCoCDate } from './constants.js';
import { 
    fetchClanData, 
    fetchMembersIndex, 
    fetchHistoricalMembers, 
    fetchWarIndex, 
    fetchWarData,
    fetchRaidIndex,
    fetchRaidData
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
import { renderCharts } from './charts.js';

// Global state variables
let allMembers = [];           
let latestClanData = null;     
let currentRoleFilter = 'all'; 
let fullWarHistory = [];       
let fullRaidHistory = [];      
let availableMemberDates = []; 
let fp = null;                 
let raidFp = null;             
let activeWarFilename = null;  
let warHistoryPickers = []; 
let currentRaidIndex = 0;      

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

    // Toggle header controls
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
    if (el) el.innerText = `${count} / 50`;
}

function updateHeader(name, badgeUrl) {
    const title = document.getElementById('pageTitle');
    const badge = document.getElementById('clanBadge');
    if (title) title.innerText = name;
    if (badge && badgeUrl) {
        badge.src = badgeUrl;
        badge.classList.remove('hidden');
    }
}

window.syncData = async () => {
    const btns = document.querySelectorAll('.sync-btn');
    btns.forEach(b => b.classList.add('syncing'));
    try {
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
    const tabRaids = document.getElementById('tab-raids');
    if (!tabAbout || !tabMembers || !tabWar || !tabRaids) return;
    [tabAbout, tabMembers, tabWar, tabRaids].forEach(t => t.classList.remove('active'));
    if (!hash || hash === 'about') tabAbout.classList.add('active');
    else if (hash === 'members') tabMembers.classList.add('active');
    else if (hash.startsWith('war')) tabWar.classList.add('active');
    else if (hash.startsWith('raids')) tabRaids.classList.add('active');
}

async function init() {
    try {
        const clanData = await fetchClanData();
        latestClanData = clanData;
        allMembers = clanData.memberList || clanData.members || [];
        updateDisplay();
        renderAbout(latestClanData);
        bindAboutPageEvents();
        updateHeader(clanData.name, clanData.badgeUrls?.medium || clanData.badgeUrls?.small);
    } catch (e) { console.error("Could not load latest clan data.", e); }

    try {
        const memberIndex = await fetchMembersIndex();
        const todayStr = new Date().toISOString().split('T')[0];
        availableMemberDates = memberIndex.map(f => {
            const dateStr = f.replace('members_', '').replace('.json', '');
            return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
        });
        let bestDefaultDate = availableMemberDates[0] || todayStr;
        if (!availableMemberDates.includes(todayStr)) availableMemberDates.push(todayStr);
        if (fp) fp.destroy();
        fp = flatpickr("#memberDate", {
            defaultDate: bestDefaultDate, enable: availableMemberDates, dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) { handleMemberDateChange(dateStr); }
        });
        const titleEl = document.getElementById('memberTitle');
        if (titleEl) titleEl.innerText = bestDefaultDate === todayStr ? "Current Members" : `Members: ${bestDefaultDate}`;
    } catch (e) { console.warn("Could not setup member date filters.", e); }

    try {
        const warIndex = await fetchWarIndex();
        const warDataPromises = warIndex.reverse().map(async (filename) => {
            try {
                const data = await fetchWarData(filename);
                return { ...data, filename };
            } catch (e) { return null; }
        });
        fullWarHistory = (await Promise.all(warDataPromises)).filter(w => w !== null);
        renderWarHistory(fullWarHistory);
        setupWarHistoryPickers();
    } catch (e) { console.error("Could not load war history.", e); }

    try {
        const raidIndex = await fetchRaidIndex();
        const raidDataPromises = raidIndex.reverse().map(async (filename) => {
            try {
                const data = await fetchRaidData(filename);
                const items = data.items || [data];
                return items.map(item => ({ ...item, filename }));
            } catch (e) { return null; }
        });
        const raidResults = await Promise.all(raidDataPromises);
        fullRaidHistory = raidResults.flat().filter(r => r !== null);
        setupRaidCalendar();
        handleInitialRoute();
    } catch (e) { console.error("Could not load raid history.", e); handleInitialRoute(); }
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
        onChange: (selectedDates) => {
            if (selectedDates.length > 0) eP.set('minDate', selectedDates[0]);
            filterWarHistory(); 
        } 
    });
    const eP = flatpickr(endEl, { 
        dateFormat: "Y-m-d", 
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
    if (hash === 'members') { switchView(hash, false); }
    else if (hash.startsWith('raids')) {
        const parts = hash.split('/');
        const subview = parts[1] || 'summary';
        switchView('raids', false);
        switchRaidSubView(subview, false);
    }
    else if (hash.startsWith('war/')) {
        const parts = hash.split('/');
        const subview = parts[1];
        let detailFile = parts[2];
        if (detailFile && !detailFile.endsWith('.json')) detailFile += '.json';
        switchView('war', false);
        if (detailFile) loadWarDetail(detailFile, false); 
        else {
            switchSubView(subview, false);
            if (subview === 'stats') renderCharts(fullWarHistory, document.getElementById('statsTimeRange')?.value || 'month');
        }
    } else if (hash === 'war') { switchView('war', false); switchSubView('history', false); }
}

function bindAboutPageEvents() {
    const btn = document.getElementById('viewWarHistoryBtn');
    if (btn) btn.onclick = () => { switchView('war'); switchSubView('history'); };
}

async function handleMemberDateChange(dateValue, shouldFetch = true) {
    if (!dateValue) return;
    const snapshotName = `members_${dateValue.replace(/-/g, '')}.json`;
    try {
        let data = await fetchHistoricalMembers(snapshotName);
        allMembers = data.memberList || data.members || [];
        updateDisplay();
    } catch (e) {
        const fb = await fetchClanData(); allMembers = fb.memberList || fb.members || []; updateDisplay();
    }
}

function filterWarHistory() {
    const startVal = document.getElementById('warStartDate')?.value.replace(/-/g, '') || '';
    const endVal = document.getElementById('warEndDate')?.value.replace(/-/g, '') || '';
    let filtered = fullWarHistory.filter(w => {
        const warDate = w.startTime.substring(0, 8);
        if (startVal && warDate < startVal) return false;
        if (endVal && warDate > endVal) return false;
        return true;
    });
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
    document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); updateDisplay();
}

async function loadWarDetail(filename, updateHash = true) {
    const warData = fullWarHistory.find(w => w.filename === filename);
    if (warData) {
        activeWarFilename = filename;
        document.getElementById('warListView')?.classList.add('hidden');
        document.getElementById('warStatsView')?.classList.add('hidden');
        document.getElementById('warDetailView')?.classList.remove('hidden');
        renderWarDetail(warData, fullWarHistory);
        if (updateHash) window.location.hash = `war/details/${filename.replace('.json', '')}`;
    }
}

function showWarList() {
    activeWarFilename = null;
    document.getElementById('warListView')?.classList.remove('hidden');
    document.getElementById('warDetailView')?.classList.add('hidden');
    window.location.hash = `war/history`;
}

window.loadWarDetail = loadWarDetail;

document.addEventListener('DOMContentLoaded', () => {
    preRoute(); init();
    document.getElementById('tab-about')?.addEventListener('click', () => { switchView('about'); if (latestClanData) renderAbout(latestClanData); bindAboutPageEvents(); });
    document.getElementById('tab-members')?.addEventListener('click', () => switchView('members'));
    document.getElementById('tab-war')?.addEventListener('click', () => { switchView('war'); switchSubView('history'); });
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

    document.getElementById('subtab-history')?.addEventListener('click', () => switchSubView('history'));
    document.getElementById('subtab-stats')?.addEventListener('click', () => { switchSubView('stats'); renderCharts(fullWarHistory, document.getElementById('statsTimeRange')?.value || 'month'); });
    document.getElementById('statsTimeRange')?.addEventListener('change', (e) => { renderCharts(fullWarHistory, e.target.value); });
    document.getElementById('sortBy')?.addEventListener('change', updateDisplay);
    document.getElementById('backToWarList')?.addEventListener('click', showWarList);
    document.getElementById('resetMembersFilters')?.addEventListener('click', () => {
        currentRoleFilter = 'all'; document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-role="all"]')?.classList.add('active');
        document.getElementById('sortBy').value = 'league';
        updateDisplay();
    });
    document.getElementById('resetWarFilters')?.addEventListener('click', () => {
        const start = document.getElementById('warStartDate');
        const end = document.getElementById('warEndDate');
        if (start) start.value = '';
        if (end) end.value = '';
        warHistoryPickers.forEach(p => { p.clear(); p.set('minDate', null); p.set('maxDate', null); });
        filterWarHistory();
    });
    document.querySelectorAll('.btn-role').forEach(btn => { btn.addEventListener('click', () => setRoleFilter(btn.getAttribute('data-role'), btn)); });
    document.addEventListener('click', () => { document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('active')); });
});
