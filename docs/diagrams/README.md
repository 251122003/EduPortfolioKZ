# UML Diagrams — EduPortfolio KZ

Assignment 3 (System Analysis & UML). Requirements are in [../specifications.md](../specifications.md).

| Diagram | File | Scenario |
|---|---|---|
| Use Case Diagrams + tabular specifications | [behavioral/use-case-diagram.md](behavioral/use-case-diagram.md) | UC-1 – UC-5, `«include»` / `«extend»` |
| Activity Diagram with swimlanes | [behavioral/activity-diagram.md](behavioral/activity-diagram.md) | UC-1 student registration: Client UI / API Gateway / Backend & DB / SMS gateway |
| State Machine Diagrams | [behavioral/state-machine-diagram.md](behavioral/state-machine-diagram.md) | Award, Share link, OTP code — triggers and `[guards]` |
| CRC Cards | [structural/crc-cards.md](structural/crc-cards.md) | Every backend class, Single Responsibility Principle |
| Class Diagrams | [structural/class-diagram.md](structural/class-diagram.md) | Domain model + service layer: types, `+`/`-`, cardinalities |
| Sequence Diagrams | [structural/sequence-diagram.md](structural/sequence-diagram.md) | UC-3 `GET /v/:token`, UC-1 `POST /auth/verify-otp`, `alt`/`else` error paths |

**Tools.** Behavioral diagrams are drawn with PlantUML (it has real UML actors and swimlanes); the `.puml` sources sit next to the PNG images. Structural diagrams are Mermaid.js blocks inside the Markdown files, so GitHub renders them directly; PNG exports are included as well.

**Consistency with the code.** Entities and their fields follow `backend/prisma/schema.prisma`. `IdentityCrypto`, `PrismaService` and `HealthController` already exist in `backend/src`; the other services are designed here and implemented in later sprints.
