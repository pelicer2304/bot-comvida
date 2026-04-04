# Technology Stack — poc-clinic-web

## Languages
- **TypeScript** — Backend APIs (clinic-bot-api, clinic-bot-api-v2), admin UIs, chat UI
- **JavaScript (ESM)** — MCP server (clinicweb-mcp), test scripts, data fetch scripts

## Runtime
- **Node.js** — All services
- **tsx** — TypeScript execution in development (watch mode)

## Core Frameworks & Libraries

### Bot Backend (clinic-bot-api / clinic-bot-api-v2)
| Package | Version | Purpose |
|---------|---------|---------|
| `@langchain/langgraph` | ^1.2.0 | State machine graph for conversation flow |
| `@langchain/langgraph-checkpoint-postgres` | ^1.0.1 | Durable state persistence in PostgreSQL |
| `@langchain/openai` | ^1.2.11 | LLM integration via OpenRouter (ChatOpenAI) |
| `@langchain/anthropic` | ^1.3.21 | Anthropic model support |
| `@langchain/core` | ^1.1.29 | Base message types, tool definitions |
| `express` | ^4.19.2 | HTTP server |
| `fuse.js` | ^7.1.0 | Fuzzy text matching for insurance names |
| `zod` | ^3.23.8 | Schema validation for tool parameters |
| `pg` | ^8.19.0 | PostgreSQL client |
| `jsonwebtoken` | ^9.0.3 | JWT auth for admin API |
| `dotenv` | ^16.4.5 | Environment variable loading |

### MCP Server (clinicweb-mcp)
| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.10.1 | MCP protocol implementation |
| `express` | ^4.19.2 | HTTP transport for MCP |

### Chat UI (chat-ui)
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.5 | React framework |
| `react` / `react-dom` | ^18 | UI library |
| `tailwindcss` | ^3.4.1 | Utility-first CSS |
| `uuid` | ^9.0.1 | Session ID generation |

### Admin UI (admin-ui / react-nextjs-material-ui-starter)
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.0.2 | React framework |
| `@mui/material` | ^7.0.2 | Material UI component library |
| `@mui/x-data-grid` | ^8.0.0 | Data tables |
| `@mui/x-date-pickers` | ^8.0.0 | Date/time pickers |
| `apexcharts` / `react-apexcharts` | ^4.0.0 | Charts and analytics |
| `dayjs` | ^1.11.11 | Date manipulation |
| `@emotion/react` / `@emotion/styled` | ^11 | CSS-in-JS styling |

## Infrastructure
- **PostgreSQL** (via docker-compose) — LangGraph checkpoint storage, port 5433
- **Evolution API** — WhatsApp messaging gateway (external service)
- **OpenRouter** — LLM API proxy (default model: `anthropic/claude-sonnet-4-5`)
- **ClinicWeb API** — External EHR/practice management system

## Development Commands

### clinic-bot-api / clinic-bot-api-v2
```bash
npm run dev      # tsx watch src/server.ts (hot-reload)
npm run build    # tsc compilation
npm start        # node dist/server.js (production)
```

### chat-ui
```bash
npm run dev      # next dev -p 3001
npm run build    # next build
npm start        # next start -p 3001
```

### admin-ui / react-nextjs-material-ui-starter
```bash
npm run dev      # next dev -p 3003 (admin-ui) / next dev (starter)
npm run build    # next build
npm run lint     # next lint
```

### clinicweb-mcp
```bash
npm start        # node index.js
npm run dev      # node --watch index.js
```

### Data Population Scripts
```bash
cd clinic-bot-api/scripts
node fetch-convenios.js        # → base/convenios.json
node fetch-profissionais.js    # → base/profissionais.json
node fetch-procedimentos.js    # → base/procedimentos.json
node fetch-salas.js            # → base/salas.json
```

## Service Ports
| Service | Port |
|---------|------|
| clinicweb-mcp | 3000 |
| chat-ui | 3001 |
| clinic-bot-api | 3002 |
| admin-ui | 3003 |
| PostgreSQL | 5433 |

## Environment Variables
```
PORT                    # Bot API port (default: 3002)
EVOLUTION_API_URL       # Evolution API base URL
EVOLUTION_API_KEY       # Evolution API key
EVOLUTION_INSTANCE      # Evolution instance name
WEBHOOK_SECRET          # Webhook validation secret
DATABASE_URL            # PostgreSQL connection string
OPENROUTER_API_KEY      # OpenRouter API key
OPENROUTER_BASE_URL     # OpenRouter base URL
LLM_MODEL               # LLM model identifier
MCP_URL                 # MCP server URL (default: http://localhost:3000)
MCP_API_KEY             # MCP server API key
```

## Build System
- **TypeScript** compiled via `tsc` (tsconfig.json in each sub-project)
- **Next.js** built-in bundler for frontend projects
- **No monorepo tool** (Turborepo, Nx, etc.) — each sub-project has independent `package.json` and `node_modules`
