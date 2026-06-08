#!/usr/bin/env python3
"""Patch nifty-keylogger.xpi to add a gecko.id to its manifest."""
import json
import os
import shutil
import zipfile

SRC = "/opt/addons/nifty-keylogger.xpi"
DST = SRC + ".tmp"
# Use a realistic-looking GUID instead of the known test GUID "fake@no-exist.org"
# which Firefox may specifically block
GUID = "{a8f45d2c-7b3e-4e1a-9c6f-2d8e4b7a1f53}"

with zipfile.ZipFile(SRC, "r") as zin, zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "manifest.json":
            m = json.loads(data)
            m.setdefault("browser_specific_settings", {}).setdefault("gecko", {})["id"] = GUID
            data = json.dumps(m, indent=2).encode()
        zout.writestr(item, data)

shutil.move(DST, SRC)
print("patched " + SRC + " with gecko.id=" + GUID)
