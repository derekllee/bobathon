# Agentic Guardrails — CSP Bob Connector

Seven rules that govern every response the Support Intelligence agent produces. All connectors built from the `connector-template/` must preserve G1–G7. Domain-specific rules may be added after G7.

---

## G1 — Search Before Reasoning

**Rule:** Always call `csp_search_cases` before forming any hypothesis. Never answer from training knowledge alone when the user describes a technical problem.

**Why it matters:** LLMs have broad knowledge of IBM products but no access to your organisation's specific case history. A plausible-sounding root cause derived from training data may contradict what IBM support engineers actually observed and resolved. G1 ensures every hypothesis is grounded in real evidence retrieved at query time.

**Where enforced:** System prompt (first rule, imperative language). Tool description for `csp_search_cases` opens with "Always call this before root cause analysis."

**Example trigger:** User asks "Why does my Presto coordinator keep OOM-killing?" → agent must call `csp_search_cases(keywords="Presto OOM coordinator")` before responding. If it responds without searching, G1 is violated.

**Customising for a new connector:** Replace `csp_search_cases` with your primary search tool name in the system prompt. Keep the rule unconditional — no "if you already know the answer" exception.

---

## G2 — Cite Every Claim

**Rule:** Every factual statement in the output must reference a `case_id` or `article_id`. No uncited assertions are permitted.

**Citation format:**
```
[CSP:TS012483901] "The JVM heap for the Presto coordinator was increased from 8 GB to 14 GB..."
  → https://ibmsf.lightning.force.com/lightning/r/Case/500DyA3K8mNpQ7rXv2Wj/view
```

**Why it matters:** Without citations, the agent's output is indistinguishable from a hallucination. Citations let the engineer verify the source in one click, build trust in the tool, and catch cases where the cited evidence doesn't actually support the claim.

**Where enforced:** System prompt instruction ("do not make a claim without a citation"). Output schema requires a non-empty `citations` array for any response with confidence HIGH, MEDIUM, or LOW.

**Example trigger:** Agent writes "JVM heap exhaustion is the most common cause of OOM kills in watsonx.data." This requires at least one `[CSP:...]` citation. If none is present, the output schema rejects the response.

**Customising for a new connector:** Change `CSP` to your system abbreviation (e.g. `[SNOW:INC0012345]` for ServiceNow). Update the citation format in the system prompt. Keep the structural requirement: every factual claim → at least one citation.

---

## G3 — Report Confidence Always

**Rule:** Every response must include a `confidence_level` (HIGH / MEDIUM / LOW / INSUFFICIENT) and a one-sentence `confidence_rationale`. If confidence is INSUFFICIENT, the agent must stop and say so explicitly.

**Confidence rubric:**

| Level | Criteria |
|---|---|
| **HIGH** | ≥3 cases with matching symptoms **and** matching resolution pattern; docs corroborate |
| **MEDIUM** | 1–2 cases match symptoms; resolution pattern partially consistent |
| **LOW** | Symptom match only; no resolution data; conflicting signals across cases |
| **INSUFFICIENT** | Fewer than 1 relevant case found; agent must stop and not hypothesise |

**Why it matters:** Engineers use Bob's output to make decisions under time pressure. A response that doesn't state its own reliability forces the reader to judge reliability themselves — they usually can't, and often over-trust. Explicit confidence levels make the agent's epistemic state visible and auditable.

**Where enforced:** Output schema — `confidence_level` and `confidence_rationale` are both `required: true`. A response missing either field is rejected. System prompt defines the rubric so the LLM assigns the right level.

**Example trigger:** Agent finds 1 case that mentions OOM but has no resolution data. Correct output: `confidence_level: LOW`, rationale: "One case matches symptoms but no confirmed resolution was found." Incorrect: outputting `confidence_level: HIGH` or omitting the field.

**Customising for a new connector:** Adjust the numeric thresholds in the rubric if your data source is sparser (e.g. set MEDIUM to ≥1 case if your system has fewer historical records). Keep the INSUFFICIENT level unchanged — no evidence must always mean no hypothesis.

---

## G4 — Never Fabricate Root Causes

**Rule:** Root cause hypotheses must be supported by at least one retrieved case. Only hypothesise what the evidence directly supports. If no evidence exists, output `confidence_level: INSUFFICIENT` and stop.

**Why it matters:** Root cause fabrication is the highest-risk failure mode for this agent. An engineer who acts on a fabricated root cause wastes hours chasing a non-existent problem and may introduce new failures. G4 is the hard stop that prevents the agent from being confidently wrong.

**Where enforced:** System prompt (explicit prohibition). Output validator checks that every entry in `root_cause_hypotheses` has at least one `evidence_case_id` that appears in the `citations` array. An hypothesis with no citation fails validation.

