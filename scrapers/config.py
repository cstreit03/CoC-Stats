import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("COC_API_TOKEN")
RAW_TAG = os.getenv("CLAN_TAG")

if RAW_TAG is None:
    raise ValueError("ERROR: CLAN_TAG not found.")

CLAN_TAG = RAW_TAG.replace("#", "%23")
BASE_URL = "https://cocproxy.royaleapi.dev/v1"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/json"
}
