import requests
import json
import os
from config import BASE_URL, CLAN_TAG, HEADERS

def update_war_data():
    os.makedirs('data/war_stats', exist_ok=True)
    url = f"{BASE_URL}/clans/{CLAN_TAG}/currentwar"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        war_data = res.json()
        
        # Check if we are in a war or in "War Ended" state
        if war_data.get('state') != 'notInWar':
            war_id = war_data.get('startTime')
            filename = f"war_{war_id}.json"
            
            # Save individual war file
            file_path = f'data/war_stats/{filename}'
            with open(file_path, 'w') as f:
                json.dump(war_data, f, indent=4)
            
            # Update the index
            index_path = 'data/war_stats_index.json'
            index = []
            if os.path.exists(index_path):
                with open(index_path, 'r') as f:
                    try:
                        index = json.load(f)
                    except json.JSONDecodeError:
                        index = []
            
            if filename not in index:
                index.append(filename)
                with open(index_path, 'w') as f:
                    json.dump(index, f, indent=4)
                print(f"Added {filename} to war stats index.")
            else:
                print(f"Updated {filename}.")
    else:
        print(f"Failed to fetch war data: {res.status_code}")

if __name__ == "__main__":
    update_war_data()
