# Specifications

Project: EduPortfolio KZ | Course: PED 741 Software Development Practice

## 1. Goal and educational value

Build a nationwide platform that stores verified diplomas and certificates from school competitions and olympiads, links them to students automatically, and lets universities check authenticity through a QR code or a secure link.

**Educational value.** A student's academic achievements become one verified, portable portfolio. This supports admission to universities and scholarships, removes forged paper diplomas, and gives students ownership of their own record.

**Personas**

| Persona | Need |
|---|---|
| Student (school pupil, often under 18) | One place to keep and show real achievements without carrying papers |
| Organization (olympiad organizer, school, education department) | A fast way to issue results that cannot be forged |
| University admission officer | Check in seconds that a diploma is real and still valid |
| Admin (project team, later a ministry) | Keep the registry trustworthy: verify organizations, resolve disputes |

## 2. Scope

**In scope (MVP):** organization registration and verification, events and awards, student registration with SMS confirmation, student profile, share links with QR, audit log, corrections, kk/ru interface, background AI review of new awards.

**Out of scope (later):** integration with ministry databases, eGov/EDS login, mobile apps, bulk import from national registries, payments.

## 3. Roles and permissions

| Action | Student | Organization | Admin | Verifier (university) |
|---|---|---|---|---|
| Register | yes | request, then verified by Admin | created manually | no account |
| View own awards | yes | no | yes | only via link |
| Create/edit events and awards | no | own only | yes | no |
| Request a global change | no | yes | approves | no |
| Verify organizations | no | no | yes | no |
| Create share link | yes | no | no | no |
| View audit log | no | own records | all | no |
| Review AI flags | no | no | yes | no |

## 4. Use cases

### UC-1: Student registers and receives awards

- **Actor:** Student
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

- **Actor:** Organization (verified)
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

- **Actors:** Student, Verifier
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

- **Actors:** Organization, Admin
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

- **Actors:** AI worker (system), Admin
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

## 5. Functional requirements

### 5.1 Organizations
- FR-1: An organization submits a registration request (name, BIN, type, contact, documents).
- FR-2: Admin approves or rejects the request. Until approved the organization cannot enter data.
- FR-3: An organization creates events (title, date, level, subject).
- FR-4: An organization adds awards to an event: participant IIN, full name, phone, place, award type (diploma/certificate), document number.
- FR-5: An organization may edit its own records. Edits are written to the audit log and set status `corrected`.
- FR-6: Global changes (change of IIN, revoking an award, merging duplicates) go through a change request that Admin must approve.

### 5.2 Students
- FR-7: A student registers with IIN, full name, phone and password.
- FR-8: The system sends an SMS code. Registration completes only after a correct code.
- FR-9: If an unclaimed record matches IIN + full name + phone, it is linked to the new account. Names are compared after normalization (case, extra spaces, ё/е).
- FR-10: If there is no match, the profile is created empty and awards appear when an organization adds them.
- FR-11: A student under 18 (derived from the IIN) confirms parental/guardian consent.
- FR-12: A student sees all own awards with status `active`, `corrected` or `revoked`. Revoked awards are clearly marked.

### 5.3 Sharing and verification
- FR-13: A student creates a share link and chooses which awards to include.
- FR-14: The link contains a random token (not IIN or student ID). Validity is configurable (default 30 days).
- FR-15: The student can revoke a link at any time.
- FR-16: A QR code is generated for every link.
- FR-17: The link page shows student name, selected awards, organization, date, document number and a "verified" mark with current status. IIN and phone are never shown.

### 5.4 Audit and corrections
- FR-18: Every create/update/status change is written to the audit log: who, what, when, before and after values.
- FR-19: Awards are never deleted. Status values: `active`, `corrected`, `revoked`.

### 5.5 Localization
- FR-20: The whole interface is available in Kazakh and Russian, with a language switch on every page.

### 5.6 AI review
- FR-21: Every new award is queued for background review by an autonomous worker.
- FR-22: The worker sends no IIN, phone or full name to an external model.
- FR-23: The worker only creates flags. Admin decides on every flag.
- FR-24: Failed jobs are retried with backoff and visible to Admin.

