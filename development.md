# Development

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS | ES Modules (`"type": "module"` in `package.json`) |
| npm | 10+ | Comes with Node.js |
| PostgreSQL | 16 | Local install or Docker |
| Git | 2.40+ | Conventional Commits |
| Editor | VS Code or Cursor | Extensions below |

Recommended editor extensions:

- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense
- GitLens
- Conventional Commits
- i18n Ally (kk/ru translation keys)
- Vitest

## 2. Technology stack

| Layer | Now | Target |
|---|---|---|
| Frontend | Vanilla HTML, CSS, JS (`frontend/`) | React 19, TypeScript, Vite, Tailwind CSS, Zustand, react-i18next |
| Backend | Node.js (`backend/index.js`) | Node.js ES Modules, Express, Zod validation |
| Database | none yet | PostgreSQL 16, Prisma ORM with migrations |
| Auth | none yet | JWT in HTTP-only cookies, argon2 |
| SMS | none yet | `SmsProvider` interface, mock provider in development |
| AI worker | none yet | Separate Node process reading the `ai_jobs` table |
| Tests | none yet | Vitest, Testing Library, coverage threshold 80% |
| CI | none yet | GitHub Actions: lint, type-check, test |

Phase 1 (current) is the frontend with mock data in the browser. Phase 2 adds the server, PostgreSQL, real SMS codes, roles and the audit log, as described in the Application Development Plan. The frontend moves from vanilla JS to React 19 + TypeScript in Week 4, following the course.

## 3. Repository structure

```
EduPortfolioKZ/
├── backend/
│   ├── index.js            # entry point (later src/ with routes, controllers, services, repositories)
│   └── prisma/             # schema.prisma and migrations (from Week 6)
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js              # later a Vite + React + TypeScript app
├── README.md
├── specifications.md
├── development.md
├── claude.md
└── .env.example
```

## 4. Local setup

```bash
git clone https://github.com/251122003/EduPortfolioKZ.git
cd EduPortfolioKZ
cp .env.example .env            # then fill in secrets
```

PostgreSQL (once the backend has a schema):

```bash
psql -U postgres -c "CREATE USER eduportfolio WITH PASSWORD 'change_me';"
psql -U postgres -c "CREATE DATABASE eduportfolio OWNER eduportfolio;"
```

Backend:

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

Frontend (current static version):

```bash
npx serve frontend
```

## 5. Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

```
PORT=3000
APP_BASE_URL=http://localhost:5173
DATABASE_URL=postgresql://eduportfolio:change_me@localhost:5432/eduportfolio
JWT_SECRET=replace_with_long_random_string
IIN_HMAC_KEY=replace_with_32_random_bytes_hex
IIN_ENCRYPTION_KEY=replace_with_32_random_bytes_hex
SMS_PROVIDER=mock
SMS_API_KEY=
LLM_API_KEY=
LLM_MODEL=
```

## 6. Git workflow

- `main` is always working. Larger changes go through branches and pull requests.
- Branches: `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`.
- Small, frequent commits, one logical change each.

### Conventional Commits

Format: `type(scope): short description`

| Type | Use for |
|---|---|
| `feat` | new feature |
| `fix` | bug fix |
| `docs` | documentation only |
| `refactor` | code change without behavior change |
| `test` | adding or changing tests |
| `chore` | tooling, dependencies, config |
| `ci` | CI pipeline |

Examples:

```
docs: add README and specifications
feat(frontend): render awards from API with fetch
chore(backend): initialize Node.js project with ES modules
feat(auth): add student registration with SMS code
fix(otp): expire code after 5 minutes
```

## 7. Code standards

- TypeScript strict mode, zero explicit `any`, ESLint and Prettier must pass.
- All input validated at the API boundary (Zod).
- REST: nouns in URLs, correct status codes, JSON errors `{ "error": { "code", "message" } }`.
- No secrets in code. No IIN or phone in logs.
- Every public endpoint has a rate limit.
- New behavior needs a test; statement coverage at least 80%.

## 8. Roadmap (15 weeks)

| Week | Focus | Result |
|---|---|---|
| 1 | Systems and AI orchestration | Repository initialized, AI tools set up |
| 2 | Software engineering blueprint | Idea, personas, first requirements |
| 3 | Frontend foundations (vanilla JS) | `frontend/` with fetch and DOM rendering; scope and draft plan |
| 4 | React 19, TypeScript, Zustand | **Deliverable 1 submitted**; frontend migrated to Vite + React + TS |
| 5 | Node.js ES Modules REST API | `backend/` skeleton, health endpoint, typed API client |
| 6 | PostgreSQL schema and migrations | **Milestone:** Prisma schema and migrations for all tables |
| 7 | Auth | Student registration, mock SMS OTP, login, kk/ru |
| 8 | Midterm exam | **Milestone:** Midterm |
| 9 | UML system diagrams | **Milestone:** class, sequence, state and ER diagrams |
| 10 | Organizations and awards | Admin approval, events, awards, matching on registration |
| 11 | Sharing | Share links, QR, public verification page, revoke |
| 12 | Audit and corrections | Audit log, change requests, award statuses |
| 13 | AI background worker | `ai_jobs` queue, rule checks, LLM flags, Admin review |
| 14 | Hardening | Tests at 80%+, rate limits, responsive check, bug fixes |
| 15 | Final application | **Milestone:** final capstone and oral defense |

Mapping to the stages of the Application Development Plan: stages 1-2 (frontend with mock data) are weeks 3-4; stage 3 (server and database) is weeks 5-7; stage 4 (security) is weeks 7 and 14; stage 5 (audit and corrections) is week 12; stage 6 (pilot) follows week 15.

## 9. Definition of done

- Feature works as described in `specifications.md`
- Tests pass, lint and type-check pass, CI green
- Docs updated if behavior changed
- Commit messages follow Conventional Commits
- Every line of AI-generated code has been read, understood and verified
