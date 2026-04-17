/**
 * Rendering Module
 * Responsible for generating all dynamic HTML content for the dashboard.
 */
import { roleMap, getTHImage, parseCoCDate } from './constants.js';

/**
 * Renders the member roster list with league icons and donation stats.
 * @param {Array} list - Array of member objects.
 */
export function renderMembers(list) {
    const container = document.getElementById('memberList');
    if (!container) return;
    container.innerHTML = list.map(m => {
        const leagueIcon = m.leagueTier?.iconUrls?.small || m.league?.iconUrls?.small || '';
        return `
        <div class="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-[#252525] border border-transparent rounded-lg">
            <img src="${getTHImage(m.townHallLevel)}" class="th-icon">
            <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-1 md:gap-2 truncate">
                    <span class="font-bold text-[11px] md:text-xs text-white">${m.name}</span>
                    <span class="text-[7px] md:text-[8px] text-gray-500 font-mono">XP ${m.expLevel}</span>
                </div>
                <span class="text-[7px] md:text-[8px] gold font-bold uppercase block">${roleMap[m.role]}</span>
                <div class="flex gap-3 md:gap-4 mt-1 md:mt-1.5">
                    <div><p class="stat-label">Donated</p><p class="stat-value text-green-500 text-[8px] md:text-[9px]">${m.donations}</p></div>
                    <div><p class="stat-label">Received</p><p class="stat-value text-red-400 text-[8px] md:text-[9px]">${m.donationsReceived}</p></div>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center min-w-[50px] md:min-w-[60px]">
                ${leagueIcon ? `<img src="${leagueIcon}" class="w-5 h-5 md:w-6 md:h-6 object-contain mb-1" title="${m.leagueTier?.name || m.league?.name || 'Unranked'}">` : ''}
                <p class="text-[11px] md:text-xs font-bold text-[#d4af37]">${m.trophies.toLocaleString()}</p>
                <p class="text-[7px] md:text-[8px] text-gray-600 uppercase font-bold tracking-tighter">Trophies</p>
            </div>
        </div>`;
    }).join('');
}

/**
 * Returns a simple string label for TH differentials (Hard, Normal, Easy).
 */
function getDifficultyLabel(targetTH, actorTH) {
    if (targetTH === "?" || actorTH === "?") return "Unknown";
    const diff = targetTH - actorTH;
    if (diff > 0) return "Hard";
    if (diff === 0) return "Normal";
    return "Easy";
}

/**
 * Renders a compact attack summary card within the member cards.
 */
export function renderAtkSmall(atk, infoMap, isDefense = false, memberTH = "?", attackNum = 1) {
    const label = `Attack #${attackNum}`;
    
    // Greyed out state for attacks not yet used
    if (!atk) return `
        <div class="flex flex-col gap-1">
            <p class="text-[7px] font-black text-gray-600 uppercase tracking-widest pl-1">${label}</p>
            <div class="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg border border-dashed border-gray-800 opacity-40 h-[58px]">
                <div class="w-6 h-6 flex items-center justify-center text-[8px] text-gray-600 uppercase font-bold">---</div>
                <div class="flex-1 min-w-0">
                    <p class="text-[9px] text-gray-600 font-bold italic">No Attack</p>
                </div>
            </div>
        </div>`;
    
    const lookupTag = isDefense ? atk.attackerTag : atk.defenderTag;
    const info = infoMap[lookupTag] || { name: "Unknown", th: "?", pos: "?" };
    
    const diffLabel = isDefense ? getDifficultyLabel(memberTH, info.th) : getDifficultyLabel(info.th, memberTH);
    const diffColor = "text-gray-400"; 

    const stars = '★'.repeat(atk.stars).padEnd(3, '☆');
    const pct = atk.destructionPercentage;
    
    // Success-based color coding for results
    let colorClass = "text-green-500";
    let bgColorClass = "bg-green-500";
    if (atk.stars === 2) {
        colorClass = "text-yellow-500";
        bgColorClass = "bg-yellow-500";
    } else if (atk.stars === 1) {
        colorClass = "text-red-500";
        bgColorClass = "bg-red-500";
    } else if (atk.stars === 0) {
        colorClass = "text-gray-500";
        bgColorClass = "bg-gray-500";
    }

    return `
        <div class="flex flex-col gap-1">
            <p class="text-[7px] font-black text-gray-600 uppercase tracking-widest pl-1">${label}</p>
            <div class="p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 h-[58px] relative">
                <span class="absolute top-1 right-2 text-[7px] font-black uppercase ${diffColor}">${diffLabel}</span>
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-[9px] font-mono text-gray-600">#${info.pos}</span>
                    <img src="${getTHImage(info.th)}" class="w-6 h-6 object-contain">
                    <div class="flex-1 min-w-0">
                        <p class="text-[9px] text-white font-bold truncate">${info.name} (TH${info.th})</p>
                    </div>
                    <span class="text-[10px] gold leading-none font-mono">${stars}</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-900 h-1 rounded-full overflow-hidden">
                        <div class="${bgColorClass} h-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                    <span class="text-[9px] font-black ${colorClass} min-w-[30px] text-right">${pct}%</span>
                </div>
            </div>
        </div>`;
}

