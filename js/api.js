export async function fetchClanData() {
    const res = await fetch('data/clan_stats/clan_data.json');
    if (!res.ok) throw new Error("Failed to fetch clan data");
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
