# UNITY Narrator

AI agent over a private-equity firm's Jedox reporting cube (codename UNITY). Ask it anything about the portfolio — it decides which metrics to pull, which variances matter, when to consult prior-quarter memory, and writes the answer with citations back to source cells.

Not a dashboard with AI bolted on. **An LLM-driven orchestrator that happens to render dashboards as one of many outputs.**

## The architecture

```
User question (turn 1, 2, 3, …)
   ↓
┌────────────────────────────────────────────────┐
│ Orchestrator (Claude Opus 4.7)                 │   adaptive thinking, streaming
│ - conversation state carried turn-to-turn      │   grammar-constrained tools (strict)
│ - auto-compaction on long chats (beta)         │   server tools: memory + code_execution
└───────────────┬────────────────────────────────┘
                │ tool_use
   ┌────────────┼────────────┬─────────────┬────────────┐
   ▼            ▼            ▼             ▼            ▼
memory       query_cube   code_execution  write_section finish
(fs @ /memories) (cube data) (Python REPL)  (citations[]) (done)
                │                 │
                ▼                 ▼
         structured result → fed back → next decision

          (DAG grows dynamically — not pre-declared)
```

**Three client tools + two Anthropic server tools.** Client: `query_cube` (cube reads), `write_section` (structured commentary), `finish`. Server: `memory_20250818` (filesystem memory — Anthropic provides the protocol, we provide the backing store at `memories/claude/`) and `code_execution_20260120` (Python sandbox with REPL persistence — pandas/numpy/matplotlib). Anything that's math — cross-entity ranking, bridge identity, trend detection — Claude writes in Python.

**No hardcoded pipeline.** The orchestrator's tool-use trace *is* the DAG. Every node is a decision the LLM made.

**Multi-turn by default.** Ask UNITY is a real chat surface. First message creates a conversation; every subsequent turn reuses it. Prior assistant content (thinking signatures, tool calls, tool results) carries forward so Opus 4.7 has full context for follow-ups. Server-side compaction (`compact-2026-01-12` beta) keeps long chats inside the 1M window.

**Stop-able.** `⌘K` focuses the composer, `⌘E` toggles the evidence drawer, `Esc` (or the red Square button replacing Send while streaming) cancels the active run. The orchestrator signals the in-flight Anthropic stream to abort and exits cleanly with a "Run cancelled by user" banner.

## Stack

- **Next.js 15** + React 19 + TypeScript
- **Anthropic SDK** with `claude-opus-4-7` + `thinking: { type: "adaptive", display: "summarized" }`
- **Tailwind v4** + **shadcn/ui** (light, enterprise)
- **Zod 4** → `z.toJSONSchema()` for tool schemas
- **Framer Motion** for DAG pulse + bridge waterfall, **Recharts**, **Zustand**
- **TanStack Query** + SSE for streaming agent events
- Prompt caching on system prompt + entity/account catalog

## Running

```bash
npm install
cp .env.example .env.local   # then paste your ANTHROPIC_API_KEY
npm run dev
# http://localhost:7340
```

Override the port if 7340 is taken: `PORT=9340 npm run dev`.

### Live — the only mode

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local
npm run dev
```

There is no simulated mode. Without a key the run fails with a red banner in Ask UNITY and a clear "Authentication failed — verify ANTHROPIC_API_KEY in .env.local" message. No canned content, no mock trace.

The orchestrator uses `client.messages.stream()` against `claude-opus-4-7` with:

- **Adaptive thinking** (`thinking: { type: "adaptive", display: "summarized" }`).
- **Prompt caching** on the system prompt and cube catalog — the 10k-token preamble is cached ephemeral; most turns re-read it from cache.
- **Grammar-constrained tool inputs** (`strict: true`) so Claude's tool-call JSON is guaranteed to match the zod-derived schema. A sanitizer strips JSON Schema keywords Anthropic's strict mode rejects (`maxItems`, `minLength`, `maximum`, `pattern`, etc.) — server-side `safeParse` still enforces them.
- **Server-side citation validation** in `write_section` — every `[cite:N]` marker + `citations[]` entry is re-resolved against the cube; mismatches over 1% come back as warnings so Claude can self-correct.
- **Synthetic accounts** (`FairValue`, `Multiple`, `Bridge:*`) resolve to the same values the bridge engine produces for the UI, so a citation chip click never shows €0.
- **Typed error surfacing**: `BadRequestError` / `AuthenticationError` / `RateLimitError` / generic `APIError` / max-turns-exhausted each produce a specific UI banner.

### Smoke test the live path

```bash
# 1. Ensure ANTHROPIC_API_KEY is set in .env.local
npm run dev

