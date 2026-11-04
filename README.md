# Mounadev Communication Hub

Multi-channel communication platform for AI agents (Hermes). Allows AI employees to autonomously send and receive customer communications through WhatsApp, with future support for SMS and email.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase and OpenWA credentials
```

### 3. Run database migration
Copy `supabase/migrations/001_initial_schema.sql` and run it in your Supabase Dashboard SQL Editor.

### 4. Seed agent API keys
```bash
npx ts-node scripts/seed-agents.ts
```
This generates API keys for all 15 agents and saves them to `agent-api-keys.json`.

### 5. Start the server
```bash
npm run dev    # Development (with hot reload)
npm run build && npm start  # Production
```

### 6. Test
```bash
curl http://localhost:3001/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /api/v1/contacts | Search contacts |
| POST | /api/v1/contacts | Create contact |
| GET | /api/v1/contacts/:id | Get contact |
| PATCH | /api/v1/contacts/:id | Update contact |
| POST | /api/v1/contacts/:id/opt-out | Mark opted out |
| GET | /api/v1/conversations | List conversations |
| GET | /api/v1/conversations/:id | Get conversation + messages |
| POST | /api/v1/conversations | Create conversation |
| POST | /api/v1/messages/send | Send message |
| POST | /api/v1/messages/send-template | Send template |
| GET | /api/v1/messages/:id/status | Message status |
| GET | /api/v1/templates | List templates |
| POST | /api/v1/templates | Create template |
| GET/POST | /api/v1/webhooks/whatsapp | Webhook handler |
| GET | /api/v1/audit | Audit log |
| GET | /api/v1/admin/status | System status |
| POST | /api/v1/admin/pause-outbound | Pause outbound |
| POST | /api/v1/admin/resume-outbound | Resume outbound |

## Authentication

All API requests require `X-Agent-Key` header with the agent's API key.

## Architecture

- **REST API** (source of truth) + **MCP** (thin wrapper)
- **Channel Adapter** pattern (OpenWA now, Meta Cloud API later)
- **Provider-agnostic** — switch WhatsApp providers without changing business logic

## Tech Stack

- Node.js + TypeScript + Express
- Supabase (PostgreSQL)
- OpenWA (WhatsApp Gateway)
- Vercel (deployment)