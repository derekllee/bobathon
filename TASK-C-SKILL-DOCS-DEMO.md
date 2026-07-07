# 🎬 Team Member C — Skill Spec, Docs & Demo Lead

> Paste this entire file into a fresh Bob window at standup.  
> Your job: write the skill definition, produce all required deliverables, own the demo.  
> **Critical output by 13:15:** `skill/prompts/analyze.md` handed to A so they can wire the full skill.

---

## Your Context (read once, then start)

We are building a Bob IDE extension that connects IBM Bob to CSP (Cognitive Support Platform). Your role is everything that makes this a *compelling, submission-ready* project: the formal skill specification, the agent system prompt, all documentation, and the 5-minute demo.

The judges care deeply about:
1. Bob being used across the **full SDLC** — you own the evidence for this
2. **Agentic best practices** being formalized — you own the guardrails document
3. A **reusable connector template** framing — you own the narrative
4. The **5-minute demo video** — you script, rehearse, and record it

Team Member A owns MCP server + integration.  
Team Member B owns CSP API recon + auth + fixtures.

You don't write server code. You write everything else that makes judges say yes.

---

## Your Schedule

| Time | Task | Hard Cutoff |
|------|------|-------------|
| 08:00–09:00 | Propel analysis: CONTRIBUTING.md → architecture narrative | |
| 09:00–09:30 | Write problem statement + solution narrative (judge-ready) | |
| 09:30–10:30 | Write `skill/skill-spec.yaml` formal schema | |
| 10:30–11:30 | Write `skill/prompts/analyze.md` (agent system prompt) | ⛔ 13:15: must hand to A |
| 11:30–12:00 | Write `docs/architecture.md` with diagrams | |
| 12:00–12:30 | Lunch | |
| 12:30–13:15 | Finalize `skill/prompts/analyze.md`; hand to A | ⛔ 13:15 |
| 13:15–14:00 | Write `README.md` (full, judge-ready) | |
| 14:00–14:30 | Write `CONTRIBUTING.md` (how to add a connector) | |
| 14:30–15:00 | Write `docs/demo-script.md` (refine §13 of PLAN.md) | |
| 15:00–15:30 | Prepare demo: fixture data loaded, Bob configured, screen layout | |
| 15:30–15:45 | Dry run with A: full demo from scratch | |
| 15:45–16:15 | Demo rehearsal 1 (with A) | |
| 16:15–16:30 | Write `docs/bob-feedback.md` | |
| 16:30–16:45 | Demo rehearsal 2 | |
| 16:45–17:15 | **Record demo video** | |
| 17:15–17:45 | Final repo pass: all files committed, links work | |

---

## Step 1 — Propel Architecture Analysis (08:00–09:00)

This sets the "reverse-engineering Propel" narrative that's central to our judging story.

While A is running Propel recon, prepare your analysis using what we know from the plan. Once A sends you `docs/propel-recon.md`, refine with real findings.

> **Bob prompt:**
> ```
> We are building a Bob IDE extension that connects Bob to IBM CSP (Cognitive Support Platform).
> We are modelling our architecture on the Propel marketplace pattern for Bob extensions.
>
> The Propel pattern is: Connection → Tool Definitions → Auth Layer → External API
> Extensions are packaged as reusable Skills.
>
> Write a 400-word architecture narrative that:
> 1. Describes what Propel's pattern is and why it's a good foundation
> 2. Explains what we're doing differently/additionally (CSP connector + Support Intelligence Skill)
> 3. Frames our contribution as "extending Propel's ecosystem into the support domain"
> 4. Mentions the reusable connector template as a generic framework contribution
>
> Write in a tone suitable for a hackathon technical brief read by judges.
> Avoid jargon. Every sentence should either describe what we built or why it matters.
> ```

Save the output for use in `docs/architecture.md` and the README.

---

## Step 2 — Problem Statement & Solution (09:00–09:30)

> **Bob prompt:**
> ```
> Write a problem statement and solution summary for a hackathon project submission.
> Audience: IBM technical judges who understand the Bob IDE and the Propel marketplace.
>
> Project: We built a Bob extension that connects Bob to CSP (IBM's Cognitive Support Platform).
> Users can search historical support cases from inside Bob, get analyzed results with
> root cause hypotheses, recommended actions, and citations with confidence scoring.
>
> Problem paragraph (150 words max):
> - Start with a specific pain scenario (support engineer, production issue, manual CSP search)
> - Quantify the pain if possible
> - End with "the answer is buried in CSP but invisible inside Bob"
>
> Solution paragraph (150 words max):
> - Lead with the Propel-pattern framing ("we extended Bob's proven integration pattern")
> - Name the core capability concisely
> - Mention agentic guardrails (cite sources, report confidence, no fabrication)
> - End with the reusable template differentiator
>
> Do not use bullet points. Write in full paragraphs. Judge-ready.
> ```

