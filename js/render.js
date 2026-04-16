import { roleMap, getTHImage } from './constants.js';

export function renderMembers(list) {
    const container = document.getElementById('memberList');
    container.innerHTML = list.map(m => {
        const leagueIcon = m.leagueTier?.iconUrls?.small || m.league?.iconUrls?.small || '';
        return `
        <div class="flex items-center gap-3 p-3 bg-[#252525] border border-transparent rounded-lg">
            <img src="${getTHImage(m.townHallLevel)}" class="th-icon">
            <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 truncate">
                    <span class="font-bold text-xs text-white">${m.name}</span>
                    <span class="text-[8px] text-gray-500 font-mono">XP ${m.expLevel}</span>
                </div>
                <span class="text-[8px] gold font-bold uppercase block">${roleMap[m.role]}</span>
                <div class="flex gap-4 mt-1.5">
                    <div><p class="stat-label">Donated</p><p class="stat-value text-green-500 text-[9px]">${m.donations}</p></div>
                    <div><p class="stat-label">Received</p><p class="stat-value text-red-400 text-[9px]">${m.donationsReceived}</p></div>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center min-w-[60px]">
                ${leagueIcon ? `<img src="${leagueIcon}" class="w-6 h-6 object-contain mb-1" title="${m.leagueTier?.name || m.league?.name || 'Unranked'}">` : ''}
                <p class="text-xs font-bold text-[#d4af37]">${m.trophies.toLocaleString()}</p>
                <p class="text-[8px] text-gray-600 uppercase font-bold tracking-tighter">Trophies</p>
            </div>
        </div>`;
    }).join('');
}

function getDifficultyLabel(targetTH, actorTH) {
    if (targetTH === "?" || actorTH === "?") return "Unknown";
    const diff = targetTH - actorTH;
    if (diff > 0) return "Hard";
    if (diff === 0) return "Normal";
    return "Easy";
}

export function renderAtkSmall(atk, infoMap, isDefense = false, memberTH = "?") {
    if (!atk) return `
        <div class="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 min-h-[54px]">
            <div class="w-6 h-6 flex items-center justify-center text-[8px] text-gray-600 uppercase font-bold">---</div>
            <div class="flex-1 min-w-0">
                <p class="text-[9px] text-gray-500 font-bold italic">No Attack</p>
            </div>
        </div>`;
    
    const lookupTag = isDefense ? atk.attackerTag : atk.defenderTag;
    const info = infoMap[lookupTag] || { name: "Unknown", th: "?", pos: "?" };
    
    const diffLabel = isDefense ? getDifficultyLabel(memberTH, info.th) : getDifficultyLabel(info.th, memberTH);
    const diffColor = diffLabel === "Hard" ? "text-red-400" : (diffLabel === "Normal" ? "text-gray-400" : "text-green-400");

    const stars = '★'.repeat(atk.stars).padEnd(3, '☆');
    const pct = atk.destructionPercentage;
    const isRed = atk.stars <= 1;
    const colorClass = isRed ? "text-red-500" : (atk.stars === 3 ? "text-green-500" : "text-yellow-500");
    const bgColorClass = isRed ? "bg-red-500" : (atk.stars === 3 ? "bg-green-500" : "bg-yellow-500");

    return `
        <div class="p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 min-h-[54px] relative">
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
        </div>`;
}

function parseCoCDate(dateStr) {
    if (!dateStr) return null;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6) - 1;
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const sec = dateStr.substring(13, 15);
    return new Date(Date.UTC(year, month, day, hour, min, sec));
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

let countdownInterval = null;

let currentWarFilters = {
    attacks: 'all',
    difficulty: 'all',
    performance: 'all',
    sortBy: 'mapPosition'
};

