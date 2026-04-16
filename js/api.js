export async function fetchClanData() {
    const indexRes = await fetch('data/clan_stats_index.json');
    if (!indexRes.ok) throw new Error("Failed to fetch clan index");
    const index = await indexRes.json();
    if (!index || index.length === 0) throw new Error("Clan index is empty");
    
    const latestFile = index[0];
    const res = await fetch(`data/clan_stats/${latestFile}`);
    if (!res.ok) throw new Error(`Failed to fetch latest clan data: ${latestFile}`);
    return await res.json();
}

export async function fetchMembersIndex() {
    const res = await fetch('data/clan_stats_index.json');
    if (!res.ok) return [];
    return await res.json();
}

export async function fetchHistoricalMembers(filename) {
    const res = await fetch(`data/clan_stats/${filename}`);
    if (!res.ok) throw new Error("Failed to fetch historical member data");
    return await res.json();
}

export async function fetchWarIndex() {
    const res = await fetch('data/war_stats_index.json');
    if (!res.ok) return [];
    return await res.json();
}

export async function fetchWarData(filename) {
    const res = await fetch(`data/war_stats/${filename}`);
    if (!res.ok) throw new Error("Failed to fetch war data");
    return await res.json();
}
