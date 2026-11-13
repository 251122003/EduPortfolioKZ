# Software Requirements Specification (SRS)

**Project:** EduPortfolio KZ — national registry of verified diplomas and certificates
**Course:** PED 741 Software Development Practice
**Team:** Zhasmin, Zhanel
**Version:** 2.0 (Assignment 3)

| Document | Where |
|---|---|
| Database schema and ERD | [database-schema.md](database-schema.md) |
| Behavioral UML: use case, activity, state machine | [diagrams/behavioral/](diagrams/behavioral/) |
| Structural UML: CRC cards, class, sequence | [diagrams/structural/](diagrams/structural/) |
| Executable schema | [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) |

## 1. Introduction

### 1.1 Purpose

This document specifies what EduPortfolio KZ shall do (functional requirements) and how well it shall do it (non-functional requirements). It is the single reference for design, implementation, testing and grading. Every requirement has an ID so that tests, diagrams and commits can point to it.

### 1.2 Definitions

| Term | Meaning |
|---|---|
| IIN | Individual identification number of a Kazakhstan citizen: 12 digits, encodes the birth date, ends with a check digit |
| BIN | Business identification number of an organization: 12 digits |
| Award | One diploma or certificate issued to one student for one event |
| Unclaimed record | A student record created by an organization before the student has an account |
| OTP | One-time password: the 6-digit SMS code used to confirm a phone number |
| HMAC hash | Keyed SHA-256 hash; lets the system find a record by IIN without storing the IIN in plain text |
| Share link | A secret URL with a random token that shows a chosen set of awards to anyone who has it |
| Verifier | A university admission officer who opens a share link; has no account |

## 2. Problem space and solution space

### 2.1 Problem space (what is wrong today)

| # | Problem | Who suffers | Consequence |
|---|---|---|---|
| P1 | Olympiad and competition results exist only as paper or PDF diplomas | Students, universities | Diplomas get lost; a student cannot prove an achievement years later |
| P2 | Paper diplomas are easy to forge | Universities, honest students | Admission and scholarship decisions are made on unverified documents |
| P3 | There is no single place that collects results from different organizers | Students | A student keeps dozens of files from schools, districts and national olympiads |
| P4 | Checking a diploma means calling or writing to the organizer | Universities | Verification takes days and often does not happen at all |
| P5 | School pupils' personal data (IIN, phone) is spread across spreadsheets and chats | Students, parents | Risk of leaks; violation of the personal data law |

### 2.2 Solution space (what EduPortfolio KZ does)

| Problem | Solution | Requirements |
|---|---|---|
| P1, P3 | Verified organizations enter results once; the system attaches each award to the student automatically by IIN | FR-3 – FR-5, FR-9, FR-10 |
| P2 | Only admin-verified organizations can issue awards; every change is audited; awards are never deleted; an AI worker flags suspicious records | FR-1, FR-2, FR-18, FR-19, FR-21 – FR-24 |
| P4 | A student creates a share link or QR code; a verifier sees the current status in seconds without an account | FR-13 – FR-17 |
| P5 | IIN and phone are stored encrypted, searched by keyed hash, and never shown to verifiers or sent to AI | NFR-5, NFR-6, FR-17, FR-22 |

### 2.3 System boundary

**Inside the system:** web client (React), REST API (NestJS), PostgreSQL database, background AI review worker.
**Outside the system (external actors):** SMS gateway (sends OTP codes), LLM API (plausibility check), the user's browser.

**In scope (MVP):** organization registration and verification, events and awards, student registration with SMS confirmation, student profile, share links with QR, audit log, corrections, kk/ru interface, background AI review.
**Out of scope (later):** integration with ministry databases, eGov/EDS login, mobile apps, bulk import from national registries, payments.

## 3. User personas

