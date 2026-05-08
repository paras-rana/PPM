# PPM

Standalone Portfolio Performance Management application.

## Structure

```text
PPM/
  api/
  web/
  infra/
```

## Local Run

1. Start Postgres:

```powershell
cd infra\ppm
docker compose up -d
```

2. Configure the API:

Create `api/.env` from `api/.env.example`.

3. Start the API:

```powershell
cd api
npm install
npm run start:dev
```

4. Start the frontend:

```powershell
cd web
npm install
npm run dev
```

## Default Local Addresses

- Frontend: `http://localhost:5174`
- API: `http://localhost:3001`
- Database: `localhost:5433` (`ppm`)
- Login: `http://localhost:5174/login`

## Optional ERM Integration

If you want PPM risk links to open an ERM frontend, set `VITE_ERM_APP_URL` in `web/.env`.
If it is not set, PPM still works, but direct risk review links are shown as unavailable.
