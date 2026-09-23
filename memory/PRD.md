# AGORA — PRD / Agent Memory

## Original Problem Statement
User requested a complete UI restyle (new frontend) for the existing app. Instructions: analyze the current UI, keep every element in its optimal place, and take ONLY the colors and style from a provided reference image (cream/bone background, warm black ink, butter-yellow accents, pill shapes, rounded cards) — do not copy elements from the image.

### User choices (June 2026)
- Redesign ALL pages/screens
- Keep every feature working as-is (visual changes only)
- Top navigation bar layout (as before)
- Light theme only

## App Overview
"Agora" — a no-code platform where a society of Qwen-powered agents self-organizes to complete a brief, visualized in a live 3D office. **Vite + React 19 + TypeScript + Tailwind v4** (NOT CRA, NOT FastAPI). Websocket relay embedded in the vite dev server (server/relay.ts). LLM: Qwen via DashScope (BYOK modal or DASHSCOPE_API_KEY env). No auth, no MongoDB usage.

### Environment quirks
- Supervisor `frontend` runs a shim: /app/frontend/package.json → `npm --prefix /app run dev` (vite on port 3000). Supervisor `backend` is FATAL by design (no python backend) — ignore.
- vite.config.ts: `allowedHosts: true` added for preview domain.
- Deps installed via `npm ci` (package-lock.json; yarn fails on vitest/vite linking).
- The 3D office runs on WebGPU when the browser has it, and on WebGL2 otherwise. `?renderer=webgl` forces WebGL2. A software GPU turns shadows off, caps the pixel ratio at 1, and skips antialiasing. If WebGL2 is missing too, the office tab draws a flat top-down view.
- `./run-agora.sh` is an optional launcher for hardware WebGPU. The office does not need Chrome flags.

## Layout (unchanged structure, restyled)
Header (top nav) | left: ActionLogPanel (Activity/Technical) | center: SimulationView (Office 3D / Obsidian Graph tabs) + KanbanPanel drawer | right: InspectorPanel (Project Info / agent inspector / chat). Modals: Join, Brief (Run Swarm / Swarm Bench), BYOK, Negotiation Arena, Manage Teams (VisualConfigurator), Info, Audit, FinalOutput, OutputReview, Society, Benchmark, Pricing, Reset.

## What's been implemented (June 2026 — UI Redesign)
- Global design system in src/index.css via Tailwind v4 `@theme` token remap:
  - white → warm paper #fcfaf4; zinc scale → warm bone/stone; ink #17150f; butter yellow tokens (--color-butter etc.); yellow scale warmed; radii enlarged (pill language); fonts: Schibsted Grotesk (sans) + Spline Sans Mono (mono); body bg #efebe0; yellow selection; hatch + dot-grid-dark utilities.
- App.tsx: cream shell, panels float as rounded-3xl cards with gaps (log / center / inspector).
- Header: black logo tile w/ yellow dot, yellow "Run Swarm" pill, black "Swarm Bench" pill, outlined "Manage Teams" pill; icon testids.
- SimulationView + ActionLogPanel: black-pill segmented tabs.
- Kanban: cream drawer, butter count badges, hatched Empty placeholders, rounded-2xl cards.
- ProjectView: butter "working" phase chip; dark dot-grid Token Usage card w/ butter accents.
- JoinModal / BYOK / brief modal: warm backdrops, pill inputs/buttons, contrast fixes.
- ObsidianGraphView + flow nodes + TeamCard + ChatPanel: hardcoded cold-gray hexes → warm equivalents.
- data-testids added across header buttons, tabs, panels, modals.

## Testing
- iteration_1.json: 100% of functional flows passed (join, tabs, modals, manage teams, kanban, logs). Contrast issues reported were fixed afterward (BYOK, NegotiationArena, empty states, header icons). Swarm execution NOT tested (no DashScope key).

## Backlog / Next
- P1: Escape-key close + shared modal overlay pattern
- P1: Restyle pass on deep modals with live data (AuditModal, OutputReviewModal, FinalOutputModal during a real swarm run — needs DashScope key)
- P2: Micro-animations (staggered panel entrance), custom cursor
- P2: Split ActionLogPanel (~550 lines) into submodules