Save output. This goes in the README, the video script opening, and any submission form.

---

## Step 3 — Skill Spec YAML (09:30–10:30)

The formal skill definition is a key judging artifact — it shows we "formalized agentic best practices in a reusable, replicable format."

> **Bob prompt:**
> ```
> Write a complete skill-spec.yaml file for a Bob IDE skill called "Support Intelligence".
>
> The skill:
> - Is invocable via natural language or /support-search slash command
> - Uses 3 MCP tools: csp_search_cases (required), csp_get_case (optional), csp_get_related_docs (optional)
> - Runs a 5-step workflow: search → enrich (parallel case fetches) → docs → analyze → output
> - Produces structured output: summary, root_cause_hypotheses, recommended_actions, citations, confidence_level, confidence_rationale
> - Enforces guardrails: G1 (search first), G2 (cite everything), G3 (always report confidence), G4 (no fabrication), G5 (bound tool calls), G6 (tag source type), G7 (no PII)
>
> The schema must be GENERIC — use [CUSTOMIZE] markers on all domain-specific fields
> so a different team could fill in the same schema to build a skill for a different domain.
>
> Include comments explaining every field.
> Include a header comment: "Generic connector skill schema v1.0 — copy and fill [CUSTOMIZE] fields"
>
> Use YAML. Be complete — do not abbreviate sections.
> ```

Save to `skill/skill-spec.yaml`. This is a demo-show artifact — it should look impressive when scrolled through.

---

## Step 4 — Agent System Prompt (10:30–12:00, finalize 12:30–13:15)

This is your most important deliverable for Team Member A. **Hand it by 13:15.**

### Draft version (10:30–11:30):

> **Bob prompt:**
> ```
> Write a system prompt for an AI agent called "Support Intelligence" inside IBM Bob.
>
> The agent's job: when a user describes a technical problem or error, the agent searches
> IBM CSP (Cognitive Support Platform) for historical support cases, analyzes patterns,
> and produces structured output with root cause hypotheses and recommended actions.
>
> The system prompt must:
> 1. State the agent's role in one sentence
> 2. Enforce these behaviors (include each explicitly):
>    - ALWAYS call csp_search_cases before forming any hypothesis. Never answer from memory alone.
>    - Cite every factual claim using format: [CSP:case_id] "quoted evidence"
>    - Always output a confidence_level: HIGH (≥3 corroborating cases), MEDIUM (1-2 cases), LOW (symptoms only), INSUFFICIENT (no relevant cases found)
>    - If confidence is INSUFFICIENT, stop and say: "I found no relevant historical cases. I cannot responsibly hypothesize a root cause."
>    - Never fabricate a root cause. Only hypothesize what the evidence directly supports.
>    - Do not repeat customer names, email addresses, or other PII from case data. Summarize instead.
>    - Maximum 3 cases to fetch in detail per query.
> 3. Describe the required output format:
>    - Summary (1 paragraph)
>    - Root Cause Hypotheses (numbered list, each with supporting case_ids)
>    - Recommended Actions (numbered list, each with rationale and citation)
>    - Citations (list of [CSP:case_id] → url → snippet)
>    - Confidence: [LEVEL] — [one sentence rationale]
> 4. End with: "When in doubt, retrieve more data. Never guess."
>
> Max 400 words. Clear, imperative language. No hedging.
> ```

### Review pass (12:30–13:15):

Read the draft. Ask Bob to tighten it:

> **Bob prompt:**
> ```
> Review this system prompt for an AI support analysis agent: [paste draft]
>
> Identify any guardrail that could be misinterpreted or bypassed.
> Rewrite those guardrails to be unambiguous.
> Make the confidence level definition more precise.
> Ensure the output format is specific enough that two different LLMs would produce
> structurally identical responses.
> Keep it under 400 words.
> ```

Save final version to `skill/prompts/analyze.md`. **Hand to A immediately.**

---

## Step 5 — Architecture Document (11:30–12:00)

