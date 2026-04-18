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

/**
 * Reusable function to generate the war summary card HTML
 */
function getWarSummaryHtml(war, now) {
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
    <div class="p-2.5 md:p-3.5 rounded-xl border ${pinnedClass} transition-colors relative overflow-hidden">
        <div class="flex justify-between items-center mb-1">
            <span class="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest">${formattedDate}</span>
        </div>
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-2 md:gap-3 w-1/3 text-left">
                <img src="${war.clan.badgeUrls.small}" class="w-7 h-7 md:w-9 md:h-9">
                <div class="min-w-0">
                    <p class="text-[10px] md:text-xs font-bold text-white truncate">${war.clan.name}</p>
                    <p class="text-[7px] md:text-[8px] text-gray-500">${clanAttacks}/${totalPossibleAttacks} Atks</p>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center w-1/3 text-center px-1">
                ${countdownTarget ? `<p id="cd-${war.filename || 'detail'}" class="mb-0.5 font-mono gold text-[9px] md:text-[10px]">${getCountdown(countdownTarget)}</p>` : ''}
                <p class="text-[9px] md:text-[11px] font-black ${isPinned ? 'gold' : scoreColor} uppercase tracking-widest leading-none mb-0.5">${resultLabel}</p>
                <p class="medieval ${isPinned ? 'gold' : scoreColor} text-base md:text-xl">${war.clan.stars} - ${war.opponent.stars}</p>
                <p class="text-[7px] md:text-[8px] text-gray-500 mt-0.5">${war.clan.destructionPercentage.toFixed(1)}% vs ${war.opponent.destructionPercentage.toFixed(1)}%</p>
            </div>
            <div class="flex items-center gap-2 md:gap-3 text-right justify-end w-1/3">
                <div class="min-w-0">
                    <p class="text-[10px] md:text-xs font-bold text-white truncate">${war.opponent.name}</p>
                    <p class="text-[7px] md:text-[8px] text-gray-500">${opponentAttacks}/${totalPossibleAttacks} Atks</p>
                </div>
                <img src="${war.opponent.badgeUrls.small}" class="w-7 h-7 md:w-9 md:h-9">
            </div>
        </div>
    </div>`;
}

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
    
    container.innerHTML = sorted.map(war => `
        <div onclick="window.loadWarDetail('${war.filename}')" class="cursor-pointer hover:border-gold group">
            ${getWarSummaryHtml(war, now)}
        </div>
    `).join('');
    
    countdownInterval = setInterval(() => {
        document.querySelectorAll('[id^="cd-"]').forEach(el => {
            const warFile = el.id.replace('cd-', '');
            const warObj = (warFile === 'detail' && window.activeWarData) ? window.activeWarData : warHistory.find(w => w.filename === warFile);
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
    const totalPossibleAtks = warData.teamSize * 2;
    const clanStars = warData.clan.stars || 0;
    const oppStars = warData.opponent.stars || 0;
    const clanAtksUsed = warData.clan.attacks || 0;
    const oppAtksUsed = warData.opponent.attacks || 0;
    const clanAtksRemaining = totalPossibleAtks - clanAtksUsed;
    const oppAtksRemaining = totalPossibleAtks - oppAtksUsed;

    const now = new Date();
    const isFinished = now > parseCoCDate(warData.endTime);

    if (isFinished || (clanAtksRemaining === 0 && oppAtksRemaining === 0)) {
        return clanStars > oppStars ? 100 : 0;
    }
    if (clanAtksRemaining === 0) return clanStars > oppStars ? 100 : 0;
    if (oppAtksRemaining === 0) return clanStars > oppStars ? 100 : 0;

    const playerMTDMap = {};
    history.forEach(w => {
        w.clan.members.forEach(m => {
            if (!playerMTDMap[m.tag]) playerMTDMap[m.tag] = { sum: 0, count: 0 };
            (m.attacks || []).forEach(a => {
                playerMTDMap[m.tag].sum += a.stars;
                playerMTDMap[m.tag].count++;
            });
        });
    });

    const getPlayerMTDAvg = (playerTag) => {
        return playerMTDMap[playerTag] && playerMTDMap[playerTag].count > 0 
            ? playerMTDMap[playerTag].sum / playerMTDMap[playerTag].count 
            : 2.2;
    };

    let clanProjectedStars = clanStars;
    let clanMaxPotentialStars = clanStars;

    warData.clan.members.forEach(m => {
        const attackerTH = m.townhallLevel || m.townHallLevel;
        const atksUsed = m.attacks ? m.attacks.length : 0;
        const atksLeft = 2 - atksUsed;

        for (let i = 0; i < atksLeft; i++) {
            const targetIdx = (m.mapPosition - 1) % warData.opponent.members.length;
            const target = warData.opponent.members[targetIdx];
            const targetTH = target.townhallLevel || target.townHallLevel;
            const targetStars = target.bestOpponentAttack?.stars || 0;
            let maxStars = 3;
            if (targetTH - attackerTH >= 4) maxStars = 1.5;
            else if (targetTH - attackerTH === 3) maxStars = 2.5;

            const playerAvg = getPlayerMTDAvg(m.tag);
            const expectedStars = Math.min(playerAvg, maxStars);
            if (targetStars < 3) {
                clanProjectedStars += expectedStars;
                clanMaxPotentialStars += maxStars;
            }
        }
    });

    const oppAvgStarsPerAtk = oppAtksUsed > 0 ? (oppStars / oppAtksUsed) : 2.2;
    let oppProjectedStars = oppStars;
    let oppHighThreats = 0;
    warData.opponent.members.forEach(m => {
        const oppTH = m.townhallLevel || m.townHallLevel;
        const atksUsed = m.attacks ? m.attacks.length : 0;
        const atksLeft = 2 - atksUsed;
        if (oppTH >= 16 && atksLeft > 0) oppHighThreats += atksLeft;
        for (let i = 0; i < atksLeft; i++) oppProjectedStars += oppAvgStarsPerAtk;
    });

    let defenseBonus = 0;
    if (clanStars >= oppStars) {
        let clanHighDef = warData.clan.members.filter(m => {
            const th = m.townhallLevel || m.townHallLevel;
            const stars = m.bestOpponentAttack?.stars || 0;
            return th >= 16 && stars < 3;
        }).length;
        if (oppHighThreats === 0 && clanHighDef > 0) defenseBonus = 15;
        else if (oppHighThreats < clanHighDef / 2) defenseBonus = 8;
    }

    const attacksRemaining = Math.min(clanAtksRemaining, oppAtksRemaining);
    const totalAttacksPossible = totalPossibleAtks;
    const volatilityMultiplier = 1 + ((totalAttacksPossible - attacksRemaining) / totalAttacksPossible) * 0.5;
    const currentStarGap = clanStars - oppStars;
    const maxPossibleGap = clanMaxPotentialStars - oppProjectedStars;
    let winProbability = 50;
    if (maxPossibleGap > 0) {
        if (currentStarGap >= 0) winProbability = 50 + (Math.min(1, currentStarGap / Math.max(1, maxPossibleGap)) * 40);
        else winProbability = 50 + ((1 - (Math.abs(currentStarGap) / Math.max(1, Math.abs(maxPossibleGap)))) * 40);
    } else if (maxPossibleGap < 0) winProbability = Math.max(10, 50 + (maxPossibleGap / Math.max(1, Math.abs(maxPossibleGap)) * 40));
    winProbability = 50 + ((winProbability - 50) * volatilityMultiplier);
    winProbability += defenseBonus;
    return Math.max(0, Math.min(100, Math.round(winProbability)));
}

/**
 * Main War Detail View
 */
export function renderWarDetail(warData, history = []) {
    const container = document.getElementById('warResults');
    const summaryContainer = document.getElementById('warDetailSummaryCard');
    const metricsContainer = document.getElementById('warMetrics');
    const controlsContainer = document.getElementById('warDetailControls');
    if (!container || !summaryContainer || !metricsContainer || !controlsContainer) return;

    window.activeWarData = warData; // For countdown interval
    if (currentWarFilters.selectedClan === 'map') currentWarFilters.selectedClan = 'clan';

    const clanAtksUsed = warData.clan.attacks || 0;
    const avgStarsAtk = clanAtksUsed > 0 ? (warData.clan.stars / clanAtksUsed).toFixed(2) : "0.00";
    
    let totalDest = 0;
    warData.clan.members.forEach(m => {
        (m.attacks || []).forEach(a => {
            totalDest += a.destructionPercentage;
        });
    });
    const avgDestAtk = clanAtksUsed > 0 ? (totalDest / clanAtksUsed).toFixed(1) : "0.0";

    const winProb = calculateWinProbability(warData, history);
    
    // Dynamic Colors for Metrics
    const avgStarsVal = parseFloat(avgStarsAtk);
    let avgStarsColor = "text-white";
    if (avgStarsVal <= 1.0) avgStarsColor = "text-red-500";
    else if (avgStarsVal <= 2.0) avgStarsColor = "text-yellow-500";
    else if (avgStarsVal > 2.0) avgStarsColor = "text-green-500";

    const avgDestVal = parseFloat(avgDestAtk);
    let avgDestColor = "text-white";
    if (avgDestVal < 80) avgDestColor = "text-red-500";
    else if (avgDestVal < 90) avgDestColor = "text-yellow-500";
    else if (avgDestVal >= 90) avgDestColor = "text-green-500";

    let winProbColor = "text-gold";
    if (winProb < 50) winProbColor = "text-red-500";
    else if (winProb === 50) winProbColor = "text-yellow-500";
    else if (winProb > 50) winProbColor = "text-green-500";

    const cleanupNeeded = warData.opponent.members.filter(m => { const s = m.bestOpponentAttack?.stars || 0; return s > 0 && s < 3; }).length;
    let cleanupColor = "text-gray-500";
    if (cleanupNeeded === 0) cleanupColor = "text-green-500";
    else if (cleanupNeeded <= 2) cleanupColor = "text-yellow-500";
    else if (cleanupNeeded > 2) cleanupColor = "text-red-500";

    const clanAvailablePower = warData.clan.members.reduce((sum, m) => sum + ((m.townhallLevel || m.townHallLevel || 0) * (2 - (m.attacks ? m.attacks.length : 0))), 0);
    const oppNeedsClearingSum = warData.opponent.members.filter(m => (m.bestOpponentAttack?.stars || 0) < 3).reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0);
    const currentTHRatio = oppNeedsClearingSum > 0 ? (clanAvailablePower / oppNeedsClearingSum).toFixed(2) : "∞";
    const startTHRatio = (warData.clan.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0) * 2 / (warData.opponent.members.reduce((sum, m) => sum + (m.townhallLevel || m.townHallLevel || 0), 0) * 1)).toFixed(2);
    const clearedBases = warData.opponent.members.filter(m => (m.bestOpponentAttack?.stars || 0) === 3).length;
    const mapCompletionPct = Math.round((clearedBases / warData.teamSize) * 100);

    window.toggleStatInfo = (type, event) => {
        event.stopPropagation();
        const allTooltips = document.querySelectorAll('.info-tooltip');
        const target = document.getElementById(`tooltip-${type}`);
        const isActive = target.classList.contains('active');
        allTooltips.forEach(t => t.classList.remove('active'));
        if (!isActive) target.classList.add('active');
    };

    summaryContainer.innerHTML = getWarSummaryHtml(warData, new Date());

    metricsContainer.innerHTML = `
        <div onclick="window.toggleStatInfo('avg', event)" class="flex flex-col justify-center items-center bg-[#1a1a1a] px-3 py-1 rounded-lg border border-gray-800 relative min-w-[80px] h-10 flex-1 cursor-pointer hover:bg-[#222] transition-colors">
            <button class="absolute top-1 right-1 text-[8px] text-gray-500 pointer-events-none">ⓘ</button>
            <div id="tooltip-avg" class="info-tooltip">Average Stars: The current efficiency of used attacks for your clan (Stars ÷ Attacks).</div>
            <span class="text-[7px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-0.5">Avg Stars</span>
            <p class="text-[11px] font-bold ${avgStarsColor} leading-none">${avgStarsAtk}</p>
        </div>
        <div onclick="window.toggleStatInfo('avgDest', event)" class="flex flex-col justify-center items-center bg-[#1a1a1a] px-3 py-1 rounded-lg border border-gray-800 relative min-w-[80px] h-10 flex-1 cursor-pointer hover:bg-[#222] transition-colors">
            <button class="absolute top-1 right-1 text-[8px] text-gray-500 pointer-events-none">ⓘ</button>
            <div id="tooltip-avgDest" class="info-tooltip">Average %: The average destruction percentage achieved per used attack (Total Destruction ÷ Used Attacks).</div>
            <span class="text-[7px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-0.5">Avg %</span>
            <p class="text-[11px] font-bold ${avgDestColor} leading-none">${avgDestAtk}%</p>
        </div>
        <div onclick="window.toggleStatInfo('probWin', event)" class="flex flex-col justify-center items-center bg-[#1a1a1a] px-3 py-1 rounded-lg border border-gray-800 relative min-w-[80px] h-10 flex-1 cursor-pointer hover:bg-[#222] transition-colors">
            <button class="absolute top-1 right-1 text-[8px] text-gray-500 pointer-events-none">ⓘ</button>
            <div id="tooltip-probWin" class="info-tooltip">Win Probability: A weighted calculation of the likelihood of victory factoring in score and resource exhaustion (Simulated Outcomes).</div>
            <span class="text-[7px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-0.5">Win Prob.</span>
            <p class="text-[11px] font-bold ${winProbColor} leading-none">${winProb}%</p>
        </div>
        <div onclick="window.toggleStatInfo('clean', event)" class="flex flex-col justify-center items-center bg-[#1a1a1a] px-3 py-1 rounded-lg border border-gray-800 relative min-w-[80px] h-10 flex-1 cursor-pointer hover:bg-[#222] transition-colors">
            <button class="absolute top-1 right-1 text-[8px] text-gray-500 pointer-events-none">ⓘ</button>
            <div id="tooltip-clean" class="info-tooltip">Cleanup Needed: The count of enemy bases that have been attacked but not 3-starred (1-2 Star Bases Count).</div>
            <span class="text-[7px] font-black text-gray-500 uppercase tracking-tighter leading-none mb-0.5">Cleanup</span>
            <p class="text-[11px] font-bold ${cleanupColor} leading-none">${cleanupNeeded}</p>
        </div>
    `;

    controlsContainer.innerHTML = `
        <div class="flex flex-col gap-1 pr-2">
            <span class="text-[9px] font-bold text-gray-500 uppercase pl-1">Side</span>
            <div class="flex items-center gap-1.5">
                <button id="toggleClan" class="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border ${currentWarFilters.selectedClan === 'clan' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all h-8">
                    <img src="${warData.clan.badgeUrls.small}" class="w-4 h-4"><span class="text-[9px] font-bold uppercase truncate max-w-[60px]">${warData.clan.name}</span>
                </button>
                <button id="toggleOpponent" class="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border ${currentWarFilters.selectedClan === 'opponent' ? 'border-gold bg-gold/10 text-gold' : 'border-gray-700 text-gray-500 hover:border-gray-500'} transition-all h-8">
                    <img src="${warData.opponent.badgeUrls.small}" class="w-4 h-4"><span class="text-[9px] font-bold uppercase truncate max-w-[60px]">${warData.opponent.name}</span>
                </button>
            </div>
        </div>
        <div class="flex flex-row items-end gap-2 lg:gap-4 overflow-x-auto no-scrollbar">
            <div class="flex flex-col gap-1">
                <span class="text-[9px] font-bold text-gray-500 uppercase pl-1">Attacks</span>
                <select id="filterAttacks" class="control-base h-8 w-24">
                    <option value="all" ${currentWarFilters.attacks === 'all' ? 'selected' : ''}>All</option>
                    <option value="atk1used" ${currentWarFilters.attacks === 'atk1used' ? 'selected' : ''}>#1 Used</option>
                    <option value="atk2used" ${currentWarFilters.attacks === 'atk2used' ? 'selected' : ''}>#2 Used</option>
                    <option value="atk1unused" ${currentWarFilters.attacks === 'atk1unused' ? 'selected' : ''}>#1 Unused</option>
                    <option value="atk2unused" ${currentWarFilters.attacks === 'atk2unused' ? 'selected' : ''}>#2 Unused</option>
                </select>
            </div>
            <div class="flex flex-col gap-1">
                <span class="text-[9px] font-bold text-gray-500 uppercase pl-1">Results</span>
                <select id="filterPerformance" class="control-base h-8 w-24">
                    <option value="all" ${currentWarFilters.performance === 'all' ? 'selected' : ''}>All Stars</option>
                    <option value="0-2" ${currentWarFilters.performance === '0-2' ? 'selected' : ''}>0-2 Stars</option>
                    <option value="3-5" ${currentWarFilters.performance === '3-5' ? 'selected' : ''}>3-5 Stars</option>
                    <option value="6" ${currentWarFilters.performance === '6' ? 'selected' : ''}>Perfect (6)</option>
                </select>
            </div>
            <div class="flex flex-col gap-1">
                <span class="text-[9px] font-bold text-gray-500 uppercase pl-1">Sort</span>
                <select id="filterSort" class="control-base h-8 w-24">
                    <option value="mapPosition" ${currentWarFilters.sortBy === 'mapPosition' ? 'selected' : ''}>Map Pos</option>
                    <option value="stars" ${currentWarFilters.sortBy === 'stars' ? 'selected' : ''}>Total Stars</option>
                </select>
            </div>
            <button id="resetDetailFilters" class="btn-reset h-8">Reset</button>
        </div>`;

    document.getElementById('toggleClan').onclick = () => { currentWarFilters.selectedClan = 'clan'; renderWarDetail(warData, history); };
    document.getElementById('toggleOpponent').onclick = () => { currentWarFilters.selectedClan = 'opponent'; renderWarDetail(warData, history); };
    document.getElementById('filterAttacks').onchange = (e) => { currentWarFilters.attacks = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterPerformance').onchange = (e) => { currentWarFilters.performance = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('filterSort').onchange = (e) => { currentWarFilters.sortBy = e.target.value; renderWarDetail(warData, history); };
    document.getElementById('resetDetailFilters').onclick = () => {
        const clan = currentWarFilters.selectedClan;
        const view = currentWarFilters.viewType;
        currentWarFilters = { attacks: 'all', difficulty: 'all', performance: 'all', sortBy: 'mapPosition', selectedClan: clan, viewType: view, strategy: 'Mirror' };
        renderWarDetail(warData, history);
    };

    const togglesContainer = document.getElementById('warDetailToggles');
    if (togglesContainer) {
        togglesContainer.innerHTML = `
            <button id="showAttacks" class="sub-tab-btn ${currentWarFilters.viewType === 'attacks' ? 'active' : ''} uppercase tracking-wider">Attacks</button>
            <button id="showDefenses" class="sub-tab-btn ${currentWarFilters.viewType === 'defenses' ? 'active' : ''} uppercase tracking-wider">Defenses</button>
        `;
        document.getElementById('showAttacks').onclick = () => { currentWarFilters.viewType = 'attacks'; renderWarDetail(warData, history); };
        document.getElementById('showDefenses').onclick = () => { currentWarFilters.viewType = 'defenses'; renderWarDetail(warData, history); };
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
        </div>
        ${filtered.map(m => renderMemberCard(m, infoInfoMap, warData.teamSize * 2, warAttacksMap)).join('')}`;
}