## 6. Non-functional requirements

| ID | Area | Requirement | How it is checked |
|---|---|---|---|
| NFR-1 | Performance | API responses under 1.5 s at p95 for profile, verification page and award creation under normal load | Load test (k6 or autocannon) in CI or before release |
| NFR-2 | Responsive UI | Mobile-first with Tailwind breakpoints `sm` 640, `md` 768, `lg` 1024, `xl` 1280; usable from 360 px width | Manual check at 375, 768 and 1280 px |
| NFR-3 | Type safety | TypeScript `strict: true`; zero explicit `any` (ESLint `@typescript-eslint/no-explicit-any` set to error); no `@ts-ignore` without a written reason; input validated at the API boundary | `tsc --noEmit` and ESLint in CI |
| NFR-4 | Testing | At least 80% statement coverage on both apps | Coverage threshold fails CI below 80% |
| NFR-5 | Security | HTTPS only; passwords hashed with argon2; IIN and phone stored encrypted, lookups through keyed hash (HMAC); no IIN or phone in logs, URLs or public pages | Code review, tests, log checks |
| NFR-6 | Privacy | Compliance with the Law of the Republic of Kazakhstan on personal data; consent for minors; data minimization | Review before pilot |
| NFR-7 | Anti-abuse | Rate limits on SMS, login and public verification; OTP valid 5 minutes, max 5 attempts | Automated tests |
| NFR-8 | Availability | 99% target for MVP; daily database backups | Monitoring, restore test |
| NFR-9 | Scalability | Stateless API; indexes on `iin_hash`, `phone_hash`, `token_hash`; background worker scales separately | Query plans reviewed |
| NFR-10 | Localization | All user text through i18n with `kk` and `ru` keys | Missing-key check in CI |
| NFR-11 | Runtime | Node.js with ES Modules; React 19 with Vite | `package.json` `"type": "module"` |

## 7. Data model

| Table | Main fields |
|---|---|
| `organizations` | id, name, bin, type, status (`pending`/`verified`/`rejected`/`suspended`), contact, created_at |
| `users` | id, role, login, password_hash, locale, created_at |
| `students` | id, user_id (nullable), iin_hash, iin_encrypted, phone_hash, phone_encrypted, full_name, status (`unclaimed`/`claimed`), is_minor, guardian_consent_at |
| `events` | id, organization_id, title, date, level, subject |
| `awards` | id, event_id, student_id, place, type, document_number, status (`active`/`corrected`/`revoked`), created_by, created_at |
| `change_requests` | id, organization_id, award_id, type, payload, reason, status (`pending`/`approved`/`rejected`), reviewed_by, review_comment |
| `share_links` | id, student_id, token_hash, award_ids, expires_at, revoked_at |
| `otp_codes` | id, phone_hash, code_hash, expires_at, attempts, status (`issued`/`verified`/`expired`/`locked`) |
| `audit_log` | id, actor_id, entity, entity_id, action, before, after, created_at |
| `ai_flags` | id, award_id, score, reasons, model, status (`open`/`confirmed`/`dismissed`), reviewed_by, created_at |
| `ai_jobs` | id, award_id, status (`queued`/`running`/`done`/`failed`), attempts, last_error, created_at |

## 8. State machines

### 8.1 Award

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| (new) | Organization creates award | org `verified` | `active` | audit log, AI job queued |
| `active` | Organization edits own award | owner | `corrected` | audit log |
| `corrected` | Organization edits own award | owner | `corrected` | audit log |
| `active` / `corrected` | Change request approved (non-revoke) | Admin | `corrected` | audit log |
| `active` / `corrected` | Change request approved (revoke) | Admin | `revoked` | audit log |
| `revoked` | Admin restores | Admin | `corrected` | audit log |
| `revoked` | Any other event | - | rejected | 409 |

### 8.2 Organization

| From | Event | To |
|---|---|---|
| (new) | Registration request | `pending` |
| `pending` | Admin approves | `verified` |
| `pending` | Admin rejects | `rejected` |
| `verified` | Admin suspends | `suspended` |
| `suspended` | Admin reinstates | `verified` |