> **Bob prompt:**
> ```
> Write a technical architecture document for the CSP Bob Connector.
>
> Include:
>
> 1. ASCII/text architecture diagram showing:
>    Bob → Support Intelligence Skill → [csp_search_cases, csp_get_case, csp_get_related_docs]
>    → MCP Server → Auth Layer → CSP HTTP Client → CSP API
>    Annotate each component as "Propel pattern" or "New"
>
> 2. Component descriptions (2-3 sentences each):
>    - Support Intelligence Skill
>    - MCP Server
>    - Tool Handler Layer
>    - Auth Layer (IAM token manager)
>    - CSP HTTP Client
>    - Fixture Mode
>
> 3. Skill workflow diagram (text/ASCII) showing the 5 steps:
>    search → enrich → docs → analyze → output
>    With data flowing between steps
>
> 4. Guardrail enforcement table:
>    Guardrail | Where enforced (system prompt / output schema / MCP middleware)
>
> 5. Design decisions:
>    - Why we modelled on Propel's pattern
>    - Why MCP over direct API calls
>    - Why fixture mode is built-in
>
> Use Markdown. Include the diagrams as code blocks.
> ```

Save to `docs/architecture.md`.

---

## Step 6 — README (13:15–14:00)

> **Bob prompt:**
> ```
> Write a README.md for an open-source IBM Bob extension called "CSP Bob Connector".
>
> Repo structure:
> [paste §8 directory tree from PLAN.md]
>
> Architecture diagram:
> [paste from docs/architecture.md]
>
> Problem and solution:
> [paste from Step 2 output]
>
> Sections to include:
> 1. What this is (problem + solution, 2 paragraphs — paste from Step 2)
> 2. Architecture (paste diagram from docs/architecture.md)
> 3. Prerequisites (Node.js 20+, IBM Cloud API key with CSP access, Bob IDE)
> 4. Setup
>    npm install
>    cp .env.example .env  # edit with your credentials
>    npm run build
> 5. Register with Bob (exact config snippet — get from A once they know the format)
> 6. Try it (3 example prompts with expected output descriptions)
> 7. Run tests: npm test
> 8. Add a new connector (1 paragraph + link to connector-template/HOWTO.md)
> 9. Agentic guardrails (link to docs/guardrails.md, 2-sentence summary)
> 10. License: Apache 2.0
>
> Style: IBM documentation style. Active voice. Short sentences.
> Do not add sections not listed above.
> ```

---

## Step 7 — CONTRIBUTING.md (14:00–14:30)

> **Bob prompt:**
> ```
> Write a CONTRIBUTING.md for the CSP Bob Connector repository.
>
> Audience: an IBM developer who wants to add a new connector (e.g., connecting Bob
> to ServiceNow, PagerDuty, or an internal ticketing system) using our template.
>
> Sections:
> 1. Overview: "This repo is a template factory. CSP is the first connector. Here's how to add another."
> 2. The connector pattern: Connection → Tool Definitions → Auth → External API
> 3. Step-by-step: use connector-template/, fill in [CUSTOMIZE] markers, test, register
> 4. Required files for a new connector (list)
> 5. Agentic guardrails: all connectors must inherit G1-G7; how to customize them
> 6. Testing requirements: unit tests with mocked responses are mandatory
> 7. Demo mode: all connectors must implement FIXTURE_MODE
> 8. How to submit a PR (branch naming, description template)
>
> Keep it under 600 words. Use numbered lists for steps, headers for sections.
> ```

---

## Step 8 — Demo Preparation (14:30–15:30)

### 8a. Refine the demo script

> **Bob prompt:**
> ```
> Here is a 5-minute demo script for our hackathon presentation:
> [paste §13 from PLAN.md]
>
> Refine it so that:
> 1. Every scene has a clear spoken line AND a matching screen action
> 2. The timing is tight: each scene ends before its allocated time
> 3. Scene 3 (Live Demo: Search) includes the exact text to type in Bob
>    and describes exactly what the expected response looks like
> 4. Scene 4 (Analysis) calls out exactly which guardrails are visible in the output
>    and points to specific parts of the response
> 5. Scene 5 (Reusable Framework) shows the skill-spec.yaml and connector-template/
>    with specific lines to highlight
>
> Also add a 30-second "panic plan": what to say if the demo breaks live.
> Output as docs/demo-script.md with timestamp markers [0:00], [0:30], etc.
> ```

### 8b. Demo environment checklist

Prepare this before rehearsal at 15:30:

