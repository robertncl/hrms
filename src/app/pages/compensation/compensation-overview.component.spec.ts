import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { DemoRole } from 'src/app/demo/demo-data';
import { grantRole } from 'src/testing/roles';
import { CompensationMocks, createCompensationMocks, provideCompensationTesting } from 'src/testing/compensation.mock';
import { CompensationOverviewComponent } from './compensation-overview.component';

describe('CompensationOverviewComponent', () => {
  let fixture: ComponentFixture<CompensationOverviewComponent>;
  let component: CompensationOverviewComponent;
  let mocks: CompensationMocks;

  beforeEach(() => {
    mocks = createCompensationMocks();
    TestBed.configureTestingModule({ providers: provideCompensationTesting(mocks) });
  });

  const render = async (role: DemoRole = 'HR Administrator', employeeId?: number, tab = '') => {
    grantRole(role);
    mocks.currentUser.set({ name: 'Viewer', email: '', role, ...(employeeId ? { employeeId } : {}) });
    fixture = TestBed.createComponent(CompensationOverviewComponent);
    component = fixture.componentInstance;
    if (tab) fixture.componentRef.setInput('tab', tab);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const texts = (selector: string) =>
    Array.from(el().querySelectorAll(selector)).map((node) =>
      // Child elements read as separate words.
      Array.from(node.childNodes).map((child) => child.textContent).join(' ').replace(/\s+/g, ' ').trim());
  const names = () => texts('tbody tr .person a');
  const button = (root: Element, label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim().startsWith(label)) as HTMLButtonElement;

  describe('for HR', () => {
    beforeEach(() => render());

    it('should sum pay per currency and compare it with the bands', () => {
      expect(texts('.stat')).toEqual([
        'Yearly base pay £195k · €50k 3 people',
        'Median compa-ratio 0.94 1.00 is the band midpoint',
        'Below their band 1 0 above',
        'Vested equity $16k $31.2k still to vest',
      ]);
    });

    it('should list everyone with their salary, band standing and equity', () => {
      expect(names()).toEqual(['Liam Test', 'Noah Test', 'Olivia Test']);
      const [liam, noah] = Array.from(el().querySelectorAll('tbody tr')) as HTMLElement[];
      const cell = (row: HTMLElement, label: string) => row.querySelector(`[data-label="${label}"]`)!.textContent!.replace(/\s+/g, ' ').trim();
      expect(cell(liam, 'Base salary')).toBe('£75,000');
      expect(cell(liam, 'Compa-ratio')).toBe('0.94 In band');
      expect(cell(liam, 'Last change')).toContain('+7.1%');
      expect(cell(liam, 'Equity vested')).toBe('$16,000 2,000 shares');
      expect(cell(noah, 'Base salary')).toBe('€50,000');
      expect(cell(noah, 'Compa-ratio')).toBe('0.77 Below band');
      expect(cell(noah, 'Equity vested')).toBe('Not vested yet');
    });

    it('should filter by band standing, department and name', () => {
      component.standing.set('below');
      fixture.detectChanges();
      expect(names()).toEqual(['Noah Test']);

      component.standing.set('');
      component.department.set('Engineering');
      fixture.detectChanges();
      expect(names()).toEqual(['Liam Test', 'Olivia Test']);

      component.search.set('head of');
      fixture.detectChanges();
      expect(names()).toEqual(['Olivia Test']);
    });

    it('should let HR decide a proposal, then reload', () => {
      const row = el().querySelector('.proposal')!;
      expect(row.textContent).toContain('£75,000 → £80,000 (+6.7%)');
      expect(row.textContent).toContain('Proposed by Olivia Bennett: “Competing offer.”');
      mocks.service.getSalaryChanges.calls.reset();

      button(row, 'Approve').click();
      fixture.detectChanges();

      expect(mocks.service.decideSalaryChange).toHaveBeenCalledWith(4, 'Approved');
      expect(mocks.service.getSalaryChanges).toHaveBeenCalled();
      expect(el().querySelector('.alert-info')!.textContent).toContain('Approved the change.');
    });

    it("should show the API's reason when a decision is refused", () => {
      mocks.service.decideSalaryChange.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 403, error: { message: "Your role can't change pay or equity." },
      })));
      button(el().querySelector('.proposal')!, 'Decline').click();
      fixture.detectChanges();
      expect(el().querySelector('.alert-error')!.textContent).toContain("Your role can't change pay or equity.");
    });
  });

  describe('for a lead', () => {
    beforeEach(() => render('Team Lead', 1));

    it("should show only their reports' pay", () => {
      expect(el().textContent).toContain('Pay and equity for the people who report to you.');
      expect(names()).toEqual(['Liam Test']);
      expect(texts('.stat')[0]).toBe('Yearly base pay £75k 1 person');
    });

    it('should let them withdraw a proposal, but not decide it', () => {
      const row = el().querySelector('.proposal')!;
      expect(el().textContent).toContain('Waiting for HR');
      expect(button(row, 'Approve')).toBeUndefined();
      button(row, 'Withdraw').click();
      expect(mocks.service.deleteSalaryChange).toHaveBeenCalledWith(4);
    });
  });

  describe('pay bands', () => {
    it('should list the bands for one currency at a time, with how many people are in each', async () => {
      await render('HR Administrator', undefined, 'bands');
      expect(texts('tbody tr th')).toEqual(['Senior Developer', 'Lead Manager']);
      expect(texts('tbody tr')[0]).toContain('£70,000 £80,000 £90,000 1');

      component.bandCurrency.set('EUR');
      fixture.detectChanges();
      expect(texts('tbody tr th')).toEqual(['Middle Developer']);
    });

    it('should let HR edit a band, checking it first', async () => {
      await render('HR Administrator', undefined, 'bands');
      button(el().querySelectorAll('tbody tr')[0], 'Edit').click();
      fixture.detectChanges();

      component.bandForm.set({ min: 80_000, max: 75_000 });
      fixture.detectChanges();
      expect(el().querySelector('dialog .preview')!.textContent).toContain('The top of the band has to be above the bottom.');

      component.bandForm.set({ min: 72_000, max: 92_000 });
      component.saveBand();
      expect(mocks.service.updatePayBand).toHaveBeenCalledWith(2, { min: 72_000, max: 92_000 });
    });

    it("should not offer a lead the band editor", async () => {
      await render('Team Lead', 1, 'bands');
      expect(el().querySelector('tbody button')).toBeNull();
    });
  });

  it('should show the share price history and let HR add a valuation', async () => {
    await render('HR Administrator', undefined, 'equity');
    expect(texts('.big')).toEqual(['$10.00']);
    expect(texts('.history li').map((t) => t.split(' ').at(-1))).toEqual(['$10.00', '$2.00']);

    component.openPrice();
    component.priceForm.set({ pricePerShare: 12.5, effectiveDate: '2026-12-01', note: ' Series C ' });
    component.savePrice();
    expect(mocks.service.addSharePrice).toHaveBeenCalledWith({ pricePerShare: 12.5, effectiveDate: '2026-12-01', note: 'Series C' });
  });

  it('should remember the tab in the address', async () => {
    await render();
    component.setTab('equity');
    expect(component.tab()).toBe('equity');
  });
});
