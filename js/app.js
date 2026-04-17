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
import { 
    switchView, 
    switchSubView,
    updateMemberCount, 
    updateHeader
} from './ui.js';

// Global state variables
let allMembers = [];           // Current list of members being viewed
let latestClanData = null;     // Latest clan profile (About tab)
let currentRoleFilter = 'all'; // Active role filter for Roster
let fullWarHistory = [];       // Loaded war records
let availableMemberDates = []; // List of dated snapshots for Roster
let fp = null;                 // Flatpickr instance for Roster date

/**
 * Initializes the application by fetching all necessary data.
 */
async function init() {
    // 1. Try to load latest Clan/Member Profile
    try {
        const clanData = await fetchClanData();
        latestClanData = clanData;
        allMembers = clanData.memberList || [];
        updateDisplay();
        renderAbout(latestClanData);
        bindAboutPageEvents();
        updateHeader(clanData.name, clanData.badgeUrls?.medium || clanData.badgeUrls?.small);
    } catch (e) {
        console.error("Critical: Could not load latest clan data.", e);
    }

    // 2. Setup Member Snapshot Filter (Roster Tab)
    try {
        const memberIndex = await fetchMembersIndex();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Convert filenames to YYYY-MM-DD for Flatpickr
        availableMemberDates = memberIndex.map(f => {
            const dateStr = f.replace('members_', '').replace('.json', '');
            return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
        });
        
        // Default to the newest available indexed snapshot
        let bestDefaultDate = availableMemberDates[0] || todayStr;
        
        // Add "today" to available dates if missing (logic in api.js handles the fallback)
        if (!availableMemberDates.includes(todayStr)) {
            availableMemberDates.push(todayStr);
        }

        fp = flatpickr("#memberDate", {
            defaultDate: bestDefaultDate,
            enable: availableMemberDates,
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                handleMemberDateChange(dateStr);
            }
        });

        // Initialize title correctly
        const titleEl = document.getElementById('memberTitle');
        if (titleEl) {
            const isToday = bestDefaultDate === todayStr;
            titleEl.innerText = isToday ? "Current Members" : `Members: ${bestDefaultDate}`;
        }
    } catch (e) {
        console.warn("Could not setup member date filters.", e);
    }

    // 3. Setup War Date Range Filters (History Tab)
    try {
        const startPicker = flatpickr("#warStartDate", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                if (endPicker) endPicker.set('minDate', dateStr);
                filterWarHistory();
            }
        });
        const endPicker = flatpickr("#warEndDate", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                if (startPicker) startPicker.set('maxDate', dateStr);
                filterWarHistory();
            }
        });
    } catch (e) {
        console.warn("Could not setup war date filters.", e);
    }

    // 4. Load War History and aggregate stats
    try {
        const warIndex = await fetchWarIndex();
        const warDataPromises = warIndex.reverse().map(async (filename) => {
            try {
                const data = await fetchWarData(filename);
                return { ...data, filename };
            } catch (e) {
                console.error(`Error loading war ${filename}`, e);
                return null;
            }
        });
        
        fullWarHistory = (await Promise.all(warDataPromises)).filter(w => w !== null);
        renderWarHistory(fullWarHistory);
    } catch (e) {
        console.error("Could not load war history.", e);
    }
}

/**
 * Binds interactive events for the About tab.
 */
function bindAboutPageEvents() {
    const btn = document.getElementById('viewWarHistoryBtn');
    if (btn) {
        btn.onclick = () => {
            switchView('war');
            switchSubView('history');
        };
    }
}

/**
 * Handles the logic when a new snapshot date is selected in the Roster.
 */
async function handleMemberDateChange(dateValue, shouldFetch = true) {
    if (!dateValue) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = dateValue === todayStr;
    const titleEl = document.getElementById('memberTitle');
    
    if (titleEl) {
        titleEl.innerText = isToday ? "Current Members" : `Members: ${dateValue}`;
    }

    if (!shouldFetch) return;

    const snapshotName = `members_${dateValue.replace(/-/g, '')}.json`;
    try {
        let data;
        if (isToday) {
            data = await fetchClanData();
        } else {
            data = await fetchHistoricalMembers(snapshotName);
        }
        allMembers = data.memberList || [];
        updateDisplay();
    } catch (e) {
        console.warn(`Snapshot ${snapshotName} not found, falling back to latest available.`);
        try {
            const fallbackData = await fetchClanData();
            allMembers = fallbackData.memberList || [];
            updateDisplay();
        } catch (err) {
            console.error("Failed to load even fallback data.");
            allMembers = [];
            updateDisplay();
        }
    }
}

/**
 * Filters the war list based on selected start/end dates.
 */