### 8.3 Student record

| From | Event | Guard | To |
|---|---|---|---|
| (new) | Organization adds award for unknown IIN | - | `unclaimed` |
| (new) | Student registers, no match | correct SMS code | `claimed` |
| `unclaimed` | Student registers | IIN + name + phone match, correct SMS code | `claimed` |

### 8.4 Share link

| From | Event | To |
|---|---|---|
| (new) | Student creates link | `active` |
| `active` | `expires_at` reached | `expired` |
| `active` | Student revokes | `revoked` |
| `expired` / `revoked` | Any | no change (terminal) |

### 8.5 Change request

| From | Event | To |
|---|---|---|
| (new) | Organization submits | `pending` |
| `pending` | Admin approves | `approved` |
| `pending` | Admin rejects (reason required) | `rejected` |

### 8.6 OTP code

| From | Event | To |
|---|---|---|
| (new) | SMS sent | `issued` |
| `issued` | Correct code entered | `verified` |
| `issued` | 5 minutes pass | `expired` |
| `issued` | 5 wrong attempts | `locked` |

## 9. CRC cards

| Class | Responsibilities | Collaborators |
|---|---|---|
| `AuthService` | Register student, log in, issue JWT, hash passwords | `OtpService`, `MatchingService`, `IdentityCrypto` |
| `OtpService` | Generate and store code hash, send SMS, verify code, count attempts, enforce limits | `SmsProvider`, `RateLimiter` |
| `IdentityCrypto` | Encrypt and decrypt IIN and phone, compute HMAC hashes, normalize names | (none) |
| `MatchingService` | Find unclaimed student by IIN + name + phone hashes, link it to the user | `IdentityCrypto`, `StudentRepository`, `AuditLogger` |
| `OrganizationService` | Handle registration requests, approval, suspension | `AuditLogger`, `OrganizationRepository` |
| `AwardService` | Create events and awards, validate data, apply minor edits, enforce ownership | `MatchingService`, `IdentityCrypto`, `AuditLogger`, `AiJobQueue` |
| `ChangeRequestService` | Create requests, apply approved changes, update award status | `AwardService`, `AuditLogger` |
| `ShareLinkService` | Create token and QR, validate token, expiry and revocation, build public view | `AwardRepository`, `QrGenerator` |
| `AuditLogger` | Write who, what, when, before and after for every change | `AuditRepository` |
| `AiReviewWorker` | Take jobs, run rule checks, call LLM with sanitized payload, save flags, retry on failure | `AiJobQueue`, `LlmClient`, `AiFlagRepository` |

## 10. API overview (REST)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register/student` | Start student registration, send SMS |
| POST | `/auth/verify-otp` | Confirm code, finish registration |
| POST | `/auth/resend-otp` | Send a new code (rate limited) |
| POST | `/auth/login` | Login |
| POST | `/organizations` | Submit organization request |
| PATCH | `/admin/organizations/:id` | Approve, reject, suspend |
| POST | `/events` | Create event |
| POST | `/events/:id/awards` | Add award |
| PATCH | `/awards/:id` | Edit own award |
| POST | `/change-requests` | Request global change |
| PATCH | `/admin/change-requests/:id` | Approve/reject |
| GET | `/admin/ai-flags` | List AI flags |
| PATCH | `/admin/ai-flags/:id` | Confirm or dismiss a flag |
| GET | `/me/awards` | Student's awards |
| POST | `/me/share-links` | Create link |
| DELETE | `/me/share-links/:id` | Revoke link |
| GET | `/v/:token` | Public verification page data |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Registration with someone else's IIN | Phone match + SMS code |
| Fake organizations | Manual verification by Admin, later a list of accredited bodies |
| Leak of personal data | Encryption, hashing, minimal exposure, access logs |
| Wrong data entered by an organization | Audit log, correction flow, `revoked` status |
| SMS provider outage or cost | Provider abstraction, rate limits, mock provider in development |
| AI worker leaks personal data to an external model | Sanitized payload without IIN, phone and name |
| AI worker gives false flags or misses fraud | Advisory only, Admin decides, rule checks run independently of the LLM |
