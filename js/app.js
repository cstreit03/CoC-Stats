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
    fetchWarData 
} from './api.js';
import { 
    renderMembers, 
    renderWarHistory, 
    renderWarDetail, 
    renderAbout
} from './render.js';
import { renderCharts } from './charts.js';

// Global state variables
let allMembers = [];           
let latestClanData = null;     
let currentRoleFilter = 'all'; 
let fullWarHistory = [];       
let availableMemberDates = []; 
let fp = null;                 
let activeWarFilename = null;  
let warHistoryPickers = []; 

/**
 * UI View Controllers
 */
function switchView(viewId, updateHash = true) {
    // Select all elements that start with 'section-' and hide them
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    
    // Show target section
    const target = document.getElementById(`section-${viewId}`);
    if (target) target.classList.remove('hidden-section');
    
    // Update tabs
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
    
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`subtab-${subviewId}`)?.classList.add('active');
    
    if (updateHash) window.location.hash = `war/${subviewId}`;
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

/**
 * Syncs all data in the background without a full page reload.
 */
window.syncData = async () => {
    const btns = document.querySelectorAll('.sync-btn');
    btns.forEach(b => b.classList.add('syncing'));
    try {
        await init();
        if (activeWarFilename) {
            const warData = fullWarHistory.find(w => w.filename === activeWarFilename);
            if (warData) renderWarDetail(warData, fullWarHistory);
        }
    } catch (e) {
        console.error("Sync failed", e);
    } finally {
        setTimeout(() => btns.forEach(b => b.classList.remove('syncing')), 500);
    }
};

function preRoute() {
    const hash = window.location.hash.replace('#', '');
    const tabAbout = document.getElementById('tab-about');
    const tabMembers = document.getElementById('tab-members');
    const tabWar = document.getElementById('tab-war');
    if (!tabAbout || !tabMembers || !tabWar) return;
    
    [tabAbout, tabMembers, tabWar].forEach(t => t.classList.remove('active'));
    if (!hash || hash === 'about') tabAbout.classList.add('active');
    else if (hash === 'members') tabMembers.classList.add('active');
    else if (hash.startsWith('war')) tabWar.classList.add('active');
}

async function init() {
    // 1. Load Clan/Member Profile
    try {
        const clanData = await fetchClanData();
        latestClanData = clanData;
        allMembers = clanData.memberList || clanData.members || [];
        updateDisplay();
        renderAbout(latestClanData);
        bindAboutPageEvents();
        updateHeader(clanData.name, clanData.badgeUrls?.medium || clanData.badgeUrls?.small);
    } catch (e) { console.error("Could not load latest clan data.", e); }

    // 2. Setup Member Snapshot Filter
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

    // 3. Load War History
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
        handleInitialRoute();
    } catch (e) { console.error("Could not load war history.", e); handleInitialRoute(); }
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
    document.getElementById('subtab-history')?.addEventListener('click', () => switchSubView('history'));
    document.getElementById('subtab-stats')?.addEventListener('click', () => { switchSubView('stats'); renderCharts(fullWarHistory, document.getElementById('statsTimeRange')?.value || 'month'); });
    document.getElementById('statsTimeRange')?.addEventListener('change', (e) => { renderCharts(fullWarHistory, e.target.value); });
    document.getElementById('sortBy')?.addEventListener('change', updateDisplay);
    document.getElementById('backToWarList')?.addEventListener('click', showWarList);
    document.getElementById('clearMembersFilters')?.addEventListener('click', () => {
        currentRoleFilter = 'all'; document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-role="all"]')?.classList.add('active');
        document.getElementById('sortBy').value = 'league';
        updateDisplay();
    });
    document.getElementById('clearWarFilters')?.addEventListener('click', () => {
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
