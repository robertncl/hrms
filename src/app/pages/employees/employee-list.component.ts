import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Type,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, forkJoin, switchMap } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { ProjectService } from 'src/app/services/project.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { awayLabels, employeeProjectNames, toCsv } from './people-table';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-employee-list',
  template: `
    <div class="page">
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

      <div class="toolbar" role="search">
        <div class="search">
          <app-icon name="search" [size]="16" />
          <label class="visually-hidden" for="employee-search">Search people by name or email</label>
          <input id="employee-search" type="search" placeholder="Search by name or email"
            [value]="search()" (input)="onSearch($any($event.target).value)" />
        </div>

        <div class="chips">
          @for (chip of chips(); track chip.position) {
            <button class="chip" type="button" [attr.aria-pressed]="positionFilter() === chip.position"
              (click)="setPosition(chip.position)">{{ chip.label }} {{ chip.count }}</button>
          }
        </div>

        <label class="acme-switch push">
          <span>Away only</span>
          <input type="checkbox" [checked]="awayOnly()" (change)="setAwayOnly($any($event.target).checked)" />
        </label>
      </div>

      <div class="table-wrap">
        <table class="data-table stack">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
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
                <td data-label="Role">{{ employee.position }}</td>
                <td class="muted" data-label="Level">{{ employee.level }}</td>
                <td data-label="Status">
                  <span class="status" [class.is-away]="!employee.isAvailable">
                    {{ statusLabel(employee) }}
                  </span>
                </td>
                <td class="muted projects" data-label="Projects">{{ projectNames()[employee.id] || '—' }}</td>
                <td class="actions">
                  @if (canEdit()) {
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
                <td colspan="6" class="empty-state">
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
    .acme-switch { flex-direction: row-reverse; color: var(--acme-color-text-muted); }

    @media (max-width: 640px) {
      .projects { max-width: none; white-space: normal; }
    }
  `,
  standalone: true,
  imports: [NgComponentOutlet, RouterLink, AvatarComponent, IconComponent],
})
export class EmployeeListComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly projectService = inject(ProjectService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly permissions = inject(PermissionsService);

  canAdd = this.permissions.can('CreateEmployee');
  canEdit = this.permissions.can('EditEmployeeGeneralDetails');
  canRemove = this.permissions.can('DeleteEmployee');

  readonly positions: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];

  /** Bound from `?position=` (links from Home) and `?q=` (sidebar search). */
  position = input<string>('');
  query = input<string>('', { alias: 'q' });

  positionFilter = linkedSignal(() => this.position() ?? '');
  search = linkedSignal(() => this.query() ?? '');
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
      { position: '', label: 'All', count: employees.length },
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
    return this.employees().filter(
      (e) =>
        (!position || e.position === position) &&
        (!awayOnly || !e.isAvailable) &&
        (!term || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(term)),
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

  // Filtering changes the result set, so start again from the first page.
  onSearch(value: string) {
    this.search.set(value);
    this.page.set(0);
  }

  setPosition(position: string) {
    this.positionFilter.set(position);
    this.page.set(0);
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
