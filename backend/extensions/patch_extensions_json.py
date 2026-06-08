#!/usr/bin/env python3
"""Manually register addons in extensions.json so Firefox loads them.

Firefox 145+ ignores sideloaded XPIs in profile/extensions/ and doesn't
support force-installing unsigned extensions via policies.json.
This script patches extensions.json to register the addons directly.
"""
import glob
import json
import os
import time
import zipfile

ADDON_DIR = "/opt/addons"
PROFILE = "/config/profile"
EXT_JSON = os.path.join(PROFILE, "extensions.json")

settings = {}
for xpi_path in glob.glob(os.path.join(ADDON_DIR, "*.xpi")):
    try:
        with zipfile.ZipFile(xpi_path) as z:
            m = json.load(z.open("manifest.json"))
            guid = m.get("browser_specific_settings", {}).get("gecko", {}).get("id", "")
            name = m.get("name", "Unknown")
            version = m.get("version", "0.0")
            perms = m.get("permissions", [])
            manifest_version = m.get("manifest_version", 2)

            if not guid:
                continue

            ext_id = guid
            # Copy XPI into profile extensions dir
            dest = os.path.join(PROFILE, "extensions", guid + ".xpi")
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if not os.path.exists(dest):
                import shutil
                shutil.copy2(xpi_path, dest)

            settings[guid] = {
                "id": guid,
                "name": name,
                "version": version,
                "manifestVersion": manifest_version,
                "type": "extension",
                "loader": None,
                "updateURL": None,
                "installOrigins": None,
                "optionsURL": None,
                "optionsType": None,
                "optionsBrowserStyle": True,
                "aboutURL": None,
                "defaultLocale": {"name": name},
                "visible": True,
                "active": True,
                "userDisabled": False,
                "appDisabled": False,
                "embedderDisabled": False,
                "installDate": int(time.time() * 1000),
                "applyBackgroundUpdates": 0,
                "path": "extensions/" + guid + ".xpi",
                "skinnable": False,
                "sourceURI": "file://" + dest,
                "releaseNotesURI": None,
                "softDisabled": False,
                "foreignInstall": True,
                "strictCompatibility": False,
                "locales": [],
                "targetApplications": [{"id": "toolkit@mozilla.org", "minVersion": None, "maxVersion": None}],
                "targetPlatforms": [],
                "signedState": 2,
                "signedDate": None,
                "seen": True,
                "dependencies": [],
                "userPermissions": {"permissions": perms, "origins": [], "data_collection": []},
                "optionalPermissions": {"permissions": [], "origins": [], "data_collection": []},
                "requestedPermissions": {"permissions": [], "origins": [], "data_collection": []},
                "icons": {},
                "iconURL": None,
                "blocklistAttentionDismissed": False,
                "blocklistState": 0,
                "blocklistURL": None,
                "startupData": None,
                "hidden": False,
                "installTelemetryInfo": {"source": "sideload", "method": "file"},
                "recommendationState": None,
                "rootURI": "jar:file://" + dest + "!/",
                "location": "app-profile",
            }
            print("  registered: " + name + " (" + guid + ")")

    except Exception as e:
        print("  SKIP " + xpi_path + ": " + str(e))

if settings:
    # Load existing extensions.json or create new
    existing_addons = []
    if os.path.exists(EXT_JSON):
        try:
            with open(EXT_JSON) as f:
                data = json.load(f)
                existing_addons = data.get("addons", [])
        except Exception:
            pass

    # Merge: keep existing built-in addons, add ours
    existing_ids = {a["id"] for a in existing_addons}
    for guid, entry in settings.items():
        if guid not in existing_ids:
            existing_addons.append(entry)

    schema_version = 37
    if os.path.exists(EXT_JSON):
        try:
            with open(EXT_JSON) as f:
                schema_version = json.load(f).get("schemaVersion", 37)
        except Exception:
            pass

    result = {"schemaVersion": schema_version, "addons": existing_addons}
    with open(EXT_JSON, "w") as f:
        json.dump(result, f, indent=2)
    print("wrote " + EXT_JSON + " with " + str(len(existing_addons)) + " addons total")
else:
    print("no addons found to register")
