import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("COC_API_TOKEN")
RAW_TAG = os.getenv("CLAN_TAG")

if RAW_TAG is None:
    print("ERROR: CLAN_TAG not found.")
    exit()

CLAN_TAG = RAW_TAG.replace("#", "%23")
BASE_URL = "https://cocproxy.royaleapi.dev/v1"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json"
}

def fetch_data():
    os.makedirs('data/wars', exist_ok=True)
    
    # 1. ALWAYS Fetch Member/Clan Data (Updates clan_data.json every 20 mins)
    clan_res = requests.get(f"{BASE_URL}/clans/{CLAN_TAG}", headers=headers)
    if clan_res.status_code == 200:
        with open('data/clan_data.json', 'w') as f:
            json.dump(clan_res.json(), f, indent=4)
        print("Updated clan_data.json")

    # 2. Fetch War Performance
    war_res = requests.get(f"{BASE_URL}/clans/{CLAN_TAG}/currentwar", headers=headers)
    if war_res.status_code == 200:
        war_data = war_res.json()
        
        # Check if we are in a war or in "War Ended" state
        if war_data.get('state') != 'notInWar':
            war_id = war_data.get('startTime')
            filename = f"war_{war_id}.json"
            
            # Save individual war file
            with open(f'data/wars/{filename}', 'w') as f:
                json.dump(war_data, f, indent=4)
            
            # ALWAYS update/check the index if we have war data
            index_path = 'data/war_index.json'
            index = []
            if os.path.exists(index_path):
                with open(index_path, 'r') as f:
                    index = json.load(f)
            
            if filename not in index:
                index.append(filename)
                with open(index_path, 'w') as f:
                    json.dump(index, f, indent=4)
                print(f"Added {filename} to index.")

if __name__ == "__main__":
    fetch_data()