# 2. In another shell, fire a representative query:
curl -X POST http://localhost:7340/api/reports \
  -H "Content-Type: application/json" \
  -d '{"question":"Why did Fortuna DE underperform this quarter?","reportType":"financial_performance","scope":"ENT_FORTUNA_DE"}'
# → {"runId":"run_..."}

# 3. Stream events:
curl -N http://localhost:7340/api/runs/{runId}/events
# You should see: run_started (mode:"live") → node_spawned → thinking_delta
# → tool_call (memory_recall) → tool_result → tool_call (query_cube) → …
# → section_ready (exec-summary) → … → run_completed
```

Or open `/ask?q=Why+did+Fortuna+DE+underperform+this+quarter%3F` in the browser — the whole loop renders live.

## Surfaces

- **`/ask`** — the primary entry point. Natural-language input, suggested prompts, chat transcript with streaming sections, collapsible per-turn DAG trace.
- **`/`** — Portfolio Overview. Ask UNITY hero at the top, then KPIs, heatmap, top movers, AI-surfaced narrative feed.
- **`/agents`** — Agent Workbench. The orchestrator + all tools with zod schemas rendered, system prompt viewer, playground.
- **`/entity/[id]`, `/project/[id]`, `/group/[id]`** — Hierarchy dashboards (statement tabs, variance waterfall, CubeCell drill-down).
- **`/reports/new`** — Wizard for scoped report generation (same orchestrator under the hood).
- **`/reports/[runId]`** — Flight Deck: live DAG trace of the orchestrator's tool-use, streaming commentary with inline citation chips.
- **`/valuation/[id]`** — FV bridge (animated waterfall).
- **`/variance/[scope]`** — Driver tree deep-dive.
- **`/model`** — Data Model Explorer (cubes, dimensions, derivation rules).

## Tool library (the agent's hands)

Three client tools (we host) + two server tools (Anthropic hosts):

| Tool | Kind | Purpose |
|---|---|---|
| `memory` | **server** (Anthropic protocol, client-stored) | `memory_20250818` — filesystem memory at `/memories`. Commands: `view`, `create`, `str_replace`, `insert`, `delete`, `rename`. Anthropic auto-injects a memory-protocol system prompt so Claude always checks memory before work. Backed by `memories/claude/` under the repo; seeded with markdown notes on Fortuna, Atlas, Vela, Helix, Orion. |
| `code_execution` | **server** (Anthropic) | `code_execution_20260120` Python sandbox. pandas/numpy/matplotlib pre-installed. REPL state persists across calls within a run. Required for any multi-operation math: variance, bridge identity, driver decomposition, ranking, trend detection. |
| `query_cube` | client | Read any (entity × accounts × periods × versions) slice — max 240 cells per call. |
| `write_section` | client | Stream a commentary section. Body uses `[cite:N]` markers; a sibling `citations[]` array carries the structured coordinates; every citation validated against the cube (±1% tolerance). |
| `finish` | client | Terminate with a one-sentence summary. |

Client tools are declared with `strict: true` so Claude's tool-call JSON is grammar-constrained to the zod-generated schema. A sanitizer strips JSON Schema keywords that Anthropic's strict mode rejects (`maxItems`, `pattern`, `minimum`, …); server-side `safeParse` still enforces them.

## Multi-turn chat

Ask UNITY is a real chat surface. The first message on `/ask` creates a `conversationId`; every subsequent turn reuses it. Server-side, `lib/agents/conversations.ts` holds each conversation's message history (including signed thinking blocks from Opus 4.7). When you fire a follow-up, the next orchestrator run sees the full prior context — no re-running the pipeline from scratch.

- Type in the bottom composer → enter. Shift+Enter for a new line.
- Keyboard: `⌘K` focus composer · `⌘E` toggle Evidence drawer.
- The conversation is in-memory only; reload = new conversation (prototype scope).

## Evidence drawer

The Evidence drawer (right-hand 380px) aggregates every citation from every section across every turn in the active conversation — deduped by (entity, account, period, version). Search, filter by statement, click to open the inline cell inspector (value, 12-month trajectory, derivation rule, leaf provenance). `⌘E` toggles it; there's also an "Evidence · N" pill above the composer once citations exist. Export CSV in the footer.

This is the primary surface for auditing numbers. Every `[cite:N]` chip in the prose is reachable from both the inline body and the drawer; they share state.

## Cross-run memory

`memories/portfolio-notes.json` is seeded with hand-crafted Q4-2025 observations that tie into the Q1 story:
- Fortuna DE linerboard ASP risk (flagged Q4 → confirmed Q1)
- Vela SE Swedish enterprise cohort go-live
- Helix UK CMA-cleared tuck-in
- Atlas NL comp-set re-rating
- Orion Lyon insurance recovery

When the orchestrator investigates Fortuna, it recalls the Q4 warning and weaves it into the commentary. That's the "AI with memory" moment.

## The demo path (90 seconds)

1. **`/`** → read the hero: the Ask input is the primary CTA.
2. Click **"Why did Fortuna DE underperform this quarter?"** (suggested chip) → lands on `/ask?q=…`
3. Watch the orchestrator run:
   - Thinking streams (adaptive summary)
   - Tool nodes appear live: memory_recall → query_cube → compute_variance → decompose_drivers → detect_insights → write_section → finish
   - Commentary streams into a section card with inline `[cite]` chips
   - 📌 **From memory:** the Q4 linerboard warning shows up
4. Click any citation chip → right-side Sheet slides in with cube coord, rule derivation, 12-month sparkline.
5. Ask a follow-up: **"Walk me through the Atlas NL fair value bridge"** — scope auto-resolves, bridge path taken, two sections written, FV legs cited.
6. **`/agents`** → inspect the tool library (zod schemas rendered), system prompt, playground.

## What to look at in the code

- `lib/agents/orchestrator.ts` — live Claude tool-use loop; declares the 5 client tools + `code_execution_20260120` server tool; sanitizes JSON Schema for strict mode; handles `server_tool_use` / `code_execution_tool_result` content blocks
- `lib/agents/orchestrator-prompt.ts` — system prompt with the four non-negotiable rules, RFP section structure, and worked examples
- `lib/agents/tools/*.ts` — five tool files (zod + executor): `query-cube`, `write-section`, `memory-recall`, `finish`, plus `registry` + `types`
- `lib/agents/memory.ts` + `memories/portfolio-notes.json` — cross-run memory (Q4-2025 observations that tie into the Q1 story)
- `lib/jedox/*` — mock Jedox cube. `engine.ts::resolve()` is the core primitive; synthetic accounts (`FairValue`, `Bridge:*`, `Multiple`) live there too
- `components/ask/ask-interface.tsx` — chat UI with structured-citation rendering and failure banner
- `components/ask/agent-timeline.tsx` — unified thinking + tool-call timeline; special rendering for code_execution (code block + stdout / stderr panes)
- `components/ask/markdown-content.tsx` — `[cite:N]` marker → CitationChip renderer, backed by the `citations[]` array from `write_section`

## Production readiness

- **Four non-negotiable rules in the system prompt**: every number grounded in a tool result, three-element sentence rule (line item + magnitude + comparison base), structured `[cite:N]` + `citations[]`, every section via `write_section` (never free text).
- **Structured citations, server-validated**: `write_section` takes a `citations[]` array of `{id, entity, account, period, version, value}`. The server re-resolves each against the cube; `[cite:N]` markers without a matching id come back as "dangling_marker" warnings; values off by >1% come back as "value_mismatch". Claude corrects and re-calls.
- **Python sandbox for math**: when a query needs anything beyond trivial arithmetic, Claude writes Python via `code_execution_20260120`. pandas and numpy pre-installed; REPL state persists across calls so a DataFrame built on turn 3 is still there on turn 5.
- **Synthetic-account first-class resolution**: `FairValue`, `Multiple`, and the seven `Bridge:*` legs are first-class in `lib/jedox/engine.ts::resolve()`. Citation chip clicks land on the cell inspector with the correct value, rule derivation, and leaf provenance.
- **Typed error surfacing**: rate-limit, auth failure, bad-request, max-turns-exhausted — each produces a specific UI banner with remediation text.
- **Deterministic mock cube**: seeded generator in `lib/jedox/generator.ts`. Identical runs produce identical numbers — useful for regression testing.

## Testing the agent from curl

```bash
# First turn — creates a new conversation, server returns its id.
curl -X POST http://localhost:7340/api/reports \
  -H "Content-Type: application/json" \
  -d '{"question":"Why is EBITDA down in Buyouts?","reportType":"chat"}'
# → {"runId":"run_...","conversationId":"conv_..."}

# Follow-up turn — pass the conversationId to carry prior context.
curl -X POST http://localhost:7340/api/reports \
  -H "Content-Type: application/json" \
  -d '{"question":"How much of that is margin vs volume?","conversationId":"conv_..."}'

# SSE events for any run
curl -N http://localhost:7340/api/runs/{runId}/events
```

## Integration tests

Live-API tests under `test/integration/`. They POST to `/api/reports`, stream the SSE events, and assert on run shape, citation validity, memory usage, and (for the ranking test) that `code_execution` fires.

```bash
npm run dev                     # in one terminal
npm run test:integration        # in another — ~10 min, ~$1 in tokens per full pass
```

Suites:
- `fortuna-fp.test.ts` — single-turn FP commentary: 4 sections, memory called, every citation validated against the cube, each section ≥ 3 citations.
- `atlas-fv.test.ts` — single-turn FV: 3 sections, ≥ 2 `Bridge:*` legs cited, `FairValue` at both V1 and V2.
- `multiturn.test.ts` — two turns in one conversation: follow-up preserves context, conversationId is stable, citations still resolve.
- `code-execution.test.ts` — cross-entity ranking query that must use the Python sandbox (≥ 1 `code_execution` server tool call, ≥ 5 distinct entities cited).

The regular `npm test` runs the unit suite (43 tests, < 2 s, no tokens).

## Deploy

The app is one Next.js service. There's no external database — cube data is a deterministic seeded generator, conversation state is in-memory (acceptable prototype scope), and agent memory lives in the filesystem at `memories/claude/*.md`. Production keeps that memory directory on a mounted volume; the rest is stateless.

### Docker — local parity

```bash
cp .env.example .env.local     # paste ANTHROPIC_API_KEY
docker compose up --build      # http://localhost:7340
# Port clash? Bump it:
UNITY_PORT=9340 docker compose up --build
```

Compose bind-mounts `./memories/claude` into the container, so any file the agent writes there is also visible on your host (and vice versa).

### Railway — one-time setup

1. **Create a project and connect this GitHub repo.** Railway auto-detects `railway.json` and builds with the Dockerfile.
2. **Add the secret.** Service → Variables → add `ANTHROPIC_API_KEY=sk-ant-…`. Railway injects `PORT` automatically; the Next.js standalone server reads it.
3. **Attach a Volume.** Service → Settings → Volumes → Mount path `/app/memories/claude`, 0.5 GB is plenty. On first boot the entrypoint copies the shipped seed files into the empty volume; later boots leave whatever the agent wrote in place.
4. **Deploy.** Push to `main` or click Deploy. Healthcheck hits `/`; `restartPolicy: ON_FAILURE` keeps the service resilient.

Need to reset the volume to a clean seed state after drift?

```bash
./scripts/railway-seed.sh      # requires the railway CLI + linked project
```

### CI / CD

`.github/workflows/ci.yml` runs on every push + PR:
- `tsc --noEmit` · `npm run lint` · `npm test` (unit) · `npm run build` · `docker build`

`.github/workflows/integration.yml` runs manually (`workflow_dispatch`). It boots the standalone server and fires the live integration suite (which costs tokens). Requires `ANTHROPIC_API_KEY` as a repo secret.

Deploys are automatic via Railway's GitHub integration — no GitHub Actions deploy step required.

### What persists / what doesn't

| State | Persisted? | Where |
|---|---|---|
| Cube data | n/a | Regenerated deterministically on every process start (seed `UNITY_DEMO_SEED_2026`) |
| Agent memory (markdown notes) | ✅ | `memories/claude/` — volume-backed on Railway, bind-mounted on Docker |
| Multi-turn conversations | ❌ | In-process `Map`; reload = fresh conversation. Future: back onto Redis/Postgres. |
| Active run buffers + SSE emitters | ❌ | Same — acceptable since a run is short-lived |
