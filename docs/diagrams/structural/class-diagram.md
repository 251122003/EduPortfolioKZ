# UML Class Diagram

Part of [specifications.md](../../specifications.md), sections 8 and 10. The entities match [`backend/prisma/schema.prisma`](../../../backend/prisma/schema.prisma) and [database-schema.md](../../database-schema.md).

**How to read it.**
- `-` private, `+` public, `#` protected.
- `name: Type` is an attribute; `method(param: Type): ReturnType` is an operation.
- Numbers at the ends of a line are **cardinalities**: `1` exactly one, `0..1` optional, `0..*` any number, `1..*` at least one.
- Solid line with a diamond (`*--`) is composition: the part cannot exist without the whole. A plain line (`-->`) is an association. A dashed line with a hollow triangle (`..|>`) means "implements an interface".

## 1. Domain model (entities)

```mermaid
classDiagram
    direction LR

    class Organization {
        -id: UUID
        -name: String
        -bin: String
        -type: String
        -status: OrgStatus
        -contact: String
        -createdAt: DateTime
        +isVerified() Boolean
    }

    class User {
        -id: UUID
        -role: UserRole
        -login: String [0..1]
        -passwordHash: String
        -locale: Locale
        -organizationId: UUID [0..1]
        +canManage(award: Award) Boolean
    }

    class Student {
        -id: UUID
        -userId: UUID [0..1]
        -iinHash: String
        -iinEncrypted: Bytes
        -phoneHash: String
        -phoneEncrypted: Bytes
        -fullName: String
        -status: StudentStatus
        -guardianConsentAt: DateTime [0..1]
        +isClaimed() Boolean
    }

    class Event {
        -id: UUID
        -organizationId: UUID
        -title: String
        -eventDate: Date
        -level: EventLevel
        -subject: String
    }

    class Award {
        -id: UUID
        -organizationId: UUID
        -eventId: UUID
        -studentId: UUID
        -place: Integer [0..1]
        -type: AwardType
        -documentNumber: String
        -status: AwardStatus
        -createdBy: UUID
        +correct() void
        +revoke() void
        +restore() void
    }

    class ChangeRequest {
        -id: UUID
        -awardId: UUID
        -type: ChangeRequestType
        -reason: String
        -status: ChangeRequestStatus
        -reviewComment: String [0..1]
        +approve(admin: User) void
        +reject(admin: User, comment: String) void
    }

    class ShareLink {
        -id: UUID
        -studentId: UUID
        -tokenHash: String
        -expiresAt: DateTime
        -revokedAt: DateTime [0..1]
        +isUsable(now: DateTime) Boolean
        +revoke() void
    }

    class OtpCode {
        -id: UUID
        -phoneHash: String
        -codeHash: String
        -payloadEncrypted: Bytes [0..1]
        -expiresAt: DateTime
        -attempts: Integer
        -status: OtpStatus
        +isExpired(now: DateTime) Boolean
    }

    class AuditLog {
        -id: UUID
        -actorId: UUID [0..1]
        -entity: String
        -entityId: UUID
        -action: String
        -before: Json [0..1]
        -after: Json [0..1]
        -createdAt: DateTime
    }

    class AiJob {
        -id: UUID
        -awardId: UUID
        -status: AiJobStatus
        -attempts: Integer
        -runAfter: DateTime
        -lastError: String [0..1]
    }

    class AiFlag {
        -id: UUID
        -awardId: UUID
        -score: Decimal
        -reasons: Json
        -status: AiFlagStatus
    }

    class AwardStatus {
        <<enumeration>>
        active
        corrected
        revoked
    }

    class UserRole {
        <<enumeration>>
        student
        organization
        admin
    }

    Organization "1" *-- "0..*" Event : runs
    Organization "0..1" <-- "0..*" User : works for
    Event "1" *-- "0..*" Award : contains
    Student "1" <-- "0..*" Award : held by
    User "1" <-- "0..*" Award : created by
    User "0..1" -- "0..1" Student : owns account
    Student "1" *-- "0..*" ShareLink : creates
    ShareLink "0..*" --> "1..*" Award : exposes
    Award "1" <-- "0..*" ChangeRequest : targets
    Award "1" <-- "0..*" AiJob : reviews
    Award "1" <-- "0..*" AiFlag : flags
    User "0..1" <-- "0..*" AuditLog : actor
    Award ..> AwardStatus
    User ..> UserRole
```

