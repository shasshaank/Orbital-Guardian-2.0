"""
TLE Data Fetcher for Orbital Guardian.

Fetches Two-Line Element (TLE) orbital data from the Celestrak API.
"""

import os
import json
import requests
from pathlib import Path
from typing import Optional

# Path to local cache and fallback data
DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "tle_cache.json"
FALLBACK_FILE = DATA_DIR / "satellites_fallback.json"


# Primary sources for TLE data
SOURCES = [
    "https://celestrak.org/NORAD/elements/active.txt",
    "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
    "https://www.celestrak.com/NORAD/elements/active.txt",
]

def fetch_tle_data(group: str = "active", fmt: str = "tle") -> list[dict]:
    """
    Fetch TLE data from multiple Celestrak sources with caching and fallback.
    """
    print(f"📡 Orbital Guardian: Attempting to sync satellite fleet...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    }
    
    # 1. Try each source in order
    for url in SOURCES:
        try:
            # If the URL is already specific to a group, use it as is, otherwise add params
            target_url = url
            if "gp.php" in url and "GROUP=" not in url:
                target_url = f"{url}?GROUP={group}&FORMAT={fmt}"
            
            response = requests.get(target_url, headers=headers, timeout=20, verify=False)
            response.raise_for_status()
            
            text = response.text
            if "1 " in text and "2 " in text:
                lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
                satellites = []
                for i in range(0, len(lines) - 2, 3):
                    if lines[i+1].startswith("1 ") and lines[i+2].startswith("2 "):
                        satellites.append({
                            "name": lines[i],
                            "line1": lines[i+1],
                            "line2": lines[i+2],
                        })
                
                if satellites:
                    # Update cache
                    DATA_DIR.mkdir(exist_ok=True)
                    with open(CACHE_FILE, "w") as f:
                        json.dump(satellites, f)
                    return satellites
        except Exception as e:
            print(f"❌ Failed to fetch from {url}: {e}")
            continue

    # 2. If all sources failed, try cache
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except:
            pass

    # 3. If cache failed, try fallback
    if FALLBACK_FILE.exists():
        try:
            with open(FALLBACK_FILE, "r") as f:
                return json.load(f)
        except:
            pass

    return []

def fetch_tle_by_catnr(catnr: int) -> Optional[dict]:
    """
    Fetch TLE data for a single satellite by its NORAD catalog number.
    """
    headers = {"User-Agent": "Mozilla/5.0"}
    url = f"https://celestrak.org/NORAD/elements/gp.php?CATNR={catnr}&FORMAT=tle"
    try:
        response = requests.get(url, headers=headers, timeout=10, verify=False)
        if response.status_code == 200:
            lines = [l.strip() for l in response.text.strip().splitlines() if l.strip()]
            if len(lines) >= 3 and lines[1].startswith("1 "):
                return {"name": lines[0], "line1": lines[1], "line2": lines[2]}
    except:
        pass
    
    # Fallback to local search
    all_sats = fetch_tle_data()
    # Simple check: catnr is in the first 5 chars of line 1
    catnr_str = f"{catnr:05d}"
    for sat in all_sats:
        if catnr_str in sat["line1"]:
            return sat
            
    return None