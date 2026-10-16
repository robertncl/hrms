import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Notification } from 'src/app/infrastructure/types/notification';
import { NotificationService } from 'src/app/services/notification.service';
import { IconComponent } from './icon.component';

/**
 * Notifications, docked beside the sidebar rather than centred in a modal, so
 * the page it refers to stays visible behind it. Unread items keep the Cobalt
 * dot and wash; read ones drop both.
 */
@Component({
  selector: 'app-notifications-panel',
  template: `
    <button class="scrim" type="button" (click)="dismiss.emit()" tabindex="-1" aria-hidden="true"></button>
    <aside class="panel panel-left" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
      <div class="panel-header">
        <h2 id="notifications-title">Notifications</h2>
        <div class="head-actions">
          @if (unread().length) {
            <button class="btn btn-sm btn-ghost" type="button" (click)="markAllAsRead()">Mark all read</button>
          }
          <button class="btn btn-icon" type="button" (click)="dismiss.emit()">
            <app-icon name="x" />
            <span class="visually-hidden">Close notifications</span>
          </button>
        </div>
      </div>

      <div class="panel-body flush">
        @if (sorted().length) {
          <ul>
            @for (note of sorted(); track note.id) {
              <li [class.unread]="!note.read">
                <span class="dot" aria-hidden="true"></span>
                <div class="note">
                  <strong>{{ note.title }}</strong>
                  <span class="body">{{ note.message }}</span>
                  <div class="foot">
                    <time [attr.datetime]="note.date">{{ note.date | date: 'MMM d, h:mm a' }}</time>
                    @if (!note.read) {
                      <button class="link" type="button" (click)="markAsRead(note)">Mark read</button>
                    }
                  </div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="empty-state">Nothing waiting. You're all caught up.</p>
        }
      </div>
    </aside>
  `,
  styles: `
    .head-actions { display: flex; align-items: center; gap: var(--acme-space-2); }

    ul { list-style: none; margin: 0; padding: 0; }

    li {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr);
      gap: var(--acme-space-3);
      padding: var(--acme-space-3) var(--acme-space-6);
      border-bottom: 1px solid var(--app-hairline);
    }
    li.unread { background: var(--acme-color-selected-soft); }

    .dot {
      width: 8px;
      height: 8px;
      margin-top: 7px;
      border-radius: var(--acme-radius-full);
      background: transparent;
    }
    li.unread .dot { background: var(--acme-color-primary); }

    .note { display: grid; gap: 3px; min-width: 0; }
    .note strong { font-size: var(--acme-text-sm); }
    .note .body { font-size: var(--acme-text-sm); color: var(--acme-color-text-muted); }

    .foot {
      display: flex;
      align-items: center;
      gap: var(--acme-space-3);
      margin-top: var(--acme-space-1);
      font-size: var(--acme-text-xs);
      color: var(--acme-color-text-subtle);
    }

    .link {
      border: 0;
      padding: 0;
      background: none;
      color: var(--acme-color-link);
      font: 600 var(--acme-text-xs) var(--acme-font-sans);
      cursor: pointer;
    }
    .link:hover { text-decoration: underline; }
  `,
  imports: [DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPanelComponent {
  private readonly notificationService = inject(NotificationService);

  dismiss = output<void>();

  unread = this.notificationService.unreadNotifications;

  /** Unread first, newest first within each group. */
  sorted = computed(() =>
    [...this.notificationService.notifications()].sort(
      (a, b) => Number(a.read) - Number(b.read) || b.date.localeCompare(a.date),
    ),
  );

  markAsRead(note: Notification) {
    this.notificationService.markAsRead(note);
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }
}
