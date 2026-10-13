import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, forkJoin, switchMap } from 'rxjs';
import { EmployeeService } from '../services/employee.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { CandidateService } from '../services/candidate.service';
import { AuthService } from '../services/auth.service';
import { Employee } from '../infrastructure/types/employee';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { AvatarComponent } from '../shared/components/avatar.component';
import { BarListComponent, BarListItem } from '../shared/components/bar-list.component';
import { candidateStage } from '../shared/functions/status-badge';
import { daysFromToday } from '../demo/demo-data';

const POSITIONS: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];
const PIPELINE_STAGES = ['CV evaluation', 'Interview preparation', 'Interview Feedback', 'Offer sent', 'Onboarding'];

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ greeting() }}</h1>
          <p>{{ today | date: 'fullDate' }}</p>
        </div>
      </div>

      @if (data(); as data) {
        <section class="stats" aria-label="Key figures">
          <a class="card stat" routerLink="/employees">
            <span class="stat-label">Headcount</span>
            <span class="stat-value">{{ data.employees.length }}</span>
            <span class="stat-note">{{ availableCount() }} available today</span>
          </a>
          <a class="card stat" routerLink="/work/time-off">
            <span class="stat-label">Away today</span>
            <span class="stat-value">{{ data.employees.length - availableCount() }}</span>
            <span class="stat-note">On approved time off</span>
          </a>
          <a class="card stat" routerLink="/work/time-off">
            <span class="stat-label">Pending requests</span>
            <span class="stat-value">{{ pendingRequests().length }}</span>
            <span class="stat-note">Waiting for approval</span>
          </a>
          <a class="card stat" routerLink="/recruitment">
            <span class="stat-label">Active candidates</span>
            <span class="stat-value">{{ activeCandidates() }}</span>
            <span class="stat-note">In the hiring pipeline</span>
          </a>
        </section>

        <div class="panels">
          <section class="card">
            <div class="card-header">
              <h2>Pending time off</h2>
              <a routerLink="/work/time-off" class="small">View all</a>
            </div>
            @if (pendingRequests().length) {
              <ul class="list">
                @for (request of pendingRequests().slice(0, 5); track request.id) {
                  <li>
                    <app-avatar [name]="employeeName(request.employeeId)" size="2rem" />
                    <div class="grow">
                      <strong>{{ employeeName(request.employeeId) }}</strong>
                      <span class="muted small">
                        {{ request.type }} · {{ request.startDate | date: 'MMM d' }}
                        @if (request.endDate !== request.startDate) { – {{ request.endDate | date: 'MMM d' }} }
                      </span>
                    </div>
                    <div class="row-actions">
                      <button class="btn btn-sm" [disabled]="busy()" (click)="resolve(request, 'Approved')">Approve</button>
                      <button class="btn btn-sm btn-ghost" [disabled]="busy()" (click)="resolve(request, 'Rejected')">Reject</button>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="empty-state">No requests waiting. Nice work!</p>
            }
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Who's out</h2>
              <span class="muted small">Next 14 days</span>
            </div>
            @if (upcomingAbsences().length) {
              <ul class="list">
                @for (request of upcomingAbsences(); track request.id) {
                  <li>
                    <app-avatar [name]="employeeName(request.employeeId)" size="2rem" />
                    <div class="grow">
                      <a [routerLink]="['/employees/details', request.employeeId]">{{ employeeName(request.employeeId) }}</a>
                      <span class="muted small">{{ request.type }}</span>
                    </div>
                    <span class="small num">
                      {{ request.startDate | date: 'MMM d' }} – {{ request.endDate | date: 'MMM d' }}
                    </span>
                  </li>
                }
              </ul>
            } @else {
              <p class="empty-state">Everyone is in for the next two weeks.</p>
            }
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Headcount by position</h2>
              <span class="muted small">{{ data.employees.length }} people</span>
            </div>
            <app-bar-list [items]="headcountByPosition()" label="Headcount by position" />
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Hiring pipeline</h2>
              <span class="muted small">Candidates per stage</span>
            </div>
            <app-bar-list [items]="pipeline()" label="Candidates per hiring stage" />
          </section>
        </div>
      } @else {
        <p class="loading">Loading dashboard…</p>
      }
    </div>
  `,
  styles: `
    .stats {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
    }
    .panels {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      align-items: start;
    }
    .stat {
      display: grid;
      gap: 0.15rem;
      color: inherit;
      text-decoration: none;
    }
    .stat:hover { border-color: var(--border-strong); }
    .stat-label { font-size: 0.9rem; color: var(--text-secondary); }
    .stat-value { font-size: 2rem; font-weight: 650; line-height: 1.2; }
    .stat-note { font-size: 0.82rem; color: var(--text-muted); }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .list li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--border);
    }
    .list li:last-child { border-bottom: 0; }
    .grow { flex: 1; display: grid; min-width: 0; }
    .grow a { font-weight: 600; text-decoration: none; }
    .row-actions { display: flex; gap: 0.25rem; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    @media (max-width: 480px) {
      .list li { flex-wrap: wrap; }
      .row-actions { width: 100%; justify-content: flex-end; }
    }
  `,
  imports: [DatePipe, RouterLink, AvatarComponent, BarListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly candidateService = inject(CandidateService);
  private readonly user = inject(AuthService).currentUser;

  readonly today = new Date();
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  busy = signal(false);

  data = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        forkJoin({
          employees: this.employeeService.getEmployees(),
          requests: this.timeOffRequestService.getRequests(),
          candidates: this.candidateService.getCandidates(),
        }),
      ),
    ),
  );

  greeting = computed(() => {
    const hour = this.today.getHours();
    const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = this.user()?.name.split(' ')[0];
    return firstName ? `${partOfDay}, ${firstName}` : partOfDay;
  });

  private readonly employeesById = computed(
    () => new Map((this.data()?.employees ?? []).map((e) => [e.id, e])),
  );

  availableCount = computed(() => (this.data()?.employees ?? []).filter((e) => e.isAvailable).length);

  pendingRequests = computed(() =>
    (this.data()?.requests ?? [])
      .filter((r) => r.status === 'Pending')
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  upcomingAbsences = computed(() => {
    const from = daysFromToday(0);
    const to = daysFromToday(14);
    return (this.data()?.requests ?? [])
      .filter((r) => r.status === 'Approved' && r.endDate >= from && r.startDate <= to)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  activeCandidates = computed(
    () => (this.data()?.candidates ?? []).filter((c) => c.status !== 'Rejected' && !c.employeeId).length,
  );

  headcountByPosition = computed<BarListItem[]>(() => {
    const employees = this.data()?.employees ?? [];
    return POSITIONS.map((position) => ({
      label: position,
      value: employees.filter((e) => e.position === position).length,
      link: '/employees',
      query: { position },
    }));
  });

  pipeline = computed<BarListItem[]>(() => {
    const candidates = this.data()?.candidates ?? [];
    return PIPELINE_STAGES.map((stage) => ({
      label: stage,
      value: candidates.filter((c) => candidateStage(c) === stage).length,
      link: '/recruitment',
      query: { stage },
    }));
  });

  employeeName(id: number) {
    const employee = this.employeesById().get(id);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${id}`;
  }

  resolve(request: TimeOffRequest, status: 'Approved' | 'Rejected') {
    this.busy.set(true);
    const action = status === 'Approved'
      ? this.timeOffRequestService.approveRequest(request.id)
      : this.timeOffRequestService.rejectRequest(request.id);
    action.subscribe({
      next: () => {
        this.busy.set(false);
        this.refresh$.next();
      },
      error: () => this.busy.set(false),
    });
  }
}
