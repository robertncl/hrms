import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Type,
  viewChildren,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, forkJoin, switchMap } from 'rxjs';
import { DEPARTMENTS, Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AccessScope } from 'src/app/services/access-scope.service';
import { inScope } from 'src/app/shared/functions/org';
import { ProjectService } from 'src/app/services/project.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { PeopleSectionsComponent } from 'src/app/shared/components/people-sections.component';
import { StatusIconComponent, StatusVariant } from 'src/app/shared/components/status-icon.component';
import { awayLabels, employeeProjectNames, toCsv } from './people-table';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-employee-list',
  template: `
    <div class="page">
      <app-people-sections />
      <div class="page-header">
        <div>
          <h1>People</h1>
          <p>{{ summary() }}</p>
        </div>
        <div class="page-actions">
          <button class="btn" type="button" (click)="exportCsv()">Export CSV</button>
          @if (canAdd()) {
            <a class="btn btn-primary" routerLink="/employees/create">Add person</a>
          }
        </div>
      </div>

      <div class="filters">
      <div class="tabs" role="tablist" aria-label="Filter by role">
        @for (chip of chips(); track chip.position; let i = $index) {
          <button #roleTab class="tab" type="button" role="tab" aria-controls="people-table"
            [attr.aria-selected]="positionFilter() === chip.position"
            [tabIndex]="positionFilter() === chip.position ? 0 : -1"
            (click)="setPosition(chip.position)" (keydown)="onTabKey($event, i)">{{ chip.label }} <span class="tab-count">{{ chip.count }}</span></button>
        }
      </div>

      <div class="toolbar" role="search">
        <div class="search">
          <app-icon name="search" [size]="16" />
          <label class="visually-hidden" for="employee-search">Search people by name, email, job title or department</label>
          <input id="employee-search" type="search" placeholder="Search by name, email or job title"
            [value]="search()" (input)="onSearch($any($event.target).value)" />
        </div>

        <label class="visually-hidden" for="employee-department">Department</label>
        <!-- [selected] per option, not [value] on the select: the value would be set before the options exist. -->
        <select id="employee-department" class="input" (change)="setDepartment($any($event.target).value)">
          <option value="" [selected]="!departmentFilter()">All departments</option>
          @for (department of departments; track department) {
            <option [value]="department" [selected]="department === departmentFilter()">{{ department }}</option>
          }
        </select>

        <label class="acme-switch push">
          <span>Away only</span>
          <input type="checkbox" [checked]="awayOnly()" (change)="setAwayOnly($any($event.target).checked)" />
        </label>
      </div>
      </div>

      <div class="table-wrap">
        <table id="people-table" class="data-table stack">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Department</th>
              <th scope="col">Level</th>
              <th scope="col">Status</th>
              <th scope="col">Projects</th>
              <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (employee of pageRows(); track employee.id) {
              <tr>
                <td>
                  <div class="person">
                    <app-avatar [name]="employee.firstName + ' ' + employee.lastName"
                      [src]="employee.profilePicture" [away]="!employee.isAvailable" />
                    <div>
                      <a [routerLink]="['/employees/details', employee.id]">
                        {{ employee.firstName }} {{ employee.lastName }}
                      </a>
                      <span class="muted">{{ employee.email }}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Role">{{ employee.jobTitle || employee.position }}</td>
                <td class="muted" data-label="Department">{{ employee.department || '—' }}</td>
                <td class="muted" data-label="Level">{{ employee.level }}</td>
                <td data-label="Status">
                  @let tone = statusTone(employee);
                  <span class="badge status-badge" [class.badge-info]="tone === 'info'" [class.badge-warning]="tone === 'warning'">
                    @if (tone) {
                      <app-status-icon [variant]="tone" [size]="12" />
                    }
                    {{ statusLabel(employee) }}
                  </span>
                </td>
                <td class="muted projects" data-label="Projects">{{ projectNames()[employee.id] || '—' }}</td>
                <td class="actions">
                  @if (canEditPerson(employee)) {
                    <a class="btn btn-icon" [routerLink]="['/employees/edit', employee.id]"
                      [title]="'Edit ' + employee.firstName">
                      <app-icon name="edit" [size]="16" />
                      <span class="visually-hidden">Edit {{ employee.firstName }} {{ employee.lastName }}</span>
                    </a>
                  }
                  @if (canRemove()) {
                    <button class="btn btn-icon" type="button" (click)="showConfirmationDialog(employee)"
                      [title]="'Remove ' + employee.firstName">
                      <app-icon name="x" [size]="16" />
                      <span class="visually-hidden">Remove {{ employee.firstName }} {{ employee.lastName }}</span>
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-state">
                  {{ loaded() ? 'Nobody matches those filters.' : 'Loading people…' }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        @if (filtered().length) {
          <div class="table-footer">
            <span>Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ filtered().length }}</span>
            <span class="pager">
              <button class="btn btn-sm" type="button" [disabled]="page() === 0"
                (click)="page.set(page() - 1)">Previous</button>
              <button class="btn btn-sm" type="button" [disabled]="rangeEnd() >= filtered().length"
                (click)="page.set(page() + 1)">Next</button>
            </span>
          </div>
        }
      </div>
    </div>
    <ng-container *ngComponentOutlet="confirmDialog; inputs: confirmInputs"></ng-container>
    `,
  styles: `
    .projects {
      max-width: 16rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pager { display: flex; gap: var(--acme-space-2); }
    .filters { display: grid; gap: var(--acme-space-4); }
    .acme-switch { flex-direction: row-reverse; color: var(--acme-color-text-muted); }

    @media (max-width: 640px) {
      .projects { max-width: none; white-space: normal; }
    }
  `,
  standalone: true,
  imports: [NgComponentOutlet, RouterLink, AvatarComponent, IconComponent, PeopleSectionsComponent, StatusIconComponent],
})
export class EmployeeListComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly projectService = inject(ProjectService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly permissions = inject(PermissionsService);

  canAdd = this.permissions.can('CreateEmployee');
  private readonly canEdit = this.permissions.can('EditEmployeeGeneralDetails');
  private readonly access = inject(AccessScope);
  /** Whom this viewer may edit: everyone for HR, their reporting line for a lead. */
  private readonly scope = computed(() => this.access.of(this.employees()));
  readonly departments = DEPARTMENTS;
  canRemove = this.permissions.can('DeleteEmployee');

  readonly positions: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];

  private readonly roleTabs = viewChildren<ElementRef<HTMLButtonElement>>('roleTab');

  /** Bound from `?position=` (links from Home) and `?q=` (app bar search). */
  position = input<string>('');
  query = input<string>('', { alias: 'q' });
  /** Bound from `?department=`. */
  department = input<string>('');

  positionFilter = linkedSignal(() => this.position() ?? '');
  search = linkedSignal(() => this.query() ?? '');
  departmentFilter = linkedSignal(() => this.department() ?? '');
  awayOnly = signal(false);
  page = signal(0);

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private readonly result = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        forkJoin({
          employees: this.employeeService.getEmployees(),
          projects: this.projectService.getProjects(),
          requests: this.timeOffRequestService.getRequests(),
        }),
      ),
    ),
  );

  employees = computed(() => this.result()?.employees ?? []);
  loaded = computed(() => this.result() !== undefined);

  /** Project names per employee, for the Projects column. */
  projectNames = computed(() => employeeProjectNames(this.result()?.projects ?? []));

  /** "Vacation until 20 Oct" for whoever is signed off across today. */
  private readonly away = computed(() => awayLabels(this.result()?.requests ?? []));

  chips = computed(() => {
    const employees = this.employees();
    return [
      { position: '', label: 'Everyone', count: employees.length },
      ...this.positions.map((position) => ({
        position,
        label: `${position}s`,
        count: employees.filter((e) => e.position === position).length,
      })),
    ];
  });

  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const position = this.positionFilter();
    const awayOnly = this.awayOnly();
    const department = this.departmentFilter();
    return this.employees().filter(
      (e) =>
        (!position || e.position === position) &&
        (!department || e.department === department) &&
        (!awayOnly || !e.isAvailable) &&
        (!term ||
          `${e.firstName} ${e.lastName} ${e.email} ${e.jobTitle ?? ''} ${e.department ?? ''}`.toLowerCase().includes(term)),
    );
  });

  pageRows = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  rangeStart = computed(() => (this.filtered().length ? this.page() * PAGE_SIZE + 1 : 0));
  rangeEnd = computed(() => Math.min(this.filtered().length, (this.page() + 1) * PAGE_SIZE));

  summary = computed(() => {
    const total = this.employees().length;
    if (!total) return 'Nobody here yet.';
    const roles = this.positions.filter((p) => this.employees().some((e) => e.position === p)).length;
    const awayCount = this.employees().filter((e) => !e.isAvailable).length;
    const people = `${total} ${total === 1 ? 'person' : 'people'} across ${roles} ${roles === 1 ? 'role' : 'roles'}.`;
    return awayCount
      ? `${people} ${awayCount} ${awayCount === 1 ? 'is' : 'are'} away today.`
      : `${people} Everyone is in today.`;
  });

  statusLabel(employee: Employee): string {
    return employee.isAvailable ? 'In today' : (this.away()[employee.id] ?? 'Away');
  }

  /** In today stays neutral; sick leave is a warning, any other absence info. */
  statusTone(employee: Employee): StatusVariant | null {
    if (employee.isAvailable) return null;
    return this.statusLabel(employee).startsWith('Sick') ? 'warning' : 'info';
  }

  /** Arrow keys, Home and End move between the role tabs. */
  onTabKey(event: KeyboardEvent, index: number) {
    const chips = this.chips();
    const next =
      event.key === 'ArrowRight' ? (index + 1) % chips.length
      : event.key === 'ArrowLeft' ? (index - 1 + chips.length) % chips.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? chips.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    this.setPosition(chips[next].position);
    this.roleTabs()[next]?.nativeElement.focus();
  }

  // Filtering changes the result set, so start again from the first page.
  onSearch(value: string) {
    this.search.set(value);
    this.page.set(0);
  }

  setPosition(position: string) {
    this.positionFilter.set(position);
    this.page.set(0);
  }

  setDepartment(department: string) {
    this.departmentFilter.set(department);
    this.page.set(0);
  }

  canEditPerson(employee: Employee): boolean {
    return this.canEdit() && inScope(this.scope(), employee.id);
  }

  setAwayOnly(value: boolean) {
    this.awayOnly.set(value);
    this.page.set(0);
  }

  exportCsv() {
    const csv = toCsv(this.filtered(), this.projectNames(), (e) => this.statusLabel(e));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'acme-people.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  isConfirmationOpen = false;
  confirmDialog: Type<unknown> | null = null;
  confirmInputs: Record<string, unknown> = {};

  async showConfirmationDialog(employee?: Employee) {
    this.confirmDialog = await import(
      '../../shared/components/confirmation-dialog.component'
    ).then((m) => m.ConfirmationDialogComponent);
    const name = employee ? `${employee.firstName} ${employee.lastName}` : 'this person';
    this.confirmInputs = {
      title: employee ? `Remove ${name}?` : 'Remove this person?',
      message: employee
        ? `This removes ${employee.firstName} from People, along with their time off history and their place on every project. You can't undo it.`
        : 'This person will be removed.',
      confirmLabel: 'Remove person',
      cancelLabel: employee ? `Keep ${employee.firstName}` : 'Cancel',
      // Away people are the ones most likely being removed by mistake.
      note:
        employee && !employee.isAvailable
          ? `${employee.firstName} is away right now — ${this.statusLabel(employee).toLowerCase()}.`
          : '',
      destructive: true,
      onConfirm: () => employee && this.deleteEmployee(employee),
      onClose: () => {
        this.isConfirmationOpen = false;
        this.confirmDialog = null;
      },
    };
    this.isConfirmationOpen = true;
    // The lazy import resolves outside zone.js's tracking, so ask for a render.
    this.changeDetector.markForCheck();
  }

  private deleteEmployee(employee: Employee) {
    this.employeeService.deleteEmployee(employee.id).subscribe(() => this.refresh$.next());
  }
}