/**
 * Calculates a relative countdown string for War Day or Prep Day.
 */
function getCountdown(endTimeStr) {
    const end = parseCoCDate(endTimeStr);
    if (!end) return "00:00:00";
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Global state for war detail filters (Active/History)
let countdownInterval = null;
let currentWarFilters = {
    attacks: 'all',
    difficulty: 'all',
    performance: 'all',
    sortBy: 'mapPosition',
    selectedClan: 'clan',
    strategy: 'Mirror'
};

/**
 * Renders the main scrollable list of past and current wars.
 */
export function renderWarHistory(warHistory) {
    const container = document.getElementById('warHistoryList');
    if (!container) return;
    if (warHistory.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-600 italic py-10 font-light text-sm">No wars found for this range.</p>`;
        return;
    }
    const now = new Date();
    // Sort logic: Active wars pinned to top, then reverse chronological
    const sorted = [...warHistory].sort((a, b) => {
        const aEnd = parseCoCDate(a.endTime);
        const bEnd = parseCoCDate(b.endTime);
        const aActive = now < aEnd ? 1 : 0;
        const bActive = now < bEnd ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return b.startTime.localeCompare(a.startTime);
    });
    
    // Clear old timer if exists
    if (countdownInterval) clearInterval(countdownInterval);
    
    container.innerHTML = sorted.map(war => {
        const totalPossibleAttacks = war.teamSize * war.attacksPerMember;
        const clanAttacks = war.clan.attacks || 0;
        const opponentAttacks = war.opponent.attacks || 0;
        const d = war.startTime;
        const formattedDate = `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`;
        const start = parseCoCDate(war.startTime);
        const end = parseCoCDate(war.endTime);
        let statusLabel = "";
        let countdownTarget = null;
        let isPinned = now < end;
        
        if (now < start) { statusLabel = "Preparation Day"; countdownTarget = war.startTime; }
        else if (now < end) { statusLabel = "War Day"; countdownTarget = war.endTime; }
        
        const pinnedClass = isPinned ? 'border-gold bg-[#2a2618]' : 'border-gray-700 bg-[#252525]';
        const clanStars = war.clan.stars || 0;
        const opponentStars = war.opponent.stars || 0;
        const clanDest = war.clan.destructionPercentage || 0;
        const opponentDest = war.opponent.destructionPercentage || 0;
        
        let resultLabel = statusLabel;
        let scoreColor = "gold";
        if (!isPinned) {
            if (clanStars > opponentStars) { resultLabel = "Victory"; scoreColor = "text-green-500"; }
            else if (clanStars < opponentStars) { resultLabel = "Loss"; scoreColor = "text-red-500"; }
            else {
                if (clanDest > opponentDest) { resultLabel = "Victory"; scoreColor = "text-green-500"; }
                else if (clanDest < opponentDest) { resultLabel = "Loss"; scoreColor = "text-red-500"; }
                else { resultLabel = "Draw"; scoreColor = "text-gray-400"; }
            }
        }
        return `
        <div class="p-4 rounded-xl border ${pinnedClass} hover:border-gold cursor-pointer transition-colors relative overflow-hidden" onclick="window.loadWarDetail('${war.filename}')">
            <div class="flex justify-between items-center mb-2">
                <div class="flex flex-col">
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">${formattedDate}</span>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-2 md:gap-3 w-1/3 text-left">
                    <img src="${war.clan.badgeUrls.small}" class="w-8 h-8 md:w-10 md:h-10">
                    <div class="min-w-0">
                        <p class="text-[11px] md:text-xs font-bold text-white truncate">${war.clan.name}</p>
                        <p class="text-[8px] md:text-[9px] text-gray-500">${clanAttacks}/${totalPossibleAttacks} Attacks</p>
                    </div>
                </div>
                <div class="flex flex-col items-center justify-center w-1/3 text-center px-1">
                    ${countdownTarget ? `<p id="cd-${war.filename}" class="mb-1 font-mono gold text-[10px] md:text-[11px]">${getCountdown(countdownTarget)}</p>` : ''}
                    <p class="text-[10px] md:text-[13px] font-black ${isPinned ? 'gold' : scoreColor} uppercase tracking-widest mb-1 leading-tight">${resultLabel}</p>
                    <p class="medieval ${isPinned ? 'gold' : scoreColor} text-lg md:text-2xl">${war.clan.stars} - ${war.opponent.stars}</p>
                    <p class="text-[8px] md:text-[9px] text-gray-500 mt-1">${war.clan.destructionPercentage.toFixed(1)}% vs ${war.opponent.destructionPercentage.toFixed(1)}%</p>
                </div>
                <div class="flex items-center gap-2 md:gap-3 text-right justify-end w-1/3">
                    <div class="min-w-0">
                        <p class="text-[11px] md:text-xs font-bold text-white truncate">${war.opponent.name}</p>
                        <p class="text-[8px] md:text-[9px] text-gray-500">${opponentAttacks}/${totalPossibleAttacks} Attacks</p>
                    </div>
                    <img src="${war.opponent.badgeUrls.small}" class="w-8 h-8 md:w-10 md:h-10">
                </div>
            </div>
        </div>`;
    }).join('');
    
    // Start live countdown timer
    countdownInterval = setInterval(() => {
        document.querySelectorAll('[id^="cd-"]').forEach(el => {
            const warFile = el.id.replace('cd-', '');
            const warObj = warHistory.find(w => w.filename === warFile);
            if (warObj) {
                const startT = parseCoCDate(warObj.startTime);
                const target = now < startT ? warObj.startTime : warObj.endTime;
                el.innerText = getCountdown(target);
            }
        });
    }, 1000);
}

/**
 * Generates a card for a clan member in the war detail view.
 */
function renderMemberCard(m, infoMap, totalAttacks) {
    const totalStars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);
    return `
        <div class="flex flex-col lg:flex-row lg:items-center gap-3 md:gap-4 p-3 bg-[#252525] rounded-xl border border-gray-800">
            <div class="flex items-center justify-between lg:justify-start gap-3 lg:min-w-[140px] lg:max-w-[140px]">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-mono text-gray-600">#${m.mapPosition}</span>
                    <img src="${getTHImage(m.townhallLevel || m.townHallLevel)}" class="w-8 h-8">
                    <div class="min-w-0">
                        <p class="font-bold text-[11px] text-white truncate">${m.name}</p>
                        <p class="text-[9px] gold font-bold uppercase tracking-tighter">TH${m.townhallLevel || m.townHallLevel}</p>
                    </div>
                </div>
                <div class="lg:hidden text-right">
                    <p class="text-[8px] font-black text-gray-500 uppercase tracking-widest">Stars</p>
                    <p class="text-lg font-bold gold leading-none">${totalStars}</p>
                </div>
            </div>
            <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                ${renderAtkSmall(m.attacks ? m.attacks[0] : null, infoMap, false, m.townhallLevel || m.townHallLevel, 1)}
                ${renderAtkSmall(m.attacks && m.attacks[1] ? m.attacks[1] : null, infoMap, false, m.townhallLevel || m.townHallLevel, 2)}
            </div>
            <div class="hidden lg:block text-right min-w-[50px]">
                <p class="text-[8px] font-black text-gray-500 uppercase tracking-widest">Stars</p>
                <p class="text-lg font-bold gold leading-none">${totalStars}</p>
            </div>
        </div>`;
}

