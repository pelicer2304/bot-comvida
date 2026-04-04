# Product Overview — poc-clinic-web

## Purpose
POC (Proof of Concept) for an AI-powered medical appointment scheduling system for **Clínica ComVida**. The system integrates a WhatsApp chatbot with the ClinicWeb EHR/practice management platform to automate patient scheduling through natural conversation.

## Value Proposition
- Replaces manual phone/WhatsApp scheduling with an autonomous AI bot
- Conducts humanized conversations (not form-like) to guide patients through booking
- Maintains explicit state across conversation turns using LangGraph state machines
- Integrates directly with ClinicWeb API via MCP (Model Context Protocol) server

## Key Features
- **Conversational Scheduling**: 6-step flow — patient identification → insurance/plan → specialty → available slots → confirmation → booking creation
- **Patient Lookup & Registration**: Searches patients by CPF, creates new records if not found
- **Insurance Matching**: Fuzzy-match insurance providers (convênios) using Fuse.js against local JSON database
- **Coverage Verification**: Checks insurance coverage for requested specialties via `observacao` field analysis
- **Slot Discovery**: Queries available appointment times from ClinicWeb API, presents up to 3 options naturally
- **Session Resumption**: Resumes conversations after inactivity (<30min: silent continue, 30min-24h: context reminder, >24h: restart)
- **Guardrails**: Never discloses pricing (transfers to human), blocks sensitive data leaks, validates outputs
- **Admin Panel**: Bot configuration, session monitoring, metrics dashboard
- **WhatsApp Integration**: Via Evolution API webhook for real-time messaging
- **Message Debouncing**: Aggregates rapid sequential WhatsApp messages before processing
- **Thread Mutex**: Prevents concurrent processing of messages from the same phone number

## Target Users
- **Patients**: Schedule medical appointments via WhatsApp without calling the clinic
- **Clinic Staff**: Monitor bot sessions, configure bot behavior, handle escalated conversations
- **Developers**: Extend the bot flow, add new specialties, integrate additional services

## Architecture
Multi-package monorepo with 6 sub-projects:
1. **clinic-bot-api** (v1) — Main bot backend with LangGraph node-per-step architecture
2. **clinic-bot-api-v2** — Refactored version with single-agent node + LLM-driven tool calling
3. **clinicweb-mcp** — MCP server bridging to ClinicWeb REST API
4. **chat-ui** — Lightweight Next.js chat interface for testing
5. **admin-ui** — Full admin dashboard (Trezo template, Material UI)
6. **react-nextjs-material-ui-starter** — Extended admin/dashboard UI starter

## External Integrations
- **ClinicWeb API**: Patient management, appointment CRUD, insurance data
- **Evolution API**: WhatsApp messaging gateway (send/receive)
- **OpenRouter**: LLM provider (Claude Sonnet via OpenRouter API)
- **PostgreSQL**: LangGraph checkpoint persistence for conversation state