export function renderWarHistory(warHistory) {
    const container = document.getElementById('warHistoryList');
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
        let isPinned = false;

        if (now < start) {
            statusLabel = "In Preparation";
            countdownTarget = war.startTime;
            isPinned = true;
        } else if (now < end) {
            statusLabel = "In Progress";
            countdownTarget = war.endTime;
            isPinned = true;
        }

        const pinnedClass = isPinned ? 'border-gold bg-[#2a2618]' : 'border-gray-700 bg-[#252525]';

        // Color coding for score
        const clanStars = war.clan.stars || 0;
        const opponentStars = war.opponent.stars || 0;
        const clanDest = war.clan.destructionPercentage || 0;
        const opponentDest = war.opponent.destructionPercentage || 0;

        let resultLabel = statusLabel;
        let scoreColor = "gold";

        if (!isPinned) {
            if (clanStars > opponentStars) {
                resultLabel = "Victory";
                scoreColor = "text-green-500";
            } else if (clanStars < opponentStars) {
                resultLabel = "Loss";
                scoreColor = "text-red-500";
            } else {
                if (clanDest > opponentDest) {
                    resultLabel = "Victory";
                    scoreColor = "text-green-500";
                } else if (clanDest < opponentDest) {
                    resultLabel = "Loss";
                    scoreColor = "text-red-500";
                } else {
                    resultLabel = "Draw";
                    scoreColor = "text-gray-400";
                }
            }
        }

        return `
        <div class="p-4 rounded-xl border ${pinnedClass} hover:border-gold cursor-pointer transition-colors relative overflow-hidden" onclick="window.loadWarDetail('${war.filename}')">
            ${isPinned ? '<div class="absolute top-0 right-0 bg-gold text-[#121212] text-[8px] font-black px-2 py-0.5 uppercase tracking-tighter">Current War</div>' : ''}
            <div class="flex justify-between items-center mb-2">
                <div class="flex flex-col">
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">${formattedDate}</span>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <img src="${war.clan.badgeUrls.small}" class="w-10 h-10">
                    <div>
                        <p class="text-xs font-bold text-white">${war.clan.name}</p>
                        <p class="text-[9px] text-gray-500">${clanAttacks}/${totalPossibleAttacks} Attacks</p>
                    </div>
                </div>
                <div class="text-center">
                    <p class="text-[11px] font-black ${isPinned ? 'gold' : scoreColor} uppercase tracking-widest mb-1">${resultLabel}</p>
                    <p class="medieval ${isPinned ? 'gold' : scoreColor} text-xl">${war.clan.stars} - ${war.opponent.stars}</p>
                    ${countdownTarget ? `<p id="cd-${war.filename}" data-end="${countdownTarget}" class="mt-1 font-mono gold text-[11px]">${getCountdown(countdownTarget)}</p>` : ''}
                    <p class="text-[9px] text-gray-500 mt-1">${war.clan.destructionPercentage.toFixed(1)}% vs ${war.opponent.destructionPercentage.toFixed(1)}%</p>
                </div>
                <div class="flex items-center gap-3 text-right">
                    <div>
                        <p class="text-xs font-bold text-white">${war.opponent.name}</p>
                        <p class="text-[9px] text-gray-500">${opponentAttacks}/${totalPossibleAttacks} Attacks</p>
                    </div>
                    <img src="${war.opponent.badgeUrls.small}" class="w-10 h-10">
                </div>
            </div>
        </div>`;
    }).join('');

    countdownInterval = setInterval(() => {
        document.querySelectorAll('[id^="cd-"]').forEach(el => {
            const end = el.getAttribute('data-end');
            el.innerText = getCountdown(end);
        });
    }, 1000);
}

function renderMemberCard(m, infoMap, totalAttacks) {
    const totalStars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);
    return `
        <div class="flex flex-col gap-2 p-3 bg-[#252525] rounded-xl border border-gray-800">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-gray-600">#${m.mapPosition}</span>
                    <img src="${getTHImage(m.townhallLevel || m.townHallLevel)}" class="w-8 h-8">
                    <div class="min-w-0">
                        <p class="font-bold text-[11px] text-white truncate">${m.name}</p>
                        <p class="text-[9px] gold font-bold uppercase">TH${m.townhallLevel || m.townHallLevel}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[9px] font-black text-gray-500 uppercase">Stars</p>
                    <p class="text-xs font-bold gold">${totalStars}</p>
                </div>
            </div>
            <div class="grid grid-cols-1 gap-1.5">
                ${renderAtkSmall(m.attacks ? m.attacks[0] : null, infoMap, false, m.townhallLevel || m.townHallLevel)}
                ${renderAtkSmall(m.attacks && m.attacks[1] ? m.attacks[1] : null, infoMap, false, m.townhallLevel || m.townHallLevel)}
            </div>
        </div>
    `;
}