export function renderAbout(clanData) {
    const container = document.getElementById('aboutContent'); if (!container || !clanData) return;
    const labelsHtml = (clanData.labels || []).map(l => `<div class="flex items-center gap-1.5 bg-[#252525] px-2 py-1 rounded border border-gray-800"><img src="${l.iconUrls.small}" class="w-3.5 h-3.5"><span class="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase">${l.name}</span></div>`).join('');
    container.innerHTML = `<div class="panel p-4 md:p-6 space-y-6 md:space-y-8">
        <div class="bg-[#1a1a1a] p-4 md:p-6 rounded-xl border border-gray-800">
            <div class="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                <div class="flex-1 space-y-4 w-full">
                    <div class="flex items-center gap-4">
                        <img src="${clanData.badgeUrls.medium}" class="w-16 h-16 md:w-20 md:h-20">
                        <div>
                            <h2 class="medieval text-xl md:text-2xl font-bold gold">${clanData.name}</h2>
                            <div class="flex items-center gap-2 mt-1"><span class="text-[10px] md:text-xs font-mono text-gray-500">${clanData.tag}</span></div>
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
                            <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Victories</p><p class="text-green-500 font-bold text-[11px] md:text-xs">${clanData.warWins}</p></div>
                            <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">Defeats</p><p class="text-red-500 font-bold text-[11px] md:text-xs">${clanData.warLosses}</p></div>
                            <div class="text-center p-2 bg-[#252525] rounded-lg h-[58px] flex flex-col justify-center"><p class="stat-label">DRAWS</p><p class="text-gray-500 font-bold text-[11px] md:text-xs">${clanData.warTies}</p></div>
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

// Raid sorting state
let raidSort = { 
    summary: { col: 'loot', dir: -1 }, 
    attacks: { col: 'index', dir: -1 }, 
    defenses: { col: 'index', dir: -1 } 
};

export function setRaidSort(table, column) {
    if (raidSort[table].col === column) raidSort[table].dir *= -1;
    else { raidSort[table].col = column; raidSort[table].dir = -1; }
    updateSortHeaders(table);
}

export function resetRaidSort(table) {
    if (table === 'summary') raidSort.summary = { col: 'loot', dir: -1 };
    else if (table === 'attacks') raidSort.attacks = { col: 'index', dir: -1 };
    else if (table === 'defenses') raidSort.defenses = { col: 'index', dir: -1 };
    updateSortHeaders(table);
}

function updateSortHeaders(table) {
    const s = raidSort[table];
    document.querySelectorAll(`.raid-sort-btn[data-table="${table}"]`).forEach(th => {
        const isSelected = th.getAttribute('data-sort') === s.col;
        const icon = th.querySelector('svg');
        if (isSelected) {
            th.classList.add('text-gold');
            if (icon) {
                icon.classList.remove('opacity-20');
                icon.classList.add('opacity-100');
            }
        } else {
            th.classList.remove('text-gold');
            if (icon) {
                icon.classList.add('opacity-20');
                icon.classList.remove('opacity-100');
            }
        }
    });
}

/**
 * Renders the Raid Summary table.
 */
export function renderRaidSummary(raidData, membersLookup = []) {
    const tableBody = document.getElementById('raidSummaryTableBody');
    if (!tableBody) return;
    if (!raidData || !raidData.members) { tableBody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-gray-600 italic">No raid data available.</td></tr>`; return; }

    updateSortHeaders('summary');

    const memberMap = {};
    membersLookup.forEach(m => memberMap[m.tag] = m);

    const playerStats = {};
    if (raidData.attackLog) {
        raidData.attackLog.forEach(logEntry => {
            (logEntry.districts || []).forEach(district => {
                (district.attacks || []).forEach(atk => {
                    const tag = atk.attacker.tag;
                    if (!playerStats[tag]) playerStats[tag] = { stars: 0, damage: 0, count: 0 };
                    playerStats[tag].stars += atk.stars;
                    playerStats[tag].damage += atk.destructionPercent;
                    playerStats[tag].count++;
                });
            });
        });
    }

    const members = raidData.members.map(m => {
        const stats = playerStats[m.tag] || { stars: 0, damage: 0, count: 0 };
        return { ...m, ...stats, avgStars: stats.count > 0 ? (stats.stars / stats.count) : 0 };
    });

    const s = raidSort.summary;
    members.sort((a, b) => {
        let valA, valB;
        if (s.col === 'name') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
        else if (s.col === 'attacks') { valA = a.attacks; valB = b.attacks; }
        else if (s.col === 'loot') { valA = a.capitalResourcesLooted || 0; valB = b.capitalResourcesLooted || 0; }
        else if (s.col === 'stars') { valA = a.stars; valB = b.stars; }
        else if (s.col === 'damage') { valA = a.damage; valB = b.damage; }
        else if (s.col === 'avgStars') { valA = a.avgStars; valB = b.avgStars; }
        return (valA < valB ? -1 : 1) * s.dir;
    });

    tableBody.innerHTML = members.map(member => {
        const totalPossible = member.attackLimit + member.bonusAttackLimit;
        const mInfo = memberMap[member.tag];
        const thLevel = mInfo?.townHallLevel || mInfo?.townhallLevel || 1;

        return `
            <tr class="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors">
                <td class="p-3">
                    <div class="flex items-center gap-3">
                        <img src="${getTHImage(thLevel)}" class="w-8 h-8">
                        <div class="min-w-0">
                            <p class="font-bold text-[11px] text-white truncate">${member.name}</p>
                            <p class="text-[9px] gold font-bold uppercase tracking-tighter">TH${thLevel}</p>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center text-gray-400 font-mono">${member.attacks}/${totalPossible}</td>
                <td class="p-3 text-center gold font-bold">${(member.capitalResourcesLooted || 0).toLocaleString()}</td>
                <td class="p-3 text-center text-white font-bold">${member.stars}</td>
                <td class="p-3 text-center text-gray-400">${member.damage}%</td>
                <td class="p-3 text-center text-gold font-bold">${member.avgStars.toFixed(2)}</td>
            </tr>`;
    }).join('');
}

