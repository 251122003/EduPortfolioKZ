# Activity Diagram with Swimlanes — UC-1 Student registration

Part of [specifications.md](../../specifications.md), UC-1. Requirements: FR-7 – FR-11, NFR-5, NFR-7.

**How to read it.** Each vertical lane is one layer of the system and owns the actions inside it:

| Swimlane | Technology | Responsibility |
|---|---|---|
| **Client UI** | React 19 + Zustand | Collects input, shows errors, keeps the form state |
| **API Gateway** | NestJS controller + Zod | Receives HTTP requests, validates the body, applies rate limits, returns status codes |
| **Backend services & Database** | NestJS services, Prisma, PostgreSQL | Business rules, encryption, hashing, matching, writing rows |
| **SMS gateway** | External provider (mock in development) | Delivers the 6-digit code |

Drawn with PlantUML, which supports real UML swimlanes. Black dot = start, circled dot = end. Diamonds are decisions; the condition for each branch is written on the arrow in square brackets. The flow crosses a lane boundary every time one layer hands work to another.

![Activity diagram with swimlanes](activity-diagram.png)

<details>
<summary>PlantUML source (<code>activity-diagram.puml</code>)</summary>

```plantuml
@startuml activity-diagram
skinparam shadowing false
skinparam ActivityBackgroundColor #EEF4FB
skinparam ActivityBorderColor #1F3A5F
skinparam SwimlaneTitleFontStyle bold
title UC-1 Student registration — Activity Diagram with Swimlanes

|#F7F9FC|Client UI (React)|
start
:Enter IIN, full name,\nphone and password;
if (Student under 18?) then ([yes])
  :Tick guardian consent;
else ([no])
endif
|#FFFFFF|API Gateway (NestJS)|
:POST /auth/register/student;
if (Body valid? (Zod)) then ([no])
  :422 Unprocessable Entity;
  |Client UI (React)|
  :Show form error;
  stop
else ([yes])
endif
|#F2F7F2|Backend services & Database|
if (IIN format, birth date\nand check digit OK?) then ([no])
  |API Gateway (NestJS)|
  :422 Unprocessable Entity;
  |Client UI (React)|
  :Show form error;
  stop
else ([yes])
endif
|Backend services & Database|
if (IIN already registered?\n(lookup by HMAC hash)) then ([yes])
  |API Gateway (NestJS)|
  :202 Accepted\n(same answer, IIN not revealed);
  |Client UI (React)|
  :Show "check your phone";
  stop
else ([no])
endif
|API Gateway (NestJS)|
if (SMS sent to this phone\n≤ 3 in the last hour?) then ([no])
  :429 Too Many Requests;
  |Client UI (React)|
  :Show "try again later";
  stop
else ([yes])
endif
|Backend services & Database|
:Encrypt registration data;
:Save otp_codes row\n(code hash, expires in 5 min);
|#FFF8EC|SMS gateway|
:Deliver 6-digit code\nto the phone;
|API Gateway (NestJS)|
:202 Accepted;
|Client UI (React)|
repeat
  :Enter 6-digit code;
  |API Gateway (NestJS)|
  :POST /auth/verify-otp;
  |Backend services & Database|
  :Check code hash,\nexpiry and attempts;
  if (Code expired or locked?) then ([yes])
    |API Gateway (NestJS)|
    :410 Gone / 423 Locked;
    |Client UI (React)|
    :Show "request a new code";
    stop
  else ([no])
  endif
  |Backend services & Database|
  backward:attempts + 1\n(400 Bad Request);
repeat while (Code correct?) is ([no]) not ([yes])
|Backend services & Database|
:Create user\n(argon2 password hash);
if (Unclaimed record with same\nIIN + phone + normalized name?) then ([yes])
  :Link record,\nstatus = claimed;
else ([no / partial match])
  :Create empty\nstudent profile;
endif
:Write audit log\n(no IIN, no phone);
|API Gateway (NestJS)|
:201 Created\n+ httpOnly auth cookie;
|Client UI (React)|
:Open profile with\nattached awards;
stop
@enduml
```

</details>

## Notes for the defense

- **Why the IIN check sits in the backend lane and not only in the client:** the client can be bypassed, so the server always validates again (NFR-3).
- **Why "IIN already registered" returns the same 202 as success:** a different answer would let anyone test whether an IIN is in the registry (UC-1 A2).
- **Why the SMS lane is separate:** the SMS provider is outside our system boundary; in development a mock provider prints the code to the console.
- **Partial match never attaches awards:** if only the IIN matches but the name or phone differs, the student gets an empty profile (FR-10). This protects against someone registering with another person's IIN.
