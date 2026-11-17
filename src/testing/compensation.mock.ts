import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { PayBand, SalaryChange, SharePrice, StockGrant } from 'src/app/infrastructure/types/compensation';
import { User } from 'src/app/infrastructure/types/user';
import { AuthService } from 'src/app/services/auth.service';
import { CompensationService } from 'src/app/services/compensation.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { addMonths, toIsoDate } from 'src/app/shared/functions/dates';

const today = toIsoDate(new Date());
/** `months` from today, so vesting comes out the same whenever the tests run. */
export const monthsFromToday = (months: number) => addMonths(today, months);

const person = (id: number, firstName: string, extra: Partial<Employee>): Employee => ({
  id, firstName, lastName: 'Test', email: '', position: 'Developer', level: 'Senior', isAvailable: true, profilePicture: '',
  ...extra,
});

/** Olivia (1) leads Liam (2) in London; Noah (3) is on another team, in Berlin. */
export const payPeople: Employee[] = [
  person(1, 'Olivia', { position: 'Manager', level: 'Lead', location: 'London', department: 'Engineering', jobTitle: 'Head of Engineering' }),
  person(2, 'Liam', { location: 'London', managerId: 1, department: 'Engineering', jobTitle: 'Senior Software Engineer' }),
  person(3, 'Noah', { level: 'Middle', location: 'Berlin', department: 'Design', jobTitle: 'Software Engineer' }),
];

export const payBands: PayBand[] = [
  { id: 1, position: 'Manager', level: 'Lead', currency: 'GBP', min: 105_000, max: 140_000 },
  { id: 2, position: 'Developer', level: 'Senior', currency: 'GBP', min: 70_000, max: 90_000 },
  { id: 3, position: 'Developer', level: 'Middle', currency: 'EUR', min: 55_000, max: 75_000 },
];

const change = (id: number, employeeId: number, months: number, baseSalary: number, extra: Partial<SalaryChange> = {}): SalaryChange => ({
  id, employeeId, effectiveDate: monthsFromToday(months), baseSalary, currency: 'GBP', reason: 'Merit increase', status: 'Approved', ...extra,
});

export function paySalaryChanges(): SalaryChange[] {
  return [
    change(1, 1, -36, 120_000, { reason: 'New hire' }),
    change(2, 2, -24, 70_000, { reason: 'New hire' }),
    change(3, 2, -6, 75_000),
    change(4, 2, 1, 80_000, { status: 'Pending', reason: 'Market adjustment', proposedBy: 'Olivia Bennett', note: 'Competing offer.' }),
    // Noah is paid below his band.
    change(5, 3, -12, 50_000, { currency: 'EUR', reason: 'New hire' }),
  ];
}

export function payGrants(): StockGrant[] {
  return [
    {
      id: 1, employeeId: 2, kind: 'Stock options', grantDate: monthsFromToday(-24), shares: 4_800, strikePrice: 2,
      vestingStart: monthsFromToday(-24), vestingMonths: 48, cliffMonths: 12, expirationDate: monthsFromToday(96), exercisedShares: 400,
    },
    {
      id: 2, employeeId: 3, kind: 'RSUs', grantDate: monthsFromToday(-2), shares: 1_200,
      vestingStart: monthsFromToday(-2), vestingMonths: 12, cliffMonths: 12, exercisedShares: 0,
    },
  ];
}

export const payPrices: SharePrice[] = [
  { id: 1, effectiveDate: monthsFromToday(-30), pricePerShare: 2, note: 'Seed round' },
  { id: 2, effectiveDate: monthsFromToday(-3), pricePerShare: 10, note: 'Series B' },
];

export function createCompensationMocks() {
  const changes = paySalaryChanges();
  const grants = payGrants();
  return {
    changes,
    grants,
    service: {
      getSalaryChanges: jasmine.createSpy('getSalaryChanges').and.callFake((employeeId?: number) =>
        of(employeeId === undefined ? changes : changes.filter((c) => c.employeeId === employeeId))),
      addSalaryChange: jasmine.createSpy('addSalaryChange').and.returnValue(of({})),
      decideSalaryChange: jasmine.createSpy('decideSalaryChange').and.returnValue(of({})),
      deleteSalaryChange: jasmine.createSpy('deleteSalaryChange').and.returnValue(of({})),
      getPayBands: jasmine.createSpy('getPayBands').and.returnValue(of(payBands)),
      updatePayBand: jasmine.createSpy('updatePayBand').and.returnValue(of({})),
      getGrants: jasmine.createSpy('getGrants').and.callFake((employeeId?: number) =>
        of(employeeId === undefined ? grants : grants.filter((g) => g.employeeId === employeeId))),
      addGrant: jasmine.createSpy('addGrant').and.returnValue(of({})),
      recordExercise: jasmine.createSpy('recordExercise').and.returnValue(of({})),
      deleteGrant: jasmine.createSpy('deleteGrant').and.returnValue(of({})),
      getSharePrices: jasmine.createSpy('getSharePrices').and.returnValue(of(payPrices)),
      addSharePrice: jasmine.createSpy('addSharePrice').and.returnValue(of({})),
    },
    currentUser: signal<User | null>(null),
  };
}

export type CompensationMocks = ReturnType<typeof createCompensationMocks>;

export function provideCompensationTesting(mocks: CompensationMocks): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter([]),
    { provide: CompensationService, useValue: mocks.service },
    { provide: EmployeeService, useValue: { getEmployees: () => of(payPeople) } },
    { provide: AuthService, useValue: { currentUser: mocks.currentUser } },
  ];
}
