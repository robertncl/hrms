import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, forkJoin, switchMap } from 'rxjs';
import { EmployeeService } from '../services/employee.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { CandidateService } from '../services/candidate.service';
import { CourseService } from '../services/course.service';
import { EnrollmentService } from '../services/enrollment.service';
import { completionRate, isOverdue } from './learning/learning';
import { AuthService } from '../services/auth.service';
import { Employee } from '../infrastructure/types/employee';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { AvatarComponent } from '../shared/components/avatar.component';
import { candidateStage } from '../shared/functions/status-badge';
import { QueueKind, buildDecisionQueue, countByKind } from './home/decision-queue';
import { WeekBar, nextWeekBars, nextWeekDays, nextWeekRange } from './home/week-strip';

const POSITIONS: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];
const PIPELINE_STAGES = ['CV evaluation', 'Interview preparation', 'Interview Feedback', 'Offer sent', 'Onboarding'];
const PIPELINE_LABELS = ['New', 'Interview', 'Feedback', 'Offer', 'Onboarding'];
const VISIBLE_QUEUE = 6;

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="kicker">{{ today | date: 'EEEE, d MMMM' }}</div>
          <h1>{{ greeting() }}</h1>
          <p>{{ summary() }}</p>
        </div>
        <div class="page-actions">
          <a class="btn" routerLink="/work/time-off">Request time off</a>
          <a class="btn btn-primary" routerLink="/employees/create">Add person</a>
        </div>
      </div>

      @if (data(); as data) {
        <div class="split">
          <section class="card flush" aria-labelledby="queue-title">
            <div class="card-header">
              <h2 id="queue-title">Needs your decision</h2>
              <div class="chips">
                @for (tab of tabs(); track tab.kind) {
                  <button class="chip" type="button" [attr.aria-pressed]="kind() === tab.kind"
                    (click)="kind.set(tab.kind)">{{ tab.label }} {{ tab.count }}</button>
                }
              </div>
            </div>

            @if (visibleQueue().length) {
              <div class="rows">
                @for (item of visibleQueue(); track item.id) {
                  <div class="row-item">
                    <app-avatar [name]="item.name" size="2.25rem" />
                    <div class="row-body">
                      <div class="row-title">
                        <strong>{{ item.name }}</strong>
                        <span class="what">{{ item.what }}</span>
                        @if (item.tag) {
                          <span class="badge" [class.badge-critical]="item.urgent">{{ item.tag }}</span>
                        }
                      </div>
                      <span class="row-note">{{ item.note }}</span>
                    </div>
                    <div class="row-actions">
                      <a class="btn btn-sm btn-ghost" [routerLink]="item.link">{{ item.secondary }}</a>
                      @if (item.request) {
                        <button class="btn btn-sm" type="button" [disabled]="busy()"
                          (click)="approve(item.request)">Approve</button>
                      } @else {
                        <a class="btn btn-sm" [routerLink]="item.link">{{ item.primary }}</a>
                      }
                    </div>
                  </div>
                }
              </div>
              @if (hiddenCount()) {
                <div class="rows-footer">
                  <button class="link-btn" type="button" (click)="showAll.set(true)">
                    Show {{ hiddenCount() }} more
                  </button>
                </div>
              }
            } @else {
              <p class="empty-state">Nothing waiting on you. Enjoy it while it lasts.</p>
            }
          </section>

          <div class="stack">
            <section class="card" aria-labelledby="week-title">
              <div class="card-header">
                <h2 id="week-title">Who's out next week</h2>
                <span class="small muted">{{ weekRange() }}</span>
              </div>
              @if (weekBars().length) {
                <div class="timeline week">
                  <span></span>
                  @for (day of weekDays; track day) {
                    <span class="t-head centred">{{ day }}</span>
                  }
                  @for (bar of weekBars(); track bar.id) {
                    <span class="t-name">{{ bar.name }}</span>
                    <span class="t-bar" [class.is-pending]="bar.pending"
                      [style.grid-column]="bar.column">{{ bar.label }}</span>
                  }
                </div>
                <div class="legend">
                  <span><span class="swatch"></span>Approved</span>
                  <span><span class="swatch is-pending"></span>Waiting on you</span>
                </div>
              } @else {
                <p class="empty-state">Everyone is in next week.</p>
              }
            </section>

            <section class="card" aria-labelledby="team-title">
              <div class="card-header">
                <h2 id="team-title">Team</h2>
                <a class="small" routerLink="/employees">All people</a>
              </div>
              <p class="headcount">
                <strong>{{ data.employees.length }}</strong>
                <span class="small muted">people · {{ availableCount() }} in today</span>
              </p>
              <div class="bars">
                @for (row of headcount(); track row.label) {
                  <a class="b-label" routerLink="/employees" [queryParams]="{ position: row.label }">{{ row.label }}</a>
                  <span class="meter">
                    <span [class.is-highlight]="row.highlight" [style.width.%]="row.percent"></span>
                  </span>
                  <span class="b-value num">{{ row.value }}</span>
                }
              </div>
            </section>

            <section class="card" aria-labelledby="pipeline-title">
              <div class="card-header">
                <h2 id="pipeline-title">Hiring</h2>
                <a class="small" routerLink="/recruitment">Open board</a>
              </div>
              <ol class="pipeline">
                @for (stage of pipeline(); track stage.label) {
                  <li>
                    <strong>{{ stage.value }}</strong>
                    <span>{{ stage.label }}</span>
                  </li>
                }
              </ol>
            </section>
          </div>
        </div>
      } @else {
        <p class="loading">Loading your day…</p>
      }
    </div>
  `,
  styles: `
    .page-header .kicker { margin-bottom: var(--acme-space-2); }

    .link-btn {
      border: 0;
      padding: 0;
      background: none;
      color: var(--acme-color-link);
      font: inherit;
      cursor: pointer;
    }
    .link-btn:hover { text-decoration: underline; }

    /* Mon-Fri strip: a name column plus one column per working day. */
    .timeline.week { grid-template-columns: 110px repeat(5, minmax(0, 1fr)); column-gap: 4px; }

    .headcount {
      display: flex;
      align-items: baseline;
      gap: var(--acme-space-3);
      margin-bottom: var(--acme-space-4);
    }
    .headcount strong { font: 700 var(--acme-text-4xl) / 1 var(--acme-font-display); }

    .bars {
      display: grid;
      grid-template-columns: 80px minmax(0, 1fr) 24px;
      gap: var(--acme-space-2) var(--acme-space-3);
      align-items: center;
      font-size: var(--acme-text-sm);
    }
    .b-label { color: var(--acme-color-text-muted); text-decoration: none; }
    .b-label:hover { color: var(--acme-color-link); text-decoration: underline; }
    .b-value { font-weight: 600; text-align: right; }

    .pipeline {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--app-hairline);
      border-radius: var(--acme-radius-md);
      overflow: hidden;
    }
    .pipeline li {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: var(--acme-space-2) var(--acme-space-1) var(--acme-space-3);
    }
    .pipeline li + li { border-left: 1px solid var(--app-hairline); }
    .pipeline strong { font: 700 var(--acme-text-2xl) / 1.1 var(--acme-font-display); }
    /* Five stage names in one row is tight: shrink the label a step rather
       than breaking "Onboarding" across lines. */
    .pipeline span {
      font-size: 10px;
      line-height: 1.3;
      letter-spacing: -0.01em;
      color: var(--acme-color-text-muted);
      white-space: nowrap;
    }
  `,
  imports: [DatePipe, RouterLink, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly candidateService = inject(CandidateService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly user = inject(AuthService).currentUser;

  readonly today = new Date();
  readonly weekDays = nextWeekDays();
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  busy = signal(false);
  kind = signal<QueueKind>('all');
  showAll = signal(false);

  data = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        forkJoin({
          employees: this.employeeService.getEmployees(),
          requests: this.timeOffRequestService.getRequests(),
          candidates: this.candidateService.getCandidates(),
          enrollments: this.enrollmentService.getEnrollments(),
          courses: this.courseService.getCourses(),
        }),
      ),
    ),
  );

  greeting = computed(() => {
    const hour = this.today.getHours();
    const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = this.user()?.name.split(' ')[0];
    return firstName ? `${partOfDay}, ${firstName}.` : `${partOfDay}.`;
  });

  private readonly employees = computed(() => this.data()?.employees ?? []);
  private readonly requests = computed(() => this.data()?.requests ?? []);
  private readonly candidates = computed(() => this.data()?.candidates ?? []);
  private readonly enrollments = computed(() => this.data()?.enrollments ?? []);
  private readonly courses = computed(() => this.data()?.courses ?? []);

  availableCount = computed(() => this.employees().filter((e) => e.isAvailable).length);

  /** Everything waiting on this user, time off and hiring together. */
  queue = computed(() =>
    buildDecisionQueue(
      this.requests(),
      this.candidates(),
      this.employees(),
      this.enrollments(),
      this.courses(),
    ),
  );

  private readonly counts = computed(() => countByKind(this.queue()));

  tabs = computed(() => {
    const counts = this.counts();
    return [
      { kind: 'all' as QueueKind, label: 'All', count: counts.all },
      { kind: 'timeoff' as QueueKind, label: 'Time off', count: counts.timeoff },
      { kind: 'hiring' as QueueKind, label: 'Hiring', count: counts.hiring },
      { kind: 'training' as QueueKind, label: 'Training', count: counts.training },
    ];
  });

  filteredQueue = computed(() => {
    const kind = this.kind();
    return kind === 'all' ? this.queue() : this.queue().filter((item) => item.kind === kind);
  });

  visibleQueue = computed(() =>
    this.showAll() ? this.filteredQueue() : this.filteredQueue().slice(0, VISIBLE_QUEUE),
  );

  hiddenCount = computed(() => this.filteredQueue().length - this.visibleQueue().length);

  summary = computed(() => {
    const total = this.counts().all;
    if (!total) return 'Nothing needs you today.';
    const urgent = this.queue().filter((item) => item.urgent).length;
    const things = `${total} ${total === 1 ? 'thing needs' : 'things need'} you.`;
    return urgent ? `${things} ${urgent} ${urgent === 1 ? "can't" : "can't"} wait.` : things;
  });

  weekRange = computed(() => nextWeekRange(this.today));

  weekBars = computed<WeekBar[]>(() =>
    nextWeekBars(this.requests(), this.employees(), this.today),
  );

  headcount = computed(() => {
    const employees = this.employees();
    const counts = POSITIONS.map((position) => ({
      label: position,
      value: employees.filter((e) => e.position === position).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.value));
    // Cobalt marks one takeaway only: the largest group, and it is labelled.
    return counts.map((c) => ({
      ...c,
      percent: (c.value / max) * 100,
      highlight: c.value === max,
    }));
  });

  pipeline = computed(() => {
    const candidates = this.candidates();
    return PIPELINE_STAGES.map((stage, i) => ({
      label: PIPELINE_LABELS[i],
      value: candidates.filter((c) => candidateStage(c) === stage).length,
    }));
  });

  approve(request: TimeOffRequest) {
    this.busy.set(true);
    this.timeOffRequestService.approveRequest(request.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.refresh$.next();
      },
      error: () => this.busy.set(false),
    });
  }
}