/**
 * Renders the Raid Attacks (Log) table.
 */
export function renderRaidAttacks(raidData) {
    const tableBody = document.getElementById('raidAttacksTableBody');
    if (!tableBody) return;
    if (!raidData) return;

    updateSortHeaders('attacks');

    const log = (raidData.attackLog || []).map((r, i) => {
        const isDefeated = r.districtsDestroyed === r.districtCount;
        return { ...r, index: i + 1, status: isDefeated ? 'Defeated' : 'In-Progress' };
    });

    const s = raidSort.attacks;
    log.sort((a, b) => {
        let valA, valB;
        if (s.col === 'index') { valA = a.index; valB = b.index; }
        else if (s.col === 'clan') { valA = a.defender.name.toLowerCase(); valB = b.defender.name.toLowerCase(); }
        else if (s.col === 'status') { valA = a.status; valB = b.status; }
        else if (s.col === 'attacks') { valA = a.attackCount; valB = b.attackCount; }
        else if (s.col === 'districts') { valA = a.districtsDestroyed; valB = b.districtsDestroyed; }
        return (valA < valB ? -1 : 1) * s.dir;
    });

    tableBody.innerHTML = log.map(r => `
        <tr class="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors">
            <td class="p-3 text-gray-500 font-mono">#${r.index}</td>
            <td class="p-3"><div class="flex items-center gap-2"><img src="${r.defender.badgeUrls.small}" class="w-5 h-5"><span class="font-bold text-white">${r.defender.name}</span></div></td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.status === 'Defeated' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}">${r.status}</span></td>
            <td class="p-3 text-center text-gray-400">${r.attackCount}</td>
            <td class="p-3 text-center text-gold font-bold">${r.districtsDestroyed} / ${r.districtCount}</td>
        </tr>`).join('');
}

