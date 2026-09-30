# claude.md

Rules for AI coding assistants (Cursor, Claude Code, GitHub Copilot) working in this repository.

## Project

EduPortfolio KZ: a registry of diplomas and certificates. Organizations enter awards, students get a profile, universities verify via QR/link. Course project for PED 741.

Read `specifications.md` before changing behavior and `development.md` for setup and workflow. If something is not described there, ask before building it.

## Stack constraints

- Frontend: `frontend/`. Currently vanilla HTML/CSS/JS. From Week 4: React 19 + TypeScript + Vite + Tailwind CSS + Zustand.
- Backend: `backend/`. Node.js 22 with ES Modules (`import`/`export`, never `require`), Express, Zod, Prisma.
- Database: PostgreSQL 16. Schema changes only through Prisma migrations, never by editing the database by hand.
- Tests: Vitest. Do not add other frameworks or libraries without asking.

## TypeScript rules

- `strict: true`. No explicit `any`; use `unknown` and narrow it. No `@ts-ignore` without a comment explaining why.
- Explicit return types on exported functions.
- Types for API payloads live in one shared place and are reused by client and server.
- `const` by default, no `var`, no unused variables or imports.
- Formatting: Prettier, 2 spaces, single quotes, semicolons. ESLint must pass.

## Architecture rules

- Backend layers: route, controller, service, repository. Controllers contain no business logic; services never touch `req` or `res`; only repositories talk to Prisma.
- Frontend: Zustand holds client state only (session, language, UI selections). Data from the server goes through the typed API client, never through direct `fetch` calls inside components.
- Validate every request body, query and params with Zod.
- Use `textContent` or framework escaping; never `innerHTML` with user data.

## REST API standards

- Nouns in paths, plural: `/events`, `/awards`. Verbs through HTTP methods.
- Status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, used correctly.
- Error format: `{ "error": { "code": "STRING", "message": "text" } }`.
- Never return IIN or phone in any response.
- Every public endpoint has a rate limit.

## Hard rules (security and domain)

1. Never store IIN or phone in plain text. Use encrypted columns plus HMAC hashes for lookup.
2. Never log, return in public endpoints, or display IIN or phone numbers.
3. Share links use random tokens only; store only the token hash. Never put IIN or internal IDs in URLs.
4. Never delete awards. Use statuses `active`, `corrected`, `revoked`.
5. Every create, update or status change writes to `audit_log`.
6. Organizations change only their own records. Global changes go through `change_requests` approved by Admin.
7. Registration finishes only after a correct SMS code. Keep rate limits on OTP and login.
8. All user-facing text goes through i18n with both `kk` and `ru` keys.
9. The AI worker never sends IIN, phone or full name to an external model and never changes award status itself.
10. No secrets in code or commits. Use `.env` and keep `.env.example` up to date.

## Conventional Commits

Format: `type(scope): short description`, imperative, lowercase, no period.
Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
One logical change per commit. Never use messages like `update` or `changes`.
Examples: `feat(auth): add student registration with SMS code`, `fix(otp): expire code after 5 minutes`.

## Prompting guardrails

- Work in small steps: one function, endpoint or component per request.
- Before writing code, state which file you will change and why.
- Do not invent libraries, APIs, functions or file paths. If unsure that something exists, say so and check the docs or the repository.
- Do not add features, dependencies or files outside the requested task.
- If a request conflicts with the rules above, stop and ask instead of guessing.
- Keep answers and code simple and direct.

## Verification loop (before every commit)

1. Run `npm run lint`, `npm run typecheck`, `npm test`. All must pass; coverage stays at 80% or above.
2. Read the diff. Every generated line must be understood by the author.
3. Check behavior manually: browser DevTools (network 200 OK, clean console) for the frontend, real requests for the API.
4. Update `specifications.md` if behavior changed.
5. Commit with a Conventional Commit message.