/**
 * MATH: Win Probability Simulation
 * Uses MTD history to project the most likely final score.
 */
function calculateWinProbability(warData, history) {
    const buckets = {
        'UP2': { sum: 0, count: 0, def: 0.8 }, 
        'UP1': { sum: 0, count: 0, def: 1.5 },
        'SAME': { sum: 0, count: 0, def: 2.2 },
        'DROP': { sum: 0, count: 0, def: 2.8 }
    };

    // 1. Gather historical data
    history.forEach(w => {
        const oppMap = {};
        w.opponent.members.forEach(om => oppMap[om.tag] = om.townhallLevel || om.townHallLevel);
        w.clan.members.forEach(m => {
            const attackerTH = m.townhallLevel || m.townHallLevel;
            (m.attacks || []).forEach(a => {
                const targetTH = oppMap[a.defenderTag];
                if (!targetTH) return;
                const diff = targetTH - attackerTH;
                let cat = 'SAME';
                if (diff >= 2) cat = 'UP2';
                else if (diff === 1) cat = 'UP1';
                else if (diff <= -1) cat = 'DROP';
                buckets[cat].sum += a.stars;
                buckets[cat].count++;
            });
        });
    });

    const getExpected = (diff) => {
        let cat = 'SAME';
        if (diff >= 2) cat = 'UP2';
        else if (diff === 1) cat = 'UP1';
        else if (diff <= -1) cat = 'DROP';
        return buckets[cat].count > 0 ? buckets[cat].sum / buckets[cat].count : buckets[cat].def;
    };

    // 2. Project Clan Final Score
    const oppMembers = [...warData.opponent.members].sort((a,b) => a.mapPosition - b.mapPosition);
    let clanProjectedStars = warData.clan.stars || 0;
    const offsetMap = { 'Up One': -1, 'Mirror': 0, 'Drop One': 1, 'Drop Two': 2, 'Drop Three': 3 };
    const offset = offsetMap[currentWarFilters.strategy] || 0;

    warData.clan.members.forEach(m => {
        const attacksUsed = m.attacks ? m.attacks.length : 0;
        const attacksLeft = 2 - attacksUsed;
        if (attacksLeft <= 0) return;

        for (let i = 0; i < attacksLeft; i++) {
            let targetIdx = (m.mapPosition - 1) + offset;
            if (targetIdx < 0) targetIdx = 0;
            if (targetIdx >= oppMembers.length) targetIdx = oppMembers.length - 1;
            const target = oppMembers[targetIdx];
            const diff = (target.townhallLevel || target.townHallLevel) - (m.townhallLevel || m.townHallLevel);
            clanProjectedStars += getExpected(diff);
        }
    });

    // 3. Project Enemy Final Score (based on their current efficiency)
    const oppAttacksUsed = warData.opponent.attacks || 0;
    const oppPossible = warData.teamSize * 2;
    const oppRemaining = oppPossible - oppAttacksUsed;
    const oppCurrentStars = warData.opponent.stars || 0;
    const oppEfficiency = oppAttacksUsed > 0 ? oppCurrentStars / oppAttacksUsed : 2.0;
    const oppProjectedStars = oppCurrentStars + (oppRemaining * oppEfficiency);

    const prob = (clanProjectedStars / (clanProjectedStars + oppProjectedStars)) * 100;
    return Math.min(99, Math.max(1, Math.round(prob)));
}

