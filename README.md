# PPM

Standalone Portfolio Performance Management application for portfolio dashboards,
project intake, operational initiatives, strategic priorities, user access, and
project-linked risk management.

## Application Structure

```text
PPM/
  api/        NestJS API, authentication, Prisma/Postgres access, and risk APIs
  web/        React + Vite frontend
  infra/ppm/  Local Postgres Docker Compose stack
```

## Local Prerequisites

- Node.js and npm
- Docker Desktop, or another Docker runtime with Compose support
- Git

## Local Setup

1. Start Postgres:

```powershell
cd infra\ppm
docker compose up -d
```

2. Configure the API:

```powershell
Copy-Item api\.env.example api\.env
```

The default API configuration points to the local Docker database:

```text
postgresql://ppm_user:ppm_pass123@localhost:5433/ppm?schema=ppm
```

3. Configure the frontend:

```powershell
Copy-Item web\.env.example web\.env
```

4. Install and run the API:

```powershell
cd api
npm install
npm run start:dev
```

5. In a second terminal, install and run the frontend:

```powershell
cd web
npm install
npm run dev
```

## Local Addresses

- Frontend: `http://localhost:5174`
- Login: `http://localhost:5174/login`
- API: `http://localhost:3001`
- Database: `localhost:5433`
- Database name: `ppm`

## Default Local Users

On API startup, the app creates local roles and default users if they do not
already exist.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@riskapp.local` | `Admin123!` |
| Executive | `executive@riskapp.local` | `Executive123!` |
| Business Owner | `owner@riskapp.local` | `Owner123!` |

Override these values in `api/.env` before first startup if you need different
local credentials.

## Environment Variables

### API

`api/.env.example` contains the local defaults:

- `DATABASE_URL`: Postgres connection string
- `AUTH_TOKEN_SECRET`: HMAC secret for local auth tokens
- `AUTH_TOKEN_TTL_SECONDS`: optional token lifetime override
- `ADMIN_*`, `EXECUTIVE_*`, `BUSINESS_OWNER_*`: default seeded user settings
- `PORT`: API port, default `3001`
- `FRONTEND_ORIGINS`: allowed CORS origins

### Frontend

`web/.env.example` contains:

- `VITE_API_BASE_URL`: API base URL, default `http://localhost:3001`
- `VITE_AUTH_STORAGE_KEY`: browser storage key for the auth session
- `VITE_ERM_APP_URL`: optional ERM frontend URL for risk review links

If `VITE_ERM_APP_URL` is empty, PPM still runs, but direct ERM review links are
shown as unavailable.

## Main Features

- Portfolio dashboard and project registers
- Current and future project views
- Project submission and proposal review workflows
- Annual operational initiative management
- Strategic priority period management
- Role-based access control and user administration
- Risk register, risk detail, assessments, and mitigations

## Frontend Functional Documentation

The frontend is a React single-page application using `react-router-dom`.
Authenticated pages render inside `AppFrame`, which provides the persistent side
navigation, page header, session menu, and permission-aware navigation links.
The root route redirects to `/dashboard`, and unauthenticated users are redirected
to `/login`.

Navigation is driven by permissions returned from the API. Users see only the
routes that match their role capabilities, such as portfolio dashboard access,
project access, initiative access, proposal review, strategy access, and user
administration.

### Workflow Assumptions

- Portfolio work is organized around strategic priorities, annual operational
  initiatives, projects, status updates, risks, and review decisions.
- Users may have all-portfolio access or owned-item access. Owned access is
  resolved from project owners, business owners, executive sponsors, initiative
  owners, and related project ownership.
- Project intake starts as a submitted proposal, moves through review, and then
  appears in future or current project portfolio views when accepted or planned.
- Operational initiatives are annual execution vehicles linked to strategic
  priorities and may have milestones, monthly updates, risks, costs, and related
  projects.
- Strategic priority periods define the multi-year strategy context that annual
  initiatives and portfolio reporting align to.
- Status updates are expected to be periodic and include health ratings,
  accomplishments, commitments, decisions needed, help needed, risks, milestone
  changes, and notes.
- Risk management is project-linked. PPM can show risk data locally and can link
  to an ERM frontend when `VITE_ERM_APP_URL` is configured.
- Administrative pages assume an admin user manages users, roles, and permission
  sets from inside the application rather than editing database records directly.

### Routed Pages

