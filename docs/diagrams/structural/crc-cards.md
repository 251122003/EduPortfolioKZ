# CRC Cards (Class – Responsibility – Collaborator)

Part of [specifications.md](../../specifications.md), section 10.

**How to read it.** Each card is one class: what it **knows** and **does** (responsibilities), and which classes it needs (collaborators). Every card follows the **Single Responsibility Principle**: it has one reason to change, written under "Single responsibility". If a card needed two such reasons, it was split. For example, encryption lives in `IdentityCrypto` and not in `AuthService`, and SMS sending lives in `SmsProvider` and not in `OtpService`.

The backend has three layers: **Controller** (HTTP) → **Service** (business rules) → **Repository** (database). A controller never talks to the database, and a repository never makes business decisions.

## Infrastructure

### `PrismaService` — *implemented* (`backend/src/prisma/prisma.service.ts`)
| Responsibilities | Collaborators |
|---|---|
| Open and close the single PostgreSQL connection pool | PostgreSQL (via `@prisma/adapter-pg`) |
| Give repositories a typed query client | |

**Single responsibility:** database connection.

### `IdentityCrypto` — *implemented* (`backend/src/common/identity/identity-crypto.ts`)
| Responsibilities | Collaborators |
|---|---|
| Encrypt and decrypt IIN and phone (AES-256-GCM) | — |
| Compute keyed lookup hashes (HMAC-SHA256) | |
| Normalize phone and full name before hashing or matching | |

**Single responsibility:** protecting personal identifiers.

### `HealthController` — *implemented* (`backend/src/health/health.controller.ts`)
| Responsibilities | Collaborators |
|---|---|
| Answer `GET /health` with 200 or 503 | `PrismaService` |

**Single responsibility:** reporting liveness.

## Identity and registration

### `AuthController`
| Responsibilities | Collaborators |
|---|---|
| Expose `/auth/register/student`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/login` | `AuthService` |
| Validate request bodies with Zod; map results to HTTP codes; set the auth cookie | |

**Single responsibility:** HTTP for authentication.

### `AuthService`
| Responsibilities | Collaborators |
|---|---|
| Run the registration flow (UC-1): check IIN, start OTP, create the user after a correct code | `OtpService`, `MatchingService`, `IdentityCrypto`, `UserRepository` |
| Log in: verify argon2 password hash, issue JWT | `UserRepository`, `StudentRepository` |

**Single responsibility:** who a user is (account creation and login).

### `OtpService`
| Responsibilities | Collaborators |
|---|---|
| Generate a 6-digit code, store only its hash with a 5-minute expiry | `OtpRepository`, `SmsProvider` |
| Verify a code, count attempts, lock after 5, enforce 3 SMS per hour | |

**Single responsibility:** one-time code lifecycle.

### `SmsProvider` «interface» (`MockSmsProvider` in development)
| Responsibilities | Collaborators |
|---|---|
| Deliver a text message to a phone number | External SMS gateway |

**Single responsibility:** message delivery. Swapping providers changes only this class.

### `MatchingService`
| Responsibilities | Collaborators |
|---|---|
| Find an unclaimed student whose IIN hash, phone hash and normalized name all match | `StudentRepository`, `IdentityCrypto` |
| Link the record to the user and set status `claimed`; never link on a partial match | `AuditLogger` |

**Single responsibility:** connecting accounts to existing records.

## Awards and organizations

### `OrganizationService`
| Responsibilities | Collaborators |
|---|---|
| Accept registration requests; let Admin verify, reject, suspend | `OrganizationRepository`, `AuditLogger` |

**Single responsibility:** organization lifecycle.

### `AwardService`
| Responsibilities | Collaborators |
|---|---|
| Create events and awards for verified organizations | `AwardRepository`, `StudentRepository` |
| Find or create the student record by IIN hash | `IdentityCrypto` |
| Apply minor edits by the owner; set `corrected` | `AuditLogger` |
| Queue an AI review job for each new or corrected award | `AiJobQueue` |

**Single responsibility:** award entry and ownership rules.

### `ChangeRequestService`
| Responsibilities | Collaborators |
|---|---|
| Create change requests; apply them after Admin approval; require a reason on rejection | `ChangeRequestRepository`, `AwardService`, `AuditLogger` |

**Single responsibility:** global corrections.

### `AuditLogger`
| Responsibilities | Collaborators |
|---|---|
| Write who, what, when, before and after for every change; never write IIN or phone | `AuditRepository` |

**Single responsibility:** recording history.

## Sharing

### `ShareLinkService`
| Responsibilities | Collaborators |
|---|---|
| Create a random token, store its SHA-256 hash, return the link once | `ShareLinkRepository` |
| Revoke a link | `QrGenerator` |
| Resolve a token: check expiry and revocation, build the public view without IIN or phone | `AwardRepository` |

**Single responsibility:** share link lifecycle.

### `QrGenerator`
| Responsibilities | Collaborators |
|---|---|
| Turn a URL into a QR image | — |

**Single responsibility:** QR rendering.

## AI review

### `AiReviewWorker`
| Responsibilities | Collaborators |
|---|---|
| Take due jobs from the queue; build a sanitized payload | `AiJobQueue`, `AiFlagRepository` |
| Run rule checks; ask the LLM; save flags; retry with backoff | `LlmClient` |

**Single responsibility:** advisory review of awards. It never changes award status.

### `LlmClient` «interface»
| Responsibilities | Collaborators |
|---|---|
| Send a sanitized prompt and return a parsed, validated answer | External LLM API |

**Single responsibility:** talking to the language model.

## Repositories

`UserRepository`, `StudentRepository`, `OrganizationRepository`, `AwardRepository`, `ChangeRequestRepository`, `ShareLinkRepository`, `OtpRepository`, `AuditRepository`, `AiFlagRepository`, `AiJobQueue`

| Responsibilities | Collaborators |
|---|---|
| Read and write one table (or one aggregate) through Prisma; no business rules | `PrismaService` |

**Single responsibility:** persistence of one entity.
