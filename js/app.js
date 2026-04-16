import { roleWeight } from './constants.js';
import { 
    fetchClanData, 
    fetchMembersIndex, 
    fetchHistoricalMembers, 
    fetchWarIndex, 
    fetchWarData 
} from './api.js';
import { renderMembers, renderWarHistory, renderWarDetail, renderAbout } from './render.js';
import { renderCharts } from './charts.js';
import { 
    switchView, 
    updateMemberCount, 
    updatePageTitle,
    updateHeader
} from './ui.js';

let allMembers = [];
let latestClanData = null;
let currentRoleFilter = 'all';
let fullWarHistory = [];
let availableMemberDates = [];
let fp = null;

async function init() {
    try {
        // Load Current Data
        const clanData = await fetchClanData();
        latestClanData = clanData;
        allMembers = clanData.memberList || [];
        updateDisplay();

        // Update Header with Clan Info
        updateHeader(clanData.name, clanData.badgeUrls?.medium || clanData.badgeUrls?.small);

        // Load Member Index for calendar restrictions
        const memberIndex = await fetchMembersIndex();
        const todayStr = new Date().toISOString().split('T')[0];
        
        availableMemberDates = memberIndex.map(f => {
            const dateStr = f.replace('members_', '').replace('.json', '');
            return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
        });
        
        // Ensure today is in available dates if not already
        if (!availableMemberDates.includes(todayStr)) {
            availableMemberDates.push(todayStr);
        }

        // Initialize Flatpickr for Member Date
        fp = flatpickr("#memberDate", {
            defaultDate: todayStr,
            enable: availableMemberDates,
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                handleMemberDateChange(dateStr);
            }
        });

        // Initialize Flatpickr for War Dates
        const startPicker = flatpickr("#warStartDate", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                endPicker.set('minDate', dateStr);
                filterWarHistory();
            }
        });
        const endPicker = flatpickr("#warEndDate", {
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                startPicker.set('maxDate', dateStr);
                filterWarHistory();
            }
        });

        // Load War History
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
        console.error("Data error.", e);
    }
}

async function handleMemberDateChange(dateValue) {
    if (!dateValue) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = dateValue === todayStr;
    const titleEl = document.getElementById('memberTitle');
    
    titleEl.innerText = isToday ? "Current Members" : `Members: ${dateValue}`;

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
        console.warn("Snapshot not found.");
        allMembers = [];
        updateDisplay();
    }
}

function filterWarHistory() {
    const startVal = document.getElementById('warStartDate').value.replace(/-/g, ''); // YYYYMMDD
    const endVal = document.getElementById('warEndDate').value.replace(/-/g, '');   // YYYYMMDD
    
    let filtered = fullWarHistory.filter(w => {
        // Always include active wars
        const now = new Date();
        const year = w.endTime.substring(0, 4);
        const month = w.endTime.substring(4, 6) - 1;
        const day = w.endTime.substring(6, 8);
        const hour = w.endTime.substring(9, 11);
        const min = w.endTime.substring(11, 13);
        const sec = w.endTime.substring(13, 15);
        const warEnd = new Date(Date.UTC(year, month, day, hour, min, sec));
        
        if (now < warEnd) return true;
        
        const warDate = w.startTime.substring(0, 8);
        if (startVal && warDate < startVal) return false;
        if (endVal && warDate > endVal) return false;
        return true;
    });
    
    renderWarHistory(filtered);
}

function updateDisplay() {
    const sortKey = document.getElementById('sortBy').value;
    let filtered = allMembers.filter(m => currentRoleFilter === 'all' || m.role === currentRoleFilter);
    updateMemberCount(filtered.length);
    
    filtered.sort((a, b) => {
        if (sortKey === 'role') {
            return roleWeight[b.role] - roleWeight[a.role];
        } else if (sortKey === 'league') {
            const leagueA = a.leagueTier?.id || a.league?.id || 0;
            const leagueB = b.leagueTier?.id || b.league?.id || 0;
            if (leagueA !== leagueB) {
                return leagueB - leagueA;
            }
            return b.trophies - a.trophies;
        } else {
            return b[sortKey] - a[sortKey];
        }
    });
    renderMembers(filtered);
}

function setRoleFilter(role, btn) {
    currentRoleFilter = role;
    document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateDisplay();
}

async function loadWarDetail(filename) {
    const warData = fullWarHistory.find(w => w.filename === filename);
    if (warData) {
        document.getElementById('warListView').classList.add('hidden');
        document.getElementById('warDetailView').classList.remove('hidden');
        renderWarDetail(warData);
    }
}

function showWarList() {
    document.getElementById('warListView').classList.remove('hidden');
    document.getElementById('warDetailView').classList.add('hidden');
}

// Expose to window for onclick handlers
window.loadWarDetail = loadWarDetail;

document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('tab-members').addEventListener('click', () => switchView('members'));
    document.getElementById('tab-war').addEventListener('click', () => switchView('war'));
    document.getElementById('tab-stats').addEventListener('click', () => {
        switchView('stats');
        renderCharts(fullWarHistory);
    });
    document.getElementById('tab-about').addEventListener('click', () => {
        switchView('about');
        renderAbout(latestClanData);
    });
    
    document.getElementById('sortBy').addEventListener('change', updateDisplay);
    
    // Member date is now handled by Flatpickr onChange
    
    document.getElementById('backToWarList').addEventListener('click', showWarList);

    document.getElementById('clearMembersFilters').addEventListener('click', () => {
        currentRoleFilter = 'all';
        document.querySelectorAll('.btn-role').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-role="all"]').classList.add('active');
        document.getElementById('sortBy').value = 'league';
        // Reset Flatpickr
        const todayStr = new Date().toISOString().split('T')[0];
        fp.setDate(todayStr);
        handleMemberDateChange(todayStr);
    });

    document.getElementById('clearWarFilters').addEventListener('click', () => {
        document.getElementById('warStartDate').value = '';
        document.getElementById('warEndDate').value = '';
        // We need to re-initialize or reset the flatpickr instances if we kept references, 
        // but simple value clear + trigger change works for basic usage.
        // For strict validation, we refresh the list.
        filterWarHistory();
    });

    document.querySelectorAll('.btn-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            setRoleFilter(role, btn);
        });
    });
});
