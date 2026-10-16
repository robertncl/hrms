# Hrms

This project uses [Angular CLI](https://github.com/angular/angular-cli) version 22.2.

Run `npm install` first. The commands below use the project's local Angular CLI through `npm run` or `npx ng`. A bare `ng` may resolve to a different program: on Debian/Ubuntu, `/usr/bin/ng` is the `ng-common` text editor.

## Demo

HRMS runs as a self-contained demo: an in-browser mock API (`src/app/demo/`) serves seed data for 18 employees, 6 projects, 10 candidates, 8 courses and a set of time off requests, so no backend is needed. Start the dev server and sign in with either account (password `demo`):

| Account | Role | Can edit names and emails | Can manage courses |
| --- | --- | --- | --- |
| `admin@hrms.demo` | HR Administrator | Yes | Yes |
| `lead@hrms.demo` | Team Lead | No (view only) | No (can still assign courses) |

You can also create your own account on the registration page.

What you can do:

- **Dashboard**: headcount, who's away, pending time off (approve or reject in place), headcount by position and the hiring pipeline.
- **Employees**: search and filter, add, edit and delete people, and see their projects.
- **Projects**: browse projects, their teams and subprojects.
- **Time off**: file, approve, reject and delete requests. Approving leave that covers today marks the person as on leave.
- **Recruitment**: move candidates from CV screening through interview, offer and onboarding, ending with an employee record.
- **Learning**: browse the course catalog, see completion and overdue training, assign courses to people with a due date, log their progress, and create, edit or delete courses. Mandatory courses are assigned to every new employee automatically, due 30 days after they start. Each employee's profile shows their training.

Changes are saved to `localStorage`, so they survive a reload. The refresh button in the header restores the original data. Dates in the seed data are relative to today, so the demo always looks current.

To point the app at a real API instead, set `demo: false` and `apiUrl` in `src/environments/environment*.ts`. The mock API follows the same json-server style routes the services already call (`/employees`, `/employees/:id`, `?firstName_like=`) plus `/api/auth/login`, `/api/auth/logout` and `/api/auth/register`. Learning uses `/courses` and `/enrollments` (filterable by `courseId` and `employeeId`); the API derives each enrollment's `status` and `progress` from `completedModules`.

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
