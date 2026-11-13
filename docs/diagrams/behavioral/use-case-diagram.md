# Use Case Diagram

Part of [specifications.md](../../specifications.md), section 5. Requirements: FR-1 – FR-25.

Drawn with PlantUML (proper UML notation for actors and use cases); the `.puml` source files are next to the images.

**How to read it.** Actors stand outside the system boundary. Ovals inside the boundary are use cases. A solid line connects an actor to the use case it takes part in.

- `«include»`: a **mandatory** step that always runs as part of the base use case (the arrow points from the base use case to the included one).
- `«extend»`: an **optional** step that runs only under a condition, shown in square brackets (the arrow points from the extension to the base use case).

To keep the lines readable, the system is drawn as three diagrams that share one system boundary: A covers students and verifiers, B covers organizations and the admin, C covers the background AI review.

### A. Student and Verifier (UC-1, UC-3)

![Use case diagram A](use-case-student.png)

<details>
<summary>PlantUML source (<code>use-case-student.puml</code>)</summary>

```plantuml
@startuml use-case-student
left to right direction
skinparam packageStyle rectangle
skinparam shadowing false
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
title Use Case Diagram A — Student and Verifier (UC-1, UC-3)
actor "Student" as Student
actor "Verifier\n(university)" as Verifier
actor "SMS gateway\n<<external>>" as SMS
rectangle "EduPortfolio KZ" {
  usecase "UC-1\nRegister as student" as UC1
  usecase "Validate IIN" as ValidateIIN
  usecase "Confirm SMS code" as ConfirmCode
  usecase "Match unclaimed record" as Match
  usecase "Confirm guardian consent" as Consent
  usecase "View own awards" as ViewAwards
  usecase "Log in" as Login
  usecase "UC-3\nCreate share link" as CreateLink
  usecase "Generate QR code" as QR
  usecase "Revoke share link" as RevokeLink
  usecase "UC-3\nVerify portfolio by link" as Verify
  usecase "Show revoked mark" as RevokedMark
}
Student --> UC1
Student --> ViewAwards
Student --> CreateLink
Student --> RevokeLink
Verifier --> Verify
UC1 ..> ValidateIIN : <<include>>
UC1 ..> ConfirmCode : <<include>>
UC1 ..> Match : <<include>>
Consent ..> UC1 : <<extend>>\n[student is under 18]
ConfirmCode -- SMS
ViewAwards ..> Login : <<include>>
CreateLink ..> Login : <<include>>
RevokeLink ..> Login : <<include>>
CreateLink ..> QR : <<include>>
RevokedMark ..> Verify : <<extend>>\n[an award was revoked]
@enduml
```

</details>

### B. Organization and Admin (UC-2, UC-4)

![Use case diagram B](use-case-organization.png)

<details>
<summary>PlantUML source (<code>use-case-organization.puml</code>)</summary>

```plantuml
@startuml use-case-organization
left to right direction
skinparam packageStyle rectangle
skinparam shadowing false
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
title Use Case Diagram B — Organization and Admin (UC-2, UC-4)
actor "Organization" as Org
actor "Admin" as Admin
rectangle "EduPortfolio KZ" {
  usecase "Register organization" as RegOrg
  usecase "Create event" as CreateEvent
  usecase "UC-2\nEnter award" as UC2
  usecase "Validate IIN" as ValidateIIN
  usecase "Create unclaimed\nstudent record" as Unclaimed
  usecase "Queue AI review" as Queue
  usecase "Edit own award" as Edit
  usecase "UC-4\nRequest correction" as UC4
  usecase "Log in" as Login
  usecase "Write audit log" as Audit
  usecase "Verify organization" as VerifyOrg
  usecase "Review change request" as ReviewCR
}
Org --> RegOrg
Org --> CreateEvent
Org --> UC2
Org --> Edit
Org --> UC4
Admin --> VerifyOrg
Admin --> ReviewCR
CreateEvent ..> Login : <<include>>
UC2 ..> Login : <<include>>
UC2 ..> ValidateIIN : <<include>>
UC2 ..> Audit : <<include>>
UC2 ..> Queue : <<include>>
Unclaimed ..> UC2 : <<extend>>\n[no student with this IIN]
Edit ..> Audit : <<include>>
UC4 ..> Audit : <<include>>
VerifyOrg ..> Audit : <<include>>
ReviewCR ..> Audit : <<include>>
@enduml
```

</details>

### C. Background AI review (UC-5)

![Use case diagram C](use-case-ai.png)

<details>
<summary>PlantUML source (<code>use-case-ai.puml</code>)</summary>

```plantuml
@startuml use-case-ai
left to right direction
skinparam packageStyle rectangle
skinparam shadowing false
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
title Use Case Diagram C — Background AI review (UC-5)
actor "AI worker\n<<system>>" as Worker
actor "Admin" as Admin
actor "LLM API\n<<external>>" as LLM
rectangle "EduPortfolio KZ" {
  usecase "UC-5\nReview new award" as UC5
  usecase "Build sanitized payload\n(no IIN, phone, name)" as Sanitize
  usecase "Run rule checks" as Rules
  usecase "Retry with backoff" as Retry
  usecase "Review AI flags" as ReviewFlags
  usecase "Revoke award" as Revoke
}
Worker --> UC5
UC5 -- LLM
Admin --> ReviewFlags
UC5 ..> Sanitize : <<include>>
UC5 ..> Rules : <<include>>
Retry ..> UC5 : <<extend>>\n[LLM error or timeout]
Revoke ..> ReviewFlags : <<extend>>\n[flag confirmed]
@enduml
```

</details>

## Use case specifications

### UC-1: Register as student

