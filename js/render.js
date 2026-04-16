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

export function renderAtkSmall(atk, infoMap, isDefense = false) {
    if (!atk) return `
        <div class="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg border border-dashed border-gray-800 opacity-40 min-h-[54px]">
            <div class="w-6 h-6 flex items-center justify-center text-[8px] text-gray-600 uppercase font-bold">---</div>
            <div class="flex-1 min-w-0">
                <p class="text-[9px] text-gray-600 font-bold italic">No ${isDefense ? 'Defense' : 'Attack'}</p>
            </div>
        </div>`;
    
    // For attacks, we look up the defender. For defenses against us, we look up the attacker.
    const lookupTag = isDefense ? atk.attackerTag : atk.defenderTag;
    const info = infoMap[lookupTag] || { name: "Unknown", th: "?", pos: "?" };
    
    const stars = '★'.repeat(atk.stars).padEnd(3, '☆');
    const pct = atk.destructionPercentage;
    const isRed = atk.stars <= 1;
    const colorClass = isRed ? "text-red-500" : (atk.stars === 3 ? "text-green-500" : "text-yellow-500");
    const bgColorClass = isRed ? "bg-red-500" : (atk.stars === 3 ? "bg-green-500" : "bg-yellow-500");

    return `
        <div class="p-2 bg-[#1a1a1a] rounded-lg border border-gray-800 min-h-[54px]">
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

export function renderWarHistory(warHistory) {
    const container = document.getElementById('warHistoryList');
    if (warHistory.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-600 italic py-10 font-light text-sm">No wars found for this range.</p>`;
        return;
    }
    
    container.innerHTML = warHistory.map(war => {
        const totalPossibleAttacks = war.teamSize * war.attacksPerMember;
        const clanAttacks = war.clan.attacks || 0;
        const opponentAttacks = war.opponent.attacks || 0;
        const d = war.startTime;
        const formattedDate = `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}`;
        
        return `
        <div class="p-4 bg-[#252525] rounded-xl border border-gray-700 hover:border-gold cursor-pointer transition-colors" onclick="window.loadWarDetail('${war.filename}')">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[9px] font-mono text-gray-500 uppercase tracking-widest">${formattedDate}</span>
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
                    <p class="medieval gold text-sm">${war.clan.stars} - ${war.opponent.stars}</p>
                    <p class="text-[9px] text-gray-500">${war.clan.destructionPercentage.toFixed(1)}% vs ${war.opponent.destructionPercentage.toFixed(1)}%</p>
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
}

export function renderWarDetail(warData) {
    const container = document.getElementById('warResults');
    const totalPossibleAttacks = warData.teamSize * warData.attacksPerMember;
    
    const clanStars = warData.clan.stars;
    const opponentStars = warData.opponent.stars;

    const clanScoreColor = clanStars > opponentStars ? "text-green-500" : (clanStars < opponentStars ? "text-red-500" : "gold");
    const opponentScoreColor = opponentStars > clanStars ? "text-green-500" : (opponentStars < clanStars ? "text-red-500" : "gold");

    document.getElementById('clanNameDetail').innerText = warData.clan.name;
    const totalStarsEl = document.getElementById('totalStars');
    totalStarsEl.innerText = clanStars;
    totalStarsEl.className = `text-xl font-bold ${clanScoreColor}`;
    
    document.getElementById('totalDestruction').innerText = warData.clan.destructionPercentage.toFixed(1) + "%";
    document.getElementById('clanAttacks').innerText = `${warData.clan.attacks || 0}/${totalPossibleAttacks} Attacks`;
    
    document.getElementById('opponentNameDetail').innerText = warData.opponent.name;
    const opponentStarsEl = document.getElementById('opponentStars');
    opponentStarsEl.innerText = opponentStars;
    opponentStarsEl.className = `text-xl font-bold ${opponentScoreColor}`;

    document.getElementById('opponentDestruction').innerText = warData.opponent.destructionPercentage.toFixed(1) + "%";
    document.getElementById('opponentAttacks').innerText = `${warData.opponent.attacks || 0}/${totalPossibleAttacks} Attacks`;

    const opponentMap = {};
    warData.opponent.members.forEach(m => opponentMap[m.tag] = { 
        pos: m.mapPosition, 
        th: m.townhallLevel || m.townHallLevel, 
        name: m.name 
    });

    // Defensive Map for Clan Members (who attacked them?)
    const clanDefenses = {};
    warData.opponent.members.forEach(opp => {
        if (opp.attacks) {
            opp.attacks.forEach(atk => {
                if (!clanDefenses[atk.defenderTag]) clanDefenses[atk.defenderTag] = [];
                clanDefenses[atk.defenderTag].push({ ...atk, attackerTag: opp.tag });
            });
        }
    });

    const sortedClanMembers = warData.clan.members.sort((a, b) => a.mapPosition - b.mapPosition);

    container.innerHTML = sortedClanMembers.map(m => {
        const th = m.townhallLevel || m.townHallLevel || "?";
        const defs = clanDefenses[m.tag] || [];
        
        return `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-[#252525] rounded-xl border border-gray-800 items-center">
            <!-- Member Info -->
            <div class="lg:col-span-3 flex items-center gap-3">
                <span class="text-xs font-mono text-gray-600">#${m.mapPosition}</span>
                <img src="${getTHImage(th)}" class="w-10 h-10">
                <div class="min-w-0">
                    <p class="font-bold text-sm text-white truncate">${m.name}</p>
                    <p class="text-[10px] gold font-bold uppercase tracking-tighter">TH${th}</p>
                </div>
            </div>

            <!-- Attacks -->
            <div class="lg:col-span-4 grid grid-cols-1 gap-2">
                <p class="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Attacks</p>
                ${renderAtkSmall(m.attacks ? m.attacks[0] : null, opponentMap, false)}
                ${renderAtkSmall(m.attacks && m.attacks[1] ? m.attacks[1] : null, opponentMap, false)}
            </div>

            <!-- VS Divider -->
            <div class="hidden lg:flex lg:col-span-1 justify-center items-center h-full">
                <div class="w-[1px] h-8 bg-gray-800"></div>
            </div>

            <!-- Defenses -->
            <div class="lg:col-span-4 grid grid-cols-1 gap-2">
                <p class="text-[8px] font-black text-gray-500 uppercase tracking-widest pl-1">Defenses</p>
                ${renderAtkSmall(defs[0] || null, opponentMap, true)}
                ${renderAtkSmall(defs[1] || null, opponentMap, true)}
            </div>
        </div>`;
    }).join('');
}
