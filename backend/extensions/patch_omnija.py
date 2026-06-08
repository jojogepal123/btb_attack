#!/usr/bin/env python3
"""Patch Firefox omni.ja to disable extension signing enforcement.

Firefox release builds have MOZ_REQUIRE_SIGNING compiled in, which
force-sets xpinstall.signatures.required=true at startup. This script
patches omni.ja to set MOZ_REQUIRE_SIGNING to false and patches the
sign-checking functions to allow unsigned extensions.

Based on: https://github.com/TheBrokenRail/jailbreak-firefox
"""
import os
import shutil
import subprocess
import tempfile

OMNIJA = "/usr/lib/firefox/omni.ja"
BACKUP = OMNIJA + ".bak"

def patch_omnija():
    """Extract omni.ja, patch files, repack."""
    if not os.path.isfile(OMNIJA):
        print("omni.ja not found at " + OMNIJA)
        return False

    shutil.copy2(OMNIJA, BACKUP)

    with tempfile.TemporaryDirectory() as tmpdir:
        extract_dir = os.path.join(tmpdir, "extracted")
        os.makedirs(extract_dir)
        subprocess.run(["unzip", "-q", "-o", OMNIJA, "-d", extract_dir],
                       capture_output=True, timeout=60)

        patched_files = []

        # Patch 1: AppConstants - disable MOZ_REQUIRE_SIGNING
        # Firefox 108+: AppConstants.jsm renamed to AppConstants.sys.mjs
        # Firefox 136+: format changed from multiline to single line:
        #   MOZ_REQUIRE_SIGNING: true,
        for ac_path in [
            os.path.join(extract_dir, "modules", "AppConstants.sys.mjs"),
            os.path.join(extract_dir, "modules", "AppConstants.jsm"),
        ]:
            if not os.path.isfile(ac_path):
                continue
            with open(ac_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            original = content
            # Firefox 136+ single-line format
            content = content.replace(
                "MOZ_REQUIRE_SIGNING: true,",
                "MOZ_REQUIRE_SIGNING: false, _old_require_signing: true,"
            )
            # Older multiline format (pre-136)
            content = content.replace(
                "MOZ_REQUIRE_SIGNING:\n//@line",
                "MOZ_REQUIRE_SIGNING: false, _old:\n//@line"
            )
            # Also handle the format where MOZ_REQUIRE_SIGNING appears alone on a line
            content = content.replace(
                "MOZ_REQUIRE_SIGNING:\n true,",
                "MOZ_REQUIRE_SIGNING:\n false,"
            )

            if content != original:
                with open(ac_path, "w", encoding="utf-8") as f:
                    f.write(content)
                patched_files.append(os.path.relpath(ac_path, extract_dir))

        # Patch 2: XPIDatabase - patch mustSign and SIGNED_TYPES
        for db_path in [
            os.path.join(extract_dir, "modules", "addons", "XPIDatabase.sys.mjs"),
            os.path.join(extract_dir, "modules", "addons", "XPIDatabase.jsm"),
        ]:
            if not os.path.isfile(db_path):
                continue
            with open(db_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            original = content
            # Patch mustSign to always return false
            content = content.replace(
                "mustSign(aType) {",
                "mustSign(aType) { return false; /* patched */"
            )
            # Comment out "extension" in SIGNED_TYPES
            content = content.replace(
                '"extension",\n',
                '/* "extension", */ /* patched */\n'
            )
            content = content.replace(
                '"extension",\r\n',
                '/* "extension", */ /* patched */\r\n'
            )

            if content != original:
                with open(db_path, "w", encoding="utf-8") as f:
                    f.write(content)
                patched_files.append(os.path.relpath(db_path, extract_dir))

        if not patched_files:
            print("WARNING: no files patched. Signing enforcement may be unchanged.")
            shutil.copy2(BACKUP, OMNIJA)
            return False

        for pf in patched_files:
            print("  patched: " + pf)

        # Repack omni.ja using zip -0DXqr (store, no compression, fast)
        # Firefox expects this specific repack format
        os.remove(OMNIJA)
        repack_dir = os.path.join(tmpdir, "repack")
        shutil.copytree(extract_dir, repack_dir)
        subprocess.run(
            ["zip", "-0DXqr", OMNIJA, "."],
            cwd=repack_dir,
            capture_output=True,
            timeout=60
        )

        print("omni.ja repacked with " + str(len(patched_files)) + " patched files")
        return True

if __name__ == "__main__":
    if patch_omnija():
        print("SUCCESS: Firefox signing enforcement disabled")
    else:
        print("FAILED: could not patch omni.ja")
