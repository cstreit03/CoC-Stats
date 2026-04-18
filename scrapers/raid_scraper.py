import requests
import json
import os
from config import BASE_URL, CLAN_TAG, HEADERS

def update_raid_data():
    """
    Fetches the capital raid log and saves each weekend as a separate JSON file.
    Updates the raid_stats_index.json to keep track of available data.
    """
    # Ensure the data directory exists (assumes running from project root)
    os.makedirs('data/raid_stats', exist_ok=True)
    
    # Endpoint for capital raid seasons (limit to 1 to ensure full detailed data)
    url = f"{BASE_URL}/clans/{CLAN_TAG}/capitalraidseasons?limit=1"
    print(f"Fetching latest raid data from {url}...")
    res = requests.get(url, headers=HEADERS)
    
    if res.status_code == 200:
        data = res.json()
        items = data.get('items', [])
        
        # Load existing index
        index_path = 'data/raid_stats_index.json'
        index = []
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                try:
                    index = json.load(f)
                except:
                    index = []

        new_count = 0
        updated_count = 0
        
        # capitalraidlog returns newest first. 
        # We process them all to ensure we have history and update the current ongoing raid.
        for raid in items:
            start_time = raid.get('startTime')
            if not start_time:
                continue
                
            filename = f"raid_{start_time}.json"
            file_path = os.path.join('data/raid_stats', filename)
            
            # Check if we should save/update
            # We always save if it's "ongoing" to get latest stats, or if it doesn't exist yet.
            state = raid.get('state', 'ended')
            should_save = not os.path.exists(file_path) or state == 'ongoing'
            
            if should_save:
                with open(file_path, 'w') as f:
                    json.dump(raid, f, indent=4)
                
                if filename not in index:
                    index.append(filename)
                    new_count += 1
                else:
                    updated_count += 1

        if new_count > 0 or updated_count > 0:
            # Sort index so oldest is first (matching app.js .reverse() logic)
            index.sort() 
            with open(index_path, 'w') as f:
                json.dump(index, f, indent=4)
            print(f"Raid update complete. New: {new_count}, Updated: {updated_count}")
        else:
            print("No new or ongoing raids found.")
            
    else:
        print(f"Failed to fetch raid data: {res.status_code}")

if __name__ == "__main__":
    update_raid_data()
