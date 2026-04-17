/**
 * Rendering Module
 * Responsible for generating all dynamic HTML content for the dashboard.
 */
import { roleMap, getTHImage, parseCoCDate } from './constants.js';

/**
 * Renders the member roster list with league icons and donation stats.
 */
export function renderMembers(list) {
    const container = document.getElementById('memberList');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-600 py-10 italic">No members found.</p>`;
        return;
    }
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
 * Returns a simple string label for TH differentials.
 */
function getDifficultyLabel(targetTH, actorTH) {
    if (targetTH === "?" || actorTH === "?") return "Unknown";
    const diff = targetTH - actorTH;
    if (diff > 0) return "Hard";
    if (diff === 0) return "Normal";
    return "Easy";
}

/**
 * Renders a compact attack summary card.
 */
export function renderAtkSmall(atk, infoMap, isDefense = false, memberTH = "?", labelOverride = null) {
    const label = labelOverride || `Attack #${atk?.order || '?'}`;
    if (!atk) return `
        <div class="flex flex-col gap-1 h-full">
            <p class="text-[7px] font-black text-gray-600 uppercase tracking-widest pl-1">${labelOverride || 'No Attack'}</p>
            <div class="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg border border-dashed border-gray-800 opacity-40 h-[58px]">
                <div class="w-6 h-6 flex items-center justify-center text-[8px] text-gray-600 uppercase font-bold">---</div>
                <div class="flex-1 min-w-0">
                    <p class="text-[9px] text-gray-600 font-bold italic">No Data</p>
                </div>
            </div>
        </div>`;
    
    const lookupTag = isDefense ? atk.attackerTag : atk.defenderTag;
    const info = infoMap[lookupTag] || { name: "Unknown", th: "?", pos: "?" };
    const diffLabel = isDefense ? getDifficultyLabel(memberTH, info.th) : getDifficultyLabel(info.th, memberTH);
    const diffColor = "text-gray-400"; 
    const stars = '★'.repeat(atk.stars).padEnd(3, '☆');
    const pct = atk.destructionPercentage;
    
    let colorClass = "text-green-500";
    let bgColorClass = "bg-green-500";
    if (atk.stars === 2) { colorClass = "text-yellow-500"; bgColorClass = "bg-yellow-500"; }
    else if (atk.stars === 1) { colorClass = "text-red-500"; bgColorClass = "bg-red-500"; }
    else if (atk.stars === 0) { colorClass = "text-gray-500"; bgColorClass = "bg-gray-500"; }

    return `
        <div class="flex flex-col gap-1 h-full">
            <p class="text-[7px] font-black text-gray-600 uppercase tracking-widest pl-1">${label}</p>
            <div class="p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 h-[58px] relative">
                <span class="absolute top-1 right-2 text-[7px] font-black uppercase ${diffColor}">${diffLabel}</span>
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-[9px] font-mono text-gray-500">#${info.pos}</span>
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

// Global state for war detail filters
let countdownInterval = null;
let currentWarFilters = {
    attacks: 'all',
    difficulty: 'all',
    performance: 'all',
    sortBy: 'mapPosition',
    selectedClan: 'clan',
    viewType: 'attacks', 
    strategy: 'Mirror'
};

export function renderWarHistory(warHistory) {
    const container = document.getElementById('warHistoryList');
    if (!container) return;
    if (warHistory.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-600 italic py-10 font-light text-sm">No wars found for this range.</p>`;
        return;
    }
    const now = new Date();
    const sorted = [...warHistory].sort((a, b) => {
        const aEnd = parseCoCDate(a.endTime);
        const bEnd = parseCoCDate(b.endTime);
        const aActive = now < aEnd ? 1 : 0;
        const bActive = now < bEnd ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return b.startTime.localeCompare(a.startTime);
    });
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
 * Generates a member card showing either Attacks or Defenses.
 */
