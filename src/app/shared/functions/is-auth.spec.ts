import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { isAuth } from './is-auth';

describe('isAuth', () => {
  let isAuth$: BehaviorSubject<boolean>;

  beforeEach(() => {
    isAuth$ = new BehaviorSubject(false);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isAuth$ },
        },
      ],
    });
  });

  it('should emit the current authentication state', (done) => {
    TestBed.runInInjectionContext(() => {
      isAuth().subscribe((value) => {
        expect(value).toBeFalse();
        done();
      });
    });
  });

  it('should emit updated values when the underlying subject changes', () => {
    const values: boolean[] = [];

    TestBed.runInInjectionContext(() => {
      isAuth().subscribe((value) => values.push(value));
    });

    isAuth$.next(true);

    expect(values).toEqual([false, true]);
  });

  it('should return an Observable, not the subject itself', () => {
    let result: unknown;

    TestBed.runInInjectionContext(() => {
      result = isAuth();
    });

    expect(result).not.toBe(isAuth$);
    expect((result as { next?: unknown }).next).toBeUndefined();
  });
});
