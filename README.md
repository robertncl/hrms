# Hrms

This project uses [Angular CLI](https://github.com/angular/angular-cli) version 22.2.

Run `npm install` first. The commands below use the project's local Angular CLI through `npm run` or `npx ng`. A bare `ng` may resolve to a different program: on Debian/Ubuntu, `/usr/bin/ng` is the `ng-common` text editor.

## Demo

ACME People runs as a self-contained demo: an in-browser mock API (`src/app/demo/`) serves the sample data below, so no backend is needed. Start the dev server (`npm start`), open `http://localhost:4200/` and sign in as any of these accounts. The password is `demo` for all of them, and the sign-in page lists them so you can pick one with a click.

| Account | Signs in as | User type | What they can do |
| --- | --- | --- | --- |
| `admin@acme.com` | Alex Morgan | HR Administrator | Everything, including changing private details, pay and equity, and removing people. |
| `lead@acme.com` | Olivia Bennett | Team Lead | For the people who report to her, directly or through another manager: approves time off, assigns training, sees pay and equity and proposes salary changes for HR to decide, and edits their job title, department, role, level, location and manager, but not their private details. Also runs hiring. Can't add or remove people or change the course catalog. |
| `recruiter@acme.com` | Priya Shah | Recruiter | Runs the hiring board and adds new hires to People. Can't edit or remove people, approve time off or assign training. |
| `learning@acme.com` | Jordan Ellis | Learning Coordinator | Owns the course catalog and assigns training to anyone. Read-only everywhere else, with no access to Hiring. |
| `employee@acme.com` | Charlotte Dubois | Employee | Self-service: books and withdraws her own time off, sees her own leave balances, pay and equity, records progress on her own training, and sees her own private details. Read-only directory, no Hiring. |

Olivia Bennett and Charlotte Dubois are also people in the directory (Charlotte reports to Olivia), so their accounts see "their own" time off and training. The other three are HR and talent staff, who aren't in the directory, so they have no time off or training of their own.

The accounts used to be `admin@hrms.demo` and `lead@hrms.demo`. Signing in with an old address now tells you which `@acme.com` account to use instead. If you registered your own account on the registration page, it signs in as an HR Administrator.

### What each user type is allowed to do

Each user type is a set of permissions (`ROLE_PERMISSIONS` in `src/app/demo/demo-data.ts`). The screens hide whatever a role can't do, and the demo API refuses it with a `403` ("Your role can't approve time off.") in case anything slips through.

| Permission | HR Administrator | Team Lead | Recruiter | Learning Coordinator | Employee |
| --- | :-: | :-: | :-: | :-: | :-: |
| See People and profiles (`ViewEmployees`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add people (`CreateEmployee`) | ✓ | | ✓ | | |
| Edit job title, department, role, level, location, start date and manager (`EditEmployeeGeneralDetails`) | ✓ | ✓ | | | |
| Edit name, work email, phone and personal email (`EditEmployeePrivateDetails`) | ✓ | | | | |
| Remove people (`DeleteEmployee`) | ✓ | | | | |
| Approve, decline and book time off for other people (`ApproveTimeOff`) | ✓ | ✓ | | | |
| Use the hiring board (`ManageHiring`) | ✓ | ✓ | ✓ | | |
| Assign training and track other people's progress (`AssignTraining`) | ✓ | ✓ | | ✓ | |
| Create, edit and delete courses (`ManageCourses`) | ✓ | | | ✓ | |
| Act for anyone in the company, not only your own reports (`OrgWideAccess`) | ✓ | | | ✓ | |
| See other people's pay and equity, and propose salary changes (`ViewCompensation`) | ✓ | ✓ | | | |
| Change salaries, decide proposals, grant equity, and set pay bands and the share price (`ManageCompensation`) | ✓ | | | | |

Without `ApproveTimeOff`, people book time off only for themselves and can withdraw a request while it's still pending. Without `AssignTraining`, they see and update only their own training. Private details (phone and personal email) are shown only to HR and to the person themselves, and the API leaves them out of everyone else's responses.

A permission says what someone can do; `OrgWideAccess` says for whom. Without it, editing people, deciding time off and assigning training reach only the people in your reporting line: your direct reports and everyone below them, never yourself. So the Team Lead can't approve her own time off or act for the Design and Quality team, and the API answers `403` ("You can only do this for people who report to you.") if she tries. The rule lives in `src/app/shared/functions/org.ts` and is applied by both the screens and the demo API.

### Leave balances

Leave is counted in working days: weekends and the public holidays of the person's office (London, Lisbon or Berlin; remote people follow London) cost nothing. The holiday calendar in `src/app/shared/functions/leave.ts` covers 2026 and 2027 and needs extending each year.

| Leave type | Days a year |
| --- | --: |
| Vacation | 25 |
| Sick leave | 10 |
| Personal (`Other`) | 3 |
| Maternity and paternity leave | No limit |

Someone who joins part-way through a year gets a proportional share for that year. What is left is the allowance less approved days and days still waiting for a decision. The Time off page shows your own balances and what a request would cost before you send it, and a profile shows that person's balances to them, their lead and HR. The API refuses a booking or an approval that would go over the balance with a `422` that says how many days are left.

### Compensation and equity

Compensation is a section under People (People · Projects · Compensation) for anyone with `ViewCompensation`; everyone else with a People record gets a **Your pay** section there instead, and a pay card on their own profile.

- **Salaries** are a history of changes, each with the day it takes effect and a reason (new hire, promotion, merit increase, market adjustment or correction). Today's salary is the latest approved change already in effect. HR's changes are recorded at once. A lead's change is a proposal: it waits on HR's Home queue (and the Compensation page) until HR approves or declines it, and the lead can withdraw it meanwhile. Nobody proposes their own raise.
- **Pay bands** set a minimum and maximum for each role and level, in pounds and in euros. London and remote people are paid in pounds, Lisbon and Berlin in euros, and pay totals are never added across currencies. The compa-ratio is salary over the band midpoint: 1.00 is the market rate. The overview flags anyone below or above their band. Everyone can see the bands; only HR changes them.
- **Equity** is stock options or RSUs, vesting monthly over a period (four years by default) after a cliff (one year by default), with nothing vesting before the cliff. Options have a strike price, usually the share price on the day they're granted, and lapse after ten years; HR records exercises, up to what has vested. Equity is valued at the latest share price (in US dollars): options at what the price is above their strike, RSUs at the price.

Who sees whose pay follows the same scope as everything else: yourself always, HR everyone, and a lead the people in their reporting line. The API filters salary changes and grants row by row, answers `404` for a record you can't see, and refuses anything else with `403` or, for bad input, `422` with the reason. The pay and vesting rules are in `src/app/shared/functions/pay.ts` and `equity.ts`.

### The sample data

Dates are relative to today, so the demo always looks current.

- **People:** 18 people in four departments and two reporting lines. Engineering reports to Olivia Bennett, as does Delivery, where Evelyn Kim manages Henry Silva. Design and Quality report to Sophia Lindqvist. Each person has a job title, department, role, level, location (London, Lisbon, Berlin or remote), start date, manager, work email, phone and personal email. Charlotte Dubois joined six weeks ago and is the newest, so her first-year leave allowance is a part of the full one.
- **Away today:** Noah Kowalski (vacation), Isabella Rossi (sick) and Benjamin Haddad (paternity leave).
- **Time off:** six requests are waiting for approval. Four are from Olivia's reporting line, including Charlotte's, and two from Sophia's. One is declined, and the rest are approved in the past or ahead.
- **Hiring:** 10 candidates across the board: three in CV screening, two being scheduled, two waiting on interview feedback, one with an offer out, one onboarding and one rejected.
- **Learning:** 8 courses, of which three are mandatory (welcome, security and respect at work). There are about 75 enrollments, three of them overdue (James O'Connor, Isabella Rossi and Charlotte Dubois).
- **Projects:** four projects and two sub-projects, with their teams.
- **Pay:** everyone has a hire salary and up to three yearly reviews on 1 April. Lucas Moreau and Mia Okafor (Lisbon) are paid below their bands and Benjamin Haddad above his. Two raises are waiting for HR: Olivia's for Liam Chen and Sophia's for Mia; Olivia's earlier one for Ethan Novak was declined.
- **Equity:** 14 grants. Most long-serving people have options at the share price of the day they joined, and some have exercised part of them. Charlotte has RSUs and Harper Nguyen options that haven't reached their cliff, and Olivia has an RSU refresher. The share price has risen from $0.85 to $9.40 over five valuations.

### Things to try

- **As the Team Lead,** approve Charlotte's request from Home. Then open a developer's profile and change their location: the private fields are locked. Open a designer's profile and there is nothing to edit or approve: they report to Sophia. Under People › Compensation, propose a raise for Noah Kowalski and watch the dialog show the raise and where it lands in his band.
- **As the Recruiter,** move a candidate through the board, then create Nora Fitzgerald's employee record from onboarding. She is enrolled in the mandatory courses automatically.
- **As the Learning Coordinator,** create a course and assign it to the overdue people.
- **As the Employee,** open People › Your pay to see Charlotte's salary and her RSUs waiting on their cliff. Book time off (it can only be for Charlotte) and watch the form count working days against what she has left; ask for more than that and it won't send. Withdraw the request, and log a module on her overdue security course.
- **As the HR Administrator,** approve Olivia's raise for Liam from Home, filter Compensation to people below their band, grant Henry Silva options, record an exercise for Liam, or edit a pay band. Filter People by department, change someone's phone number, or remove a person.

Changes are saved to `localStorage`, so they survive a reload. The refresh button in the top bar, beside the notifications bell, restores the original data. Data saved by an older version is upgraded in place, keeping your changes.

### Using a real API

To point the app at a real API instead, set `demo: false` and `apiUrl` in `src/environments/environment*.ts`. The mock API follows the same json-server style routes the services already call (`/employees`, `/employees/:id`, `?firstName_like=`), plus these:

- `POST /api/auth/login`, `POST /api/auth/logout` and `POST /api/auth/register`.
- `GET /api/auth/session`, which returns the signed-in user and their current permissions. The app calls it at startup, so a role change takes effect without signing out, and an expired session sends you back to sign in.
- `/courses` and `/enrollments` for learning, filterable by `courseId` and `employeeId`. The API derives each enrollment's `status` and `progress` from `completedModules`.
- `/salary-changes` and `/stock-grants`, filterable by `employeeId`, return only the records the caller may see. `/pay-bands` and `/share-prices` are readable by everyone signed in.
- `GET /leave-balances?employeeId=&year=`, which returns the allowance, days taken, days pending and days remaining per leave type. Without `employeeId` it returns everyone the caller may see: themselves, plus the people they approve time off for. `year` defaults to the current year.

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