function renderMemberCard(m, infoMap, totalAttacks, warAttacksMap = {}) {
    const isDefMode = currentWarFilters.viewType === 'defenses';
    const defensesAgainst = warAttacksMap[m.tag] || [];
    const defensesWon = defensesAgainst.filter(a => a.stars === 0).length;
    const bestDef = m.bestOpponentAttack; 
    const totalStars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);

    return `
        <div class="flex flex-col lg:flex-row lg:items-center gap-3 md:gap-4 p-3 bg-[#252525] rounded-xl border border-gray-800">
            <div class="flex items-center justify-between lg:justify-start gap-3 lg:min-w-[130px] lg:max-w-[130px]">
                <div class="flex items-center gap-3">
                    <span class="text-xs font-mono text-gray-600">#${m.mapPosition}</span>
                    <img src="${getTHImage(m.townhallLevel || m.townHallLevel)}" class="w-8 h-8">
                    <div class="min-w-0">
                        <p class="font-bold text-[11px] text-white truncate">${m.name}</p>
                        <p class="text-[9px] gold font-bold uppercase tracking-tighter">TH${m.townhallLevel || m.townHallLevel}</p>
                    </div>
                </div>
                <div class="lg:hidden flex flex-col items-center justify-center">
                    <p class="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-tight text-center w-full">${isDefMode ? 'Defenses Won' : 'Total Stars'}</p>
                    <p class="text-lg font-bold gold leading-none mt-1 text-center w-full">${isDefMode ? `${defensesWon}/${defensesAgainst.length}` : totalStars}</p>
                </div>
            </div>
            <div class="flex-1 grid grid-cols-1 ${isDefMode ? '' : 'md:grid-cols-2'} gap-3 h-full">
                ${isDefMode 
                    ? renderAtkSmall(bestDef, infoMap, true, m.townhallLevel || m.townHallLevel, 'Enemy Best Attack')
                    : `
                    ${renderAtkSmall(m.attacks ? m.attacks[0] : null, infoMap, false, m.townhallLevel || m.townHallLevel, 'Attack #1')}
                    ${renderAtkSmall(m.attacks && m.attacks[1] ? m.attacks[1] : null, infoMap, false, m.townhallLevel || m.townHallLevel, 'Attack #2')}
                    `
                }
            </div>
            <div class="hidden lg:flex flex-col items-center justify-center min-w-[110px] border-l border-gray-800/30 pl-4 h-full">
                <p class="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-tight text-center w-full">${isDefMode ? 'Defenses Won' : 'Total Stars'}</p>
                <p class="text-xl font-bold gold leading-none mt-1.5 text-center w-full">${isDefMode ? `${defensesWon}/${defensesAgainst.length}` : totalStars}</p>
            </div>
        </div>`;
}

/**
 * MATH: Win Probability Logic with Resource-Weighted Simulation
 */
function calculateWinProbability(warData, history) {
    const buckets = {
        'UP2': { sum: 0, count: 0, def: 0.8 }, 
        'UP1': { sum: 0, count: 0, def: 1.5 },
        'SAME': { sum: 0, count: 0, def: 2.2 },
        'DROP': { sum: 0, count: 0, def: 2.8 }
    };

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

    const oppMembers = [...warData.opponent.members].sort((a,b) => a.mapPosition - b.mapPosition);
    const clanMembers = [...warData.clan.members].sort((a,b) => a.mapPosition - b.mapPosition);
    const totalPossibleAtks = warData.teamSize * 2;
    const clanStars = warData.clan.stars || 0;
    const oppStars = warData.opponent.stars || 0;
    const clanAtksUsed = warData.clan.attacks || 0;
    const oppAtksUsed = warData.opponent.attacks || 0;

    const now = new Date();
    const isFinished = now > parseCoCDate(warData.endTime);
    
    if (isFinished || (clanAtksUsed === totalPossibleAtks && oppAtksUsed === totalPossibleAtks)) {
        if (clanStars > oppStars) return 100;
        return 0;
    }

    if (clanAtksUsed === totalPossibleAtks && clanStars <= oppStars) return 0;
    if (oppAtksUsed === totalPossibleAtks && clanStars > oppStars) return 100;

    let clanProjected = clanStars;
    let clanHighPower = 0; 
    let oppHighTargets = 0;

    clanMembers.forEach(m => {
        const th = m.townhallLevel || m.townHallLevel;
        const left = 2 - (m.attacks ? m.attacks.length : 0);
        if (th >= 15) clanHighPower += left;
        for (let i = 0; i < left; i++) {
            let targetIdx = (m.mapPosition - 1);
            if (targetIdx < 0) targetIdx = 0;
            if (targetIdx >= oppMembers.length) targetIdx = oppMembers.length - 1;
            clanProjected += getExpected((oppMembers[targetIdx].townhallLevel || oppMembers[targetIdx].townHallLevel) - th);
        }
    });

    oppMembers.forEach(m => {
        if ((m.townhallLevel || m.townHallLevel) >= 15 && (m.bestOpponentAttack?.stars || 0) < 3) oppHighTargets++;
    });

    if (oppHighTargets > clanHighPower) clanProjected -= (oppHighTargets - clanHighPower) * 0.5;

    const oppEfficiency = oppAtksUsed > 0 ? (oppStars / oppAtksUsed) : 2.2;
    const oppProjected = oppStars + ((totalPossibleAtks - oppAtksUsed) * oppEfficiency);

    const prob = Math.round((clanProjected / (clanProjected + oppProjected)) * 100);
    return Math.max(1, Math.min(99, prob));
}