/**
 * Renders the War Detail View (Summary, Metrics, and Roster/Map).
 */
export function renderWarDetail(warData, history = []) {
    const container = document.getElementById('warResults');
    const metricsContainer = document.getElementById('warMetrics');
    if (!container || !metricsContainer) return;

    const totalPossibleAttacks = warData.teamSize * warData.attacksPerMember;

    // --- METRIC LOGIC ---
    const winProb = calculateWinProbability(warData, history);
    
    // Technical Power Ratio: Available Clan TH Levels / Opponent TH Levels still needing 3-stars
    const clanTHSum = warData.clan.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0);
    const oppTHSum = warData.opponent.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0);
    const initialTHRatio = (clanTHSum / oppTHSum).toFixed(2);

    const clanAvailableTHPower = warData.clan.members.reduce((sum, m) => {
        const attacksLeft = 2 - (m.attacks ? m.attacks.length : 0);
        return sum + ((m.townhallLevel || m.townHallLevel || 0) * attacksLeft);
    }, 0);
    const oppBasesNeedsClearingSum = warData.opponent.members
        .filter(m => (m.bestOpponentAttack?.stars || 0) < 3)
        .reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0);
    const currentTHRatio = oppBasesNeedsClearingSum > 0 ? (clanAvailableTHPower / oppBasesNeedsClearingSum).toFixed(2) : "∞";

    // Map completion: % of enemy bases cleared
    const threeStarredBases = warData.opponent.members.filter(m => (m.bestOpponentAttack?.stars || 0) === 3).length;
    const mapCompletionPct = Math.round((threeStarredBases / warData.teamSize) * 100);

    // Gapped bases: count of bases hit but not 3-starred
    const cleanupNeeded = warData.opponent.members.filter(m => {
        const stars = m.bestOpponentAttack?.stars || 0;
        return stars > 0 && stars < 3;
    }).length;

    // Global toggle function for tooltips
    window.toggleStatInfo = (type, event) => {
        event.stopPropagation();
        const allTooltips = document.querySelectorAll('.info-tooltip');
        const target = document.getElementById(`tooltip-${type}`);
        const isActive = target.classList.contains('active');
        allTooltips.forEach(t => t.classList.remove('active'));
        if (!isActive) target.classList.add('active');
    };

    // --- RENDER TOP TACTICAL BOXES ---
    metricsContainer.innerHTML = `
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-between relative group">
            <button onclick="window.toggleStatInfo('prob', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-prob" class="info-tooltip">Win Probability: Uses monthly averages to simulate remaining attacks for both clans to project the final score and win chance.</div>
            <div class="flex justify-between items-start mb-1 pr-4">
                <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest">Win Probability</span>
                <select id="probStrategy" class="bg-transparent border-none text-[8px] gold font-bold uppercase outline-none cursor-pointer p-0 m-0">
                    <option value="Up One" ${currentWarFilters.strategy === 'Up One' ? 'selected' : ''}>Up One</option>
                    <option value="Mirror" ${currentWarFilters.strategy === 'Mirror' ? 'selected' : ''}>Mirror</option>
                    <option value="Drop One" ${currentWarFilters.strategy === 'Drop One' ? 'selected' : ''}>Drop 1</option>
                    <option value="Drop Two" ${currentWarFilters.strategy === 'Drop Two' ? 'selected' : ''}>Drop 2</option>
                    <option value="Drop Three" ${currentWarFilters.strategy === 'Drop Three' ? 'selected' : ''}>Drop 3</option>
                </select>
            </div>
            <p class="text-xl font-bold gold leading-none">${winProb}%</p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative group">
            <button onclick="window.toggleStatInfo('ratio', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-ratio" class="info-tooltip">TH Power Ratio: Compares your clan's total available Town Hall levels for remaining attacks against the Town Hall levels of enemy bases not yet 3-starred.</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">TH Power Ratio</span>
            <p class="text-xl font-bold text-white leading-none">${currentTHRatio} <span class="text-[9px] text-gray-600 font-normal">Start: ${initialTHRatio}</span></p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative group">
            <button onclick="window.toggleStatInfo('comp', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-comp" class="info-tooltip">3-Star Wins: The percentage of enemy bases that have been successfully 3-starred.</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">3-Star Wins</span>
            <p class="text-xl font-bold text-green-500 leading-none">${mapCompletionPct}% <span class="text-[9px] text-gray-600 font-normal">${threeStarredBases}/${warData.teamSize}</span></p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative group">
            <button onclick="window.toggleStatInfo('clean', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-clean" class="info-tooltip">Clean-up Needed: The count of enemy bases that have been attacked but only partially cleared (1 or 2 stars).</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Clean-up Needed</span>
            <p class="text-xl font-bold ${cleanupNeeded > 0 ? 'text-yellow-500' : 'text-gray-600'} leading-none">${cleanupNeeded}</p>
        </div>
    `;

    document.getElementById('probStrategy').onchange = (e) => {
        currentWarFilters.strategy = e.target.value;
        renderWarDetail(warData, history);
    };

    // --- RENDER FILTERS & TOGGLES ---
    let filterBar = document.getElementById('warDetailFilters');
    if (!filterBar) {
        const detailView = document.getElementById('warDetailView');
        filterBar = document.createElement('div');
        filterBar.id = 'warDetailFilters';
        filterBar.className = 'flex flex-wrap items-center gap-4 mb-6 p-4 bg-[#1a1a1a] rounded-xl border border-gray-800';
        detailView.insertBefore(filterBar, metricsContainer.nextSibling);
    }
    filterBar.innerHTML = `
        <div class="flex items-center gap-2 w-full lg:w-auto pb-4 lg:pb-0 lg:pr-4 border-b lg:border-b-0 lg:border-r border-gray-800 mr-0 lg:mr-2">
            <button id="toggleClan" class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border ${currentWarFilters.selectedClan === 'clan' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all min-w-[90px]">
                <img src="${warData.clan.badgeUrls.small}" class="w-3.5 h-3.5">
                <span class="text-[9px] font-bold uppercase truncate">${warData.clan.name}</span>
            </button>
            <button id="toggleMap" class="flex-1 lg:flex-none flex items-center justify-center px-3 py-1.5 rounded-lg border ${currentWarFilters.selectedClan === 'map' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all min-w-[55px]">
                <span class="text-[9px] font-bold uppercase">Map</span>
            </button>
            <button id="toggleOpponent" class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border ${currentWarFilters.selectedClan === 'opponent' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all min-w-[90px]">
                <img src="${warData.opponent.badgeUrls.small}" class="w-3.5 h-3.5">
                <span class="text-[9px] font-bold uppercase truncate">${warData.opponent.name}</span>
            </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:flex lg:items-center gap-4 w-full lg:w-auto">
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Attacks:</span>
                <select id="filterAttacks" class="control-base flex-1 h-8">
                    <option value="all" ${currentWarFilters.attacks === 'all' ? 'selected' : ''}>All Members</option>
                    <option value="atk1used" ${currentWarFilters.attacks === 'atk1used' ? 'selected' : ''}>Attack #1 Used</option>
                    <option value="atk2used" ${currentWarFilters.attacks === 'atk2used' ? 'selected' : ''}>Attack #2 Used</option>
                    <option value="atk1unused" ${currentWarFilters.attacks === 'atk1unused' ? 'selected' : ''}>Attack #1 Unused</option>
                    <option value="atk2unused" ${currentWarFilters.attacks === 'atk2unused' ? 'selected' : ''}>Attack #2 Unused</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Difficulty:</span>
                <select id="filterDifficulty" class="control-base flex-1 h-8">
                    <option value="all" ${currentWarFilters.difficulty === 'all' ? 'selected' : ''}>All</option>
                    <option value="Hard" ${currentWarFilters.difficulty === 'Hard' ? 'selected' : ''}>Hard Only</option>
                    <option value="Normal" ${currentWarFilters.difficulty === 'Normal' ? 'selected' : ''}>Normal Only</option>
                    <option value="Easy" ${currentWarFilters.difficulty === 'Easy' ? 'selected' : ''}>Easy Only</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase">Results:</span>
                <select id="filterPerformance" class="control-base flex-1 h-8">
                    <option value="all" ${currentWarFilters.performance === 'all' ? 'selected' : ''}>All Stars</option>
                    <option value="0-2" ${currentWarFilters.performance === '0-2' ? 'selected' : ''}>0-2 Stars</option>
                    <option value="3-5" ${currentWarFilters.performance === '3-5' ? 'selected' : ''}>3-5 Stars</option>
                    <option value="6" ${currentWarFilters.performance === '6' ? 'selected' : ''}>Perfect (6)</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Sort:</span>
                <select id="filterSort" class="control-base flex-1 h-8">
                    <option value="mapPosition" ${currentWarFilters.sortBy === 'mapPosition' ? 'selected' : ''}>Map Position</option>
                    <option value="stars" ${currentWarFilters.sortBy === 'stars' ? 'selected' : ''}>Total Stars</option>
                </select>
            </div>
            <button id="clearDetailFilters" class="text-[10px] font-bold text-gray-500 hover:text-gold uppercase transition-colors col-span-2 lg:ml-auto">Clear</button>
        </div>`;

    document.getElementById('toggleClan').onclick = () => { currentWarFilters.selectedClan = 'clan'; renderWarDetail(warData, history); };
    document.getElementById('toggleMap').onclick = () => { currentWarFilters.selectedClan = 'map'; renderWarDetail(warData, history); };
    document.getElementById('toggleOpponent').onclick = () => { currentWarFilters.selectedClan = 'opponent'; renderWarDetail(warData, history); };
    document.getElementById('filterAttacks').onchange = (e) => { currentWarFilters.attacks = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterDifficulty').onchange = (e) => { currentWarFilters.difficulty = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterPerformance').onchange = (e) => { currentWarFilters.performance = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterSort').onchange = (e) => { currentWarFilters.sortBy = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('clearDetailFilters').onclick = () => {
        currentWarFilters = { attacks: 'all', difficulty: 'all', performance: 'all', sortBy: 'mapPosition', selectedClan: 'clan', strategy: 'Mirror' };
        renderWarDetail(warData, history);
    };

    // --- UPDATE HEADER SUMMARY ---
    const clanStars = warData.clan.stars || 0;
    const opponentStars = warData.opponent.stars || 0;
    const clanDest = warData.clan.destructionPercentage || 0;
    const opponentDest = warData.opponent.destructionPercentage || 0;
    const start = parseCoCDate(warData.startTime);
    const end = parseCoCDate(warData.endTime);
    const now = new Date();
    let isPinned = now < end;
    let resultLabel = "";
    let scoreColor = "gold";
    if (now < start) { resultLabel = "Preparation Day"; }
    else if (now < end) { resultLabel = "War Day"; }
    else {
        if (clanStars > opponentStars) { resultLabel = "Victory"; scoreColor = "text-green-500"; }
        else if (clanStars < opponentStars) { resultLabel = "Loss"; scoreColor = "text-red-500"; }
        else {
            if (clanDest > opponentDest) { resultLabel = "Victory"; scoreColor = "text-green-500"; }
            else if (clanDest < opponentDest) { resultLabel = "Loss"; scoreColor = "text-red-500"; }
            else { resultLabel = "Draw"; scoreColor = "text-gray-400"; }
        }
    }

    const cn = document.getElementById('clanNameDetail'); if (cn) cn.innerText = warData.clan.name;
    const on = document.getElementById('opponentNameDetail'); if (on) on.innerText = warData.opponent.name;
    const cb = document.getElementById('detailClanBadge'); if (cb) cb.src = warData.clan.badgeUrls.small;
    const ob = document.getElementById('detailOpponentBadge'); if (ob) ob.src = warData.opponent.badgeUrls.small;
    
    // Total attack count update (e.g. 25/50)
    const ca = document.getElementById('clanAttacks'); if (ca) ca.innerText = `${warData.clan.attacks || 0}/${totalPossibleAttacks} Attacks`;
    const oa = document.getElementById('opponentAttacks'); if (oa) oa.innerText = `${warData.opponent.attacks || 0}/${totalPossibleAttacks} Attacks`;

    const summaryHeader = document.getElementById('warResultHeader');
    if (summaryHeader) {
        summaryHeader.innerHTML = `
            <span class="text-[10px] md:text-xs font-black ${isPinned ? 'gold' : scoreColor} uppercase tracking-widest mb-1 leading-none">${resultLabel}</span>
            <p class="medieval ${isPinned ? 'gold' : scoreColor} text-lg md:text-2xl">${clanStars} - ${opponentStars}</p>
            <p class="text-[8px] md:text-[9px] text-gray-500 mt-1">${clanDest.toFixed(1)}% vs ${opponentDest.toFixed(1)}%</p>`;
    }

    // --- RENDER VIEW-SPECIFIC CONTENT ---
    const clanMap = {};
    warData.clan.members.forEach(m => clanMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });
    const opponentMap = {};
    warData.opponent.members.forEach(m => opponentMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });

    // Special View: Map (Side-by-side technical comparison)
    if (currentWarFilters.selectedClan === 'map') {
        const sortedClan = [...warData.clan.members].sort((a,b) => a.mapPosition - b.mapPosition);
        const sortedOpp = [...warData.opponent.members].sort((a,b) => a.mapPosition - b.mapPosition);
        container.className = "space-y-2";
        container.innerHTML = `
            <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1 mb-2">War Map Matchup</p>
            ${sortedClan.map((m, idx) => {
                const opp = sortedOpp[idx] || { name: 'Empty', townhallLevel: 0, mapPosition: idx+1 };
                return `
                <div class="flex items-center gap-2 p-2 bg-[#252525] rounded-lg border border-gray-800">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <span class="text-[9px] font-mono text-gray-600">#${m.mapPosition}</span>
                        <img src="${getTHImage(m.townhallLevel || m.townHallLevel)}" class="w-6 h-6 object-contain">
                        <span class="text-[10px] font-bold text-white truncate">${m.name}</span>
                    </div>
                    <div class="text-[9px] font-black text-gray-700 mx-1 italic">VS</div>
                    <div class="flex items-center justify-end gap-2 flex-1 min-w-0 text-right">
                        <span class="text-[10px] font-bold text-gray-300 truncate">${opp.name}</span>
                        <img src="${getTHImage(opp.townhallLevel || opp.townHallLevel)}" class="w-6 h-6 object-contain">
                        <span class="text-[9px] font-mono text-gray-600">#${opp.mapPosition}</span>
                    </div>
                </div>`;
            }).join('')}`;
        return;
    }

    const filterFunc = (m, sideMap) => {
        const attackCount = m.attacks ? m.attacks.length : 0;
        const totalStars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);
        if (currentWarFilters.attacks === 'atk1used' && attackCount < 1) return false;
        if (currentWarFilters.attacks === 'atk2used' && attackCount < 2) return false;
        if (currentWarFilters.attacks === 'atk1unused' && attackCount > 0) return false;
        if (currentWarFilters.attacks === 'atk2unused' && attackCount !== 1) return false;
        if (currentWarFilters.performance === '0-2' && totalStars > 2) return false;
        if (currentWarFilters.performance === '3-5' && (totalStars < 3 || totalStars > 5)) return false;
        if (currentWarFilters.performance === '6' && totalStars < 6) return false;
        if (currentWarFilters.difficulty !== 'all') {
            const labels = (m.attacks || []).map(a => getDifficultyLabel(sideMap[a.defenderTag]?.th || "?", m.townhallLevel || m.townHallLevel));
            if (!labels.includes(currentWarFilters.difficulty)) return false;
        }
        return true;
    };

    const membersToRender = currentWarFilters.selectedClan === 'clan' ? warData.clan.members : warData.opponent.members;
    const oppositeMap = currentWarFilters.selectedClan === 'clan' ? opponentMap : clanMap;
    const filteredMembers = membersToRender.filter(m => filterFunc(m, oppositeMap)).sort((a,b) => {
        if (currentWarFilters.sortBy === 'stars') {
            const aStars = (a.attacks || []).reduce((sum, atk) => sum + atk.stars, 0);
            const bStars = (b.attacks || []).reduce((sum, atk) => sum + atk.stars, 0);
            return bStars - aStars || a.mapPosition - b.mapPosition;
        }
        return a.mapPosition - b.mapPosition;
    });

    container.className = "space-y-3";
    container.innerHTML = `
        <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">
            ${currentWarFilters.selectedClan === 'clan' ? 'Clan Attacks' : 'Opponent Attacks'}
        </p>
        ${filteredMembers.map(m => renderMemberCard(m, oppositeMap, warData.attacksPerMember)).join('')}`;
}

