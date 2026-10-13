import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { HeaderComponent } from './header.component';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/infrastructure/types/notification';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let notificationsSignal: ReturnType<typeof signal<Notification[]>>;
  let unreadNotificationsSignal: ReturnType<typeof signal<Notification[]>>;
  let mockNotificationService: {
    notifications: ReturnType<typeof signal<Notification[]>>;
    unreadNotifications: ReturnType<typeof signal<Notification[]>>;
    markAsRead: jasmine.Spy;
    markAllAsRead: jasmine.Spy;
    connect: jasmine.Spy;
  };
  let mockAuthService: { currentUser: ReturnType<typeof signal>; logout: jasmine.Spy };
  let navigateSpy: jasmine.Spy;

  const notifications: Notification[] = [
    { id: 1, title: 'Time Off', message: 'Approved', type: 'TimeOff', read: false, date: '2026-01-01' },
    { id: 2, title: 'Birthday', message: 'Happy Birthday', type: 'Birthday', read: true, date: '2026-01-02' },
  ];

  beforeEach(async () => {
    notificationsSignal = signal(notifications);
    unreadNotificationsSignal = signal(notifications.filter(n => !n.read));
    mockNotificationService = {
      notifications: notificationsSignal,
      unreadNotifications: unreadNotificationsSignal,
      markAsRead: jasmine.createSpy('markAsRead'),
      markAllAsRead: jasmine.createSpy('markAllAsRead'),
      connect: jasmine.createSpy('connect'),
    };

    mockAuthService = {
      currentUser: signal({ name: 'Alex Morgan', email: 'admin@hrms.demo', role: 'HR Administrator' }),
      logout: jasmine.createSpy('logout').and.returnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should connect to the notification service on construction', () => {
    expect(mockNotificationService.connect).toHaveBeenCalled();
  });

  it('should render the count of unread notifications', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    expect(button.textContent).toContain('1');
  });

  it('should not have the notifications dialog open by default', () => {
    const dialog: HTMLElement = fixture.debugElement.query(By.css('dialog')).nativeElement;
    expect(dialog.hasAttribute('open')).toBeFalse();
  });

  it('should open the notifications dialog when the header button is clicked', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    button.click();
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.debugElement.query(By.css('dialog')).nativeElement;
    expect(dialog.hasAttribute('open')).toBeTrue();
  });

  it('should list all notifications with their title and message', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    button.click();
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items.length).toBe(2);
    expect(items[0].query(By.css('h4')).nativeElement.textContent).toContain('Time Off');
    expect(items[0].query(By.css('span')).nativeElement.textContent).toContain('Approved');
  });

  it('should only show the "Mark as Read" button for unread notifications', () => {
    const button: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    button.click();
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('li'));
    expect(items[0].queryAll(By.css('button')).length).toBe(1);
    expect(items[1].queryAll(By.css('button')).length).toBe(0);
  });

  it('should call markNotificationAsRead with the notification when "Mark as Read" is clicked', () => {
    const headerButton: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    headerButton.click();
    fixture.detectChanges();

    const markAsReadButton: HTMLButtonElement = fixture.debugElement.query(By.css('li button')).nativeElement;
    markAsReadButton.click();
    fixture.detectChanges();

    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(notifications[0]);
  });

  it('should close the dialog when the Close button is clicked', () => {
    const headerButton: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    headerButton.click();
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('dialog button'));
    const closeButton: HTMLButtonElement = buttons[buttons.length - 1].nativeElement;
    expect(closeButton.textContent).toContain('Close');
    closeButton.click();
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.debugElement.query(By.css('dialog')).nativeElement;
    expect(dialog.hasAttribute('open')).toBeFalse();
  });

  it('should show the signed-in user', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alex Morgan');
    expect(text).toContain('HR Administrator');
  });

  it('should mark every notification as read', () => {
    const headerButton: HTMLButtonElement = fixture.debugElement.query(By.css('header button')).nativeElement;
    headerButton.click();
    fixture.detectChanges();

    const markAll = fixture.debugElement.queryAll(By.css('dialog button'))
      .find((b) => b.nativeElement.textContent.includes('Mark all as read'))!;
    markAll.nativeElement.click();

    expect(mockNotificationService.markAllAsRead).toHaveBeenCalled();
  });

  it('should list unread notifications before read ones', () => {
    notificationsSignal.set([...notifications].reverse());
    fixture.detectChanges();

    const titles = fixture.debugElement.queryAll(By.css('li h4')).map((h) => h.nativeElement.textContent);
    expect(titles).toEqual(['Time Off', 'Birthday']);
  });

  it('should sign out and return to the login page', () => {
    const signOut = fixture.debugElement.queryAll(By.css('header button'))
      .find((b) => b.nativeElement.textContent.includes('Sign out'))!;
    signOut.nativeElement.click();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