/**
 * Renders the Raid Defenses (Log) table.
 */
export function renderRaidDefenses(raidData) {
    const tableBody = document.getElementById('raidDefensesTableBody');
    if (!tableBody) return;
    if (!raidData) return;

    updateSortHeaders('defenses');

    const log = (raidData.defenseLog || []).map((r, i) => {
        const isDefeated = r.districtsDestroyed === r.districtCount;
        return { ...r, index: i + 1, status: isDefeated ? 'Defeated' : 'In-Progress' };
    });

    const s = raidSort.defenses;
    log.sort((a, b) => {
        let valA, valB;
        if (s.col === 'index') { valA = a.index; valB = b.index; }
        else if (s.col === 'clan') { valA = a.attacker.name.toLowerCase(); valB = b.attacker.name.toLowerCase(); }
        else if (s.col === 'status') { valA = a.status; valB = b.status; }
        else if (s.col === 'attacks') { valA = a.attackCount; valB = b.attackCount; }
        else if (s.col === 'districts') { valA = a.districtsDestroyed; valB = b.districtsDestroyed; }
        return (valA < valB ? -1 : 1) * s.dir;
    });

    tableBody.innerHTML = log.map(r => `
        <tr class="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors">
            <td class="p-3 text-gray-500 font-mono">#${r.index}</td>
            <td class="p-3"><div class="flex items-center gap-2"><img src="${r.attacker.badgeUrls.small}" class="w-5 h-5"><span class="font-bold text-white">${r.attacker.name}</span></div></td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.status === 'Defeated' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}">${r.status}</span></td>
            <td class="p-3 text-center text-gray-400">${r.attackCount}</td>
            <td class="p-3 text-center text-red-400 font-bold">${r.districtsDestroyed} / ${r.districtCount}</td>
        </tr>`).join('');
}