| Persona | Profile | Goals | Pain points today | Tech level |
|---|---|---|---|---|
| **Aruzhan, student (17)** | 11th grade, Shymkent; won a regional math olympiad and two district competitions | Keep all achievements in one place; show them to universities abroad and in Kazakhstan | Diplomas are photos in her phone gallery; one was lost | Uses a smartphone daily; no laptop of her own |
| **Gulnara, organizer (42)** | Methodologist at a regional education department; runs 6 olympiads a year with ~500 participants each | Publish results fast and once; stop answering "is this diploma real?" calls | Fills Excel sheets, prints and signs diplomas by hand | Office software; comfortable with web forms |
| **Daniyar, admission officer (35)** | University admission office; checks 2,000 applications per season | Confirm in seconds that a diploma is genuine and not revoked | Has to email organizers; forged diplomas slip through | Works on a desktop browser all day |
| **Admin (project team, later the ministry)** | 1–2 people who run the registry | Keep the registry trustworthy: approve real organizations, resolve disputes | — | High |

## 4. Roles and permissions

| Action | Student | Organization | Admin | Verifier |
|---|---|---|---|---|
| Register | yes (SMS) | request, then verified by Admin | created manually | no account |
| Log in with | phone + password | email + password | email + password | — |
| View own awards | yes | no | yes | only via link |
| Create / edit events and awards | no | own only | yes | no |
| Request a global change | no | yes | approves | no |
| Verify organizations | no | no | yes | no |
| Create share link | yes | no | no | no |
| View audit log | no | own records | all | no |
| Review AI flags | no | no | yes | no |

## 5. Use cases

The use case diagram and the full tabular specifications (actors, pre/post-conditions, `<<include>>` / `<<extend>>`) are in [diagrams/behavioral/use-case-diagram.md](diagrams/behavioral/use-case-diagram.md). Summary:

| ID | Use case | Primary actor | Main requirements |
|---|---|---|---|
| UC-1 | Student registers and receives awards | Student | FR-7 – FR-12 |
| UC-2 | Organization enters awards | Organization | FR-3, FR-4, FR-21 |
| UC-3 | Student shares portfolio, university verifies | Student, Verifier | FR-13 – FR-17 |
| UC-4 | Correction of an award | Organization, Admin | FR-5, FR-6, FR-18, FR-19 |
| UC-5 | Background AI review of new awards | AI worker, Admin | FR-21 – FR-24 |

### UC-1: Student registers and receives awards

- **Actor:** Student. **Secondary:** SMS gateway.
- **Preconditions:** the student has a 12-digit IIN and a phone that receives SMS; no account exists for this IIN.
- **Main success scenario:**
  1. Student opens the registration page and selects Kazakh or Russian.
  2. Student enters IIN, full name, phone and password.
  3. If the IIN shows the student is under 18, the student confirms parental/guardian consent.
  4. System validates the IIN format and checksum and checks that the IIN is not registered yet (lookup by HMAC hash).
  5. System sends a 6-digit SMS code valid for 5 minutes.
  6. Student enters the code.
  7. System creates the user and searches for an unclaimed student record matching IIN + full name + phone.
  8. System links the record, marks it `claimed` and opens the profile with all attached awards.
- **Alternative and error flows:**
  - A1. Invalid IIN format or checksum: form error, no SMS is sent.
  - A2. IIN already registered: generic failure message that does not reveal whether the IIN exists.
  - A3. Wrong code: attempt counter increases; after 5 attempts the code is locked for 15 minutes.
  - A4. Code expired: student requests a new code (limit 3 per hour per phone).
  - A5. No matching unclaimed record, or only the IIN matches: an empty profile is created; awards are never attached on a partial match.
  - A6. Under 18 and consent not confirmed: registration is blocked.
- **Postconditions:** user account exists, student is `claimed`, code is marked used, event is written to the audit log.

### UC-2: Organization enters awards

- **Actor:** Organization (verified).
- **Preconditions:** organization status is `verified` and the user is logged in.
- **Main success scenario:**
  1. Organization creates an event (title, date, level, subject).
  2. Organization adds an award: participant IIN, full name, phone, place, award type, document number.
  3. System validates the data and looks up the student by IIN hash.
  4. If no student record exists, system creates an `unclaimed` record; otherwise it attaches the award to the existing record.
  5. System saves the award with status `active`, writes the audit log and puts an AI review job in the queue.
- **Alternative and error flows:**
  - A1. Organization is not `verified`: request rejected with 403.
  - A2. Document number already exists for this organization: 409, nothing is saved.
  - A3. Invalid IIN or missing field: 422, nothing is saved.
  - A4. A record with this IIN exists but the full name or phone differs: 409 "participant data does not match"; the organization checks the data or files a change request.
  - A5. Event date is in the future: warning, the award is saved and flagged for AI review.
