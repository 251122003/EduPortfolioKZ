# State Machine Diagrams

Part of [specifications.md](../../specifications.md), section 9. Requirements: FR-5, FR-6, FR-8, FR-15, FR-19, NFR-7.

**How to read it.** Each label is `trigger [guard] / effect`:

- **trigger**: the event or call that starts the transition;
- **[guard]**: a condition that must be true, otherwise the transition is refused;
- **/ effect**: what the system does during the transition.

Drawn with PlantUML; the `.puml` sources are next to the images.

A transition that is not drawn is illegal and the API refuses it (409 Conflict). The database also blocks the most important illegal action, deleting an award, with a trigger.

## 1. Award lifecycle

An award is never deleted (FR-19). It only moves between three states.

![Award state machine](state-machine-award.png)

<details>
<summary>PlantUML source (<code>state-machine-award.puml</code>)</summary>

```plantuml
@startuml state-machine-award
skinparam shadowing false
skinparam state {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
hide empty description
title Award lifecycle — State Machine
[*] --> active : createAward()\n[organization is verified]\n/ audit log, queue AI job
active --> corrected : editOwnAward()\n[actor owns the award]\n/ audit log
active --> corrected : approveChangeRequest()\n[role = admin AND type ≠ revoke]\n/ audit log
corrected --> corrected : editOwnAward() [owner] / audit log
corrected --> corrected : approveChangeRequest()\n[admin, type ≠ revoke] / audit log
active --> revoked : approveChangeRequest()\n[role = admin AND type = revoke]\n/ audit log
corrected --> revoked : approveChangeRequest()\n[role = admin AND type = revoke]\n/ audit log
revoked --> corrected : restoreAward()\n[role = admin]\n/ audit log
note bottom of revoked
  Any other event → 409 Conflict.
  DELETE is blocked by the
  awards_no_delete trigger:
  an award never reaches [*].
end note
@enduml
```

</details>

## 2. Share link lifecycle

![Share link state machine](state-machine-share-link.png)

<details>
<summary>PlantUML source (<code>state-machine-share-link.puml</code>)</summary>

```plantuml
@startuml state-machine-share-link
skinparam shadowing false
skinparam state {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
hide empty description
title Share link lifecycle — State Machine
[*] --> active : createShareLink()\n[≥ 1 award selected]\n/ store token hash, show link + QR once
active --> active : open /v/:token\n[now < expires_at AND revoked_at is null]\n/ 200 OK with awards
active --> expired : clock tick\n[now ≥ expires_at]
active --> revoked : revokeLink()\n[actor owns the link]\n/ set revoked_at
expired --> [*]
revoked --> [*]
note bottom of expired : Terminal: opening the link\nreturns 410 Gone.
note bottom of revoked : Terminal: opening the link\nreturns 410 Gone.
@enduml
```

</details>

## 3. OTP code (registration session) lifecycle

![OTP state machine](state-machine-otp.png)

<details>
<summary>PlantUML source (<code>state-machine-otp.puml</code>)</summary>

```plantuml
@startuml state-machine-otp
skinparam shadowing false
skinparam state {
  BackgroundColor #EEF4FB
  BorderColor #1F3A5F
}
hide empty description
title OTP code (registration) lifecycle — State Machine
left to right direction
[*] --> issued : registerStudent()\n[IIN valid AND ≤ 3 SMS in last hour]\n/ save code hash, send SMS
issued --> issued : verifyOtp(code)\n[code wrong AND attempts < 4]\n/ attempts + 1
issued --> verified : verifyOtp(code)\n[code matches AND now < expires_at]\n/ create user, match record
issued --> locked : verifyOtp(code)\n[code wrong AND attempts = 4]\n/ attempts = 5
issued --> expired : clock tick\n[now ≥ expires_at (5 min)]
verified --> [*]
expired --> [*] : resendOtp()\nstarts a new code
locked --> [*] : after 15 min\na new code may be requested
@enduml
```

</details>

## Guard summary

| Entity | Transition | Guard | If the guard fails |
|---|---|---|---|
| Award | create | organization is `verified` | 403 |
| Award | edit | actor owns the award | 403 |
| Award | revoke / restore | role = admin | 403 |
| Award | anything from `revoked` except restore | — | 409 |
| Share link | open | `now < expires_at` and not revoked | 410 |
| OTP | verify | code matches, not expired, attempts < 5 | 400 / 410 / 423 |
| OTP | issue | ≤ 3 SMS per phone per hour | 429 |