**Example trigger:** Search returns 0 results. Correct behaviour: output INSUFFICIENT confidence, no hypotheses, recommend searching CSP directly. Incorrect: generating a hypothesis about "likely JVM misconfiguration" based on general knowledge.

**Customising for a new connector:** No customisation needed — this rule is universal. The evidence requirement (each hypothesis cites at least one retrieved record) applies regardless of domain.

---

## G5 — Bound Tool Calls

**Rule:** Maximum 3 parallel `csp_get_case` calls per query. Maximum 2 total tool types invoked per workflow run. Do not chain unbounded tool calls or recursive searches.

**Why it matters:** Unbounded tool use degrades response latency, increases API costs, risks rate limiting from CSP, and makes agent behaviour unpredictable. G5 ensures that a single user query has a deterministic upper bound on external calls.

**Where enforced:** `max_parallel_calls: 3` in `skill-spec.yaml` under the `csp_get_case` connector binding. MCP server applies a per-request timeout of 15 seconds. The system prompt instructs the agent to fetch detail for "at most 3 cases."

**Example trigger:** Search returns 8 cases. Agent must select the top 3 for detail enrichment, not all 8. If the skill spec limit is respected, the 4th–8th `csp_get_case` calls are never made.

**Customising for a new connector:** Adjust the parallel call limit based on your system's rate limits (e.g. reduce to 1 for a slow legacy API). Keep the principle: always define an explicit upper bound. Never leave tool call count open-ended.

---

## G6 — Tag Source Type in Citations

**Rule:** Citations must tag their `source_type` as `CSP_CASE` or `KB_ARTICLE`. Do not conflate support case resolutions with product documentation.

**Why it matters:** A resolution from a real support case ("we fixed it by increasing heap to 14 GB") carries different epistemic weight than a KB article ("the recommended heap is 8–16 GB depending on workload"). Conflating them leads engineers to treat documentation guidance as confirmed fixes, or vice versa.

**Where enforced:** `source_type` is a required enum field in the `citations` array output schema. The system prompt instructs the agent to label each citation with its source type.

**Example trigger:** Agent cites both a closed case resolution and a KB tuning guide. Correct output: case citation tagged `CSP_CASE`, article tagged `KB_ARTICLE`. Incorrect: both cited with the same tag, or `source_type` omitted.

**Customising for a new connector:** Replace the enum values with your system's source types. Examples: `INCIDENT` / `PROBLEM` / `RUNBOOK` for ServiceNow; `ISSUE` / `WIKI` for a GitHub-based system. Add as many types as your domain needs — just keep the field required.

---

## G7 — Respect Data Sensitivity

**Rule:** Do not repeat raw PII (customer names, email addresses, account IDs, company names) from case descriptions in the output. Summarise instead.

**Why it matters:** CSP case descriptions often contain customer-identifying information submitted during a support engagement. Echoing this data in Bob's responses risks exposing it beyond its intended context — to other users sharing a Bob session, to logs, or to clipboard history.

**Where enforced:** System prompt instruction ("do not repeat raw PII; summarise instead"). A planned MCP server middleware layer (`pii_scrubber.ts`) will apply regex-based scrubbing to all tool output before it reaches the LLM — this provides defence-in-depth beyond the prompt instruction alone.

**Example trigger:** Case description contains "Customer john.doe@acme.com reported that their cluster at IP 10.0.0.5...". Correct agent output: "A customer reported that their cluster experienced...". Incorrect: repeating the email address or IP in the analysis.

**Customising for a new connector:** If your source system contains particularly sensitive field types (e.g. healthcare data, financial account numbers), add those field names to the PII scrubber's pattern list in `mcp-server/src/middleware/pii_scrubber.ts`. Keep the system prompt instruction unconditional.

---

## Enforcement Architecture Summary

```
┌─────────────────────┬────────────────────────────────────────────────────┐
│ Layer               │ Guardrails enforced                                │
├─────────────────────┼────────────────────────────────────────────────────┤
│ System prompt       │ G1 (search first), G4 (no fabrication),            │
│                     │ G7 (no PII), G5 (≤3 case fetches)                 │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Tool descriptions   │ G1 ("Always call this before root cause analysis") │
├─────────────────────┼────────────────────────────────────────────────────┤
│ Output schema       │ G2 (citations required), G3 (confidence required), │
│                     │ G4 (hypothesis ↔ citation cross-check),            │
│                     │ G6 (source_type enum required)                     │
├─────────────────────┼────────────────────────────────────────────────────┤
│ skill-spec.yaml     │ G5 (max_parallel_calls: 3, tool_call_limit)        │
├─────────────────────┼────────────────────────────────────────────────────┤
│ MCP middleware      │ G5 (per-request timeout), G7 (PII scrubber)        │
└─────────────────────┴────────────────────────────────────────────────────┘
```

Guardrails at multiple layers provide defence-in-depth: a failure at the prompt layer is caught by schema validation; a failure at schema validation is caught by middleware.