- **Postconditions:** award exists with status `active`, audit entry created, AI job queued.

### UC-3: Student shares portfolio, university verifies

- **Actors:** Student, Verifier.
- **Preconditions:** the student is logged in and has at least one award.
- **Main success scenario:**
  1. Student selects awards and a validity period (default 30 days).
  2. System generates a random token, stores only its hash, builds the link and a QR code, and shows them once.
  3. Student sends the link or shows the QR code.
  4. Verifier opens the link.
  5. System checks token, expiry and revocation, then shows student name, selected awards, organization, date, document number and current status. IIN and phone are never shown.
- **Alternative and error flows:**
  - A1. Link expired or revoked: page "link is no longer valid" (410).
  - A2. Unknown token: neutral "not found" page (404), no hints.
  - A3. A selected award was revoked after the link was created: it is shown with a visible "revoked" mark.
  - A4. Too many requests from one IP: 429.
  - A5. Student wants to share again after closing the page: the token cannot be shown again; a new link is created.
- **Postconditions:** share link record exists; revocation makes it unusable immediately.

### UC-4: Correction of an award

- **Actors:** Organization, Admin.
- **Preconditions:** the award belongs to the organization; the organization is `verified`.
- **Main success scenario (global change):**
  1. Organization opens an award and requests a global change (change of IIN, revoke, merge duplicates) with a reason.
  2. System creates a change request with status `pending`.
  3. Admin reviews the request and approves it.
  4. System applies the change, sets the award status to `corrected` or `revoked`, and writes the audit log with before and after values.
- **Alternative and error flows:**
  - A1. Minor edit of own award (place, document number, event title): applied immediately, status becomes `corrected`, audit log written, no Admin step.
  - A2. Organization tries to change another organization's award: 403.
  - A3. Admin rejects the request: a reason is required, award unchanged, decision logged.
  - A4. Award is already `revoked`: new requests are rejected with 409, except an Admin restore.
- **Postconditions:** award status reflects the decision; audit log contains the full history.

### UC-5: Background AI review of new awards

- **Actors:** AI worker (system), Admin. **Secondary:** LLM API.
- **Preconditions:** an award was created and a review job is queued.
- **Main success scenario:**
  1. Worker takes the job and builds a sanitized payload (event title, level, subject, date, place, award type, organization name; no IIN, phone or full name).
  2. Worker runs rule checks (duplicate document number across organizations, unusual number of awards for one event, future date) and asks an LLM to assess plausibility.
  3. Worker saves an `ai_flag` with score, reasons and model name.
  4. Admin sees flagged awards in a queue and marks each flag `confirmed` or `dismissed`.
  5. For a confirmed flag the Admin opens a change request or revokes the award.
- **Alternative and error flows:**
  - A1. LLM API error or timeout: retry 3 times with exponential backoff, then job status `failed`; the award is unaffected.
  - A2. Model returns invalid output: the output is discarded and only rule-check results are saved.
  - A3. No anomaly found: no flag is created.
- **Postconditions:** flags exist for suspicious awards. The worker never changes award status by itself; the decision always belongs to a human.

## 6. Functional requirements

Priority: **Must** = needed for the MVP demo; **Should** = planned for the MVP, can slip. Every requirement is verified by an automated test unless the last column says otherwise.

### 6.1 Organizations

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-1 | The system shall accept an organization registration request with name, 12-digit BIN, type and contact, and store it with status `pending`. | Must | API test |
| FR-2 | The system shall let only an Admin change an organization's status to `verified`, `rejected` or `suspended`, and shall reject event and award creation (403) from any organization that is not `verified`. | Must | API test |
| FR-3 | The system shall let a verified organization create an event with title, date, level (`school`, `district`, `regional`, `national`, `international`) and subject. | Must | API test |
| FR-4 | The system shall let a verified organization add an award to its own event with participant IIN, full name, phone, place, type (`diploma` / `certificate`) and document number, and shall reject a document number that already exists in the same organization (409). | Must | API test + DB unique constraint |
| FR-5 | The system shall let an organization edit place, document number or event title of its own award, set the award status to `corrected`, and write the change to the audit log. | Should | API test |
| FR-6 | The system shall route a change of IIN, a revocation or a merge of duplicates through a change request that takes effect only after Admin approval. | Should | API test |

