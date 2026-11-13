# UML Sequence Diagrams

Part of [specifications.md](../../specifications.md), section 11. Requirements: FR-7 – FR-17, NFR-5, NFR-7.

**How to read it.** Time runs from top to bottom. Each vertical line (lifeline) is one participant. A solid arrow `->>` is a request or call, a dashed arrow `-->>` is a response. A bar on a lifeline means the participant is busy handling the call (activation). An `alt` box contains alternative branches: only one runs, chosen by the condition in brackets. Every HTTP response shows its status code.

## 1. UC-3: University verifies a portfolio by link

```mermaid
sequenceDiagram
    autonumber
    actor V as Verifier (browser)
    participant UI as React client
    participant API as NestJS API<br/>ShareLinkController
    participant RL as RateLimiter
    participant S as ShareLinkService
    participant DB as PostgreSQL

    V->>UI: Open https://…/v/{token} (or scan QR)
    activate UI
    UI->>API: GET /v/{token}
    activate API
    API->>RL: allow(ip)
    activate RL
    RL-->>API: true / false
    deactivate RL

    alt more than 10 requests per minute from this IP
        API-->>UI: 429 Too Many Requests
        UI-->>V: "Too many attempts, try later"
    else request allowed
        API->>S: resolve(token)
        activate S
        S->>S: tokenHash = SHA-256(token)
        S->>DB: SELECT … FROM share_links WHERE token_hash = $1
        activate DB
        DB-->>S: row or nothing
        deactivate DB

        alt no row for this hash
            S-->>API: NotFound
            API-->>UI: 404 Not Found {error}
            UI-->>V: neutral "Link not found" page (no hints)
        else revoked_at is set OR now ≥ expires_at
            S-->>API: Gone
            API-->>UI: 410 Gone {error}
            UI-->>V: "This link is no longer valid"
        else link is usable
            S->>DB: SELECT awards + events + organizations<br/>WHERE award.id IN (selected) — no IIN, no phone
            activate DB
            DB-->>S: awards with current status
            deactivate DB
            S-->>API: PublicPortfolio {studentName, awards[]}
            deactivate S
            API-->>UI: 200 OK {studentName, awards[]}
            deactivate API
            opt an award has status = revoked
                UI->>UI: show red "revoked" badge on that award
            end
            UI-->>V: Verified portfolio page
        end
    end
    deactivate UI
```

![Sequence diagram UC-3](sequence-verify-link.png)

## 2. UC-1: Student confirms the SMS code

```mermaid
sequenceDiagram
    autonumber
    actor St as Student (browser)
    participant UI as React client<br/>(Zustand store)
    participant API as NestJS API<br/>AuthController
    participant Z as Zod schema
    participant A as AuthService
    participant O as OtpService
    participant M as MatchingService
    participant DB as PostgreSQL

    St->>UI: Enter 6-digit code, press "Confirm"
    activate UI
    UI->>API: POST /auth/verify-otp {otpId, code}
    activate API
    API->>Z: parse(body)
    Z-->>API: valid / errors

    alt body invalid (code is not 6 digits)
        API-->>UI: 422 Unprocessable Entity {error}
        UI-->>St: "Enter 6 digits"
    else body valid
        API->>A: completeRegistration(otpId, code)
        activate A
        A->>O: verify(otpId, code)
        activate O
        O->>DB: SELECT … FROM otp_codes WHERE id = $1
        DB-->>O: code_hash, attempts, expires_at, status

        alt now ≥ expires_at
            O-->>A: Expired
            A-->>API: Expired
            API-->>UI: 410 Gone
            UI-->>St: "Code expired, request a new one"
        else status = locked (5 wrong attempts)
            O-->>A: Locked
            A-->>API: Locked
            API-->>UI: 423 Locked
            UI-->>St: "Try again in 15 minutes"
        else code does not match
            O->>DB: UPDATE otp_codes SET attempts = attempts + 1
            O-->>A: Wrong
            A-->>API: Wrong
            API-->>UI: 400 Bad Request {attemptsLeft}
            UI-->>St: "Wrong code, N attempts left"
        else code matches
            O->>DB: UPDATE otp_codes SET status = 'verified'
            O-->>A: Verified + decrypted registration data
            deactivate O
            A->>DB: INSERT INTO users (argon2 password hash)
            A->>M: linkUnclaimedRecord(user, iin, fullName, phone)
            activate M
            M->>DB: SELECT … FROM students WHERE iin_hash = $1 AND phone_hash = $2 AND user_id IS NULL
            alt full match (IIN + phone + normalized name)
                M->>DB: UPDATE students SET user_id = $1, status = 'claimed'
            else no match or partial match
                M->>DB: INSERT INTO students (empty profile, claimed)
            end
            M->>DB: INSERT INTO audit_log (no IIN, no phone)
            M-->>A: Student
            deactivate M
            A-->>API: Session (JWT)
            deactivate A
            API-->>UI: 201 Created + Set-Cookie (httpOnly, Secure)
            deactivate API
            UI-->>St: Profile with attached awards
        end
    end
    deactivate UI
```

![Sequence diagram UC-1](sequence-verify-otp.png)
