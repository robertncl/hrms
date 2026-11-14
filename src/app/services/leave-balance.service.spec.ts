import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LeaveBalanceService } from './leave-balance.service';

describe('LeaveBalanceService', () => {
  let service: LeaveBalanceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveBalanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("should fetch one person's balances", () => {
    service.getBalances(15).subscribe();
    const req = httpMock.expectOne('/leave-balances?employeeId=15');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should fetch every balance the viewer may see', () => {
    service.getVisibleBalances().subscribe();
    httpMock.expectOne('/leave-balances').flush([]);
  });
});
