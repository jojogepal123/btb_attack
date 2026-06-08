import urllib.request, urllib.error
for p in ["/json", "/json/list", "/json/version", "/json/protocol"]:
    try:
        with urllib.request.urlopen(f"http://localhost:9222{p}", timeout=3) as r:
            data = r.read().decode("utf-8", errors="replace")
            print(f"--- GET {p} -> {r.status} ---")
            print(data[:500])
    except urllib.error.HTTPError as e:
        print(f"--- GET {p} -> {e.code} ---")
    except Exception as e:
        print(f"--- GET {p} -> ERR {e} ---")