export function renderWarDetail(warData) {
    const container = document.getElementById('warResults');
    const totalPossibleAttacks = warData.teamSize * warData.attacksPerMember;
    
    let filterBar = document.getElementById('warDetailFilters');
    if (!filterBar) {
        const detailView = document.getElementById('warDetailView');
        const summary = document.getElementById('warSummary');
        filterBar = document.createElement('div');
        filterBar.id = 'warDetailFilters';
        filterBar.className = 'flex flex-wrap items-center gap-4 mb-6 p-4 bg-[#1a1a1a] rounded-xl border border-gray-800';
        detailView.insertBefore(filterBar, summary.nextSibling);
    }

    filterBar.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold text-gray-500 uppercase">Attacks:</span>
            <select id="filterAttacks" class="control-base h-8">
                <option value="all" ${currentWarFilters.attacks === 'all' ? 'selected' : ''}>All</option>
                <option value="complete" ${currentWarFilters.attacks === 'complete' ? 'selected' : ''}>Complete</option>
                <option value="incomplete" ${currentWarFilters.attacks === 'incomplete' ? 'selected' : ''}>Incomplete</option>
            </select>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold text-gray-500 uppercase">Difficulty:</span>
            <select id="filterDifficulty" class="control-base h-8">
                <option value="all" ${currentWarFilters.difficulty === 'all' ? 'selected' : ''}>All</option>
                <option value="Hard" ${currentWarFilters.difficulty === 'Hard' ? 'selected' : ''}>Hard Only</option>
                <option value="Normal" ${currentWarFilters.difficulty === 'Normal' ? 'selected' : ''}>Normal Only</option>
                <option value="Easy" ${currentWarFilters.difficulty === 'Easy' ? 'selected' : ''}>Easy Only</option>
            </select>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold text-gray-500 uppercase">Performance:</span>
            <select id="filterPerformance" class="control-base h-8">
                <option value="all" ${currentWarFilters.performance === 'all' ? 'selected' : ''}>All Stars</option>
                <option value="0-2" ${currentWarFilters.performance === '0-2' ? 'selected' : ''}>0-2 Stars</option>
                <option value="3-5" ${currentWarFilters.performance === '3-5' ? 'selected' : ''}>3-5 Stars</option>
                <option value="6" ${currentWarFilters.performance === '6' ? 'selected' : ''}>Perfect (6)</option>
            </select>
        </div>
        <div class="flex items-center gap-2 ml-auto">
            <span class="text-[10px] font-bold text-gray-500 uppercase">Sort:</span>
            <select id="filterSort" class="control-base h-8">
                <option value="mapPosition" ${currentWarFilters.sortBy === 'mapPosition' ? 'selected' : ''}>Map Position</option>
                <option value="stars" ${currentWarFilters.sortBy === 'stars' ? 'selected' : ''}>Total Stars</option>
            </select>
            <button id="clearDetailFilters" class="text-[9px] font-bold text-gray-500 hover:text-gold uppercase transition-colors ml-2">Clear</button>
        </div>
    `;

    document.getElementById('filterAttacks').onchange = (e) => { currentWarFilters.attacks = e.target.value; renderWarDetail(warData); };
    document.getElementById('filterDifficulty').onchange = (e) => { currentWarFilters.difficulty = e.target.value; renderWarDetail(warData); };
    document.getElementById('filterPerformance').onchange = (e) => { currentWarFilters.performance = e.target.value; renderWarDetail(warData); };
    document.getElementById('filterSort').onchange = (e) => { currentWarFilters.sortBy = e.target.value; renderWarDetail(warData); };
    document.getElementById('clearDetailFilters').onclick = () => {
        currentWarFilters = { attacks: 'all', difficulty: 'all', performance: 'all', sortBy: 'mapPosition' };
        renderWarDetail(warData);
    };

    const clanStars = warData.clan.stars;
    const opponentStars = warData.opponent.stars;
    const clanDest = warData.clan.destructionPercentage;
    const opponentDest = warData.opponent.destructionPercentage;

    let resultLabel = "";
    let scoreColor = "gold";
    if (clanStars > opponentStars) {
        resultLabel = "Victory";
        scoreColor = "text-green-500";
    } else if (clanStars < opponentStars) {
        resultLabel = "Loss";
        scoreColor = "text-red-500";
    } else {
        if (clanDest > opponentDest) {
            resultLabel = "Victory";
            scoreColor = "text-green-500";
        } else if (clanDest < opponentDest) {
            resultLabel = "Loss";
            scoreColor = "text-red-500";
        } else {
            resultLabel = "Draw";
            scoreColor = "text-gray-400";
        }
    }

    const totalStarsEl = document.getElementById('totalStars');
    totalStarsEl.innerText = clanStars;
    totalStarsEl.className = `text-xl font-bold ${scoreColor}`;
    document.getElementById('totalDestruction').innerText = clanDest.toFixed(1) + "%";
    document.getElementById('clanAttacks').innerText = `${warData.clan.attacks || 0}/${totalPossibleAttacks} Attacks`;
    
    const summaryHeader = document.querySelector('.medieval.gold.text-lg');
    if (summaryHeader) {
        summaryHeader.innerHTML = `<div class="flex flex-col items-center">
            <span class="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">${resultLabel}</span>
            <span>VS</span>
        </div>`;
    }

    document.getElementById('opponentNameDetail').innerText = warData.opponent.name;
    const opponentStarsEl = document.getElementById('opponentStars');
    opponentStarsEl.innerText = opponentStars;
    const oppScoreColor = scoreColor === "text-green-500" ? "text-red-500" : (scoreColor === "text-red-500" ? "text-green-500" : "text-gray-400");
    opponentStarsEl.className = `text-xl font-bold ${oppScoreColor}`;
    document.getElementById('opponentDestruction').innerText = opponentDest.toFixed(1) + "%";
    document.getElementById('opponentAttacks').innerText = `${warData.opponent.attacks || 0}/${totalPossibleAttacks} Attacks`;

    const clanMap = {};
    warData.clan.members.forEach(m => clanMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });
    const opponentMap = {};
    warData.opponent.members.forEach(m => opponentMap[m.tag] = { pos: m.mapPosition, th: m.townhallLevel || m.townHallLevel, name: m.name });

    const filterFunc = (m, sideMap) => {
        const attackCount = m.attacks ? m.attacks.length : 0;
        const totalStars = (m.attacks || []).reduce((sum, a) => sum + a.stars, 0);
        
        if (currentWarFilters.attacks === 'incomplete' && attackCount >= warData.attacksPerMember) return false;
        if (currentWarFilters.attacks === 'complete' && attackCount < warData.attacksPerMember) return false;
        
        if (currentWarFilters.performance === '0-2' && totalStars > 2) return false;
        if (currentWarFilters.performance === '3-5' && (totalStars < 3 || totalStars > 5)) return false;
        if (currentWarFilters.performance === '6' && totalStars < 6) return false;
        if (currentWarFilters.difficulty !== 'all') {
            const labels = (m.attacks || []).map(a => getDifficultyLabel(sideMap[a.defenderTag]?.th || "?", m.townhallLevel || m.townHallLevel));
            if (!labels.includes(currentWarFilters.difficulty)) return false;
        }
        return true;
    };

    const sortFunc = (a, b) => {
        if (currentWarFilters.sortBy === 'stars') {
            const aStars = (a.attacks || []).reduce((sum, atk) => sum + atk.stars, 0);
            const bStars = (b.attacks || []).reduce((sum, atk) => sum + atk.stars, 0);
            return bStars - aStars || a.mapPosition - b.mapPosition;
        }
        return a.mapPosition - b.mapPosition;
    };

    const filteredClan = warData.clan.members.filter(m => filterFunc(m, opponentMap)).sort(sortFunc);
    const filteredOpponent = warData.opponent.members.filter(m => filterFunc(m, clanMap)).sort(sortFunc);

    container.className = "grid grid-cols-1 md:grid-cols-2 gap-6";
    container.innerHTML = `
        <div class="space-y-3">
            <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">${warData.clan.name}</p>
            ${filteredClan.map(m => renderMemberCard(m, opponentMap, warData.attacksPerMember)).join('')}
        </div>
        <div class="space-y-3">
            <p class="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">${warData.opponent.name}</p>
            ${filteredOpponent.map(m => renderMemberCard(m, clanMap, warData.attacksPerMember)).join('')}
        </div>
    `;
}

export function renderAbout(clanData) {
    const container = document.getElementById('aboutContent');
    if (!clanData) return;

    const labelsHtml = (clanData.labels || []).map(l => `
        <div class="flex items-center gap-1.5 bg-[#252525] px-2 py-1 rounded border border-gray-800">
            <img src="${l.iconUrls.small}" class="w-4 h-4">
            <span class="text-[9px] font-bold text-gray-400 uppercase">${l.name}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="panel p-6 space-y-8">
            <!-- Basic Info Row -->
            <div class="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800">
                <div class="flex flex-col md:flex-row gap-8 items-start">
                    <div class="flex-1 space-y-4">
                        <div class="flex items-center gap-4">
                            <img src="${clanData.badgeUrls.medium}" class="w-20 h-20">
                            <div>
                                <h2 class="medieval text-2xl font-bold gold">${clanData.name}</h2>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-xs font-mono text-gray-500">${clanData.tag}</span>
                                    <button onclick="navigator.clipboard.writeText('${clanData.tag}')" class="p-1 hover:bg-[#252525] rounded transition-colors" title="Copy Tag">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p class="text-sm text-gray-300 leading-relaxed italic">"${clanData.description}"</p>
                    </div>
                    <div class="grid grid-cols-2 gap-x-8 gap-y-4 min-w-[300px]">
                        <div>
                            <p class="stat-label">Location</p>
                            <p class="stat-value">${clanData.location?.name || 'Unknown'}</p>
                        </div>
                        <div>
                            <p class="stat-label">Language</p>
                            <p class="stat-value">${clanData.chatLanguage?.name || 'English'}</p>
                        </div>
                        <div>
                            <p class="stat-label">Clan Level</p>
                            <p class="stat-value text-gold">${clanData.clanLevel}</p>
                        </div>
                        <div>
                            <p class="stat-label">Family Friendly</p>
                            <p class="stat-value">${clanData.isFamilyFriendly ? 'Yes' : 'No'}</p>
                        </div>
                        <div class="col-span-2">
                            <p class="stat-label mb-2">Clan Labels</p>
                            <div class="flex flex-wrap gap-2">
                                ${labelsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Three Columns under it -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- War Info -->
                <div class="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800 flex flex-col h-full">
                    <h3 class="medieval text-sm font-bold gold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        War Performance
                    </h3>
                    <div class="space-y-4 flex-1">
                        <div class="p-3 bg-[#252525] rounded-lg">
                            <p class="stat-label">War League</p>
                            <p class="stat-value text-white">${clanData.warLeague?.name || 'Unranked'}</p>
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                            <div class="text-center p-2 bg-[#252525] rounded-lg">
                                <p class="stat-label">Wins</p>
                                <p class="text-green-500 font-bold">${clanData.warWins}</p>
                            </div>
                            <div class="text-center p-2 bg-[#252525] rounded-lg">
                                <p class="stat-label">Losses</p>
                                <p class="text-red-500 font-bold">${clanData.warLosses}</p>
                            </div>
                            <div class="text-center p-2 bg-[#252525] rounded-lg">
                                <p class="stat-label">Ties</p>
                                <p class="text-gray-500 font-bold">${clanData.warTies}</p>
                            </div>
                        </div>
                    </div>
                    <button onclick="document.getElementById('tab-war').click()" class="mt-6 w-full py-2 bg-[#252525] border border-gray-700 rounded text-[10px] font-bold uppercase hover:border-gold transition-colors">
                        View War History
                    </button>
                </div>

                <!-- Clan Capital -->
                <div class="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800">
                    <h3 class="medieval text-sm font-bold gold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m0 10V4m-2 4h1m1 4h1m-3 10a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3z" />
                        </svg>
                        Clan Capital
                    </h3>
                    <div class="space-y-4">
                        <div class="p-3 bg-[#252525] rounded-lg">
                            <p class="stat-label">Capital League</p>
                            <p class="stat-value text-white">${clanData.capitalLeague?.name || 'Unranked'}</p>
                        </div>
                        <div class="p-3 bg-[#252525] rounded-lg">
                            <p class="stat-label">Capital Hall Level</p>
                            <p class="stat-value text-white">${clanData.clanCapital?.capitalHallLevel || 'Unknown'}</p>
                        </div>
                        <div class="p-3 bg-[#252525] rounded-lg">
                            <p class="stat-label">Districts Unlocked</p>
                            <p class="stat-value text-white">${(clanData.clanCapital?.districts || []).length} Districts</p>
                        </div>
                    </div>
                </div>

                <!-- Requirements -->
                <div class="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800">
                    <h3 class="medieval text-sm font-bold gold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Join Requirements
                    </h3>
                    <div class="space-y-4">
                        <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center">
                            <p class="stat-label">Required Trophies</p>
                            <p class="stat-value text-white">${clanData.requiredTrophies.toLocaleString()}</p>
                        </div>
                        <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center">
                            <p class="stat-label">Min. Town Hall</p>
                            <p class="stat-value text-white">TH${clanData.requiredTownhallLevel}</p>
                        </div>
                        <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center">
                            <p class="stat-label">Builder Trophies</p>
                            <p class="stat-value text-white">${clanData.requiredBuilderBaseTrophies.toLocaleString()}</p>
                        </div>
                        <div class="p-3 bg-[#252525] rounded-lg flex justify-between items-center">
                            <p class="stat-label">Type</p>
                            <p class="stat-value text-gold uppercase">${clanData.type}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