/**
 * Main War Detail View
 */
export function renderWarDetail(warData, history = []) {
    const container = document.getElementById('warResults');
    const metricsContainer = document.getElementById('warMetrics');
    if (!container || !metricsContainer) return;

    if (currentWarFilters.selectedClan === 'map') currentWarFilters.selectedClan = 'clan';

    const clanAtksUsed = warData.clan.attacks || 0;
    const avgStarsAtk = clanAtksUsed > 0 ? (warData.clan.stars / clanAtksUsed).toFixed(2) : "0.00";
    const winProb = calculateWinProbability(warData, history);

    const clanAvailablePower = warData.clan.members.reduce((sum, m) => sum + ((m.townhallLevel || m.townHallLevel || 0) * (2 - (m.attacks ? m.attacks.length : 0))), 0);
    const oppNeedsClearingSum = warData.opponent.members.filter(m => (m.bestOpponentAttack?.stars || 0) < 3).reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0);
    const currentTHRatio = oppNeedsClearingSum > 0 ? (clanAvailablePower / oppNeedsClearingSum).toFixed(2) : "∞";
    const startTHRatio = (warData.clan.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0) * 2 / (warData.opponent.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0) * 1)).toFixed(2);
    const clearedBases = warData.opponent.members.filter(m => (m.bestOpponentAttack?.stars || 0) === 3).length;
    const mapCompletionPct = Math.round((clearedBases / warData.teamSize) * 100);
    const cleanupNeeded = warData.opponent.members.filter(m => { const s = m.bestOpponentAttack?.stars || 0; return s > 0 && s < 3; }).length;

    window.toggleStatInfo = (type, event) => {
        event.stopPropagation();
        const allTooltips = document.querySelectorAll('.info-tooltip');
        const target = document.getElementById(`tooltip-${type}`);
        const isActive = target.classList.contains('active');
        allTooltips.forEach(t => t.classList.remove('active'));
        if (!isActive) target.classList.add('active');
    };

    metricsContainer.innerHTML = `
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-between relative">
            <button onclick="window.toggleStatInfo('avg', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-avg" class="info-tooltip">Avg Stars / Atk: The current efficiency of used attacks for your clan (Stars ÷ Attacks).</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Avg Stars/Atk</span>
            <p class="text-xl font-bold text-white leading-none">${avgStarsAtk}</p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative">
            <button onclick="window.toggleStatInfo('probWin', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-probWin" class="info-tooltip">Chance of Win: A weighted probability factoring in stars earned, Technical Capacity remaining, and resource exhaustion.</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Chance of Win</span>
            <p class="text-xl font-bold gold leading-none">${winProb}%</p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative">
            <button onclick="window.toggleStatInfo('ratio', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-ratio" class="info-tooltip">TH Power Ratio: Available Clan TH power for remaining attacks vs remaining targets to clear.</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">TH Power Ratio</span>
            <p class="text-xl font-bold text-white leading-none">${currentTHRatio} <span class="text-[9px] text-gray-600 font-normal">Start: ${startTHRatio}</span></p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative">
            <button onclick="window.toggleStatInfo('comp', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-comp" class="info-tooltip">Map Completion: The percentage of enemy bases that have been successfully 3-starred.</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Map Completion</span>
            <p class="text-xl font-bold text-green-500 leading-none">${mapCompletionPct}% <span class="text-[9px] text-gray-600 font-normal">${clearedBases}/${warData.teamSize}</span></p>
        </div>
        <div class="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col justify-center relative">
            <button onclick="window.toggleStatInfo('clean', event)" class="absolute top-2 right-2 text-[10px] text-gray-600 hover:text-gold transition-colors">ⓘ</button>
            <div id="tooltip-clean" class="info-tooltip">Clean-up Needed: Count of enemy bases attacked but only partially cleared (1 or 2 stars).</div>
            <span class="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Clean-up Needed</span>
            <p class="text-xl font-bold ${cleanupNeeded > 0 ? 'text-yellow-500' : 'text-gray-600'} leading-none">${cleanupNeeded}</p>
        </div>
    `;

    let filterBar = document.getElementById('warDetailFilters');
    if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'warDetailFilters';
        filterBar.className = 'flex flex-wrap items-center gap-4 mb-6 p-4 bg-[#1a1a1a] rounded-xl border border-gray-800';
        document.getElementById('warDetailView').insertBefore(filterBar, container);
    }
    
    filterBar.innerHTML = `
        <div class="flex items-center gap-2 w-full lg:w-auto pb-4 lg:pb-0 lg:pr-4 border-b lg:border-b-0 lg:border-r border-gray-800 mr-0 lg:mr-2">
            <button id="toggleClan" class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border ${currentWarFilters.selectedClan === 'clan' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all min-w-[120px]">
                <img src="${warData.clan.badgeUrls.small}" class="w-4 h-4"><span class="text-[9px] font-bold uppercase truncate">${warData.clan.name}</span>
            </button>
            <button id="toggleOpponent" class="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border ${currentWarFilters.selectedClan === 'opponent' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all min-w-[120px]">
                <img src="${warData.opponent.badgeUrls.small}" class="w-4 h-4"><span class="text-[9px] font-bold uppercase truncate">${warData.opponent.name}</span>
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
            <button id="clearDetailFilters" class="text-[10px] font-bold text-gray-500 uppercase transition-colors col-span-2 lg:ml-auto">Clear</button>
        </div>`;

    document.getElementById('toggleClan').onclick = () => { currentWarFilters.selectedClan = 'clan'; renderWarDetail(warData, history); };
    document.getElementById('toggleOpponent').onclick = () => { currentWarFilters.selectedClan = 'opponent'; renderWarDetail(warData, history); };
    document.getElementById('filterAttacks').onchange = (e) => { currentWarFilters.attacks = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterPerformance').onchange = (e) => { currentWarFilters.performance = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterSort').onchange = (e) => { currentWarFilters.sortBy = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('clearDetailFilters').onclick = () => {
        const clan = currentWarFilters.selectedClan;
        const view = currentWarFilters.viewType;
        currentWarFilters = { attacks: 'all', difficulty: 'all', performance: 'all', sortBy: 'mapPosition', selectedClan: clan, viewType: view, strategy: 'Mirror' };
        renderWarDetail(warData, history);
    };

    const cn = document.getElementById('clanNameDetail'); if (cn) cn.innerText = warData.clan.name;
    const on = document.getElementById('opponentNameDetail'); if (on) on.innerText = warData.opponent.name;
    const cb = document.getElementById('detailClanBadge'); if (cb) cb.src = warData.clan.badgeUrls.small;
    const ob = document.getElementById('detailOpponentBadge'); if (ob) ob.src = warData.opponent.badgeUrls.small;
    const ca = document.getElementById('clanAttacks'); if (ca) ca.innerText = `${warData.clan.attacks || 0}/${warData.teamSize * 2} Attacks`;
    const oa = document.getElementById('opponentAttacks'); if (oa) oa.innerText = `${warData.opponent.attacks || 0}/${warData.teamSize * 2} Attacks`;
    
    const start = parseCoCDate(warData.startTime); const end = parseCoCDate(warData.endTime); const now = new Date();
    let isPinned = now < end; let resultLabel = ""; let scoreColor = "gold";
    if (now < start) resultLabel = "Preparation Day"; else if (now < end) resultLabel = "War Day";
    else {
        if (warData.clan.stars > warData.opponent.stars) { resultLabel = "Victory"; scoreColor = "text-green-500"; }
        else if (warData.clan.stars < warData.opponent.stars) { resultLabel = "Loss"; scoreColor = "text-red-500"; }
        else resultLabel = "Draw";
    }
    const summaryHeader = document.getElementById('warResultHeader');
    if (summaryHeader) {
        summaryHeader.innerHTML = `<span class="text-[10px] md:text-xs font-black ${isPinned ? 'gold' : scoreColor} uppercase tracking-widest mb-1 leading-none">${resultLabel}</span>
            <p class="medieval ${isPinned ? 'gold' : scoreColor} text-lg md:text-2xl">${warData.clan.stars} - ${warData.opponent.stars}</p>
            <p class="text-[8px] md:text-[9px] text-gray-500 mt-1">${warData.clan.destructionPercentage.toFixed(1)}% vs ${warData.opponent.destructionPercentage.toFixed(1)}%</p>`;
    }

    const clanMap = {};
    warData.clan.members.forEach(m => clanMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });
    const opponentMap = {};
    warData.opponent.members.forEach(m => opponentMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });

    const warAttacksMap = {}; 
    warData.clan.members.forEach(m => warAttacksMap[m.tag] = []);
    warData.opponent.members.forEach(m => warAttacksMap[m.tag] = []);
    warData.clan.members.forEach(m => (m.attacks || []).forEach(a => { if (warAttacksMap[a.defenderTag]) warAttacksMap[a.defenderTag].push(a); }));
    warData.opponent.members.forEach(m => (m.attacks || []).forEach(a => { if (warAttacksMap[a.defenderTag]) warAttacksMap[a.defenderTag].push(a); }));

    const filterFunc = (m) => {
        const atks = m.attacks ? m.attacks.length : 0;
        const stars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);
        if (currentWarFilters.attacks === 'atk1used' && atks < 1) return false;
        if (currentWarFilters.attacks === 'atk2used' && atks < 2) return false;
        if (currentWarFilters.attacks === 'atk1unused' && atks > 0) return false;
        if (currentWarFilters.attacks === 'atk2unused' && atks !== 1) return false;
        if (currentWarFilters.performance === '0-2' && stars > 2) return false;
        if (currentWarFilters.performance === '3-5' && (stars < 3 || stars > 5)) return false;
        if (currentWarFilters.performance === '6' && stars < 6) return false;
        return true;
    };

    const sideMembers = currentWarFilters.selectedClan === 'clan' ? warData.clan.members : warData.opponent.members;
    const infoInfoMap = currentWarFilters.selectedClan === 'clan' ? opponentMap : clanMap;
    const filtered = sideMembers.filter(filterFunc).sort((a,b) => {
        if (currentWarFilters.sortBy === 'stars') {
            const aS = (a.attacks || []).reduce((s,x)=>s+x.stars,0);
            const bS = (b.attacks || []).reduce((s,x)=>s+x.stars,0);
            return bS - aS || a.mapPosition - b.mapPosition;
        }
        return a.mapPosition - b.mapPosition;
    });

    container.className = "space-y-3";
    container.innerHTML = `
        <div class="flex items-center justify-between px-1 mb-2">
            <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest">War Roster</p>
            <div class="flex gap-2 p-1 bg-[#1a1a1a] rounded-lg border border-gray-800">
                <button id="showAttacks" class="text-[9px] font-bold px-3 py-1 rounded transition-all ${currentWarFilters.viewType === 'attacks' ? 'text-gold bg-gold/10' : 'text-gray-500 hover:text-gray-300'} uppercase">Attacks</button>
                <button id="showDefenses" class="text-[9px] font-bold px-3 py-1 rounded transition-all ${currentWarFilters.viewType === 'defenses' ? 'text-gold bg-gold/10' : 'text-gray-500 hover:text-gray-300'} uppercase">Defenses</button>
            </div>
        </div>
        ${filtered.map(m => renderMemberCard(m, infoInfoMap, warData.teamSize * 2, warAttacksMap)).join('')}`;

    document.getElementById('showAttacks').onclick = () => { currentWarFilters.viewType = 'attacks'; renderWarDetail(warData, history); };
    document.getElementById('showDefenses').onclick = () => { currentWarFilters.viewType = 'defenses'; renderWarDetail(warData, history); };
}

