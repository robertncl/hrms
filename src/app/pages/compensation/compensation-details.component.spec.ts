import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { DemoRole } from 'src/app/demo/demo-data';
import { grantRole } from 'src/testing/roles';
import { CompensationMocks, createCompensationMocks, monthsFromToday, provideCompensationTesting } from 'src/testing/compensation.mock';
import { firstOfNextMonth, toIsoDate } from 'src/app/shared/functions/dates';
import { CompensationDetailsComponent } from './compensation-details.component';

describe('CompensationDetailsComponent', () => {
  let fixture: ComponentFixture<CompensationDetailsComponent>;
  let component: CompensationDetailsComponent;
  let mocks: CompensationMocks;
  const today = toIsoDate(new Date());

  beforeEach(() => {
    mocks = createCompensationMocks();
    TestBed.configureTestingModule({ providers: provideCompensationTesting(mocks) });
  });

  /** Opens `id`'s pay as someone signed in with `role`. */
  const render = async (id: number, role: DemoRole = 'HR Administrator', employeeId?: number) => {
    grantRole(role);
    mocks.currentUser.set({ name: 'Viewer', email: '', role, ...(employeeId ? { employeeId } : {}) });
    fixture = TestBed.createComponent(CompensationDetailsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', String(id));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent!.replace(/\s+/g, ' ').trim();
  const buttons = (selector = '.page-actions') => Array.from(el().querySelectorAll(`${selector} button`)).map((b) => b.textContent!.trim());
  const click = (label: string, root: ParentNode = el()) =>
    (Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim().startsWith(label)) as HTMLButtonElement).click();

  describe('what HR sees', () => {
    beforeEach(() => render(2));

    it('should show the salary against its band', () => {
      expect(text('h1')).toBe('Liam Test');
      expect(text('.big')).toBe('£75,000 a year');
      expect(text('#salary-title')).toBe('Base salary');
      expect(text('.card-header .badge')).toBe('In band');
      expect(text('app-band-meter + p')).toBe('Compa-ratio 0.94: below the market midpoint for a Senior developer paid in GBP.');
      expect(el().querySelector('app-band-meter [role="img"]')!.getAttribute('aria-label'))
        .toBe('£75,000, within the band of £70,000 to £90,000. Compa-ratio 0.94.');
    });

    it('should list every change, newest first, with the waiting proposal marked', () => {
      const rows = Array.from(el().querySelectorAll('tbody tr')).map((r) =>
        Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));
      expect(rows.length).toBe(3);
      expect(rows[0]).toMatch(/ Waiting \| £80,000 \| \+6\.7% \| Market adjustment by Olivia Bennett$/);
      expect(rows[1]).toMatch(/£75,000 \| \+7\.1% \| Merit increase$/);
      expect(rows[2]).toMatch(/£70,000 \| — \| New hire$/);
    });

    it('should show equity vested, still to vest, and what can be exercised', () => {
      expect(Array.from(el().querySelectorAll('.totals dd')).map((d) => d.textContent!.trim())).toEqual(['$16,000', '$19,200']);
      expect(text('.grant h3')).toBe('4,800 stock options');
      const grant = text('.grant')!;
      expect(grant).toContain('strike $2.00 · 4 years, monthly after a 1-year cliff');
      expect(grant).toContain('2,400 of 4,800 vested. Next 100 on');
      expect(grant).toContain('400 exercised · 2,000 can be exercised until');
    });

    it('should approve the waiting proposal', () => {
      click('Approve', el().querySelector('.callout')!);
      expect(mocks.service.decideSalaryChange).toHaveBeenCalledWith(4, 'Approved');
    });

    it('should record a change, previewing the raise and the band', () => {
      click('Change salary');
      fixture.detectChanges();
      expect(component.changeForm().baseSalary).toBe(75_000);
      expect(component.changeForm().effectiveDate).toBe(firstOfNextMonth(today));

      component.patchChange({ baseSalary: 95_000, reason: 'Promotion', note: ' Now Staff ' });
      fixture.detectChanges();
      expect(text('dialog .preview')).toBe('+26.7% on £75,000. Compa-ratio 1.19, above the band (up to £90,000).');

      component.submitChange();
      expect(mocks.service.addSalaryChange).toHaveBeenCalledWith({
        employeeId: 2, baseSalary: 95_000, currency: 'GBP', effectiveDate: firstOfNextMonth(today), reason: 'Promotion', note: 'Now Staff',
      });
      fixture.detectChanges();
      expect(text('.alert-info')).toBe("Saved Liam's new salary.");
    });

    it("should not send a change that can't be saved", () => {
      component.openChange();
      component.patchChange({ baseSalary: 0 });
      fixture.detectChanges();
      expect(text('dialog .preview')).toBe('Enter a salary above zero.');
      component.submitChange();
      expect(mocks.service.addSalaryChange).not.toHaveBeenCalled();
    });

    it("should grant options at today's share price by default", () => {
      component.openGrant();
      expect(component.grantForm().strikePrice).toBe(10);
      component.patchGrant({ shares: 1_000 });
      fixture.detectChanges();
      expect(text('dialog[open] .preview')).toBe('Vests over 4 years, monthly after a 1-year cliff. They gain value as the share price rises above the strike price.');

      component.submitGrant();
      expect(mocks.service.addGrant).toHaveBeenCalledWith(jasmine.objectContaining({
        employeeId: 2, kind: 'Stock options', shares: 1_000, strikePrice: 10, grantDate: today, vestingStart: today,
        vestingMonths: 48, cliffMonths: 12, expirationDate: monthsFromToday(120),
      }));
      expect(mocks.service.addGrant.calls.mostRecent().args[0].exercisedShares).toBeUndefined();
    });

    it('should grant RSUs without a strike price or expiry', () => {
      component.openGrant();
      component.patchGrant({ kind: 'RSUs', shares: 500 });
      component.submitGrant();
      const grant = mocks.service.addGrant.calls.mostRecent().args[0];
      expect(grant.strikePrice).toBeUndefined();
      expect(grant.expirationDate).toBeUndefined();
    });

    it('should record an exercise of vested options only', () => {
      click('Record exercise');
      fixture.detectChanges();
      component.exerciseCount.set(2_001);
      fixture.detectChanges();
      expect(text('dialog[open] .preview')).toBe('Only 2,000 can be exercised.');

      component.exerciseCount.set(500);
      fixture.detectChanges();
      expect(text('dialog[open] .preview')).toBe('Costs $1,000 at the strike price, for shares worth $5,000 today.');
      component.submitExercise();
      expect(mocks.service.recordExercise).toHaveBeenCalledWith(1, 900);
    });

    it("should show the API's reason when a change is refused", () => {
      mocks.service.addSalaryChange.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 422, error: { message: 'Pay is in pounds (GBP) or euros (EUR).' },
      })));
      component.openChange();
      component.submitChange();
      fixture.detectChanges();
      expect(text('.alert-error')).toBe('Pay is in pounds (GBP) or euros (EUR).');
    });
  });

  it('should show someone below their band', async () => {
    await render(3);
    expect(text('.card-header .badge')).toBe('Below band');
    expect(el().textContent).toContain('below the market midpoint');
    expect(text('.grant')).toContain('0 of 1,200 vested. Next 1,200 on');
  });

  describe('for a lead', () => {
    it('should let them propose a change for a report, and withdraw one', async () => {
      await render(2, 'Team Lead', 1);
      expect(buttons()).toEqual(['Propose a change']);
      expect(buttons('.callout')).toEqual(['Withdraw']);

      component.openChange();
      fixture.detectChanges();
      expect(el().querySelector('dialog')!.textContent).toContain('HR decides proposals.');
      component.patchChange({ baseSalary: 82_000 });
      component.submitChange();
      fixture.detectChanges();
      expect(mocks.service.addSalaryChange).toHaveBeenCalled();
      expect(text('.alert-info')).toBe("Sent to HR. Liam's salary changes once it's approved.");

      click('Withdraw', el().querySelector('.callout')!);
      expect(mocks.service.deleteSalaryChange).toHaveBeenCalledWith(4);
    });

    it("should keep another team's pay private", async () => {
      await render(3, 'Team Lead', 1);
      expect(text('h1')).toBe("Noah's pay is private");
      expect(el().querySelector('.big')).toBeNull();
    });
  });

  describe('for the person themselves', () => {
    it('should show their own pay, with nothing to change', async () => {
      await render(2, 'Employee', 2);
      expect(text('h1')).toBe('Your pay and equity');
      expect(text('.big')).toBe('£75,000 a year');
      expect(buttons()).toEqual([]);
      expect(buttons('.callout')).toEqual([]);
      expect(buttons('.grant')).toEqual([]);
      expect(text('.breadcrumb a')).toBe('People');
    });

    it("should keep a colleague's pay private", async () => {
      await render(3, 'Employee', 2);
      expect(text('h1')).toBe("Noah's pay is private");
    });
  });

  it('should say when the person does not exist', async () => {
    await render(99);
    expect(text('h1')).toBe('Person not found');
  });
});