### 6.2 Students

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-7 | The system shall let a student start registration with IIN, full name, phone and password, and shall reject an IIN with a wrong format, impossible birth date or wrong check digit (422) before sending any SMS. | Must | Unit test (`iin.spec.ts`) + API test |
| FR-8 | The system shall send a 6-digit SMS code valid for 5 minutes and shall create the account only after the correct code is entered. | Must | API test with mock SMS provider |
| FR-9 | The system shall link an unclaimed student record to the new account only when IIN, normalized full name (case, spaces, Ё/Е ignored) and phone all match. | Must | Unit + API test |
| FR-10 | The system shall create an empty profile when no unclaimed record matches, and shall never attach awards on a partial match. | Must | API test |
| FR-11 | The system shall derive the age from the IIN and shall block registration of a student under 18 until parental/guardian consent is confirmed. | Must | Unit test (`isMinor`) + API test |
| FR-12 | The system shall show a logged-in student all own awards with status `active`, `corrected` or `revoked`, with revoked awards visibly marked. | Must | API + UI test |
| FR-25 | The system shall authenticate a student by phone number and password, and staff (organization, admin) by email and password. | Must | API test |

### 6.3 Sharing and verification

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-13 | The system shall let a student create a share link that contains only the awards the student selects (at least one). | Must | API test |
| FR-14 | The system shall build each link from a random token of at least 128 bits, store only the token's SHA-256 hash, and let the student choose a validity period (default 30 days). | Must | Unit test + DB check |
| FR-15 | The system shall let a student revoke a link at any time, after which the link shall answer 410 within one request. | Must | API test |
| FR-16 | The system shall generate a QR code for every new link. | Should | UI test |
| FR-17 | The system shall show a verifier the student name, the selected awards, organization, date, document number and current status, and shall never show IIN or phone. | Must | API test checks the response body |

### 6.4 Audit and corrections

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-18 | The system shall record every create, update and status change in the audit log with actor, entity, action, time, and before/after values, and shall reject any UPDATE or DELETE of an audit row. | Must | DB trigger test |
| FR-19 | The system shall never delete an award; awards change only between `active`, `corrected` and `revoked`. | Must | DB trigger test |

### 6.5 Localization

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-20 | The system shall offer the whole interface in Kazakh and Russian with a language switch on every page. | Should | Missing-key check in CI |

### 6.6 AI review

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-21 | The system shall queue a background review job for every new or corrected award. | Should | API test checks `ai_jobs` |
| FR-22 | The AI worker shall send no IIN, phone or full name to an external model. | Must | Unit test on the payload builder |
| FR-23 | The AI worker shall only create flags; only an Admin shall change an award's status. | Must | Code review + test |
| FR-24 | The AI worker shall retry a failed job up to 3 times with exponential backoff and then mark it `failed`, visible to the Admin. | Should | Unit test with a failing LLM stub |

## 7. Non-functional requirements

