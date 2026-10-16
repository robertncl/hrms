import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from 'src/environments/environment';
import { DemoBackend } from '../demo/demo-backend';
import { forkJoin, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';
import { CandidateService } from '../services/candidate.service';
import { CourseService } from '../services/course.service';
import { EnrollmentService } from '../services/enrollment.service';
import { EmployeeService } from '../services/employee.service';
import { NotificationService } from '../services/notification.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { buildDecisionQueue } from '../pages/home/decision-queue';
import { PermissionsService } from '../services/permissions.service';
import { Permissions } from '../infrastructure/types/permissions';
import { FooterComponent } from '../shared/components/footer.component';
import { IconComponent, IconName } from '../shared/components/icon.component';
import { NotificationsPanelComponent } from '../shared/components/notifications-panel.component';
import { WordmarkComponent } from '../shared/components/wordmark.component';

type NavItem = { label: string; link: string; icon: IconName; permission?: Permissions };

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', link: '/dashboard', icon: 'home' },
  { label: 'People', link: '/employees', icon: 'users' },
  { label: 'Projects', link: '/work/projects', icon: 'briefcase' },
  { label: 'Time off', link: '/work/time-off', icon: 'calendar' },
  { label: 'Hiring', link: '/recruitment', icon: 'user-plus', permission: 'ManageHiring' },
  { label: 'Learning', link: '/learning', icon: 'book' },
];

/**
 * Layout for signed-in pages.
 *
 * The ACME People screens have no top app bar: the sidebar carries the brand,
 * search, destinations, notifications and the signed-in user, and the page
 * starts straight at its own title. So this shell folds in what the old
 * header did rather than stacking a second bar above the content.
 */
