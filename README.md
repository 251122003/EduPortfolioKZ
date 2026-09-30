# EduPortfolio KZ

A nationwide registry of diplomas and certificates from competitions and olympiads. Verified organizations enter results into a closed database; students get a personal profile where their awards appear automatically; universities verify authenticity through a QR code or a secure link.


## Problem

Diplomas and certificates are scattered across paper folders and chats, are easy to forge, and universities have no quick way to check them. Students have no single place to show their achievements.

## Solution

- **Organizations** register (verified by the project team) and enter participants and results.
- **Students** register with IIN, full name and phone, confirm the phone by SMS code, and the system attaches all matching awards to their profile.
- **Universities** open a student's shared portfolio via QR/link and see whether each award is authentic.

## Key features

- Closed database: awards are not publicly searchable
- Student profile with active diplomas and certificates
- Matching by IIN + full name + phone, confirmed by SMS code
- QR code and secure link with random token, expiry and revocation
- Audit log of every change; awards are never deleted, only marked corrected or revoked
- Two interface languages: Kazakh and Russian

## Roles

| Role | What they do |
|---|---|
| Student | Registers, views awards, creates share links |
| Organization | Enters and edits its own events and results |
| Admin (project team) | Verifies organizations, approves global changes |
| Verifier (university) | Opens a shared link, no account needed |

## Tech stack

React + TypeScript, Node.js (NestJS), PostgreSQL, Prisma, Docker. See [development.md](development.md).

## Documentation

- [specifications.md](specifications.md): requirements, data model, flows, security
- [development.md](development.md): setup, structure, workflow, roadmap
- [claude.md](claude.md): rules for AI coding assistants in this repo

## Quick start

```bash
git clone https://github.com/251122003/ped-741---project/
cd eduportfolio-kz
cp .env.example .env
```
Code in progress

## Team

- <Zhanel>: frontend
- <Zhasmin>: backend

## License

To be decided.