| ID | Area | Requirement (measurable) | How it is checked |
|---|---|---|---|
| NFR-1 | Performance | The API shall answer profile, verification and award-creation requests in under **1.5 s at the 95th percentile** with **50 concurrent users**; `GET /health` in under **200 ms**. | Load test (autocannon) before release |
| NFR-2 | Responsive UI | The UI shall be usable from **360 px** width; layouts checked at 375, 768 and 1280 px. | Manual check, screenshots in PR |
| NFR-3 | Type safety | All code shall compile with TypeScript `strict: true` and **zero** explicit `any` (lint rule `no-explicit-any` = error); every request body, query and path parameter shall be validated with Zod at the API boundary. | `tsc` and `oxlint` in CI |
| NFR-4 | Testing | Each app shall keep at least **80% statement coverage**. | Coverage threshold fails CI |
| NFR-5 | Security | Traffic shall use **HTTPS only**; passwords shall be hashed with **argon2**; IIN and phone shall be stored with **AES-256-GCM** and searched by **HMAC-SHA256**; IIN and phone shall never appear in logs, URLs, public pages or audit entries; JWT shall be kept in an `httpOnly`, `Secure`, `SameSite=Strict` cookie. | Unit tests (`identity-crypto.spec.ts`), code review, log checks |
| NFR-6 | Privacy | The system shall comply with the Law of the Republic of Kazakhstan "On personal data and their protection": collect only listed fields, require guardian consent under 18, and keep data inside the country for production. | Review before pilot |
| NFR-7 | Anti-abuse | OTP codes shall expire after **5 min** and lock after **5** wrong attempts for **15 min**; at most **3 SMS per phone per hour**; login and public verification shall be limited to **10 requests per minute per IP** (then 429). | Automated tests |
| NFR-8 | Availability | The production service shall be available **99% per month** (≤ 7.3 h downtime); the database shall be backed up **daily** with a restore tested before release (RPO ≤ 24 h, RTO ≤ 4 h). | Uptime monitor on `/health`, restore test |
| NFR-9 | Scalability | The API shall be stateless; lookups shall use indexes on `iin_hash`, `phone_hash`, `token_hash`; the AI worker shall scale separately from the API. | Query plans reviewed |
| NFR-10 | Localization | All user-facing text shall go through i18n with `kk` and `ru` keys. | Missing-key check in CI |
| NFR-11 | Runtime | Both apps shall use ES Modules on Node.js 24 LTS: React 19 + Vite + Zustand on the client, NestJS 12 + Prisma 7 + PostgreSQL 18 on the server. | `package.json` `"type": "module"` |
| NFR-12 | Data integrity | Rules that must never break (BIN format, unique document number per organization, no deleted awards, append-only audit log) shall be enforced by the database itself through constraints and triggers, not only by application code. | Migration review + DB tests |

## 8. Data model

The full schema, ERD and design reasons are in [database-schema.md](database-schema.md); the executable version is [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). The class diagram in [diagrams/structural/class-diagram.md](diagrams/structural/class-diagram.md) shows the same entities with types and cardinalities.

| Table | Main fields |
|---|---|
| `organizations` | id, name, bin, type, status, contact, created_at, updated_at |
| `users` | id, role, login (staff only), password_hash, locale, organization_id, created_at |
| `students` | id, user_id, iin_hash, iin_encrypted, phone_hash, phone_encrypted, full_name, status, guardian_consent_at |
| `events` | id, organization_id, title, event_date, level, subject |
| `awards` | id, organization_id, event_id, student_id, place, type, document_number, status, created_by |
| `change_requests` | id, award_id, requested_by, type, payload, reason, status, reviewed_by, review_comment |
| `share_links` / `share_link_awards` | id, student_id, token_hash, expires_at, revoked_at / share_link_id, award_id |
| `otp_codes` | id, phone_hash, iin_hash, code_hash, payload_encrypted, expires_at, attempts, status |
| `audit_log` | id, actor_id, entity, entity_id, action, before, after, created_at |
| `ai_flags` | id, award_id, score, reasons, model, status, reviewed_by |
| `ai_jobs` | id, award_id, status, attempts, last_error, run_after, finished_at |

## 9. State machines

Diagrams with triggers and guards: [diagrams/behavioral/state-machine-diagram.md](diagrams/behavioral/state-machine-diagram.md).

### 9.1 Award

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| (new) | Organization creates award | org `verified` | `active` | audit log, AI job queued |
| `active` | Organization edits own award | owner | `corrected` | audit log |
| `corrected` | Organization edits own award | owner | `corrected` | audit log |
| `active` / `corrected` | Change request approved (non-revoke) | Admin | `corrected` | audit log |
| `active` / `corrected` | Change request approved (revoke) | Admin | `revoked` | audit log |
| `revoked` | Admin restores | Admin | `corrected` | audit log |
| `revoked` | Any other event | - | rejected | 409 |

### 9.2 Organization

| From | Event | To |
|---|---|---|
| (new) | Registration request | `pending` |
| `pending` | Admin approves | `verified` |
| `pending` | Admin rejects | `rejected` |
| `verified` | Admin suspends | `suspended` |
| `suspended` | Admin reinstates | `verified` |

### 9.3 Student record

| From | Event | Guard | To |
|---|---|---|---|
| (new) | Organization adds award for unknown IIN | - | `unclaimed` |
| (new) | Student registers, no match | correct SMS code | `claimed` |
| `unclaimed` | Student registers | IIN + name + phone match, correct SMS code | `claimed` |

