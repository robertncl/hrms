import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild, afterNextRender } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Notification } from 'src/app/infrastructure/types/notification';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/app/services/auth.service';
import { DemoBackend } from 'src/app/demo/demo-backend';
import { environment } from 'src/environments/environment';
import { AvatarComponent } from './avatar.component';
import { IconComponent } from './icon.component';
import { enableLightDismissFallback } from '../functions/light-dismiss';

@Component({
  selector: 'app-header',
  template: `
    <header>
      @if (isDemo) {
        <span class="demo-pill" title="Changes are stored in this browser only">Demo data</span>
      }
      <div class="spacer"></div>
      <button class="btn btn-ghost btn-icon notifications" (click)="openNotifications()" title="View Notifications">
        <app-icon name="bell" />
        @if (unreadNotifications().length) {
          <span class="count" aria-hidden="true">{{ unreadNotifications().length }}</span>
        }
        <span class="visually-hidden">You have {{ unreadNotifications().length }} unread notifications</span>
      </button>
      @if (user(); as user) {
        <div class="user">
          <app-avatar [name]="user.name" size="2rem" />
          <div class="user-text">
            <strong>{{ user.name }}</strong>
            <span class="muted small">{{ user.role }}</span>
          </div>
        </div>
      }
      @if (isDemo) {
        <button class="btn btn-ghost btn-icon" (click)="resetDemo()" title="Reset demo data">
          <app-icon name="refresh" />
          <span class="visually-hidden">Reset demo data</span>
        </button>
      }
      <button class="btn btn-ghost btn-icon" (click)="logout()" title="Sign out">
        <app-icon name="log-out" />
        <span class="visually-hidden">Sign out</span>
      </button>
    </header>
    <dialog #dialog closedby="any" aria-labelledby="notifications-title" (close)="notificationsOpen.set(false)">
      <div class="dialog-header">
        <h2 id="notifications-title">Notifications</h2>
        @if (unreadNotifications().length) {
          <button class="btn btn-sm btn-ghost" (click)="markAllAsRead()">Mark all as read</button>
        }
      </div>
      @if (sortedNotifications().length) {
        <ul>
          @for (notification of sortedNotifications(); track notification.id) {
            <li [class.unread]="!notification.read">
              <div>
                <h4>{{ notification.title }}</h4>
                <span>{{ notification.message }}</span>
                <time class="muted small" [attr.datetime]="notification.date">{{ notification.date | date: 'MMM d, h:mm a' }}</time>
              </div>
              @if (!notification.read) {
                <button class="btn btn-sm" (click)="markNotificationAsRead(notification)">
                  Mark as Read
                </button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="empty-state">You're all caught up.</p>
      }
      <div class="dialog-actions">
        <button class="btn" (click)="closeNotifications()">Close</button>
      </div>
    </dialog>
  `,
  styles: `
    header {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 3.75rem;
      padding: 0.5rem 1.5rem;
      background: color-mix(in srgb, var(--page) 88%, transparent);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
    }
    .spacer { flex: 1; }
    .demo-pill {
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      background: var(--brand-soft);
      color: var(--link);
      font-size: 0.8rem;
      font-weight: 600;
    }
    .notifications { position: relative; }
    .count {
      position: absolute;
      top: 0.1rem;
      right: 0.1rem;
      min-width: 1.1rem;
      height: 1.1rem;
      padding: 0 0.25rem;
      border-radius: 999px;
      background: var(--critical);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 700;
      line-height: 1.1rem;
    }
    .user {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      margin-inline: 0.5rem;
    }
    .user-text {
      display: grid;
      line-height: 1.2;
      font-size: 0.9rem;
    }
    .dialog-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }
    li {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    li.unread { background: var(--brand-soft); }
    li h4 { font-size: 0.95rem; }
    li span, li time { display: block; }
    @media (max-width: 600px) {
      header { padding-inline: 1rem; }
      .user-text { display: none; }
    }
  `,
  imports: [AvatarComponent, IconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly demoBackend = inject(DemoBackend);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly isDemo = environment.demo;
  notifications = this.notificationService.notifications;
  unreadNotifications = this.notificationService.unreadNotifications;
  // Unread first, newest first within each group.
  sortedNotifications = computed(() =>
    [...this.notifications()].sort(
      (a, b) => Number(a.read) - Number(b.read) || b.date.localeCompare(a.date),
    ),
  );
  user = this.authService.currentUser;
  notificationsOpen = signal(false);

  constructor() {
    this.notificationService.connect();
    afterNextRender(() => enableLightDismissFallback(this.dialog().nativeElement));
  }

  openNotifications() {
    this.dialog().nativeElement.showModal();
    this.notificationsOpen.set(true);
  }

  closeNotifications() {
    this.dialog().nativeElement.close();
    this.notificationsOpen.set(false);
  }

  markNotificationAsRead(notification: Notification) {
    this.notificationService.markAsRead(notification);
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  logout() {
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