| Route | Page | Why it is included | Function |
| --- | --- | --- | --- |
| `/login` | Login | Establishes the authenticated PPM session before protected portfolio data is shown. | Accepts email and password, stores the auth token in browser storage, and routes the user into the app. |
| `/dashboard` | Portfolio Dashboard | Gives leaders and PMO users a portfolio-level operating view. | Summarizes portfolio items by status, owner, and strategic priority; supports drill-down into selected groups. |
| `/projects/current` | Current Projects | Separates active execution work from future pipeline and intake work. | Shows active major and operational projects with status context for ongoing portfolio management. |
| `/projects/future` | Future Projects | Provides a pipeline view for proposed, planned, or not-yet-active projects. | Displays future pipeline items and a proposal archive so reviewers can understand upcoming demand. |
| `/projects/register` | Portfolio Register | Provides the detailed list view behind dashboard summaries. | Lists initiatives and major projects in register format for scanning, comparison, and navigation into detail records. |
| `/projects/:projectId` | Project Detail | Provides the working record for an individual project. | Shows project status updates, milestones, ERM risks, cost tracking, and edit/update workflows where permitted. |
| `/projects/submit` | Submit Project | Captures new project demand in a consistent intake format. | Collects project summary, resources, assumptions, risks, and strategic alignment details for review. |
| `/projects/review` | Review Queue | Gives reviewers a single place to triage submitted proposals. | Lists project submissions requiring review and links to the detailed proposal review page. |
| `/projects/review/:projectId` | Proposal Review | Supports the formal intake decision workflow. | Shows proposal details, resource needs, attachments, schedule assumptions, risks, alignment, and decision controls. |
| `/strategic-priorities` | Strategic Priorities | Makes the active strategy visible as the organizing context for portfolio work. | Shows selected priority-period detail and the strategic priorities in that period. |
| `/strategic-priorities/register` | Strategic Priority Period Register | Keeps historical and active priority periods discoverable. | Lists strategic priority periods so users can review or navigate to period definitions. |
| `/strategic-priorities/new` | Create Strategic Priority Period | Allows strategy definitions to be added without database work. | Captures a new priority period and its priority list for use in portfolio and initiative alignment. |
| `/operational-initiatives` | Annual Operational Initiatives | Gives users a current-year initiative landing page. | Shows the current initiatives that translate strategic priorities into annual execution work. |
| `/operational-initiatives/register` | Operational Initiative Register | Provides a full initiative list beyond the current landing view. | Lists initiatives in register format with links to detailed initiative records. |
| `/operational-initiatives/new` | Add Annual Operational Initiative | Supports creation of new annual execution items. | Captures initiative details, owner, year, and strategic-priority alignment. |
| `/operational-initiatives/:initiativeId` | Operational Initiative Detail | Provides the working record for initiative execution. | Shows monthly updates, milestones, risks, cost tracking, linked major projects, and progress-update workflows. |
| `/admin/users` | User Management | Lets admins manage access without code or database changes. | Adds users, lists existing users, and supports user updates through the API. |
| `/admin/users/roles` | Role Definition | Makes role and permission configuration visible and editable. | Creates roles and manages permission sets used by navigation and route guards. |

### Additional Implemented Risk Views

The frontend also contains risk-focused pages and components used by the
project-linked risk workflow.

| Page | Why it is included | Function |
| --- | --- | --- |
| Risk Register | Gives PMO and risk users a table-oriented risk management view. | Filters risks, pages through the risk list, and supports adding a new risk when the user can manage risks. |
| Risk Detail | Provides the working record for one risk. | Shows risk metadata, assessments, mitigations, and forms to add or edit mitigation and assessment records. |
| Risk Dashboard | Gives users a risk-summary view independent of the broader portfolio dashboard. | Provides dashboard controls, category and department summaries, matrix-style summaries, and filtered risk lists. |

## Useful Commands

Run these from the `api` or `web` directory as noted.

| Area | Command | Purpose |
| --- | --- | --- |
| API | `npm run start:dev` | Start the NestJS API in watch mode |
| API | `npm run build` | Build the API |
| API | `npm run lint` | Run API linting with fixes |
| API | `npm test` | Run API unit tests |
| API | `npm run test:e2e` | Run API end-to-end tests |
| Web | `npm run dev` | Start the Vite dev server |
| Web | `npm run build` | Build the frontend |
| Web | `npm run lint` | Run frontend linting |
| Web | `npm run preview` | Preview the production frontend build |

## Stopping Local Services

```powershell
cd infra\ppm
docker compose down
```

To remove the local Postgres volume and reset the database:

```powershell
cd infra\ppm
docker compose down -v
```
