import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, Type, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeService } from 'src/app/services/employee.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { EmployeeNotAvailableDirective } from 'src/app/shared/directives/employee-not-available.directive';
import { TruncateDirective } from 'src/app/shared/directives/truncate.directive';

@Component({
  selector: 'app-employee-list',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Employees</h1>
          <p>{{ employees().length }} people across {{ positions.length }} roles</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" routerLink="/employees/create">
            <app-icon name="plus" /> Add employee
          </a>
        </div>
      </div>

      <div class="toolbar" role="search">
        <label class="visually-hidden" for="employee-search">Search employees</label>
        <input id="employee-search" class="input" type="search" placeholder="Search by name or email"
          [value]="search()" (input)="search.set($any($event.target).value)" />
        <label class="visually-hidden" for="employee-position">Position</label>
        <select id="employee-position" class="input" [value]="positionFilter()"
          (change)="positionFilter.set($any($event.target).value)">
          <option value="">All positions</option>
          @for (position of positions; track position) {
            <option [value]="position">{{ position }}</option>
          }
        </select>
      </div>

      <div class="table-wrap">
        <table class="data-table stack">
          <thead>
            <tr>
              <th scope="col">Full Name</th>
              <th scope="col">Position</th>
              <th scope="col">Level</th>
              <th scope="col">Status</th>
              <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (employee of filteredEmployees(); track employee.id) {
              <tr>
                <td>
                  <div class="person">
                    <app-avatar [name]="employee.firstName + ' ' + employee.lastName" [src]="employee.profilePicture" />
                    <div>
                      <a [routerLink]="['/employees/details', employee.id]">
                        {{ employee.firstName }} {{ employee.lastName }}
                      </a>
                      <span class="muted">{{ employee.email }}</span>
                    </div>
                  </div>
                </td>
                <td appTruncate [limit]="10" data-label="Position">{{ employee.position }}</td>
                <td data-label="Level">{{ employee.level }}</td>
                <td>
                  @if (employee.isAvailable) {
                    <span class="badge badge-good">Available</span>
                  } @else {
                    <span class="badge badge-serious">On leave</span>
                  }
                </td>
                <td class="actions">
                  <a class="btn btn-sm btn-ghost" [routerLink]="['/employees/edit', employee.id]">Edit</a>
                  <button class="btn btn-sm btn-ghost" (click)="showConfirmationDialog(employee)">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty-state">
                  {{ loaded() ? 'No employees match your filters.' : 'Loading employees…' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    <ng-container *ngComponentOutlet="confirmDialog; inputs: confirmInputs"></ng-container>
    `,
  standalone: true,
  imports: [NgComponentOutlet, RouterLink, TruncateDirective, EmployeeNotAvailableDirective, AvatarComponent, IconComponent],
})
export class EmployeeListComponent {
  employeeService = inject(EmployeeService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly positions: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];

  /** Bound from the `?position=` query parameter (e.g. links from the dashboard). */
  position = input<string>('');
  positionFilter = linkedSignal(() => this.position() ?? '');
  search = signal('');

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  private readonly employeesResult = toSignal(
    this.refresh$.pipe(switchMap(() => this.employeeService.getEmployees())),
  );
  employees = computed(() => this.employeesResult() ?? []);
  loaded = computed(() => this.employeesResult() !== undefined);

  filteredEmployees = computed(() => {
    const term = this.search().trim().toLowerCase();
    const position = this.positionFilter();
    return this.employees().filter(
      (e) =>
        (!position || e.position === position) &&
        (!term || `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(term)),
    );
  });

  isConfirmationOpen = false;
  confirmDialog: Type<unknown> | null = null;
  confirmInputs: Record<string, unknown> = {};

  async showConfirmationDialog(employee?: Employee) {
    this.confirmDialog = await import(
      '../../shared/components/confirmation-dialog.component'
    ).then((m) => m.ConfirmationDialogComponent);
    this.confirmInputs = {
      title: 'Delete employee?',
      message: employee
        ? `${employee.firstName} ${employee.lastName} will be removed, along with their time off requests and project assignments.`
        : 'This employee will be removed.',
      confirmLabel: 'Delete',
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
