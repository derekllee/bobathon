# Bob Prompt Log — Bobathon 2025
# CSP Bob Connector Project

> **Purpose:** Required hackathon deliverable. Logs every significant Bob interaction across all three team roles during the build day.  
> **Format:** Phase | Prompt (abbreviated) | Output | Quality (1–5) | Notes

---

## Full Prompt Log

| # | Phase | Role | Prompt (first sentence) | Bob Output | Quality | Notes |
|---|-------|------|------------------------|------------|---------|-------|
| 1 | Design | C | "Write a 400-word architecture narrative that describes what Propel's pattern is…" | 400-word narrative for docs/architecture.md; component descriptions and connector framing | 5 | Nailed the Propel framing; used verbatim in README |
| 2 | Design | C | "Write a problem statement and solution summary for a hackathon project submission…" | 2-paragraph judge-ready narrative; "the answer is buried in CSP but invisible inside Bob" | 5 | Perfect cold-open for the demo video |
| 3 | Requirements | C | "Write a complete skill-spec.yaml file for a Bob IDE skill called 'Support Intelligence'…" | Full YAML schema with guardrails G1–G7, 5-step workflow, output schema, [CUSTOMIZE] markers | 5 | Immediately demo-ready; judges can scroll through it |
| 4 | Requirements | C | "Write a system prompt for an AI agent called 'Support Intelligence' inside IBM Bob…" | 380-word system prompt with 7 enforced behaviors, output format spec, confidence levels | 4 | Needed one tightening pass to remove hedged language |
| 5 | Requirements | C | "Review this system prompt for an AI support analysis agent: [draft]. Identify any guardrail that could be misinterpreted…" | Revised guardrails with unambiguous phrasing; tightened confidence level definitions | 5 | Second-pass output was handed directly to Team A |
| 6 | Design | C | "Write a technical architecture document for the CSP Bob Connector. Include ASCII diagram, component descriptions…" | Full docs/architecture.md with ASCII diagram, guardrail table, design decisions | 5 | ASCII diagram was surprisingly accurate; zero manual edits needed |
| 7 | Documentation | C | "Write a README.md for an open-source IBM Bob extension called 'CSP Bob Connector'…" | Full README with all 10 sections; IBM documentation style | 4 | Bob config section needed Team A's exact format filled in post-generation |
| 8 | Documentation | C | "Write a CONTRIBUTING.md for the CSP Bob Connector repository. Audience: IBM developer adding a new connector…" | 580-word CONTRIBUTING.md; 8 sections; numbered connector steps | 5 | Under word limit; usable without edits |
| 9 | Operations | C | "Here is a 5-minute demo script for our hackathon presentation: [§13 PLAN.md]. Refine it so that every scene has a clear spoken line…" | docs/demo-script.md with [0:00] timestamps, exact typed text, panic plan | 5 | Panic plan section was unexpectedly high quality |
| 10 | Operations | C | "I need to write 500 words of honest feedback on using IBM Bob as an SDLC assistant…Give me a structured outline…" | 5-section outline with 2–3 bullet points per section | 4 | Outline used as scaffold; content written by hand from real experience |
| 11 | Infrastructure | B | "Write a TypeScript class IamTokenManager that fetches an IAM access token… caches it… proactively refreshes it 60 seconds before expiry…" | Full iam_auth.ts with cache, refresh logic, AuthError class, axios call | 5 | Correct on first try; no changes needed |
| 12 | Infrastructure | B | "Write a TypeScript function extractSessionCookie() that reads a cookie string from process.env.CSP_SESSION_COOKIE…" | session_auth.ts with validation, cookieName override, expiry warning | 4 | Added CSP_COOKIE_SET_AT env var check that wasn't in original prompt |
| 13 | Testing | B | "Generate realistic mock CSP support case data for the following search queries…" | csp_responses.json with 3 search fixtures (10 cases total) + 2 full case details | 5 | All 14 validation checks pass; Salesforce-format IDs, correct URL pattern |
| 14 | Testing | B | "Write Jest unit tests for these MCP tool handlers… Mock CspClient with jest.mock…" | tools.test.ts with 12 tests across 4 suites (search, get_case, get_related_docs, unknown tool) | 5 | 12/12 passing in ~0.25s; coverage of error paths was thorough |
| 15 | Infrastructure | B | "Create a reusable connector template by replacing all CSP-specific logic with [CUSTOMIZE: description] placeholders…" | connector-template/ with 4 files: index-template.ts, client-template.ts, auth-template.ts, HOWTO.md | 5 | Template is genuinely reusable; HOWTO.md covers all steps |
| 16 | Documentation | B | "Expand this guardrail ruleset into a full document: G1 through G7…" | docs/guardrails.md with motivation, enforcement, example, and customization per rule | 5 | G4 (no fabrication) section was particularly strong |
| 17 | Integration | A | "Here is the stub for the csp_get_case tool handler. Complete the handler so it: validates input with Zod, calls cspClient.getCase(), returns MCP content, handles 404…" | Complete handler body for index.ts csp_get_case case | 4 | Zod schema was correct; needed minor adjustment to match CspClient return type |
| 18 | Integration | A | "Wire the Support Intelligence skill system prompt into the MCP server as a prompt resource…" | Prompt resource registration block for index.ts | 4 | Followed MCP SDK prompts API correctly |
| 19 | Infrastructure | A | "Fix this TypeScript build error: [paste error]. The constructor takes CspClientConfig not (baseUrl, tokenProvider)…" | Corrected CspClient instantiation; identified config object pattern | 5 | Root-caused the constructor mismatch in one turn |
| 20 | DevOps | B | "Write a GitHub Actions CI workflow that runs npm ci, npm run build, and npm test on push to main and PR…" | .github/workflows/ci.yml with Node 20, correct working-directory | 5 | Used verbatim |

---

## Cross-Team Prompt Pattern Summary

**What worked best for code generation:** Highly specific prompts with explicit TypeScript signatures, named env vars, error class names, and test case numbers. Bob produced correct, compilable code when given exact interface contracts. Vague prompts like "write a client" required 2–3 follow-up turns to converge.

**What worked best for documentation:** Prompts that included a target audience, a word limit, and an explicit section list. Bob reliably stayed within scope when given structure. Open-ended documentation prompts produced verbose output that required manual trimming.

**What was frustrating:** Multi-file refactors in a single prompt (e.g., "update index.ts and client.ts simultaneously") often produced inconsistent cross-file assumptions. Breaking refactors into sequential, single-file prompts was significantly more reliable. Bob also occasionally hallucinated import paths (`.js` vs no extension) in CommonJS modules; always verify imports before running `tsc`.

---

*Compiled by Team B from entries submitted by all three team members. Bobathon 2025.*
