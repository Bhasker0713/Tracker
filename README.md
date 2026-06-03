# ResTrack — Resource Utilization Tool

A full-featured resource utilization platform with live **Jira Cloud integration**.
Built with React + Vite, deployed on Vercel (serverless functions handle Jira auth + CORS).

---

## Features

- **Dashboard** — Utilization %, project health, team capacity at a glance
- **Projects** — Create projects, expand to see tasks, sync directly from Jira
- **Resources** — Per-person capacity cards + allocation matrix
- **Timesheets** — Log hours; optionally write worklogs back to Jira in one click
- **Leaves** — Apply + approve/reject leave requests with balance tracker
- **Reports** — Utilization vs Allocated charts, leave distribution, budget health
- **Jira Integration** — Connect Jira Cloud, sync all projects + issues, log work bi-directionally
- **Admin Panel** — User management, role permissions, system settings

---

## Deploy in 5 minutes (Vercel)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create restrack --public --push
```

### 2. Import to Vercel

1. Go to **vercel.com/new**
2. Import your GitHub repo
3. Framework preset: **Vite**
4. Click **Deploy** — that's it!

Vercel auto-detects Vite and deploys the serverless function in `api/jira.js`.

---

## Run locally

```bash
# Install dependencies
npm install

# Install Vercel CLI (needed to run serverless functions locally)
npm install -g vercel

# Start everything (run in two terminals)
vercel dev        # Terminal 1 — starts serverless functions on :3000
npm run dev       # Terminal 2 — starts Vite on :5173
```

Then open **http://localhost:5173**

---

## Connect Jira

1. Open the app → **Jira Integration** in the sidebar
2. Enter your **Atlassian workspace URL** (e.g. `https://yourteam.atlassian.net`)
3. Enter your **account email**
4. Generate an **API Token** at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
5. Click **Connect to Jira** — credentials are verified instantly
6. Click **Sync All Projects & Issues** — imports everything

### What syncs

| Jira               | ResTrack          | Direction          |
|--------------------|-------------------|--------------------|
| Epic / Project     | Project           | Jira → ResTrack    |
| Issue / Story      | Task              | Jira → ResTrack    |
| Story Points       | Estimated Hours   | Jira → ResTrack    |
| Time Logged        | Logged Hours      | ↔ Both             |
| Assignee           | Resource          | Jira → ResTrack    |
| Status             | Task Status       | Jira → ResTrack    |

### Logging hours back to Jira

In **Timesheets**, check **"Also log worklog to Jira"** before submitting. ResTrack will call the Jira Worklog API and confirm with a blue **✓ Jira** badge on the log entry.

---

## Architecture

```
Browser (React + Vite)
    │
    │  /api/jira  (fetch with X-Jira-* headers)
    ▼
Vercel Serverless Function  (api/jira.js)
    │  Adds Authorization: Basic header
    │  Handles CORS
    ▼
Atlassian Jira Cloud REST API v3
```

Jira credentials are stored in the browser's `localStorage` (suitable for internal tools).
For a multi-tenant production deployment, move credentials to server-side environment variables.

---

## Project Structure

```
restrack/
├── api/
│   └── jira.js          ← Vercel serverless Jira proxy
├── src/
│   ├── main.jsx          ← React entry point
│   ├── App.jsx           ← Full application
│   └── services/
│       └── jira.js       ← JiraService class + helpers
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

---

## Jira API Rate Limits

Atlassian enforces rate limits on their REST API. ResTrack syncs the first 5 projects on initial sync to stay within limits. For larger workspaces, sync individual projects using the **↻ Sync** button on each project card.

---

## License

MIT
