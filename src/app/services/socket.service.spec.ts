import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not emit before the interval elapses', fakeAsync(() => {
    const emissions: unknown[] = [];
    const subscription = service.notifications$.subscribe((value) => emissions.push(value));

    tick(2_499);
    expect(emissions.length).toBe(0);

    subscription.unsubscribe();
    tick(1);
  }));

  it('should emit an empty array every 2500ms', fakeAsync(() => {
    const emissions: unknown[] = [];
    const subscription = service.notifications$.subscribe((value) => emissions.push(value));

    tick(2_500);
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toEqual([]);

    tick(2_500);
    expect(emissions.length).toBe(2);
    expect(emissions[1]).toEqual([]);

    subscription.unsubscribe();
  }));
});