### 9.4 Share link

| From | Event | To |
|---|---|---|
| (new) | Student creates link | `active` |
| `active` | `expires_at` reached | `expired` |
| `active` | Student revokes | `revoked` |
| `expired` / `revoked` | Any | no change (terminal) |

### 9.5 Change request

| From | Event | To |
|---|---|---|
| (new) | Organization submits | `pending` |
| `pending` | Admin approves | `approved` |
| `pending` | Admin rejects (reason required) | `rejected` |

### 9.6 OTP code

| From | Event | To |
|---|---|---|
| (new) | SMS sent | `issued` |
| `issued` | Correct code entered | `verified` |
| `issued` | 5 minutes pass | `expired` |
| `issued` | 5 wrong attempts | `locked` |

## 10. Architecture and CRC cards

The backend follows a layered structure: **controller** (HTTP, validation) → **service** (business rules) → **repository** (Prisma, the only layer that touches PostgreSQL). CRC cards for every class are in [diagrams/structural/crc-cards.md](diagrams/structural/crc-cards.md); the HTTP flows are in [diagrams/structural/sequence-diagram.md](diagrams/structural/sequence-diagram.md).

## 11. API overview (REST)

| Method | Path | Description | Success | Main errors |
|---|---|---|---|---|
| GET | `/health` | API and database status | 200 | 503 |
| POST | `/auth/register/student` | Start student registration, send SMS | 202 | 422, 429 |
| POST | `/auth/verify-otp` | Confirm code, finish registration | 201 | 400, 410, 423 |
| POST | `/auth/resend-otp` | Send a new code | 202 | 429 |
| POST | `/auth/login` | Log in | 200 | 401, 429 |
| POST | `/organizations` | Submit organization request | 201 | 409, 422 |
| PATCH | `/admin/organizations/:id` | Approve, reject, suspend | 200 | 403, 404 |
| POST | `/events` | Create event | 201 | 403, 422 |
| POST | `/events/:id/awards` | Add award | 201 | 403, 409, 422 |
| PATCH | `/awards/:id` | Edit own award | 200 | 403, 409 |
| POST | `/change-requests` | Request global change | 201 | 403, 409 |
| PATCH | `/admin/change-requests/:id` | Approve / reject | 200 | 403, 422 |
| GET | `/admin/ai-flags` | List AI flags | 200 | 403 |
| PATCH | `/admin/ai-flags/:id` | Confirm or dismiss a flag | 200 | 403 |
| GET | `/me/awards` | Student's awards | 200 | 401 |
| POST | `/me/share-links` | Create link | 201 | 401, 422 |
| DELETE | `/me/share-links/:id` | Revoke link | 204 | 401, 404 |
| GET | `/v/:token` | Public verification data | 200 | 404, 410, 429 |

Every error uses one body format: `{ "error": { "code": "...", "message": "..." } }`.

## 12. Traceability

| Use case | Requirements | Diagrams |
|---|---|---|
| UC-1 | FR-7 – FR-11, FR-25, NFR-5, NFR-7 | Use case, Activity (swimlanes), State machine (OTP, Student record), Sequence 2 |
| UC-2 | FR-2 – FR-4, FR-21, NFR-12 | Use case, Class, State machine (Award) |
| UC-3 | FR-13 – FR-17, NFR-7 | Use case, State machine (Share link), Sequence 1 |
| UC-4 | FR-5, FR-6, FR-18, FR-19 | Use case, State machine (Award, Change request) |
| UC-5 | FR-21 – FR-24 | Use case, CRC (`AiReviewWorker`) |

## 13. Risks

| Risk | Mitigation |
|---|---|
| Registration with someone else's IIN | Phone match + SMS code |
| Fake organizations | Manual verification by Admin, later a list of accredited bodies |
| Leak of personal data | Encryption, hashing, minimal exposure, access logs |
| Wrong data entered by an organization | Audit log, correction flow, `revoked` status |
| SMS provider outage or cost | Provider interface, rate limits, mock provider in development |
| AI worker leaks personal data to an external model | Sanitized payload without IIN, phone and name |
| AI worker gives false flags or misses fraud | Advisory only, Admin decides, rule checks run independently of the LLM |
