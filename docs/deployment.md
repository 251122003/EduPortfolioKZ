# Deployment (Render, Docker, single origin)

One Render **Free web service** runs the root `Dockerfile`. The NestJS server serves the API under `/api` and the built React app from the same origin, so the `SameSite=Strict` session cookie works without CORS. The database is **Render Postgres 18**.

What the container does on start (`npm run start:migrate`):

1. `prisma migrate deploy` applies pending migrations from `backend/prisma/migrations`.
2. The server starts on `0.0.0.0:$PORT` (Render sets `PORT`).
3. `/api/*` goes to the API; other `GET` paths (`/me`, `/login`, `/v/:token`) get `index.html`.

> **Course demo only.** There is no real SMS provider yet. With `SMS_MOCK_ALLOWED_IN_PRODUCTION=true` no SMS is sent and the code is written to the Render log (with `otpId`, never the phone or IIN). Do not use this setup for real users.

## 1. Database

1. Render → **New → Postgres**, version **18**, plan Free.
2. Copy two connection strings:
   - **Internal Database URL**: for the web service (same region).
   - **External Database URL**: only for running the seed from your computer.

## 2. Web service

Render → **New → Web Service** → this GitHub repository.

| Setting | Value |
|---|---|
| Language / Runtime | Docker (uses `Dockerfile` in the repository root) |
| Instance type | Free |
| Health Check Path | `/api/health` (200 only when the API and the database work) |

### Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Internal Database URL |
| `JWT_SECRET` | new secret (see below) |
| `IIN_HMAC_KEY` | new secret |
| `IIN_ENCRYPTION_KEY` | new secret |
| `APP_BASE_URL` | `https://<service-name>.onrender.com` |
| `SMS_PROVIDER` | `mock` |
| `SMS_MOCK_ALLOWED_IN_PRODUCTION` | `true` (demo only) |

Do not set `PORT` (Render sets it) or `NODE_ENV` (the image sets `production`, which also makes the session cookie `Secure`).

### New secrets

Generate three **different** values. Never reuse the ones from your local `backend/.env`, and never commit them:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep `IIN_HMAC_KEY` and `IIN_ENCRYPTION_KEY` in a password manager: if they change, stored IINs can no longer be found or decrypted.

## 3. Seed the Render database once (from your computer)

Run it after the first successful deploy (the tables exist then). Use the **External** URL, the **same** `IIN_HMAC_KEY` and `IIN_ENCRYPTION_KEY` as in Render, and a strong `SEED_PASSWORD` (it becomes the password of `admin@eduportfolio.test` and `org@eduportfolio.test`).

PowerShell, in a new window:

```powershell
cd backend
$env:DATABASE_URL = "<External Database URL>?sslmode=require"
$env:IIN_HMAC_KEY = "<same as in Render>"
$env:IIN_ENCRYPTION_KEY = "<same as in Render>"
$env:SEED_PASSWORD = "<strong password, 16+ characters>"
npx prisma db seed
```

Then close the window so the variables are gone. Variables set in the shell win over `backend/.env` (`process.loadEnvFile` does not overwrite them). The seed prints the password at the end: do not paste that output anywhere. The seed is safe to run again; existing rows are left as they are.

## 4. Check the deployment

- `https://<service-name>.onrender.com/api/health` → `{"status":"ok","database":"up"}`
- `https://<service-name>.onrender.com/login` → the sign-in page (also after reload)
- Sign in as `org@eduportfolio.test` with `SEED_PASSWORD`.
- Registration: the SMS code is in Render → Logs (`Dev SMS (not sent): otpId ..., code ...`).

Free instances sleep after inactivity; the first request after a pause takes up to a minute.

## 5. Run the image locally (needs Docker Desktop)

```bash
docker build -t eduportfolio .
docker run --rm -p 3000:3000 \
  -e PORT=3000 \
  -e DATABASE_URL="postgresql://eduportfolio:change_me@host.docker.internal:5432/eduportfolio" \
  -e JWT_SECRET=<secret> -e IIN_HMAC_KEY=<key> -e IIN_ENCRYPTION_KEY=<key> \
  -e SMS_PROVIDER=mock -e SMS_MOCK_ALLOWED_IN_PRODUCTION=true \
  eduportfolio
```

Inside the container `localhost` is the container itself, so the local database is reached through `host.docker.internal`. Then open `http://localhost:3000/` and `http://localhost:3000/api/health`.

## Local development is unchanged

`npm run dev` (Vite, port 5173) and `cd backend && npm run start:dev` (port 3000). The Vite proxy forwards `/api/*` to the server unchanged; the server serves the frontend itself only when a build exists in `dist/`.
