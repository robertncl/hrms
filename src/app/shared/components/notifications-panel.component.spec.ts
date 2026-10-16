import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { NotificationsPanelComponent } from './notifications-panel.component';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/infrastructure/types/notification';

describe('NotificationsPanelComponent', () => {
  let component: NotificationsPanelComponent;
  let fixture: ComponentFixture<NotificationsPanelComponent>;
  let notificationsSignal: ReturnType<typeof signal<Notification[]>>;
  let unreadSignal: ReturnType<typeof signal<Notification[]>>;
  let mockNotificationService: {
    notifications: ReturnType<typeof signal<Notification[]>>;
    unreadNotifications: ReturnType<typeof signal<Notification[]>>;
    markAsRead: jasmine.Spy;
    markAllAsRead: jasmine.Spy;
  };

  const notifications: Notification[] = [
    { id: 1, title: 'Time Off', message: 'Approved', type: 'TimeOff', read: false, date: '2026-01-01' },
    { id: 2, title: 'Birthday', message: 'Happy Birthday', type: 'Birthday', read: true, date: '2026-01-02' },
  ];

  beforeEach(async () => {
    notificationsSignal = signal(notifications);
    unreadSignal = signal(notifications.filter((n) => !n.read));
    mockNotificationService = {
      notifications: notificationsSignal,
      unreadNotifications: unreadSignal,
      markAsRead: jasmine.createSpy('markAsRead'),
      markAllAsRead: jasmine.createSpy('markAllAsRead'),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationsPanelComponent],
      providers: [{ provide: NotificationService, useValue: mockNotificationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list every notification with its title and message', () => {
    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items.length).toBe(2);
    expect(items[0].query(By.css('strong')).nativeElement.textContent).toContain('Time Off');
    expect(items[0].query(By.css('.body')).nativeElement.textContent).toContain('Approved');
  });

  it('should mark unread items with the unread class and read ones without', () => {
    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items[0].nativeElement.classList).toContain('unread');
    expect(items[1].nativeElement.classList).not.toContain('unread');
  });

  it('should only offer "Mark read" on unread notifications', () => {
    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items[0].queryAll(By.css('button')).length).toBe(1);
    expect(items[1].queryAll(By.css('button')).length).toBe(0);
  });

  it('should mark a single notification as read', () => {
    fixture.debugElement.query(By.css('li button')).nativeElement.click();
    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(notifications[0]);
  });

  it('should mark every notification as read', () => {
    const markAll = fixture.debugElement
      .queryAll(By.css('.panel-header button'))
      .find((b) => b.nativeElement.textContent.includes('Mark all read'))!;
    markAll.nativeElement.click();
    expect(mockNotificationService.markAllAsRead).toHaveBeenCalled();
  });

  it('should hide "Mark all read" once nothing is unread', () => {
    unreadSignal.set([]);
    fixture.detectChanges();

    const markAll = fixture.debugElement
      .queryAll(By.css('.panel-header button'))
      .find((b) => b.nativeElement.textContent.includes('Mark all read'));
    expect(markAll).toBeUndefined();
  });

  it('should list unread notifications before read ones', () => {
    notificationsSignal.set([...notifications].reverse());
    fixture.detectChanges();

    const titles = fixture.debugElement
      .queryAll(By.css('li strong'))
      .map((h) => h.nativeElement.textContent.trim());
    expect(titles).toEqual(['Time Off', 'Birthday']);
  });

  it('should emit dismiss from the close button and the scrim', () => {
    const emitted: unknown[] = [];
    component.dismiss.subscribe(() => emitted.push(true));

    fixture.debugElement
      .queryAll(By.css('.panel-header button'))
      .at(-1)!.nativeElement.click();
    fixture.debugElement.query(By.css('.scrim')).nativeElement.click();

    expect(emitted.length).toBe(2);
  });

  it('should show an empty state when there is nothing to show', () => {
    notificationsSignal.set([]);
    unreadSignal.set([]);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.empty-state')).nativeElement.textContent)
      .toContain('caught up');
  });
});
