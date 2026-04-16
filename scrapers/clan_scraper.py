import requests
import json
import os
from datetime import datetime
from config import BASE_URL, CLAN_TAG, HEADERS

def update_clan_data():
    os.makedirs('data/clan_stats', exist_ok=True)
    url = f"{BASE_URL}/clans/{CLAN_TAG}"
    res = requests.get(url, headers=HEADERS)
    
    if res.status_code == 200:
        clan_data = res.json()
        
        # 1. Update the 'current' file (legacy support and current view)
        current_path = 'data/clan_stats/clan_data.json'
        with open(current_path, 'w') as f:
            json.dump(clan_data, f, indent=4)
        print(f"Updated {current_path}")
        
        # 2. Save daily snapshot
        today = datetime.now().strftime('%Y%m%d')
        filename = f"members_{today}.json"
        snapshot_path = os.path.join('data/clan_stats', filename)
        
        with open(snapshot_path, 'w') as f:
            json.dump(clan_data, f, indent=4)
        print(f"Saved snapshot to {snapshot_path}")
        
        # 3. Update clan_stats_index.json
        index_path = 'data/clan_stats_index.json'
        index = []
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                try:
                    index = json.load(f)
                except:
                    index = []
        
        if filename not in index:
            index.append(filename)
            index.sort(reverse=True) # Newest first
            with open(index_path, 'w') as f:
                json.dump(index, f, indent=4)
            print(f"Added {filename} to clan stats index.")
            
    else:
        print(f"Failed to fetch clan data: {res.status_code}")

if __name__ == "__main__":
    update_clan_data()