export function renderAbout(clanData) {
    const container = document.getElementById('aboutContent'); if (!container || !clanData) return;
    const labelsHtml = (clanData.labels || []).map(l => `<div class="flex items-center gap-1.5 bg-[#252525] px-2 py-1 rounded border border-gray-800"><img src="${l.iconUrls.small}" class="w-3.5 h-3.5"><span class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase">${l.name}</span></div>`).join('');
    container.innerHTML = `<div class="panel p-4 md:p-6 space-y-6 md:space-y-8"><div class="bg-[#1a1a1a] p-4 md:p-6 rounded-xl border border-gray-800"><div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start"><div class="flex-1 space-y-4 w-full"><div class="flex items-center gap-4"><img src="${clanData.badgeUrls.medium}" class="w-16 h-16 md:w-20 md:h-20"><div><h2 class="medieval text-xl md:text-2xl font-bold gold">${clanData.name}</h2><div class="flex items-center gap-2 mt-1"><span class="text-[10px] md:text-xs font-mono text-gray-500">${clanData.tag}</span></div></div></div><p class="text-[11px] md:text-sm text-gray-300 leading-relaxed italic">${clanData.description}</p></div><div class="grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 w-full md:w-auto md:min-w-[350px]"><div><p class="stat-label">Location</p><p class="stat-value text-[11px] md:text-xs">${clanData.location?.name || 'Unknown'}</p></div><div><p class="stat-label">Language</p><p class="stat-value text-[11px] md:text-xs">${clanData.chatLanguage?.name || 'English'}</p></div><div><p class="stat-label">Clan Level</p><p class="stat-value text-gold text-[11px] md:text-xs">${clanData.clanLevel}</p></div><div><p class="stat-label">Family Friendly</p><p class="stat-value text-[11px] md:text-xs">${clanData.isFamilyFriendly ? 'Yes' : 'No'}</p></div><div class="col-span-2"><p class="stat-label mb-2">Clan Labels</p><div class="flex flex-wrap gap-2">${labelsHtml}</div></div></div></div></div><div class="grid grid-cols-1 md:grid-cols-3 gap-6"><div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]"><div class="flex-1 flex flex-col"><h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>War Performance</h3><div class="space-y-3 md:space-y-4 flex-1"><div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">War League</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.warLeague?.name || 'Unranked'}</p></div><div class="grid grid-cols-3 gap-2"><div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Wins</p><p class="text-green-500 font-bold text-[11px] md:text-xs">${clanData.warWins}</p></div><div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Losses</p><p class="text-red-500 font-bold text-[11px] md:text-xs">${clanData.warLosses}</p></div><div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Ties</p><p class="text-gray-500 font-bold text-[11px] md:text-xs">${clanData.warTies}</p></div></div><button id="viewWarHistoryBtn" class="w-full py-2 bg-[#252525] border border-gray-700 rounded h-[58px] text-[9px] md:text-[10px] font-bold uppercase hover:border-gold transition-colors">View War History <span class="ml-1 opacity-70">›</span></button></div></div></div><div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]"><div><h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m0 10V4m-2 4h1m1 4h1m-3 10a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3z" /></svg>Clan Capital</h3><div class="space-y-3 md:space-y-4"><div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Capital League</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.capitalLeague?.name || 'Unranked'}</p></div><div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Capital Hall Level</p><p class="stat-value text-white text-[11px] md:text-xs">Level ${clanData.clanCapital?.capitalHallLevel || 'Unknown'}</p></div><div class="p-3 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Districts Unlocked</p><p class="stat-value text-white text-[11px] md:text-xs">${(clanData.clanCapital?.districts || []).length} Districts</p></div></div></div></div><div class="bg-[#1a1a1a] p-4 md:p-5 rounded-xl border border-gray-800 flex flex-col justify-between min-h-[250px] md:min-h-[300px]"><div><h3 class="medieval text-xs md:text-sm font-bold gold mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Join Requirements</h3><div class="space-y-3 md:space-y-4"><div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Required Trophies</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.requiredTrophies.toLocaleString()}</p></div><div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Min. Town Hall</p><p class="stat-value text-white text-[11px] md:text-xs">TH${clanData.requiredTownhallLevel}</p></div><div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center h-[58px]"><p class="stat-label">Builder Trophies</p><p class="stat-value text-white text-[11px] md:text-xs">${clanData.requiredBuilderBaseTrophies.toLocaleString()}</p></div></div></div></div></div></div>`;
}
