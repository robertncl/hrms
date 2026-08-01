import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { NotificationService } from './notification.service';
import { SocketService } from './socket.service';
import { Notification } from '../infrastructure/types/notification';

describe('NotificationService', () => {
  let service: NotificationService;
  let notifications$: Subject<Notification[]>;

  const mockNotification: Notification = {
    id: 1,
    title: 'New request',
    message: 'A new time off request was submitted',
    type: 'TimeOff',
    read: false,
    date: '2026-01-01',
  };

  beforeEach(() => {
    localStorage.clear();
    notifications$ = new Subject<Notification[]>();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SocketService,
          useValue: { notifications$ },
        },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty notifications list when localStorage is empty', () => {
    expect(service.notifications()).toEqual([]);
  });

  it('should restore notifications from localStorage on construction', () => {
    localStorage.setItem('notifications', JSON.stringify([mockNotification]));

    const restoredService = TestBed.runInInjectionContext(() => new NotificationService());

    expect(restoredService.notifications()).toEqual([mockNotification]);
  });

  it('should add a notification', () => {
    service.addNotification(mockNotification);

    expect(service.notifications()).toEqual([mockNotification]);
  });

  it('should mark a single notification as read', () => {
    service.addNotification(mockNotification);
    service.addNotification({ ...mockNotification, id: 2 });

    service.markAsRead(mockNotification);

    expect(service.notifications()).toEqual([
      { ...mockNotification, read: true },
      { ...mockNotification, id: 2, read: false },
    ]);
  });

  it('should mark all notifications as read', () => {
    service.addNotification(mockNotification);
    service.addNotification({ ...mockNotification, id: 2 });

    service.markAllAsRead();

    expect(service.notifications().every((n) => n.read)).toBe(true);
  });

  it('should compute readNotifications and unreadNotifications', () => {
    service.addNotification({ ...mockNotification, id: 1, read: true });
    service.addNotification({ ...mockNotification, id: 2, read: false });

    expect(service.readNotifications()).toEqual([{ ...mockNotification, id: 1, read: true }]);
    expect(service.unreadNotifications()).toEqual([{ ...mockNotification, id: 2, read: false }]);
  });

  it('should replace notifications when the socket emits', () => {
    TestBed.runInInjectionContext(() => service.connect());

    notifications$.next([mockNotification]);

    expect(service.notifications()).toEqual([mockNotification]);
  });

  it('should persist notifications to localStorage via the effect', () => {
    service.addNotification(mockNotification);

    TestBed.tick();

    expect(JSON.parse(localStorage.getItem('notifications') ?? '[]')).toEqual([mockNotification]);
  });
});
