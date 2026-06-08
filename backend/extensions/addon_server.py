#!/usr/bin/env python3
"""Tiny HTTP server to serve addon XPIs for Firefox policy installation.

Runs as a s6 service before Firefox starts. Serves files from /opt/addons
on localhost:19999. Firefox policies use http://localhost:19999/ to fetch them.
Firefox kills this server after installing addons on first run.
"""
import http.server
import os
import signal
import sys
import threading
import time

PORT = 19999
DIR = "/opt/addons"
TIMEOUT = 120  # seconds — shut down after this

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def log_message(self, fmt, *args):
        pass  # silent

def shutdown_timer():
    time.sleep(TIMEOUT)
    os._exit(0)

if __name__ == "__main__":
    t = threading.Thread(target=shutdown_timer, daemon=True)
    t.start()
    srv = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    print("[addon-server] listening on http://127.0.0.1:" + str(PORT))
    srv.serve_forever()
