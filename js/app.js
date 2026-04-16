import { roleWeight } from './constants.js';
import { 
    fetchClanData, 
    fetchMembersIndex, 
    fetchHistoricalMembers, 
    fetchWarIndex, 
    fetchWarData 
} from './api.js';
import { renderMembers, renderWarHistory, renderWarDetail } from './render.js';
import { 
    switchView, 
    updateMemberCount, 
    updatePageTitle 
} from './ui.js';

let allMembers = [];
let currentRoleFilter = 'all';
let fullWarHistory = [];
let availableMemberDates = [];
let fp = null;

async function init() {
    try {
        // Set default title
        updatePageTitle("Dashboard");

        // Load Current Data
        const clanData = await fetchClanData();
        allMembers = clanData.memberList || [];
        updateDisplay();

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

        // Initialize Flatpickr
        fp = flatpickr("#memberDate", {
            defaultDate: todayStr,
            enable: availableMemberDates,
            dateFormat: "Y-m-d",
            onChange: function(selectedDates, dateStr) {
                handleMemberDateChange(dateStr);
            },
            onDayCreate: function(dObj, dStr, fp, dayElem) {
                // Ensure weekend days (sat/sun) don't have special colors from themes
                dayElem.classList.remove("flatpickr-disabled"); // theme might use this
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
    const startVal = document.getElementById('warStartDate').value.replace(/-/g, '');
    const endVal = document.getElementById('warEndDate').value.replace(/-/g, '');
    
    let filtered = fullWarHistory;
    
    if (startVal) {
        filtered = filtered.filter(w => w.startTime.substring(0, 8) >= startVal);
    }
    if (endVal) {
        filtered = filtered.filter(w => w.startTime.substring(0, 8) <= endVal);
    }
    
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
    
    document.getElementById('sortBy').addEventListener('change', updateDisplay);
    
    // Member date is now handled by Flatpickr onChange
    
    document.getElementById('warStartDate').addEventListener('change', filterWarHistory);
    document.getElementById('warEndDate').addEventListener('change', filterWarHistory);
    
    document.getElementById('backToWarList').addEventListener('click', showWarList);

    document.querySelectorAll('.btn-role').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-role');
            setRoleFilter(role, btn);
        });
    });
});
