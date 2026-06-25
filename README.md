# 📚 Lese-Sprint Discord Bot — Setup Guide

## What goes in your `.env` file

Create a file called `.env` in the root of the project with these values:

```
DISCORD_TOKEN=        ← Your bot token from Discord Developer Portal
CLIENT_ID=            ← Your Application ID from Discord Developer Portal
SPRINT_CHANNEL_ID=    ← The ID of the channel where the bot should post
DATABASE_URL=         ← Your PostgreSQL connection string from Render
```

---

## Step 1 — Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** → click **Add Bot**
4. Under **Token** → click **Reset Token** → copy it → paste into `DISCORD_TOKEN` in `.env`
5. Under **Privileged Gateway Intents** → enable **Server Members Intent**
6. Go to **OAuth2 → URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Mention Everyone`, `Read Message History`
7. Copy the generated URL → open it → add the bot to your server

---

## Step 2 — Render PostgreSQL

1. Log in to https://render.com
2. Click **New +** → **PostgreSQL**
3. Give it a name, choose the free tier → **Create Database**
4. Copy the **External Database URL** → paste into `DATABASE_URL` in your `.env`

---

## Step 3 — Render Web Service (hosting the bot)

1. Push this project to a GitHub repository
2. On Render → Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables** → add all 4 values from your `.env`
6. Click **Create Web Service**

---

## Step 4 — UptimeRobot (keep the bot alive)

> Render free tier shuts down after inactivity. UptimeRobot prevents this.

1. Go to https://uptimerobot.com → create a free account
2. Click **Add New Monitor**
   - Type: **HTTP(s)**
   - URL: your Render web service URL (e.g. `https://your-bot.onrender.com`)
   - Interval: every 5 minutes
3. Save — UptimeRobot will now ping Render every 5 min to keep it awake

> Note: You need to add a simple HTTP endpoint to the bot for UptimeRobot to ping.
> Add this to `src/index.js` at the bottom:
> ```js
> const http = require('http');
> http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 3000);
> ```

---

## How the bot works

| Button | Who | What it does |
|---|---|---|
| 📅 Schedule Sprint | Admin | Opens a form to set date + start/end time |
| ▶️ Start Now | Admin | Starts a sprint immediately |
| ⏹️ End Sprint | Admin | Ends the running sprint |
| 📖 Join Sprint | User | Opens form to enter book + starting page |
| ✏️ Edit / Leave | User | Update progress, switch books, or leave |
| ⏸️ Pause | User | Pauses your personal timer |

---

## Project structure

```
bot/
├── src/
│   ├── index.js              ← Bot entry point
│   ├── events/
│   │   ├── ready.js          ← Sends admin panel on startup
│   │   └── interactionCreate.js ← Handles all buttons + modals
│   ├── utils/
│   │   ├── sprintManager.js  ← All sprint logic
│   │   └── leaderboard.js    ← Image generation
│   └── db/
│       └── database.js       ← PostgreSQL setup + queries
├── assets/
│   ├── wreath.png
│   ├── book.png
│   └── fonts/
│       └── Halimun-W7jn.ttf
├── .env                      ← Your secrets (never commit this!)
├── .env.example              ← Template
└── package.json
```