| Field | Specification |
|---|---|
| **Use case ID** | UC-1 |
| **Primary actor** | Student |
| **Secondary actors** | SMS gateway (external) |
| **Pre-conditions** | The student has a 12-digit IIN and a phone that receives SMS; no account exists for this IIN. |
| **Post-conditions** | A user account exists; the student record is `claimed`; the OTP code is `verified`; the event is in the audit log. |
| **Main success scenario** | 1. Student enters IIN, full name, phone and password.<br/>2. System validates the IIN format, birth date and check digit (`«include»` Validate IIN).<br/>3. System sends a 6-digit code by SMS, valid for 5 min.<br/>4. Student enters the code (`«include»` Confirm SMS code).<br/>5. System creates the user and links the matching unclaimed record (`«include»` Match unclaimed record).<br/>6. Student sees the profile with all attached awards. |
| **Extension** | 1a. IIN shows the student is under 18 → `«extend»` Confirm guardian consent; without consent registration is blocked. |
| **Exception flows** | 2a. Invalid IIN → 422, no SMS sent.<br/>2b. IIN already registered → generic failure that does not reveal the IIN exists.<br/>4a. Wrong code → attempts + 1; after 5 attempts → `locked` for 15 min (423).<br/>4b. Code expired → 410; student requests a new code (max 3 per hour).<br/>5a. No full match (IIN + name + phone) → empty profile; awards are never attached on a partial match. |
| **Requirements** | FR-7 – FR-11, NFR-5, NFR-7 |

### UC-2: Enter award

| Field | Specification |
|---|---|
| **Use case ID** | UC-2 |
| **Primary actor** | Organization (status `verified`) |
| **Secondary actors** | — |
| **Pre-conditions** | The organization is `verified`; the staff user is logged in; the event exists. |
| **Post-conditions** | The award exists with status `active`; an audit entry and an AI review job are created. |
| **Main success scenario** | 1. Organization opens its event and adds an award (`«include»` Log in).<br/>2. System validates IIN and fields (`«include»` Validate IIN).<br/>3. System finds the student by IIN hash or creates an `unclaimed` record.<br/>4. System saves the award as `active` and writes the audit log (`«include»` Write audit log).<br/>5. System queues an AI review job. |
| **Exception flows** | 1a. Organization not `verified` → 403.<br/>2a. Invalid IIN or missing field → 422, nothing saved.<br/>3a. A record with this IIN has a different name or phone → 409 "participant data does not match".<br/>4a. Document number already used by this organization → 409. |
| **Requirements** | FR-2 – FR-4, FR-21, NFR-12 |

### UC-3: Create share link / Verify portfolio by link

| Field | Specification |
|---|---|
| **Use case ID** | UC-3 |
| **Primary actors** | Student (creates the link), Verifier (opens it) |
| **Secondary actors** | — |
| **Pre-conditions** | The student is logged in and has at least one award. |
| **Post-conditions** | A share link exists; only the token's hash is stored; revocation makes the link unusable immediately. |
| **Main success scenario** | 1. Student selects awards and a validity period (`«include»` Log in).<br/>2. System creates a random token, stores its SHA-256 hash, shows the link once with a QR code (`«include»` Generate QR code).<br/>3. Verifier opens the link.<br/>4. System checks the token, expiry and revocation and shows name, awards, organization, date, document number and status. IIN and phone are never shown. |
| **Extension** | 4a. One of the awards was revoked after the link was created → `«extend»` Show revoked mark. |
| **Exception flows** | 4b. Unknown token → 404 with no hints.<br/>4c. Link expired or revoked → 410.<br/>4d. Too many requests from one IP → 429. |
| **Requirements** | FR-13 – FR-17, NFR-7 |

### UC-4: Request correction

| Field | Specification |
|---|---|
| **Use case ID** | UC-4 |
| **Primary actors** | Organization (requests), Admin (reviews change request) |
| **Pre-conditions** | The award belongs to the organization; the organization is `verified`. |
| **Post-conditions** | The award status reflects the decision; the audit log holds before and after values. |
| **Main success scenario** | 1. Organization requests a global change (change of IIN, revoke, merge) with a reason.<br/>2. System creates a change request `pending` and writes the audit log (`«include»`).<br/>3. Admin approves (`«include»` Write audit log).<br/>4. System applies the change; the award becomes `corrected` or `revoked`. |
| **Exception flows** | 1a. Not the award's owner → 403.<br/>1b. Award already `revoked` → 409 (only an Admin restore is allowed).<br/>3a. Admin rejects → a comment is required; the award is unchanged. |
| **Requirements** | FR-5, FR-6, FR-18, FR-19 |

### UC-5: Review new award (AI)

| Field | Specification |
|---|---|
| **Use case ID** | UC-5 |
| **Primary actor** | AI worker (system actor) |
| **Secondary actors** | LLM API (external), Admin (reviews flags) |
| **Pre-conditions** | A review job is `queued` and its `run_after` time has passed. |
| **Post-conditions** | A flag exists for a suspicious award, or no flag if nothing was found. The award status is never changed by the worker. |
| **Main success scenario** | 1. Worker takes the job and builds a sanitized payload without IIN, phone or name.<br/>2. Worker runs rule checks and asks the LLM about plausibility.<br/>3. Worker saves an `ai_flag` with score and reasons.<br/>4. Admin confirms or dismisses the flag (Review AI flags). |
| **Extension** | 2a. LLM error or timeout → `«extend»` Retry with backoff (up to 3 times); after that the job is `failed`. |
| **Exception flows** | 2b. Invalid model output → discarded; only rule-check results are saved. |
| **Requirements** | FR-21 – FR-24 |
