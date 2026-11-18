import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CompensationService } from './compensation.service';

describe('CompensationService', () => {
  let service: CompensationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CompensationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should read salary changes and grants, for everyone visible or one person', () => {
    service.getSalaryChanges().subscribe();
    service.getSalaryChanges(2).subscribe();
    service.getGrants().subscribe();
    service.getGrants(2).subscribe();
    service.getPayBands().subscribe();
    service.getSharePrices().subscribe();
    for (const url of ['/salary-changes', '/salary-changes?employeeId=2', '/stock-grants', '/stock-grants?employeeId=2', '/pay-bands', '/share-prices']) {
      http.expectOne({ method: 'GET', url }).flush([]);
    }
  });

  it('should send changes to the matching endpoints', () => {
    const change = { employeeId: 2, baseSalary: 80_000, currency: 'GBP' as const, effectiveDate: '2026-12-01', reason: 'Promotion' as const };
    service.addSalaryChange(change).subscribe();
    expect(http.expectOne({ method: 'POST', url: '/salary-changes' }).request.body).toEqual(change);

    service.decideSalaryChange(4, 'Rejected').subscribe();
    expect(http.expectOne({ method: 'PATCH', url: '/salary-changes/4' }).request.body).toEqual({ status: 'Rejected' });

    service.deleteSalaryChange(4).subscribe();
    http.expectOne({ method: 'DELETE', url: '/salary-changes/4' }).flush({});

    service.updatePayBand(1, { min: 1, max: 2 }).subscribe();
    expect(http.expectOne({ method: 'PATCH', url: '/pay-bands/1' }).request.body).toEqual({ min: 1, max: 2 });

    service.recordExercise(3, 900).subscribe();
    expect(http.expectOne({ method: 'PATCH', url: '/stock-grants/3' }).request.body).toEqual({ exercisedShares: 900 });

    service.addSharePrice({ effectiveDate: '2026-12-01', pricePerShare: 11 }).subscribe();
    http.expectOne({ method: 'POST', url: '/share-prices' }).flush({});

    service.deleteGrant(3).subscribe();
    http.expectOne({ method: 'DELETE', url: '/stock-grants/3' }).flush({});
  });
});
