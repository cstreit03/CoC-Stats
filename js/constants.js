export const roleMap = { 
    "leader": "Leader", 
    "coLeader": "Co-Leader", 
    "admin": "Elder", 
    "member": "Member" 
};

export const roleWeight = { 
    "leader": 4, 
    "coLeader": 3, 
    "admin": 2, 
    "member": 1 
};

export const getTHImage = (lv) => `assets/Town_Hall${lv}.webp`;

export function parseCoCDate(dateStr) {
    if (!dateStr) return null;
    // Format: 20260415T020302.000Z
    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const sec = dateStr.substring(13, 15);
    return new Date(Date.UTC(year, month, day, hour, min, sec));
}
