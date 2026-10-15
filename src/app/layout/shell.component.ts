import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../shared/components/header.component';
import { FooterComponent } from '../shared/components/footer.component';
import { IconComponent, IconName } from '../shared/components/icon.component';

type NavItem = { label: string; link: string; icon: IconName };

/** Layout for signed-in pages: sidebar navigation, header and footer. */
@Component({
  selector: 'app-shell',
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard">
          <span class="brand-mark" aria-hidden="true">H</span>
          <span>HRMS</span>
        </a>
        <nav aria-label="Main">
          @for (item of navItems; track item.link) {
            <a [routerLink]="item.link" routerLinkActive="active" ariaCurrentWhenActive="page" [title]="item.label">
              <app-icon [name]="item.icon" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>
      <div class="main">
        <app-header />
        <main id="main" class="content" tabindex="-1">
          <router-outlet />
        </main>
        <app-footer />
      </div>
    </div>
  `,
  styles: `
    .skip-link {
      position: absolute;
      left: 1rem;
      top: -3rem;
      z-index: 10;
      padding: 0.5rem 0.75rem;
      border-radius: var(--radius-sm);
      background: var(--brand);
      color: var(--brand-text);
    }
    .skip-link:focus { top: 1rem; }

    .shell {
      display: grid;
      grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
      min-height: 100dvh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.25rem 0.85rem;
      background: var(--surface);
      border-inline-end: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0 0.5rem;
      color: var(--text);
      font-size: 1.15rem;
      font-weight: 700;
      text-decoration: none;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
      background: var(--brand);
      color: var(--brand-text);
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    nav a {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.55rem 0.65rem;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-weight: 550;
      text-decoration: none;
      white-space: nowrap;
    }

    nav a:hover { background: var(--surface-hover); color: var(--text); }

    nav a.active {
      background: var(--brand-soft);
      color: var(--link);
    }

    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .content {
      flex: 1;
      width: 100%;
      max-width: 1240px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .content:focus { outline: none; }

    @media (max-width: 860px) {
      .shell { grid-template-columns: minmax(0, 1fr); }

      .sidebar {
        position: static;
        height: auto;
        flex-direction: row;
        align-items: center;
        gap: 1rem;
        padding: 0.6rem 1rem;
        border-inline-end: 0;
        border-bottom: 1px solid var(--border);
      }

      .brand span:last-child { display: none; }

      nav {
        flex-direction: row;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .content { padding: 1rem; }
    }

    @media (max-width: 520px) {
      .sidebar { justify-content: space-between; }
      nav a { padding: 0.55rem; }
      nav a span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
  `,
  // Default change detection on purpose: routed pages render inside this
  // outlet, and an OnPush shell would stop them refreshing after plain
  // property updates.
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HeaderComponent, FooterComponent, IconComponent],
})
export class ShellComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'home' },
    { label: 'Employees', link: '/employees', icon: 'users' },
    { label: 'Projects', link: '/work/projects', icon: 'briefcase' },
    { label: 'Time off', link: '/work/time-off', icon: 'calendar' },
    { label: 'Recruitment', link: '/recruitment', icon: 'user-plus' },
    { label: 'Learning', link: '/learning', icon: 'book' },
  ];
}
