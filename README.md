# Hrms

This project uses [Angular CLI](https://github.com/angular/angular-cli) version 22.2.

Run `npm install` first. The commands below use the project's local Angular CLI through `npm run` or `npx ng`. A bare `ng` may resolve to a different program: on Debian/Ubuntu, `/usr/bin/ng` is the `ng-common` text editor.

## Demo

ACME People runs as a self-contained demo: an in-browser mock API (`src/app/demo/`) serves the sample data below, so no backend is needed. Start the dev server (`npm start`), open `http://localhost:4200/` and sign in as any of these accounts. The password is `demo` for all of them, and the sign-in page lists them so you can pick one with a click.

| Account | Signs in as | User type | What they can do |
| --- | --- | --- | --- |
| `admin@acme.com` | Alex Morgan | HR Administrator | Everything, including changing private details and removing people. |
| `lead@acme.com` | Olivia Bennett | Team Lead | Approves time off, runs hiring and assigns training. Edits people's role, level, location and manager, but not their private details. Can't add or remove people or change the course catalog. |
| `recruiter@acme.com` | Priya Shah | Recruiter | Runs the hiring board and adds new hires to People. Can't edit or remove people, approve time off or assign training. |
| `learning@acme.com` | Jordan Ellis | Learning Coordinator | Owns the course catalog and assigns training. Read-only everywhere else, with no access to Hiring. |
| `employee@acme.com` | Charlotte Dubois | Employee | Self-service: books and withdraws her own time off, records progress on her own training, and sees her own private details. Read-only directory, no Hiring. |

Olivia Bennett and Charlotte Dubois are also people in the directory (Charlotte reports to Olivia), so their accounts see "their own" time off and training. The other three are HR and talent staff, who aren't in the directory, so they have no time off or training of their own.

The accounts used to be `admin@hrms.demo` and `lead@hrms.demo`. Signing in with an old address now tells you which `@acme.com` account to use instead. If you registered your own account on the registration page, it signs in as an HR Administrator.

### What each user type is allowed to do

Each user type is a set of permissions (`ROLE_PERMISSIONS` in `src/app/demo/demo-data.ts`). The screens hide whatever a role can't do, and the demo API refuses it with a `403` ("Your role can't approve time off.") in case anything slips through.

| Permission | HR Administrator | Team Lead | Recruiter | Learning Coordinator | Employee |
| --- | :-: | :-: | :-: | :-: | :-: |
| See People and profiles (`ViewEmployees`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add people (`CreateEmployee`) | ✓ | | ✓ | | |
| Edit role, level, location, start date and manager (`EditEmployeeGeneralDetails`) | ✓ | ✓ | | | |
| Edit name, work email, phone and personal email (`EditEmployeePrivateDetails`) | ✓ | | | | |
| Remove people (`DeleteEmployee`) | ✓ | | | | |
| Approve, decline and book time off for anyone (`ApproveTimeOff`) | ✓ | ✓ | | | |
| Use the hiring board (`ManageHiring`) | ✓ | ✓ | ✓ | | |
| Assign training and track anyone's progress (`AssignTraining`) | ✓ | ✓ | | ✓ | |
| Create, edit and delete courses (`ManageCourses`) | ✓ | | | ✓ | |

Without `ApproveTimeOff`, people book time off only for themselves and can withdraw a request while it's still pending. Without `AssignTraining`, they see and update only their own training. Private details (phone and personal email) are shown only to HR and to the person themselves.

### The sample data

Dates are relative to today, so the demo always looks current.

- **People:** 18 people in two teams. Engineering reports to Olivia Bennett, with Evelyn Kim running delivery and managing Henry Silva. Design and QA report to Sophia Lindqvist. Each person has a role, level, location (London, Lisbon, Berlin or remote), start date, manager, work email, phone and personal email. Charlotte Dubois joined six weeks ago and is the newest.
- **Away today:** Noah Kowalski (vacation), Isabella Rossi (sick) and Benjamin Haddad (paternity leave).
- **Time off:** six requests are waiting for approval, including Charlotte's. One is declined, and the rest are approved in the past or ahead.
- **Hiring:** 10 candidates across the board: three in CV screening, two being scheduled, two waiting on interview feedback, one with an offer out, one onboarding and one rejected.
- **Learning:** 8 courses, of which three are mandatory (welcome, security and respect at work). There are about 75 enrollments, three of them overdue (James O'Connor, Isabella Rossi and Charlotte Dubois).
- **Projects:** four projects and two sub-projects, with their teams.

### Things to try

- **As the Team Lead,** approve Charlotte's request from Home. Then open a developer's profile and change their location: the private fields are locked.
- **As the Recruiter,** move a candidate through the board, then create Nora Fitzgerald's employee record from onboarding. She is enrolled in the mandatory courses automatically.
- **As the Learning Coordinator,** create a course and assign it to the overdue people.
- **As the Employee,** book time off (it can only be for Charlotte), withdraw it, and log a module on her overdue security course.
- **As the HR Administrator,** change someone's phone number, or remove a person.

Changes are saved to `localStorage`, so they survive a reload. The refresh button at the bottom of the sidebar restores the original data. Data saved by an older version is upgraded in place, keeping your changes.

### Using a real API

To point the app at a real API instead, set `demo: false` and `apiUrl` in `src/environments/environment*.ts`. The mock API follows the same json-server style routes the services already call (`/employees`, `/employees/:id`, `?firstName_like=`), plus these:

- `POST /api/auth/login`, `POST /api/auth/logout` and `POST /api/auth/register`.
- `GET /api/auth/session`, which returns the signed-in user and their current permissions. The app calls it at startup, so a role change takes effect without signing out, and an expired session sends you back to sign in.
- `/courses` and `/enrollments` for learning, filterable by `courseId` and `employeeId`. The API derives each enrollment's `status` and `progress` from `completedModules`.

Every data request needs a bearer token from login.

## Development server

Run `npm start` (or `npx ng serve`) for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `npx ng generate component component-name` to generate a new component. You can also use `npx ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build` (or `npx ng build`) to build the project. The build artifacts will be stored in the `dist/hrms/` directory.

## Running unit tests

Run `npm test` to execute the unit tests via [Karma](https://karma-runner.github.io). For a single headless run, as in CI, use `npm test -- --watch=false --browsers=ChromeHeadless`.

## Running end-to-end tests

Run `npx ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `npx ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/cli) page.
