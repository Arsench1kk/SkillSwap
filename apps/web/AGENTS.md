## Team coordination

The root `../../AGENTS.md` also applies. Before implementation, read
`../../docs/launch/README.md`, the ownership/gates in `../../docs/launch/PLAN.md`,
the open decisions, and your named task. Work only in that package's owned files;
do not treat this app-specific file as replacing the root product/data rules.
Read `../../docs/launch/HANDOFFS.md` and incoming author records before editing.
Publish your own cross-team handoff when a task changes another owner's contract
or dependencies; the protocol applies equally to D1–D6 and their agents.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
