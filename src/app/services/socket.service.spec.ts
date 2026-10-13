import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Notification } from '../infrastructure/types/notification';
import { SocketService } from './socket.service';
import { demoNotificationBacklog } from '../demo/demo-notifications';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit the demo backlog as soon as it is subscribed', fakeAsync(() => {
    const emissions: Notification[][] = [];
    const subscription = service.notifications$.subscribe((value) => emissions.push(value));

    expect(emissions.length).toBe(1);
    expect(emissions[0].map((n) => n.id)).toEqual(demoNotificationBacklog().map((n) => n.id));

    subscription.unsubscribe();
  }));

  it('should push one new unread notification every minute', fakeAsync(() => {
    const emissions: Notification[][] = [];
    const subscription = service.notifications$.subscribe((value) => emissions.push(value));

    tick(59_999);
    expect(emissions.length).toBe(1);

    tick(1);
    expect(emissions.length).toBe(2);
    expect(emissions[1].length).toBe(1);
    expect(emissions[1][0].read).toBeFalse();

    subscription.unsubscribe();
  }));
});