/**
 * Renders the About tab content with clan identity and join requirements.
 */
export function renderAbout(clanData) {
    const container = document.getElementById('aboutContent');
    if (!container || !clanData) return;
    const labelsHtml = (clanData.labels || []).map(l => `
        <div class="flex items-center gap-1.5 bg-[#252525] px-2 py-1 rounded border border-gray-800">
            <img src="${l.iconUrls.small}" class="w-3.5 h-3.5">
            <span class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase">${l.name}</span>
        </div>`).join('');
    container.innerHTML = `
        <div class="panel p-4 md:p-6 space-y-6 md:space-y-8">
            <div class="bg-[#1a1a1a] p-4 md:p-6 rounded-xl border border-gray-800">
                <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                    <div class="flex-1 space-y-4 w-full">
                        <div class="flex items-center gap-4">
                            <img src="${clanData.badgeUrls.medium}" class="w-16 h-16 md:w-20 md:h-20">
                            <div>
                                <h2 class="medieval text-xl md:text-2xl font-bold gold">${clanData.name}</h2>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[10px] md:text-xs font-mono text-gray-500">${clanData.tag}</span>
                                </div>
                            </div>
                        </div>
                        <p class="text-[11px] md:text-sm text-gray-300 leading-relaxed italic">${clanData.description}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 w-full md:w-auto md:min-w-[350px]">
                        <div><p class="stat-label">Location</p><p class="stat-value text-[11px] md:text-xs">${clanData.location?.name || 'Unknown'}</p></div>
                        <div><p class="stat-label">Language</p><p class="stat-value text-[11px] md:text-xs">${clanData.chatLanguage?.name || 'English'}</p></div>
                        <div><p class="stat-label">Clan Level</p><p class="stat-value text-gold text-[11px] md:text-xs">${clanData.clanLevel}</p></div>
                        <div><p class="stat-label">Family Friendly</p><p class="stat-value text-[11px] md:text-xs">${clanData.isFamilyFriendly ? 'Yes' : 'No'}</p></div>
                        <div class="col-span-2"><p class="stat-label mb-2">Clan Labels</p><div class="flex flex-wrap gap-2">${labelsHtml}</div></div>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]">
                    <div class="flex-1 flex flex-col">
                        <h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            War Performance
                        </h3>
                        <div class="space-y-3 md:space-y-4 flex-1">
                            <div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">War League</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.warLeague?.name || 'Unranked'}</p></div>
                            <div class="grid grid-cols-3 gap-2">
                                <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Wins</p><p class="text-green-500 font-bold text-[11px] md:text-xs">${clanData.warWins}</p></div>
                                <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Losses</p><p class="text-red-500 font-bold text-[11px] md:text-xs">${clanData.warLosses}</p></div>
                                <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Ties</p><p class="text-gray-500 font-bold text-[11px] md:text-xs">${clanData.warTies}</p></div>
                            </div>
                            <button id="viewWarHistoryBtn" class="w-full py-2 bg-[#252525] border border-gray-700 rounded h-[58px] text-[9px] md:text-[10px] font-bold uppercase hover:border-gold transition-colors">View War History <span class="ml-1 opacity-70">›</span></button>
                        </div>
                    </div>
                </div>
                <div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]">
                    <div>
                        <h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m0 10V4m-2 4h1m1 4h1m-3 10a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3z" /></svg>
                            Clan Capital
                        </h3>
                        <div class="space-y-3 md:space-y-4">
                            <div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Capital League</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.capitalLeague?.name || 'Unranked'}</p></div>
                            <div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Capital Hall Level</p><p class="stat-value text-white text-[11px] md:text-xs">Level ${clanData.clanCapital?.capitalHallLevel || 'Unknown'}</p></div>
                            <div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Districts Unlocked</p><p class="stat-value text-white text-[11px] md:text-xs">${(clanData.clanCapital?.districts || []).length} Districts</p></div>
                        </div>
                    </div>
                </div>
                <div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]">
                    <div>
                        <h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Join Requirements
                        </h3>
                        <div class="space-y-3 md:space-y-4">
                            <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Required Trophies</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.requiredTrophies.toLocaleString()}</p></div>
                            <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Min. Town Hall</p><p class="stat-value text-white text-[11px] md:text-xs">TH${clanData.requiredTownhallLevel}</p></div>
                            <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Builder Trophies</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.requiredBuilderBaseTrophies.toLocaleString()}</p></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}
