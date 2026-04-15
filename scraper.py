import requests
import os
import json
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

TOKEN = os.getenv("COC_API_TOKEN")
CLAN_TAG = os.getenv("CLAN_TAG").replace("#", "%23")
BASE_URL = "https://cocproxy.royaleapi.dev/v1"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json"
}

def fetch_data():
    # Ensure data directory structure exists
    os.makedirs('data/wars', exist_ok=True)
    
    # 1. Fetch Current Member/Clan Data
    clan_res = requests.get(f"{BASE_URL}/clans/{CLAN_TAG}", headers=headers)
    if clan_res.status_code == 200:
        with open('data/clan_data.json', 'w') as f:
            json.dump(clan_res.json(), f, indent=4)
    
    # 2. Fetch War Performance
    war_res = requests.get(f"{BASE_URL}/clans/{CLAN_TAG}/currentwar", headers=headers)
    if war_res.status_code == 200:
        war_data = war_res.json()
        
        # Only process if actually in a war
        if war_data.get('state') != 'notInWar':
            war_id = war_data.get('startTime')
            filename = f"war_{war_id}.json"
            
            # Save individual war file
            with open(f'data/wars/{filename}', 'w') as f:
                json.dump(war_data, f, indent=4)
            
            # Update the historical index
            index_path = 'data/war_index.json'
            index = []
            if os.path.exists(index_path):
                with open(index_path, 'r') as f:
                    index = json.load(f)
            
            if filename not in index:
                index.append(filename)
                with open(index_path, 'w') as f:
                    json.dump(index, f, indent=4)

if __name__ == "__main__":
    fetch_data()