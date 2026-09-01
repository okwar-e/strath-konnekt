# Strath Konnekt

Random anonymous chat app for verified Strathmore University students.

> Verify → Start Chat → Get matched → Chat → Next.

## Monorepo structure

- `client/` — React + Vite + TypeScript
- `server/` — Node.js + Express + TypeScript + Prisma + Socket.IO

## Stack

- Frontend: React, Vite, TypeScript, React Router
- Backend: Express, TypeScript, Socket.IO
- Database: PostgreSQL via Prisma
- Auth: Firebase Email Link Authentication (restricted to `@strathmore.edu`)

## Getting started

### Server

```powershell
cd server
npm install
copy .env.example .env   # fill in DATABASE_URL and Firebase Admin credentials
npx prisma migrate deploy
npm run dev               # http://localhost:4000
```

### Client

```powershell
cd client
npm install
copy .env.example .env   # fill in Firebase web config
npm run dev               # http://localhost:5173
```

## Features implemented

- Firebase email-link login restricted to `@strathmore.edu`
- Random matchmaking queue with FIFO ordering and skip-cooldown
- Anonymous, ephemeral text chat (no message persistence)
- Reporting with strike/ban thresholds
- Basic abuse protection: message rate limiting and sanitization
