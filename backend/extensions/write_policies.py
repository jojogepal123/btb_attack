#!/usr/bin/env python3
"""Write Firefox distribution/policies.json to force-install addons via local HTTP."""
import glob
import json
import os
import zipfile

ADDON_DIR = "/opt/addons"
POLICIES_DIR = "/usr/lib/firefox/distribution"
POLICIES_FILE = os.path.join(POLICIES_DIR, "policies.json")
BASE_URL = "http://localhost:19999"

settings = {}
for xpi_path in glob.glob(os.path.join(ADDON_DIR, "*.xpi")):
    try:
        with zipfile.ZipFile(xpi_path) as z:
            m = json.load(z.open("manifest.json"))
            guid = m.get("browser_specific_settings", {}).get("gecko", {}).get("id", "")
            if guid:
                filename = os.path.basename(xpi_path)
                settings[guid] = {
                    "installation_mode": "force_installed",
                    "install_url": BASE_URL + "/" + filename,
                }
                print("  " + guid + " -> " + BASE_URL + "/" + filename)
    except Exception as e:
        print("  SKIP " + xpi_path + ": " + str(e))

policies = {"policies": {"ExtensionSettings": settings}}
os.makedirs(POLICIES_DIR, exist_ok=True)
with open(POLICIES_FILE, "w") as f:
    json.dump(policies, f, indent=2)
print("wrote " + POLICIES_FILE + " with " + str(len(settings)) + " addons")
