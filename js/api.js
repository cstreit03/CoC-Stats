export async function fetchClanData() {
    const indexRes = await fetch('data/clan_stats_index.json');
    if (!indexRes.ok) throw new Error("Failed to fetch clan index");
    const index = await indexRes.json();
    if (!index || index.length === 0) throw new Error("Clan index is empty");
    
    // Try each file in the index until one works
    for (const filename of index) {
        try {
            const res = await fetch(`data/clan_stats/${filename}`);
            if (res.ok) {
                const data = await res.json();
                return data;
            }
        } catch (e) {
            console.warn(`Could not load indexed file: ${filename}, trying next...`);
        }
    }
    
    throw new Error("No available clan data files found in index.");
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
