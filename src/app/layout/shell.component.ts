import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { environment } from 'src/environments/environment';
import { DemoBackend } from '../demo/demo-backend';
import { filter, forkJoin, map, of } from 'rxjs';
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
import { IconComponent } from '../shared/components/icon.component';
import { NotificationsPanelComponent } from '../shared/components/notifications-panel.component';
import { WordmarkComponent } from '../shared/components/wordmark.component';

type NavItem = {
  label: string;
  link: string;
  /** URL prefixes that count as this destination (People also owns Projects). */
  match: string[];
  permission?: Permissions;
};

/**
 * The ACME app bar holds at most five destinations, so Projects lives under
 * People (a tab on both pages) rather than in the bar.
 */
const NAV_ITEMS: NavItem[] = [
  { label: 'Home', link: '/dashboard', match: ['/dashboard'] },
  { label: 'People', link: '/employees', match: ['/employees', '/work/projects'] },
  { label: 'Time off', link: '/work/time-off', match: ['/work/time-off'] },
  { label: 'Hiring', link: '/recruitment', match: ['/recruitment'], permission: 'ManageHiring' },
  { label: 'Learning', link: '/learning', match: ['/learning'] },
];

/**
 * Layout for signed-in pages: the ACME top bar (wordmark, up to five
 * destinations, then search, notifications and the signed-in user pushed
 * right), the page in a centred 1200px container, and the footer.
 *
 * The bar is full-width, opaque and sits at zero elevation, separated from
 * the page only by its bottom hairline. The current destination is ink text
 * on a surface-hover fill (the .acme-topbar__link[aria-current] rule).
 */
@Component({
  selector: 'app-shell',
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="acme-topbar topbar">
      <a routerLink="/dashboard" class="brand" aria-label="ACME People home"><app-wordmark /></a>

      <nav class="acme-topbar__nav" aria-label="Main">
        @for (item of navItems(); track item.link) {
          <a class="acme-topbar__link" [routerLink]="item.link" [attr.aria-current]="isCurrent(item) ? 'page' : null">
            {{ item.label }}
            @if (item.link === '/dashboard' && decisionCount()) {
              <span class="count-pill" aria-hidden="true">{{ decisionCount() }}</span>
              <span class="visually-hidden">, {{ decisionCount() }} waiting on you</span>
            }
          </a>
        }
      </nav>

      <div class="acme-topbar__actions">
        <form class="search top-search" role="search" (submit)="runSearch($event)">
          <app-icon name="search" [size]="15" />
          <label class="visually-hidden" for="global-search">Find a person</label>
          <input id="global-search" #searchInput name="q" type="search" placeholder="Find a person"
            [value]="term()" (input)="term.set($any($event.target).value)" />
          <kbd aria-hidden="true">{{ shortcutHint }}</kbd>
        </form>

        @if (isDemo) {
          <button class="btn btn-icon" type="button" (click)="resetDemo()" title="Reset demo data">
            <app-icon name="refresh" [size]="16" />
            <span class="visually-hidden">Reset demo data</span>
          </button>
        }

        <button class="btn btn-icon bell" type="button" (click)="notificationsOpen.set(true)">
          <app-icon name="bell" [size]="18" />
          @if (unreadCount()) {
            <span class="dot" aria-hidden="true"></span>
          }
          <span class="visually-hidden">Notifications: {{ unreadCount() }} unread</span>
        </button>

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
    </header>

    <div class="main">
      <main id="main" class="content" tabindex="-1">
        <router-outlet />
      </main>
      <app-footer />
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
      border-radius: var(--acme-radius-md);
      background: var(--acme-color-primary);
      color: var(--acme-color-on-primary);
    }
    .skip-link:focus { top: var(--acme-space-2); }

    /* Sticky but still opaque and at zero elevation: only the hairline. */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      min-block-size: var(--app-topbar-h);
    }

    .brand { display: inline-flex; text-decoration: none; }

    .acme-topbar__link {
      display: inline-flex;
      align-items: center;
      gap: var(--acme-space-2);
      white-space: nowrap;
    }

    .top-search {
      flex: 0 1 15rem;
      min-height: 2.25rem;
    }
    .top-search kbd {
      font: 500 11px var(--acme-font-mono);
      color: var(--acme-color-text-subtle);
    }

    .bell { position: relative; }
    .dot {
      position: absolute;
      top: 5px;
      right: 6px;
      width: 8px;
      height: 8px;
      border-radius: var(--acme-radius-full);
      background: var(--acme-color-info);
      border: 2px solid var(--acme-color-canvas);
    }

    .user {
      display: flex;
      align-items: center;
      gap: var(--acme-space-2);
      padding-inline-start: var(--acme-space-3);
      margin-inline-start: var(--acme-space-1);
      border-inline-start: 1px solid var(--acme-color-border);
    }
    .initials {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      flex: none;
      border-radius: var(--acme-radius-full);
      background: var(--acme-color-surface-hover);
      color: var(--acme-gray-700);
      font: 600 12px var(--acme-font-sans);
    }
    .who { display: grid; min-width: 0; line-height: 1.25; }
    .who strong { font-size: 13px; font-weight: 600; white-space: nowrap; }
    .who > span { font-size: 12px; color: var(--acme-color-text-muted); white-space: nowrap; }

    .main { display: flex; flex-direction: column; min-height: calc(100dvh - var(--app-topbar-h)); }
    .content { flex: 1; }
    .content:focus { outline: none; }

    @media (max-width: 1180px) {
      .who { display: none; }
    }

    /* Narrow screens: the destinations drop to their own scrolling row and
       the search moves to the People page's own filter. */
    @media (max-width: 860px) {
      .topbar { flex-wrap: wrap; row-gap: 0; padding-block-end: 0; }
      .acme-topbar__nav {
        order: 3;
        flex: 1 0 100%;
        margin-inline: calc(-1 * var(--acme-space-5));
        padding: var(--acme-space-1) var(--acme-space-5) var(--acme-space-2);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .top-search { display: none; }
    }
  `,
  // Default change detection on purpose: routed pages render inside this
  // outlet, and an OnPush shell would stop them refreshing after plain
  // property updates.
  imports: [
    RouterOutlet,
    RouterLink,
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
  private readonly orgWide = this.permissions.can('OrgWideAccess');

  /** Destinations this role can use; the rest are hidden, not greyed out. */
  navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permission || (item.permission === 'ManageHiring' && this.canHire())),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
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
   * The Home count shows the same items the Home queue lists, so the app bar
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
            orgWide: this.orgWide(),
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

  isCurrent(item: NavItem): boolean {
    const path = this.url().split(/[?#]/)[0];
    return item.match.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  runSearch(event: Event) {
    event.preventDefault();
    const q = this.term().trim();
    this.router.navigate(['/employees'], { queryParams: q ? { q } : {} });
  }

  /** The search hint promises Cmd/Ctrl+K, so make it true. */
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
