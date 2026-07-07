# IBM Bob as an SDLC Assistant — Honest Feedback
# Bobathon 2025 — Team B (CSP Bob Connector)

> Written from direct experience building the CSP Bob Connector in a single hackathon day.  
> ~520 words. Unfiltered.

---

## What Worked Well

**Code generation for well-scoped tasks was excellent.** When we gave Bob a tight TypeScript interface — exact method signatures, named env vars, explicit error class names — it produced compilable, correct code on the first attempt in the majority of cases. The `IamTokenManager` class (IAM token fetch, cache, and proactive refresh) came back clean without a single change. The Jest test suite for 12 test cases took one prompt and ran green immediately. For isolated, well-specified units, Bob is genuinely faster than writing from scratch.

**Documentation generation was surprisingly strong.** The architecture document, README, and CONTRIBUTING.md all came back in IBM documentation style with appropriate structure. The demo script — including timestamp markers and a panic plan — was usable with zero edits. Bob appears to internalize document tone when you name the audience explicitly. "Write for an IBM developer who did not build this system" produced noticeably better output than "write documentation."

**Debugging and root-cause analysis was fast.** When the TypeScript build broke due to a CspClient constructor mismatch, pasting the error and the relevant file excerpts into Bob produced the correct fix in one turn. It correctly identified that the constructor expected a config object, not two positional arguments, and produced the minimal diff needed. This saved at least 20 minutes of manual investigation.

---

## What Was Frustrating

**Multi-file refactors in a single prompt were unreliable.** When we asked Bob to update `index.ts` and `csp_client.ts` simultaneously, the two files made inconsistent assumptions about the auth interface shape. Breaking the same work into two sequential, single-file prompts always produced better results. Bob does not maintain cross-file consistency well in a single generation pass.

**Import path hallucination in CommonJS projects.** Bob repeatedly generated `.js` extension imports (e.g., `import { CspClient } from './client/csp_client.js'`) in a `"type": "commonjs"` project where those extensions cause runtime failures under `ts-jest`. Every code generation pass required a manual import-path audit. This is a sharp edge that cost real time.

**Context window confusion on long files.** When `index.ts` grew beyond ~200 lines, Bob's edits to specific handler functions occasionally introduced regressions in other handlers in the same file. Smaller, focused files with single-responsibility would have made Bob more effective throughout the day.

---

## Surprising Capabilities

The guardrails document (G1–G7 with motivation, enforcement mechanism, worked example, and customization guidance per rule) was the most impressive single output of the day. What would have taken 90 minutes of careful writing came back in one pass at a quality level that required no substantive revision. Complex structured documents with repeated internal patterns are a genuine Bob strength.

---

## Gaps

Bob has no awareness of your running build. It cannot tell you "this import will fail at runtime" without being shown the tsconfig. A tighter integration between Bob and the active TypeScript compiler errors — real-time, without copy-paste — would eliminate the most common friction point we experienced.

---

## Recommendations

1. Add a "CommonJS vs ESM" mode flag to code generation prompts so Bob selects the correct import style automatically.
2. Enable multi-file edit coordination: let Bob hold a lightweight mental model of the files it has already modified in a session before generating a new edit.
3. The current prompt-response loop is fast enough for documentation tasks but creates context-management overhead for iterative code work. A "keep editing this file" mode — where Bob accumulates diffs against a single file across turns — would be a significant quality-of-life improvement for the coding workflow.

---

*Written by Team B, Bobathon 2025. Not reviewed by Bob.*