- [ ] Bob is open and configured with the MCP server registered
- [ ] `FIXTURE_MODE=true` version is tested and ready as backup
- [ ] `skill/prompts/analyze.md` is loaded in Bob (confirm with A)
- [ ] Screen layout: Bob chat on left, code/files on right
- [ ] Font size is legible for video recording (≥16px)
- [ ] Browser tab with CSP open (to show "before" state at demo start)
- [ ] `skill/skill-spec.yaml` open in editor (for Scene 5)
- [ ] `connector-template/HOWTO.md` open in editor (for Scene 5)
- [ ] Fixture JSON loaded: `export FIXTURE_MODE=true`
- [ ] Loom or QuickTime recording ready, test audio levels

---

## Step 9 — Bob Experience Feedback (16:15–16:30)

This is a required deliverable. Write it yourself from experience — don't ask Bob to write it (that would be ironic and hollow).

But you can use Bob to structure it:

> **Bob prompt:**
> ```
> I need to write 500 words of honest feedback on using IBM Bob as an SDLC assistant
> for a hackathon. Give me a structured outline with these sections:
> - What worked well (code generation, docs, testing)
> - What was frustrating (what needed multiple prompt attempts, what failed)
> - Surprising capabilities (things Bob did better than expected)
> - Gaps (what you wished Bob could do but couldn't)
> - Recommendations for improving Bob for this use case
>
> Output just the outline with 2-3 bullet points per section. I'll write the content.
> ```

Fill in the outline with your real experience from today. Save to `docs/bob-feedback.md`.

---

## Step 10 — Demo Video (16:45–17:15)

Record using Loom (preferred — instant shareable link) or QuickTime.

**Before hitting record:**
- Close all notifications (Do Not Disturb on)
- Close all browser tabs except CSP + any docs
- Have fixture mode ready as instant fallback
- Read the demo script once out loud

**Recording rules:**
- First good take wins — no re-editing
- If you fumble a line, pause 2 seconds and continue; don't re-record
- If the live demo breaks, say "let me switch to recorded mode" and continue with fixtures — don't apologize excessively
- End exactly at 5:00 — practice this

**Fallback if you go over:** Cut Scene 5 (Reusable Framework) to 30 seconds by just saying "and here's the connector template — any team can use this to add their own integration" while scrolling through HOWTO.md.

---

## Key Files You Own

| File | Status |
|------|--------|
| `skill/skill-spec.yaml` | You write |
| `skill/prompts/analyze.md` | You write ← **critical, hand to A by 13:15** |
| `skill/README.md` | You write |
| `docs/architecture.md` | You write |
| `docs/demo-script.md` | You write |
| `docs/bob-feedback.md` | You write (from real experience) |
| `README.md` | You write |
| `CONTRIBUTING.md` | You write |

---

## Handoffs

| What | Direction | When |
|------|-----------|------|
| `docs/propel-recon.md` findings | A → you | By 09:00 (inform architecture narrative) |
| CSP fixture responses (for demo) | B → you | By 11:30 (for demo prep) |
| `connector-template/` files | B → you | By 14:30 (for demo Scene 5) |
| `docs/guardrails.md` | B → you | By 15:00 (for demo Scene 4 narration) |
| `skill/prompts/analyze.md` (final) | You → A | ⛔ By 13:15 |
| `README.md` (Bob config section) | You + A | A fills in exact config snippet when known |
| `demo.mp4` | You → everyone | By 17:15 |
| `docs/bob-feedback.md` | You → everyone | By 16:30 |

---

## Your "Bob Across the SDLC" Evidence List

Capture a screenshot or copy the output from each of these Bob interactions. This is the prompt-log deliverable:

| # | Phase | What you asked Bob | Save as |
|---|-------|-------------------|---------|
| 1 | Design | Propel architecture narrative | `docs/bob-prompt-log.md` entry |
| 2 | Design | Problem statement + solution | `docs/bob-prompt-log.md` entry |
| 3 | Requirements | Skill spec YAML | `docs/bob-prompt-log.md` entry |
| 4 | Requirements | Agent system prompt (draft) | `docs/bob-prompt-log.md` entry |
| 5 | Requirements | System prompt review + tighten | `docs/bob-prompt-log.md` entry |
| 6 | Design | Architecture document | `docs/bob-prompt-log.md` entry |
| 7 | Documentation | README | `docs/bob-prompt-log.md` entry |
| 8 | Documentation | CONTRIBUTING.md | `docs/bob-prompt-log.md` entry |
| 9 | Operations | Demo script refinement | `docs/bob-prompt-log.md` entry |
| 10 | Operations | Bob feedback outline | `docs/bob-prompt-log.md` entry |

B will compile the full cross-team log into `docs/bob-prompt-log.md` by 16:30. Send them your entries by 16:00.
