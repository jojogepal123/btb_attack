# BTB Attack — Security Learning Simulator

## Project Structure

```
btb_attack/
├── backend/
│   ├── main.py              # FastAPI async server
│   ├── .env                 # Backend environment variables
│   └── .env.example         # Backend env template
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionButton.jsx   # Reusable button w/ loading state
│   │   │   ├── Dashboard.jsx      # Main layout (header + buttons + terminal)
│   │   │   └── TerminalOutput.jsx # Scrollable terminal log viewer
│   │   ├── hooks/
│   │   │   └── useAsyncAction.js  # Custom hook for API state management
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── .env                 # Frontend environment variables
│   ├── .env.example         # Frontend env template
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VPS_IP` | `127.0.0.1` | Your VPS IP address |
| `DOCKER_HOST` | _(empty)_ | Remote Docker socket e.g. `tcp://<ip>:2375` |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins |
| `FIREFOX_UI_PORT` | `5800` | Firefox web UI port |
| `FIREFOX_VNC_PORT` | `5900` | Firefox VNC port |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | Backend URL (`/api` uses Vite proxy in dev) |
| `VITE_VPS_IP` | `127.0.0.1` | Shown in the dashboard header |

## Setup & Run

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install fastapi uvicorn python-dotenv
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### 2. Frontend (React + Vite)

In a **separate terminal**:

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:3000`.

## Adding More Buttons

1. Add a new entry to `COMMANDS` in `backend/main.py` and a new `@app.get("/api/...")` endpoint.
2. Add a new entry to the `BUTTONS` array in `frontend/src/components/Dashboard.jsx`.
3. Store any secrets or addresses in `backend/.env` and access via `os.getenv()`.
