import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChildren } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, forkJoin, of, switchMap } from 'rxjs';
import { EmployeeService } from '../services/employee.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { CandidateService } from '../services/candidate.service';
import { CourseService } from '../services/course.service';
import { EnrollmentService } from '../services/enrollment.service';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions.service';
import { Employee } from '../infrastructure/types/employee';
import { AvatarComponent } from '../shared/components/avatar.component';
import { StatusIconComponent } from '../shared/components/status-icon.component';
import { candidateStage } from '../shared/functions/status-badge';
import { awayLabels } from './employees/people-table';
import { QueueItem, QueueKind, QueueViewer, buildDecisionQueue, countByKind } from './home/decision-queue';
import { WeekBar, nextWeekBars, nextWeekDays, nextWeekRange } from './home/week-strip';

const POSITIONS: Employee['position'][] = ['Developer', 'Designer', 'QA', 'Manager'];
const PIPELINE_STAGES = ['CV evaluation', 'Interview preparation', 'Interview Feedback', 'Offer sent', 'Onboarding'];
const PIPELINE_LABELS = ['New', 'Interview', 'Feedback', 'Offer', 'Onboarding'];
const VISIBLE_QUEUE = 6;

/** "A, B and C". */
function listJoin(parts: string[]): string {
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Home, built to the ACME People design: the day's context and greeting, an
 * info alert naming who is out today, then the decision queue (underline tabs
 * with counts, status badges with their glyphs) beside a rail of cards for
 * next week's absences, the team and the hiring pipeline.
 */
@Component({
  selector: 'app-dashboard',
  template: `
    <div class="page">
      <div class="page-header">
        <div class="intro">
          <span class="kicker">{{ today | date: 'EEEE, d MMMM' }}</span>
          <h1>{{ greeting() }}</h1>
          <p>{{ summary() }}</p>
        </div>
        @if (canRequestTimeOff() || canAddPeople()) {
          <div class="page-actions">
            @if (canRequestTimeOff()) {
              <!-- One solid action per view: this is it unless "Add person" is offered. -->
              <a class="btn" [class.btn-primary]="!canAddPeople()" routerLink="/work/time-off">Request time off</a>
            }
            @if (canAddPeople()) {
              <a class="btn btn-primary" routerLink="/employees/create">Add person</a>
            }
          </div>
        }
      </div>

      @if (data(); as data) {
        @if (outToday(); as out) {
          <div class="acme-alert" role="status">
            <span class="acme-alert__icon"><app-status-icon variant="info" /></span>
            <div>
              <p class="acme-alert__title">{{ out.title }}</p>
              <p>{{ out.body }}</p>
            </div>
          </div>
        }

        @if (approved()) {
          <div class="acme-alert acme-alert--success" role="status">
            <span class="acme-alert__icon"><app-status-icon variant="success" /></span>
            <div>
              <p class="acme-alert__title">Saved.</p>
              <p>{{ approved() }}</p>
            </div>
          </div>
        }

        <div class="layout">
          <section class="card flush queue" aria-labelledby="queue-title">
            <div class="queue-head">
              <div class="card-header">
                <h2 id="queue-title">Needs your decision</h2>
                <span class="small muted">Soonest first</span>
              </div>
              <div class="tabs" role="tablist" aria-label="Filter decisions">
                @for (tab of tabs(); track tab.kind; let i = $index) {
                  <button #tabButton class="tab" type="button" role="tab" [id]="'queue-tab-' + tab.kind"
                    aria-controls="queue-panel" [attr.aria-selected]="kind() === tab.kind"
                    [tabIndex]="kind() === tab.kind ? 0 : -1"
                    (click)="selectKind(tab.kind)" (keydown)="onTabKey($event, i)">{{ tab.label }} <span class="tab-count">{{ tab.count }}</span></button>
                }
              </div>
            </div>

            <div id="queue-panel" role="tabpanel" [attr.aria-labelledby]="'queue-tab-' + kind()">
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
                            <span class="badge" [class.badge-warning]="item.tone === 'warning'"
                              [class.badge-critical]="item.tone === 'danger'">
                              @if (item.tone) {
                                <app-status-icon [variant]="item.tone" [size]="12" />
                              }
                              {{ item.tag }}
                            </span>
                          }
                        </div>
                        <span class="row-note">{{ item.note }}</span>
                      </div>
                      <div class="row-actions">
                        <a class="btn btn-sm btn-ghost" [routerLink]="item.link">{{ item.secondary }}</a>
                        @if (item.request) {
                          <button class="btn btn-sm" type="button" [disabled]="busy()"
                            (click)="approve(item)">Approve</button>
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
            </div>
          </section>

          <div class="rail">
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
                  <span><span class="swatch is-pending"></span>{{ canApprove() ? 'Waiting on you' : 'Waiting for approval' }}</span>
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
                  <span class="b-value num" [class.is-highlight]="row.highlight">{{ row.value }}</span>
                }
              </div>
            </section>

            @if (canHire()) {
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
            }
          </div>
        </div>
      } @else {
        <p class="loading">Loading your day…</p>
      }
    </div>
  `,
  styles: `
    .intro { display: grid; gap: var(--acme-space-2); min-width: 0; }
    .intro h1 { font-size: 2rem; }
    .page-header p { margin-top: 0; }

    /* Main queue beside a rail: the rail drops below on narrow screens. */
    .layout {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--acme-space-6);
    }
    .queue { flex: 999 1 560px; min-width: 0; }
    .rail {
      flex: 1 1 360px;
      min-width: 0;
      display: grid;
      gap: var(--acme-space-6);
      align-content: start;
    }

    .queue-head {
      display: grid;
      gap: var(--acme-space-4);
      padding: var(--acme-space-5) var(--acme-space-5) 0;
    }
    .queue-head .card-header { margin: 0; padding: 0; }
    .queue-head .tabs { border-bottom: 0; }
    .rows .row-item:first-child { border-top-color: var(--acme-color-border); }

    .link-btn {
      border: 0;
      padding: 0;
      background: none;
      color: var(--acme-color-link);
      font: inherit;
      cursor: pointer;
    }
    .link-btn:hover { color: var(--acme-color-link-hover); text-decoration: underline; }

    /* Mon-Fri strip: a name column plus one column per working day. */
    .timeline.week { grid-template-columns: 128px repeat(5, minmax(0, 1fr)); column-gap: 4px; }
    .legend { margin-top: var(--acme-space-4); }

    .headcount {
      display: flex;
      align-items: baseline;
      gap: var(--acme-space-3);
      margin-bottom: var(--acme-space-4);
    }
    .headcount strong {
      font: 600 2.5rem / 1 var(--acme-font-sans);
      letter-spacing: var(--acme-tracking-tight);
      font-variant-numeric: tabular-nums;
    }

    .bars {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr) 24px;
      gap: 10px var(--acme-space-3);
      align-items: center;
      font-size: 0.8125rem;
    }
    .b-label { color: var(--acme-color-text); text-decoration: none; }
    .b-label:hover { color: var(--acme-color-link); text-decoration: underline; }
    .b-value { text-align: right; }
    .b-value.is-highlight { font-weight: 600; }

    /* One row per stage, label then count: five tiles abreast in a 360px
       rail cut "Interview" and "Onboarding" short. */
    .pipeline {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.8125rem;
    }
    .pipeline li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--acme-space-3);
      padding: var(--acme-space-2) 0;
      border-top: 1px solid var(--acme-color-border);
    }
    .pipeline li:first-child { border-top: 0; padding-top: 0; }
    .pipeline li:last-child { padding-bottom: 0; }
    .pipeline span { order: -1; color: var(--acme-color-text); }
    .pipeline strong {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
  imports: [DatePipe, RouterLink, AvatarComponent, StatusIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly candidateService = inject(CandidateService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly user = inject(AuthService).currentUser;
  private readonly permissions = inject(PermissionsService);
  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  canApprove = this.permissions.can('ApproveTimeOff');
  canHire = this.permissions.can('ManageHiring');
  private readonly canAssign = this.permissions.can('AssignTraining');
  canAddPeople = this.permissions.can('CreateEmployee');
  /** Approvers book for anyone; everyone else only for themselves. */
  canRequestTimeOff = computed(() => this.canApprove() || this.user()?.employeeId !== undefined);

  private readonly viewer = computed<QueueViewer>(() => ({
    canApprove: this.canApprove(),
    canHire: this.canHire(),
    canAssign: this.canAssign(),
    employeeId: this.user()?.employeeId,
  }));

  readonly today = new Date();
  readonly weekDays = nextWeekDays();
  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  busy = signal(false);
  kind = signal<QueueKind>('all');
  showAll = signal(false);
  /** "Approved Harper Nguyen's vacation." after an approval from the queue. */
  approved = signal('');

  data = toSignal(
    this.refresh$.pipe(
      switchMap(() =>
        forkJoin({
          employees: this.employeeService.getEmployees(),
          requests: this.timeOffRequestService.getRequests(),
          // Only hiring roles may read candidates.
          candidates: this.canHire() ? this.candidateService.getCandidates() : of([]),
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
    return firstName ? `${partOfDay}, ${firstName}` : partOfDay;
  });

  private readonly employees = computed(() => this.data()?.employees ?? []);
  private readonly requests = computed(() => this.data()?.requests ?? []);
  private readonly candidates = computed(() => this.data()?.candidates ?? []);
  private readonly enrollments = computed(() => this.data()?.enrollments ?? []);
  private readonly courses = computed(() => this.data()?.courses ?? []);

  availableCount = computed(() => this.employees().filter((e) => e.isAvailable).length);

  /** Who is away today and why, for the info alert above the queue. */
  outToday = computed(() => {
    const away = this.employees().filter((e) => !e.isAvailable);
    if (!away.length) return null;
    const reasons = awayLabels(this.requests(), this.today);
    const people = away.map((e) => {
      const name = `${e.firstName} ${e.lastName}`;
      // "Sick Leave until 18 Oct" reads as "sick leave until 18 Oct" mid-sentence.
      const [what, until] = (reasons[e.id] ?? '').split(' until ');
      if (!what) return name;
      return `${name} (${what.toLowerCase()}${until ? ` until ${until}` : ''})`;
    });
    return {
      title: `${away.length} ${away.length === 1 ? 'person is' : 'people are'} out today`,
      body: `${listJoin(people)}.`,
    };
  });

  /** Everything waiting on this user, time off and hiring together. */
  queue = computed(() =>
    buildDecisionQueue(
      this.requests(),
      this.candidates(),
      this.employees(),
      this.enrollments(),
      this.courses(),
      this.viewer(),
    ),
  );

  private readonly counts = computed(() => countByKind(this.queue()));

  tabs = computed(() => {
    const counts = this.counts();
    // A tab for each kind of decision this role can make.
    return [
      { kind: 'all' as QueueKind, label: 'All', count: counts.all, shown: true },
      { kind: 'timeoff' as QueueKind, label: 'Time off', count: counts.timeoff, shown: this.canApprove() },
      { kind: 'hiring' as QueueKind, label: 'Hiring', count: counts.hiring, shown: this.canHire() },
      // Training items are either everyone's (assigners) or your own (if you have a People record).
      { kind: 'training' as QueueKind, label: 'Training', count: counts.training, shown: this.canAssign() || this.viewer().employeeId !== undefined },
    ].filter((tab) => tab.shown);
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
    if (!total) return 'Nothing needs your decision today.';
    const urgent = this.queue().filter((item) => item.urgent).length;
    const things = `${total} ${total === 1 ? 'thing needs' : 'things need'} your decision.`;
    return urgent ? `${things} ${urgent} can't wait.` : things;
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
    // Blue marks one takeaway only: the largest group, and it is labelled.
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

  selectKind(kind: QueueKind) {
    this.kind.set(kind);
    this.showAll.set(false);
  }

  /** Arrow keys, Home and End move between tabs, as the ACME Tabs do. */
  onTabKey(event: KeyboardEvent, index: number) {
    const tabs = this.tabs();
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    this.selectKind(tabs[next].kind);
    this.tabButtons()[next]?.nativeElement.focus();
  }

  approve(item: QueueItem) {
    const request = item.request;
    if (!request) return;
    this.busy.set(true);
    this.timeOffRequestService.approveRequest(request.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.approved.set(`Approved ${item.name}'s ${request.type.toLowerCase()}.`);
        this.refresh$.next();
      },
      error: () => this.busy.set(false),
    });
  }
}
