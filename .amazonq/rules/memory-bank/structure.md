# Project Structure — poc-clinic-web

## Root Layout
```
poc-clinic-web-master/
├── clinic-bot-api/          # Main bot backend (v1) — node-per-step LangGraph
├── clinic-bot-api-v2/       # Refactored bot backend — single-agent architecture
├── clinicweb-mcp/           # MCP server for ClinicWeb API
├── chat-ui/                 # Lightweight Next.js chat test UI
├── admin-ui/                # Admin dashboard (Trezo Material UI template)
├── react-nextjs-material-ui-starter/  # Extended admin/dashboard starter
├── ARQUITETURA.md           # Architecture design document (Portuguese)
├── FLUXO_BOT.md             # Bot conversation flow specification
├── PLANEJAMENTO.md          # Implementation roadmap with validation criteria
├── test-*.js                # Root-level integration/flow test scripts
├── setup-demo*.js           # Demo data setup scripts
└── .amazonq/                # Amazon Q rules and memory bank
```

## clinic-bot-api/ (Main Backend — v1)
```
clinic-bot-api/
├── base/                    # Static JSON data (fetched from ClinicWeb)
│   ├── convenios.json       # Insurance providers + plans + coverage notes
│   ├── profissionais.json   # Doctors + specialties
│   ├── procedimentos.json   # Medical procedures
│   ├── salas.json           # Rooms
│   └── agendamento-status.json
├── scripts/                 # Data fetch + test scripts
│   ├── fetch-*.js           # Populate base/ JSONs from ClinicWeb API
│   └── test-*.js            # Per-feature test scripts
├── src/
│   ├── server.ts            # Express server (port 3002), CORS, routes
│   ├── logger.ts            # Structured logging
│   ├── config/index.ts      # Environment config (Evolution, Postgres, OpenRouter, MCP)
│   ├── agent/
│   │   ├── state.ts         # BookingStateAnnotation — typed LangGraph state
│   │   ├── graph.ts         # StateGraph definition, checkpointing, debounce, mutex
│   │   ├── tools.ts         # LangChain tools wrapping MCP calls + local JSON reads
│   │   └── nodes/           # One file per conversation step
│   │       ├── identificacao.ts  # Patient identification (CPF lookup/create)
│   │       ├── convenio.ts       # Insurance selection + plan matching
│   │       ├── especialidade.ts  # Specialty selection + coverage check
│   │       ├── horarios.ts       # Available time slots
│   │       ├── confirmacao.ts    # Booking confirmation + creation
│   │       └── router.ts        # Conditional routing by step
│   ├── base/
│   │   ├── loader.ts        # In-memory JSON loader with typed access
│   │   ├── convenio-matcher.ts  # Fuse.js fuzzy matching for insurance names
│   │   └── cobertura-checker.ts # Coverage verification via observacao field
│   ├── admin/
│   │   ├── router.ts        # Admin API routes
│   │   ├── auth.ts          # JWT authentication
│   │   ├── botConfig.ts     # Bot configuration (hours, messages, active flag)
│   │   ├── sessions.ts      # Session management endpoints
│   │   ├── convenios.ts     # Insurance admin endpoints
│   │   └── metrics.ts       # Usage metrics
│   ├── webhooks/
│   │   ├── evolution-webhook.ts  # Evolution API webhook handler
│   │   └── evolution-client.ts   # Evolution API client (send messages)
│   └── types/
│       └── evolution.ts     # Evolution API type definitions
├── docker-compose.yml       # PostgreSQL for checkpointing
├── package.json             # Dependencies: langgraph, express, fuse.js, pg, zod
└── tsconfig.json
```

## clinic-bot-api-v2/ (Refactored Backend)
```
clinic-bot-api-v2/
├── src/
│   ├── server.ts            # Express server with /chat endpoint + graph init
│   ├── agent/
│   │   ├── graph.ts         # Single agenteNode with tool-calling loop (max 10 iterations)
│   │   ├── state.ts         # Same BookingState structure
│   │   ├── tools.ts         # Tools with threadId tracking
│   │   ├── prompt.ts        # Dynamic system prompt builder per state
│   │   ├── extractor.ts     # Post-response state extraction + session resumption detection
│   │   └── fewshots.ts      # Few-shot examples for LLM guidance
│   ├── clinicweb/client.ts  # Direct ClinicWeb API client
│   └── webhooks/            # Same Evolution API integration
├── scripts/                 # Data fetch scripts
└── package.json             # Same stack, v2.0.0
```

### Key Difference v1 vs v2
- **v1**: Deterministic node-per-step — each step is a separate LangGraph node with its own LLM call and prompt
- **v2**: Single agent node — one LLM call with all tools available, state extracted post-response via `extractor.ts`

## clinicweb-mcp/ (MCP Server)
```
clinicweb-mcp/
├── clinicweb.js             # ClinicWeb API wrapper (all endpoints)
├── index.js                 # MCP server setup + tool definitions
├── test-mcp.js              # MCP tool tests
└── package.json             # @modelcontextprotocol/sdk, express
```
Bridges ClinicWeb REST API as MCP tools: `buscar_pacientes`, `criar_paciente`, `proximos_horarios_livres`, `criar_agendamento`, etc.

## chat-ui/ (Test Chat Interface)
```
chat-ui/
├── app/
│   ├── page.tsx             # Chat page component
│   ├── layout.tsx           # Root layout
│   └── api/                 # API routes (proxy to bot backend)
├── lib/
│   ├── sessions.ts          # Session management
│   └── tools.ts             # Tool utilities
└── package.json             # Next.js 14, React 18, Tailwind CSS
```

## admin-ui/ & react-nextjs-material-ui-starter/ (Admin Dashboards)
Both based on **Trezo React** template (Material UI v7, Next.js 15). Contains:
- Dashboard components, charts (ApexCharts), data grids
- Chat interface components (ChatContent.tsx)
- i18n support (en, fr, ar)
- Authentication pages
- SCSS-based theming (dark mode, RTL support)

## Architectural Patterns
- **State Machine**: LangGraph `StateGraph` with typed `BookingStateAnnotation` for deterministic conversation flow
- **Checkpoint Persistence**: `PostgresSaver` for durable conversation state across server restarts
- **Message Debouncing**: Aggregates rapid WhatsApp messages (4-10s window) before processing
- **Thread Mutex**: Promise-based queue per `threadId` prevents concurrent state corruption
- **MCP Bridge**: ClinicWeb API exposed as MCP tools, consumed by LangChain tool interface
- **Local Knowledge Base**: Static JSON files (`base/`) for insurance, doctors, procedures — avoids slow API calls for reference data
- **Fuzzy Matching**: Fuse.js for insurance name matching from patient free-text input