![Domain class diagram](class-diagram-domain.png)

## 2. Service layer (registration and sharing)

Signatures of `IdentityCrypto` and the IIN functions are taken from the implemented code; the other services are designed and will be implemented in the next sprints.

```mermaid
classDiagram
    direction LR

    class AuthController {
        -authService: AuthService
        +registerStudent(dto: RegisterStudentDto) Promise~RegistrationStarted~
        +verifyOtp(dto: VerifyOtpDto) Promise~SessionDto~
        +login(dto: LoginDto) Promise~SessionDto~
    }

    class AuthService {
        -otpService: OtpService
        -matchingService: MatchingService
        -identityCrypto: IdentityCrypto
        -userRepository: UserRepository
        +startRegistration(dto: RegisterStudentDto) Promise~UUID~
        +completeRegistration(otpId: UUID, code: String) Promise~User~
        +login(login: String, password: String) Promise~String~
        -hashPassword(password: String) Promise~String~
    }

    class OtpService {
        -smsProvider: SmsProvider
        -otpRepository: OtpRepository
        +issue(phone: String, payload: Bytes) Promise~UUID~
        +verify(otpId: UUID, code: String) Promise~OtpResult~
        -generateCode() String
    }

    class SmsProvider {
        <<interface>>
        +send(phone: String, text: String) Promise~void~
    }

    class MockSmsProvider {
        +send(phone: String, text: String) Promise~void~
    }

    class MatchingService {
        -studentRepository: StudentRepository
        -identityCrypto: IdentityCrypto
        -auditLogger: AuditLogger
        +linkUnclaimedRecord(user: User, iin: String, fullName: String, phone: String) Promise~Student~
    }

    class IdentityCrypto {
        -hmacKey: Buffer
        -encryptionKey: Buffer
        +fromEnv(env: ProcessEnv)$ IdentityCrypto
        +hash(kind: HashKind, value: String) String
        +encrypt(plaintext: String) Uint8Array
        +decrypt(data: Uint8Array) String
    }

    class ShareLinkService {
        -shareLinkRepository: ShareLinkRepository
        -awardRepository: AwardRepository
        -qrGenerator: QrGenerator
        +create(studentId: UUID, awardIds: UUID[], days: Integer) Promise~CreatedLink~
        +revoke(studentId: UUID, linkId: UUID) Promise~void~
        +resolve(token: String) Promise~PublicPortfolio~
        -hashToken(token: String) String
    }

    class AuditLogger {
        -auditRepository: AuditRepository
        +record(actorId: UUID, entity: String, entityId: UUID, action: String, before: Json, after: Json) Promise~void~
    }

    class PrismaService {
        +onModuleInit() Promise~void~
        +onModuleDestroy() Promise~void~
    }

    AuthController "1" --> "1" AuthService
    AuthService "1" --> "1" OtpService
    AuthService "1" --> "1" MatchingService
    AuthService "1" --> "1" IdentityCrypto
    OtpService "1" --> "1" SmsProvider
    MockSmsProvider ..|> SmsProvider
    MatchingService "1" --> "1" IdentityCrypto
    MatchingService "1" --> "1" AuditLogger
    ShareLinkService "1" --> "1" AuditLogger
    AuditLogger "1" --> "1" PrismaService
    ShareLinkService "1" --> "1" PrismaService
```

![Service class diagram](class-diagram-services.png)
