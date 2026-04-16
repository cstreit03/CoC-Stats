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