function filterWarHistory() {
    const startVal = document.getElementById('warStartDate')?.value.replace(/-/g, '') || '';
    const endVal = document.getElementById('warEndDate')?.value.replace(/-/g, '') || '';
    
    let filtered = fullWarHistory.filter(w => {
        const now = new Date();
        const warEnd = parseCoCDate(w.endTime);
        
        // Pinned wars (active/prep) are always visible
        if (now < warEnd) return true;
        
        const warDate = w.startTime.substring(0, 8);
        if (startVal && warDate < startVal) return false;
        if (endVal && warDate > endVal) return false;
        return true;
    });
    
    renderWarHistory(filtered);
}

/**
 * Triggers a sort and re-render of the member roster.
 */
function updateDisplay() {
    const sortByEl = document.getElementById('sortBy');
    if (!sortByEl) return;
    const sortKey = sortByEl.value;
    
    let filtered = allMembers.filter(m => currentRoleFilter === 'all' || m.role === currentRoleFilter);
    updateMemberCount(filtered.length);
    
    filtered.sort((a, b) => {
        if (sortKey === 'role') {
            return (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
        } else if (sortKey === 'league') {
            const leagueA = a.leagueTier?.id || a.league?.id || 0;
            const leagueB = b.leagueTier?.id || b.league?.id || 0;
            if (leagueA !== leagueB) return leagueB - leagueA;
            return (b.trophies || 0) - (a.trophies || 0);
        } else {
            return (b[sortKey] || 0) - (a[sortKey] || 0);
        }
    });
    renderMembers(filtered);
}

/**
 * Updates the active role filter.
 */
function setRoleFilter(role, btn) {
    currentRoleFilter = role;
    document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateDisplay();
}

/**
 * Transitions the UI to show specific war details.
 */
async function loadWarDetail(filename) {
    const warData = fullWarHistory.find(w => w.filename === filename);
    if (warData) {
        const listView = document.getElementById('warListView');
        const detailView = document.getElementById('warDetailView');
        if (listView) listView.classList.add('hidden');
        if (detailView) {
            detailView.classList.remove('hidden');
            renderWarDetail(warData, fullWarHistory);
        }
    }
}

/**
 * Transitions back to the war history list.
 */
function showWarList() {
    const listView = document.getElementById('warListView');
    const detailView = document.getElementById('warDetailView');
    if (listView) listView.classList.remove('hidden');
    if (detailView) detailView.classList.add('hidden');
}

// Expose navigation functions to global scope for HTML onclick handlers
window.loadWarDetail = loadWarDetail;

/**
 * DOM Ready Listener
 */
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Bind Primary Navigation
    const tabAbout = document.getElementById('tab-about');
    if (tabAbout) {
        tabAbout.addEventListener('click', () => {
            switchView('about');
            if (latestClanData) renderAbout(latestClanData);
            bindAboutPageEvents();
        });
    }

    const tabMembers = document.getElementById('tab-members');
    if (tabMembers) tabMembers.addEventListener('click', () => switchView('members'));

    const tabWar = document.getElementById('tab-war');
    if (tabWar) {
        tabWar.addEventListener('click', () => {
            switchView('war');
            switchSubView('history');
        });
    }

    // Bind War Sub-navigation
    const subtabHistory = document.getElementById('subtab-history');
    if (subtabHistory) subtabHistory.addEventListener('click', () => switchSubView('history'));

    const subtabStats = document.getElementById('subtab-stats');
    if (subtabStats) {
        subtabStats.addEventListener('click', () => {
            switchSubView('stats');
            renderCharts(fullWarHistory);
        });
    }
    
    // Bind Filter Controls
    const sortBy = document.getElementById('sortBy');
    if (sortBy) sortBy.addEventListener('change', updateDisplay);

    const backToWarList = document.getElementById('backToWarList');
    if (backToWarList) backToWarList.addEventListener('click', showWarList);

    // Bind Clear Buttons
    const clearMembers = document.getElementById('clearMembersFilters');
    if (clearMembers) {
        clearMembers.addEventListener('click', () => {
            currentRoleFilter = 'all';
            document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
            const allBtn = document.querySelector('[data-role="all"]');
            if (allBtn) allBtn.classList.add('active');
            const sortBy = document.getElementById('sortBy');
            if (sortBy) sortBy.value = 'league';
            
            const bestDate = availableMemberDates[0] || new Date().toISOString().split('T')[0];
            if (fp) fp.setDate(bestDate);
            handleMemberDateChange(bestDate);
        });
    }

    const clearWar = document.getElementById('clearWarFilters');
    if (clearWar) {
        clearWar.addEventListener('click', () => {
            const start = document.getElementById('warStartDate');
            const end = document.getElementById('warEndDate');
            if (start) start.value = '';
            if (end) end.value = '';
            filterWarHistory();
        });
    }

    // Bind Role Filter Buttons
    document.querySelectorAll('.btn-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            setRoleFilter(role, btn);
        });
    });

    // Global listener to close tactical tooltips when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.info-tooltip').forEach(t => t.classList.remove('active'));
    });
});
