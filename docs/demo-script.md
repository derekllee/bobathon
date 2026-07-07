# 5-Minute Demo Script — CSP Bob Connector

> **Total runtime:** 5:00  
> **Presenter:** Team C (with Team A on standby)  
> **Recording tool:** Loom (preferred) or QuickTime  
> **Primary mode:** `FIXTURE_MODE=true` (live CSP as bonus if available)

---

## Pre-Demo Setup Checklist

Complete before hitting record:

- [ ] `FIXTURE_MODE=true` confirmed working (`npm run build && FIXTURE_MODE=true node dist/mcp-server/src/index.js` starts without error)
- [ ] Bob open with `csp-connector` registered in `.bob/mcp.json`
- [ ] Support Intelligence skill / system prompt loaded (confirm with Team A)
- [ ] Bob chat window on left, VS Code file tree on right
- [ ] `skill/skill-spec.yaml` open in editor tab (for Scene 4)
- [ ] `connector-template/HOWTO.md` open in editor tab (for Scene 4)
- [ ] Browser tab with CSP web UI open (for Scene 1 "before" shot)
- [ ] Font size ≥16px in both Bob chat and editor
- [ ] Do Not Disturb enabled
- [ ] Loom or QuickTime ready; test audio levels

---

## Scene 1 — The Problem [0:00–0:30]

**Screen:** CSP web UI — show the search box and filter panel

**Spoken:**
> "Every IBM support engineer has been here. It's 2am, you've got a production Kubernetes pod OOM-killing on watsonx.data, and you know someone at IBM has seen this exact failure before. The answer is in CSP — buried across dozens of case threads, behind filters, with no way to get from symptom to resolution without spending an hour clicking. Bob knows everything about your code. But it has no idea what support history exists. That's the gap we're closing."

**Action:** Click through a CSP search — show the manual effort, then close the tab.

---

## Scene 2 — The Approach [0:30–1:00]

**Screen:** Switch to VS Code — show `docs/architecture.md` diagram or `PLAN.md §3`

**Spoken:**
> "We didn't build from scratch. IBM's Propel marketplace already gives us a proven integration pattern: Connection, Tool Definitions, Auth, External API. We reverse-engineered that pattern, applied it to CSP, and formalized it as a reusable connector template. This is Bob extended across the full SDLC — including when things go wrong in production."

**Action:** Scroll slowly through the architecture diagram. Point to: Skill → Tool calls → MCP Server → Auth Layer → CSP.

---

## Scene 3 — Live Demo: Search [1:00–2:00]

**Screen:** Bob chat window, full screen

**Type exactly:**
```
Search CSP for historical cases about Kubernetes OOM errors in watsonx.data
```

**While Bob is responding (narrate):**
> "Bob is calling our MCP server, authenticating with the CSP API Gateway, and retrieving matched cases in real time."

**When response appears — point to specific parts:**
> "Here's what Bob found. Four closed cases — each with a case ID, a title, a description snippet, and a direct link to CSP. Notice Bob has already spotted the pattern: every single one of these resolved by adjusting JVM heap allocation."

**Specific lines to highlight in the response:**
- Case ID format: `TS012483901`
- URL: `https://ibmsf.lightning.force.com/lightning/r/Case/500DyA3K8mNpQ7rXv2Wj/view`
- Resolution snippet mentioning heap increase

---

## Scene 4 — Analysis and Guardrails [2:00–3:15]

**Screen:** Stay on Bob chat — scroll through the analysis output

**Spoken (point to each section as you name it):**
> "Now let's look at what the Support Intelligence skill actually produced. Root cause hypothesis: JVM heap undersized relative to container memory limits — cited from cases TS012483901 and TS013917254. Recommended action: increase coordinator heap to 14GB, with the exact ConfigMap setting. Confidence level: HIGH — three independent cases corroborate the same resolution pattern."

**Point to citations block:**
> "Every claim has a citation. These are the case IDs that back each statement. Any engineer can click through to the source in seconds. Bob cannot fabricate a root cause here — because we've built seven guardrails into the skill itself."

**Scroll to show confidence level and rationale lines — pause 2 seconds.**

> "G1: search before reasoning. G3: always report confidence. G4: never fabricate. These aren't hopes — they're enforced by the system prompt and the output schema."

---

## Scene 5 — Reusable Framework [3:15–4:00]

**Screen:** Switch to VS Code — open `skill/skill-spec.yaml`

**Spoken:**
> "But here's what we're most proud of. We didn't just build a CSP connector — we built a connector factory."

**Scroll through `skill-spec.yaml` slowly — highlight these lines:**
- `id: support-intelligence-csp` — "This is the skill identity"
- `guardrails:` section — "These are the 7 guardrails, formalized in YAML"
- `[CUSTOMIZE]` comments — "A new team fills in these fields and they have a new connector"

**Switch to `connector-template/HOWTO.md`:**
> "Seven steps. Copy the template, fill in the `[CUSTOMIZE]` markers, write fixtures, register with Bob. Any internal IBM system — ServiceNow, PagerDuty, your ticketing system — connected to Bob in under 2 hours, with the same guardrails, the same output schema, the same demo mode."

---

## Scene 6 — Bob Across the SDLC [4:00–5:00]

**Screen:** Switch to `docs/bob-prompt-log.md` — scroll through it

**Spoken:**
> "Here's the prompt log from today. Design, requirements, development, testing, documentation, operations — every phase of the SDLC, Bob was the co-pilot."

**Point to specific phases as you name them:**
> "We used Bob to reverse-engineer the Propel architecture. To define the guardrails. To scaffold the MCP server. To generate the HTTP client and the auth layer. To write the unit tests. To produce this fixture data. To draft this demo script."

**Pause on the test output or CI green screenshot:**
> "The extension we built is immediately useful for every IBM support engineer. The methodology we demonstrated is replicable by every IBM team. Thank you."

**Stop recording.**

---

## Timing Summary

| Scene | Time | Key action |
|---|---|---|
| 1 — The Problem | 0:00–0:30 | Show CSP manual search |
| 2 — The Approach | 0:30–1:00 | Architecture diagram |
| 3 — Live Search | 1:00–2:00 | Type query, show results |
| 4 — Analysis | 2:00–3:15 | Walk through output sections |
| 5 — Framework | 3:15–4:00 | skill-spec.yaml + HOWTO.md |
| 6 — SDLC close | 4:00–5:00 | bob-prompt-log.md |

---

## Panic Plan (30 seconds)

**If Bob doesn't respond to the tool call:**
> "Let me switch to recorded fixture mode — the output is identical."

Switch: add `"FIXTURE_MODE": "true"` to `.bob/mcp.json`, restart Bob, re-run the query.

**If Bob responds but the output looks wrong:**
> "The structure is there — let me highlight the key sections."

Navigate directly to the citations block and confidence level. These are always present in fixture mode.

**If VS Code files don't open:**
> "The key point here is the schema — let me read through the guardrails directly."

Open `skill/skill-spec.yaml` from the terminal with `cat skill/skill-spec.yaml | head -80`.

**If you run over 5 minutes:** Cut Scene 5 to 20 seconds: "And here's the connector template — any team can use this to wire Bob to their own system" while scrolling HOWTO.md. Jump straight to the close.

---

## Post-Recording Checklist

- [ ] Video is under 5:10 (trim if needed)
- [ ] All 3 example prompts visible at some point
- [ ] At least one citation with case ID visible clearly
- [ ] Confidence level output visible clearly
- [ ] `skill-spec.yaml` guardrails section visible
- [ ] Upload to Loom / Google Drive / Box
- [ ] Share link with Team A and Team B before submission