@Component({
  selector: 'app-shell',
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="shell">
      <aside class="sidebar">
        <div class="side-top">
          <a routerLink="/dashboard" class="brand" aria-label="ACME People home"><app-wordmark /></a>
          <button class="btn btn-icon bell" type="button" (click)="notificationsOpen.set(true)">
            <app-icon name="bell" />
            @if (unreadCount()) {
              <span class="dot" aria-hidden="true"></span>
            }
            <span class="visually-hidden">Notifications: {{ unreadCount() }} unread</span>
          </button>
        </div>

        <form class="search side-search" role="search" (submit)="runSearch($event)">
          <app-icon name="search" [size]="15" />
          <label class="visually-hidden" for="global-search">Find a person</label>
          <input id="global-search" #searchInput name="q" type="search" placeholder="Find a person"
            [value]="term()" (input)="term.set($any($event.target).value)" />
          <kbd aria-hidden="true">{{ shortcutHint }}</kbd>
        </form>

        <nav aria-label="Main">
          @for (item of navItems(); track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active" ariaCurrentWhenActive="page">
              <app-icon [name]="item.icon" />
              <span>{{ item.label }}</span>
              @if (item.link === '/dashboard' && decisionCount()) {
                <span class="count-pill">{{ decisionCount() }}</span>
              }
            </a>
          }
        </nav>

        <div class="side-foot">
          @if (isDemo) {
            <div class="demo-row">
              <span class="tag">Demo data</span>
              <button class="btn btn-icon" type="button" (click)="resetDemo()" title="Reset demo data">
                <app-icon name="refresh" [size]="15" />
                <span class="visually-hidden">Reset demo data</span>
              </button>
            </div>
          }
          @if (user(); as user) {
            <div class="user">
              <span class="initials" aria-hidden="true">{{ initials() }}</span>
              <span class="who">
                <strong>{{ user.name }}</strong>
                <span>{{ user.role }}</span>
              </span>
              <button class="btn btn-icon" type="button" (click)="signOut()" title="Sign out">
                <app-icon name="log-out" [size]="16" />
                <span class="visually-hidden">Sign out</span>
              </button>
            </div>
          }
        </div>
      </aside>

      <div class="main">
        <main id="main" class="content" tabindex="-1">
          <router-outlet />
        </main>
        <app-footer />
      </div>
    </div>

    @if (notificationsOpen()) {
      <app-notifications-panel (dismiss)="notificationsOpen.set(false)" />
    }
  `,
  styles: `
    .skip-link {
      position: absolute;
      left: var(--acme-space-4);
      top: -3rem;
      z-index: 40;
      padding: var(--acme-space-2) var(--acme-space-3);
      border-radius: var(--acme-radius-sm);
      background: var(--acme-color-primary);
      color: var(--acme-color-on-primary);
    }
    .skip-link:focus { top: var(--acme-space-4); }

    .shell {
      display: grid;
      grid-template-columns: var(--app-sidebar-width) minmax(0, 1fr);
      min-height: 100dvh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      gap: var(--acme-space-6);
      padding: var(--acme-space-5) var(--acme-space-3);
      background: var(--acme-color-surface-raised);
      border-inline-end: 1px solid var(--app-hairline);
    }

    .side-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--acme-space-2);
      padding-inline: var(--acme-space-2);
    }
    .brand { text-decoration: none; }

    .bell { position: relative; }
    .dot {
      position: absolute;
      top: 4px;
      right: 5px;
      width: 8px;
      height: 8px;
      border-radius: var(--acme-radius-full);
      background: var(--acme-color-primary);
      border: 2px solid var(--acme-color-surface-raised);
    }

    .side-search {
      flex: none;
      min-height: 36px;
      border-color: var(--app-hairline);
      background: var(--acme-color-canvas);
      font-size: var(--acme-text-sm);
    }
    .side-search kbd {
      font: 500 11px var(--acme-font-mono);
      color: var(--acme-color-text-subtle);
    }

    nav { display: flex; flex-direction: column; gap: 2px; }

    nav a {
      display: flex;
      align-items: center;
      gap: var(--acme-space-3);
      padding: 9px var(--acme-space-3);
      border-radius: var(--acme-radius-md);
      color: var(--acme-color-text-muted);
      font-size: var(--acme-text-sm);
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
    }
    nav a:hover { background: var(--acme-color-surface); color: var(--acme-color-text); }
    nav a.active {
      background: var(--acme-color-selected-soft);
      color: var(--acme-color-selected);
      font-weight: 600;
    }
    nav a .count-pill { margin-left: auto; }

    .side-foot {
      margin-top: auto;
      display: grid;
      gap: var(--acme-space-3);
    }

    .demo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-inline: var(--acme-space-2);
    }

    .user {
      display: flex;
      align-items: center;
      gap: var(--acme-space-3);
      padding: var(--acme-space-3) var(--acme-space-2) 0;
      border-top: 1px solid var(--app-hairline);
    }
    .initials {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      flex: none;
      border-radius: var(--acme-radius-full);
      background: var(--acme-blue-100);
      color: var(--acme-blue-800);
      font: 600 12px var(--acme-font-sans);
    }
    .who { display: grid; flex: 1; min-width: 0; line-height: 1.25; }
    .who strong { font-size: 13px; }
    .who > span { font-size: 12px; color: var(--acme-color-text-muted); }

    .main { display: flex; flex-direction: column; min-width: 0; }
    .content { flex: 1; }
    .content:focus { outline: none; }

    @media (max-width: 860px) {
      .shell { grid-template-columns: minmax(0, 1fr); }
      .sidebar {
        position: static;
        height: auto;
        gap: var(--acme-space-3);
        padding: var(--acme-space-3) var(--acme-space-4);
        border-inline-end: 0;
        border-bottom: 1px solid var(--app-hairline);
      }
      .side-search { display: none; }
      nav { flex-direction: row; overflow-x: auto; scrollbar-width: none; }
      .side-foot { margin-top: 0; }
      .user { border-top: 0; padding-top: 0; }
    }
  `,
  // Default change detection on purpose: routed pages render inside this
  // outlet, and an OnPush shell would stop them refreshing after plain
  // property updates.
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FooterComponent,
    IconComponent,
    WordmarkComponent,
    NotificationsPanelComponent,
  ],
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly demoBackend = inject(DemoBackend);
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly candidateService = inject(CandidateService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private readonly permissions = inject(PermissionsService);
  private readonly canApprove = this.permissions.can('ApproveTimeOff');
  private readonly canHire = this.permissions.can('ManageHiring');
  private readonly canAssign = this.permissions.can('AssignTraining');

  /** Destinations this role can use; the rest are hidden, not greyed out. */
  navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permission || (item.permission === 'ManageHiring' && this.canHire())),
  );

  user = this.authService.currentUser;
  notificationsOpen = signal(false);
  term = signal('');

  unreadCount = computed(() => this.notificationService.unreadNotifications().length);

  private readonly queueData = toSignal(
    forkJoin({
      employees: this.employeeService.getEmployees(),
      requests: this.timeOffRequestService.getRequests(),
      // Only hiring roles may read candidates.
      candidates: this.canHire() ? this.candidateService.getCandidates() : of([]),
      enrollments: this.enrollmentService.getEnrollments(),
      courses: this.courseService.getCourses(),
    }),
  );

  /**
   * The Home badge counts the same items the Home queue lists, so the sidebar
   * and the page never disagree about how much is waiting.
   */
  decisionCount = computed(() => {
    const data = this.queueData();
    return data
      ? buildDecisionQueue(
          data.requests,
          data.candidates,
          data.employees,
          data.enrollments,
          data.courses,
          {
            canApprove: this.canApprove(),
            canHire: this.canHire(),
            canAssign: this.canAssign(),
            employeeId: this.user()?.employeeId,
          },
        ).length
      : 0;
  });

  initials = computed(() =>
    (this.user()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  readonly isDemo = environment.demo;
  readonly shortcutHint = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl K';

  constructor() {
    this.notificationService.connect();
  }

  runSearch(event: Event) {
    event.preventDefault();
    const q = this.term().trim();
    this.router.navigate(['/employees'], { queryParams: q ? { q } : {} });
  }

  /** The sidebar hint promises Cmd/Ctrl+K, so make it true. */
  onKeydown(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.searchInput()?.nativeElement.focus();
    }
  }

  signOut() {
    this.authService.logout().subscribe(() => this.router.navigate(['/login']));
  }

  resetDemo() {
    if (confirm('Reset all demo data to its original state? Your changes will be lost.')) {
      this.demoBackend.reset();
      localStorage.removeItem('notifications');
      location.reload();
    }
  }
}
