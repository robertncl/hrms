import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { PermissionsService } from 'src/app/services/permissions.service';
import { hasPermissions } from './has-permissions.operator';

describe('hasPermissions', () => {
  it('should let the source value through when hasPermissions resolves to true', () => {
    const mockPermissionsService = {
      hasPermissions: () => of(true),
    };

    const values: string[] = [];
    of('value').pipe(hasPermissions(['ViewEmployees'], mockPermissionsService as unknown as PermissionsService))
      .subscribe((value) => values.push(value));

    expect(values).toEqual(['value']);
  });

  it('should filter out the source value when hasPermissions resolves to false', () => {
    const mockPermissionsService = {
      hasPermissions: () => of(false),
    };

    const values: string[] = [];
    of('value').pipe(hasPermissions(['ViewEmployees'], mockPermissionsService as unknown as PermissionsService))
      .subscribe((value) => values.push(value));

    expect(values).toEqual([]);
  });

  it('should re-evaluate against the latest permissions value when the source emits', () => {
    const permissions$ = new BehaviorSubject(false);
    const mockPermissionsService = {
      hasPermissions: () => permissions$.asObservable(),
    };

    const values: number[] = [];
    const source$ = new BehaviorSubject(1);

    source$.pipe(hasPermissions(['CreateEmployee'], mockPermissionsService as unknown as PermissionsService))
      .subscribe((value) => values.push(value));

    expect(values).toEqual([]);

    permissions$.next(true);
    source$.next(2);

    expect(values).toEqual([2]);
  });

  it('should use the injected PermissionsService when none is provided explicitly', () => {
    const mockPermissionsService = {
      hasPermissions: () => of(true),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: PermissionsService, useValue: mockPermissionsService }],
    });

    const values: string[] = [];
    TestBed.runInInjectionContext(() => {
      of('value').pipe(hasPermissions(['ViewEmployees'])).subscribe((value) => values.push(value));
    });

    expect(values).toEqual(['value']);
  });
});
