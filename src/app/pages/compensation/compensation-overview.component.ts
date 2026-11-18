import { Component, ElementRef, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { DEPARTMENTS } from 'src/app/infrastructure/types/employee';
import { EQUITY_CURRENCY, PAY_CURRENCIES, PayBand, PayCurrency, SalaryChange } from 'src/app/infrastructure/types/compensation';
import { CompensationService } from 'src/app/services/compensation.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AccessScope } from 'src/app/services/access-scope.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { BandMeterComponent } from 'src/app/shared/components/band-meter.component';
import { PeopleSectionsComponent } from 'src/app/shared/components/people-sections.component';
import { enableLightDismissFallback } from 'src/app/shared/functions/light-dismiss';
import { toIsoDate } from 'src/app/shared/functions/dates';
import { inScope } from 'src/app/shared/functions/org';
import { BandStanding, bandMidpoint, bandProblem, formatChange, formatCompact, formatMoney, median, percentChange, previousSalary } from 'src/app/shared/functions/pay';
import { sharePriceOn, sharePriceProblem } from 'src/app/shared/functions/equity';
import { PaySummary, STANDING_LABEL, payCsv, paySummary } from './compensation';

type Tab = 'people' | 'bands' | 'equity';
const TABS: { id: Tab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'bands', label: 'Pay bands' },
  { id: 'equity', label: 'Equity' },
];
const POSITIONS = ['Developer', 'Designer', 'QA', 'Manager'] as const;
const LEVELS = ['Junior', 'Middle', 'Senior', 'Lead'] as const;

@Component({
  selector: 'app-compensation-overview',
  template: `
    <div class="page">
      <app-people-sections />
      <div class="page-header">
        <div>
          <h1>Compensation</h1>
          <p>{{ orgWide() ? 'Pay and equity across ACME.' : 'Pay and equity for the people who report to you.' }}</p>
        </div>
        <div class="page-actions">
          <button class="btn" type="button" (click)="exportCsv()" [disabled]="!rows().length">Export CSV</button>
        </div>
      </div>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (saved()) {
        <p class="alert alert-info" role="status">{{ saved() }}</p>
      }

      @if (data.hasValue()) {
        <section class="stats" aria-label="Pay figures">
          <div class="card stat">
            <span class="stat-label">Yearly base pay</span>
            <span class="stat-value">{{ payroll() || '—' }}</span>
            <span class="stat-note">{{ rows().length }} {{ rows().length === 1 ? 'person' : 'people' }}</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Median compa-ratio</span>
            <span class="stat-value">{{ medianCompa() ?? '—' }}</span>
            <span class="stat-note">1.00 is the band midpoint</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Below their band</span>
            <span class="stat-value">{{ counts().below }}</span>
            <span class="stat-note">{{ counts().above }} above</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Vested equity</span>
            <span class="stat-value">{{ compact(totals().vestedValue, equityCurrency) }}</span>
            <span class="stat-note">{{ compact(totals().unvestedValue, equityCurrency) }} still to vest</span>
          </div>
        </section>

        @if (pending().length) {
          <section class="card flush" aria-labelledby="pending-title">
            <div class="card-header">
              <h2 id="pending-title">{{ canManage() ? 'Waiting for your decision' : 'Waiting for HR' }}</h2>
              <span class="muted small">{{ pending().length }} {{ pending().length === 1 ? 'proposal' : 'proposals' }}</span>
            </div>
            <div class="rows">
              @for (row of pending(); track row.change.id) {
                <div class="row-item proposal">
                  <app-avatar [name]="row.name" size="2.25rem" />
                  <div class="row-body">
                    <a [routerLink]="['/compensation', row.change.employeeId]">{{ row.name }}</a>
                    <span class="row-note">
                      {{ row.from }} → <strong>{{ money(row.change.baseSalary, row.change.currency) }}</strong>
                      {{ row.percent }} · {{ row.change.reason }} from {{ shortDate(row.change.effectiveDate) }}
                    </span>
                    <span class="row-note">Proposed by {{ row.change.proposedBy || 'someone' }}{{ row.change.note ? ': “' + row.change.note + '”' : '' }}</span>
                  </div>
                  <div class="row-actions">
                    @if (canManage()) {
                      <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="decide(row.change, 'Rejected')">Decline</button>
                      <button class="btn btn-sm" type="button" [disabled]="busy()" (click)="decide(row.change, 'Approved')">Approve</button>
                    } @else {
                      <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="withdraw(row.change)">Withdraw</button>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        }

        <div class="tabs" role="tablist" aria-label="Compensation views">
          @for (t of tabs; track t.id) {
            <button class="tab" type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="setTab(t.id)">{{ t.label }}</button>
          }
        </div>

        @switch (tab()) {
          @case ('people') {
            <div class="toolbar" role="search">
              <label class="visually-hidden" for="pay-search">Search people</label>
              <input id="pay-search" class="input" type="search" placeholder="Search by name or job title"
                [value]="search()" (input)="search.set($any($event.target).value)" />
              <label class="visually-hidden" for="pay-department">Department</label>
              <select id="pay-department" class="input" (change)="department.set($any($event.target).value)">
                <option value="" [selected]="!department()">All departments</option>
                @for (d of departments; track d) {
                  <option [value]="d" [selected]="d === department()">{{ d }}</option>
                }
              </select>
              <label class="visually-hidden" for="pay-standing">Band</label>
              <select id="pay-standing" class="input" (change)="standing.set($any($event.target).value)">
                <option value="" [selected]="!standing()">Any band position</option>
                <option value="below" [selected]="standing() === 'below'">Below band</option>
                <option value="within" [selected]="standing() === 'within'">In band</option>
                <option value="above" [selected]="standing() === 'above'">Above band</option>
              </select>
            </div>
            <div class="table-wrap">
              <table class="data-table stack" aria-label="Pay by person">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col" class="num">Base salary</th>
                    <th scope="col">Band</th>
                    <th scope="col" class="num">Compa-ratio</th>
                    <th scope="col">Last change</th>
                    <th scope="col" class="num">Equity vested</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filtered(); track row.employee.id) {
                    <tr>
                      <td>
                        <div class="person">
                          <app-avatar [name]="row.employee.firstName + ' ' + row.employee.lastName" />
                          <div>
                            <a [routerLink]="['/compensation', row.employee.id]">{{ row.employee.firstName }} {{ row.employee.lastName }}</a>
                            <span class="muted">{{ row.employee.jobTitle || row.employee.position }} · {{ row.employee.level }}</span>
                          </div>
                        </div>
                      </td>
                      <td class="num" data-label="Base salary">{{ row.salary ? money(row.salary.baseSalary, row.salary.currency) : '—' }}</td>
                      <td data-label="Band" class="band-cell">
                        @if (row.salary && row.band) {
                          <app-band-meter [salary]="row.salary.baseSalary" [band]="row.band" [compact]="true" />
                        } @else {
                          <span class="muted">No band</span>
                        }
                      </td>
                      <td class="num" data-label="Compa-ratio">
                        @if (row.standing) {
                          {{ row.compa!.toFixed(2) }}
                          <span class="badge" [class.badge-warning]="row.standing !== 'within'">{{ standingLabel[row.standing] }}</span>
                        } @else {
                          —
                        }
                      </td>
                      <td data-label="Last change">
                        @if (row.lastChange; as last) {
                          {{ shortDate(last.change.effectiveDate) }}
                          <span class="muted small">{{ last.percent === null ? last.change.reason : percent(last.percent) }}</span>
                        } @else {
                          —
                        }
                      </td>
                      <td class="num" data-label="Equity vested">
                        @if (row.sharesVested) {
                          {{ money(row.vestedValue, equityCurrency) }}
                          <span class="muted small block">{{ shares(row.sharesVested) }} shares</span>
                        } @else if (row.sharesGranted) {
                          <span class="muted">Not vested yet</span>
                        } @else {
                          <span class="muted">None</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6"><p class="empty-state">{{ rows().length ? 'Nobody matches those filters.' : 'Nobody reports to you yet.' }}</p></td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('bands') {
            <p class="muted small">
              The range ACME pays for each role and level. The midpoint is the market rate; a compa-ratio of 1.00 means
              pay at the midpoint. Everyone at ACME can see the bands.
            </p>
            <div class="toolbar">
              <label class="visually-hidden" for="band-currency">Currency</label>
              <select id="band-currency" class="input" (change)="bandCurrency.set($any($event.target).value)">
                @for (c of currencies; track c) {
                  <option [value]="c" [selected]="c === bandCurrency()">{{ c === 'GBP' ? 'Pounds (GBP)' : 'Euros (EUR)' }}</option>
                }
              </select>
            </div>
            <div class="table-wrap">
              <table class="data-table stack" aria-label="Pay bands">
                <thead>
                  <tr>
                    <th scope="col">Role and level</th>
                    <th scope="col" class="num">Minimum</th>
                    <th scope="col" class="num">Midpoint</th>
                    <th scope="col" class="num">Maximum</th>
                    <th scope="col" class="num">People</th>
                    @if (canManage()) {
                      <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (band of bands(); track band.id) {
                    <tr>
                      <th scope="row">{{ band.level }} {{ band.position }}</th>
                      <td class="num" data-label="Minimum">{{ money(band.min, band.currency) }}</td>
                      <td class="num" data-label="Midpoint">{{ money(mid(band), band.currency) }}</td>
                      <td class="num" data-label="Maximum">{{ money(band.max, band.currency) }}</td>
                      <td class="num" data-label="People">{{ bandHeadcount().get(band.id) ?? 0 }}</td>
                      @if (canManage()) {
                        <td class="actions">
                          <button class="btn btn-sm btn-ghost" type="button" (click)="openBand(band)">
                            Edit<span class="visually-hidden"> {{ band.level }} {{ band.position }} band</span>
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('equity') {
            <div class="split even">
              <section class="card" aria-labelledby="price-title">
                <div class="card-header">
                  <h2 id="price-title">Share price</h2>
                  @if (canManage()) {
                    <button class="btn btn-sm" type="button" (click)="openPrice()">New valuation</button>
                  }
                </div>
                @if (price(); as p) {
                  <p class="big">{{ money(p.pricePerShare, equityCurrency, 2) }}</p>
                  <p class="muted small">Since {{ shortDate(p.effectiveDate) }}{{ p.note ? ' · ' + p.note : '' }}</p>
                }
                <ul class="history">
                  @for (p of priceHistory(); track p.id) {
                    <li>
                      <span>{{ shortDate(p.effectiveDate) }}</span>
                      <span class="muted">{{ p.note }}</span>
                      <strong>{{ money(p.pricePerShare, equityCurrency, 2) }}</strong>
                    </li>
                  }
                </ul>
              </section>
              <section class="card" aria-labelledby="equity-title">
                <div class="card-header"><h2 id="equity-title">Granted equity</h2></div>
                <dl class="details-list">
                  <dt>People with equity</dt><dd>{{ totals().holders }}</dd>
                  <dt>Shares granted</dt><dd>{{ shares(totals().granted) }}</dd>
                  <dt>Vested, not exercised</dt><dd>{{ shares(totals().vested) }}</dd>
                  <dt>Vested value</dt><dd>{{ money(totals().vestedValue, equityCurrency) }}</dd>
                  <dt>Still to vest</dt><dd>{{ money(totals().unvestedValue, equityCurrency) }}</dd>
                </dl>
                <p class="muted small">Options are valued at what the share price is above their strike price.</p>
              </section>
            </div>
          }
        }
      } @else if (data.error()) {
        <p class="alert alert-error" role="alert">Pay data didn't load. Reload the page to try again.</p>
      } @else {
        <p class="loading">Loading pay…</p>
      }

      <dialog #bandDialog closedby="any" aria-labelledby="band-title">
        @if (editingBand(); as band) {
          <h2 id="band-title">{{ band.level }} {{ band.position }} ({{ band.currency }})</h2>
          <form (submit)="$event.preventDefault(); saveBand()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="band-min">Minimum</label>
                <input id="band-min" type="number" min="1" step="1000" inputmode="numeric" [value]="bandForm().min ?? ''"
                  (input)="bandForm.set({ min: number($event), max: bandForm().max })" />
              </div>
              <div class="field">
                <label for="band-max">Maximum</label>
                <input id="band-max" type="number" min="1" step="1000" inputmode="numeric" [value]="bandForm().max ?? ''"
                  (input)="bandForm.set({ min: bandForm().min, max: number($event) })" />
              </div>
              @if (bandFormProblem(); as problem) {
                <p class="span-all preview is-problem" role="status">{{ problem }}</p>
              }
            </div>
            <div class="dialog-actions">
              <button class="btn" type="button" (click)="bandDialog.close()">Cancel</button>
              <button class="btn btn-primary" type="submit" [disabled]="busy() || !!bandFormProblem()">Save band</button>
            </div>
          </form>
        }
      </dialog>

      <dialog #priceDialog closedby="any" aria-labelledby="price-dialog-title">
        <h2 id="price-dialog-title">New share valuation</h2>
        <p>Equity is valued at the latest price from its date on. New option grants default to it as their strike price.</p>
        <form (submit)="$event.preventDefault(); savePrice()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="price-value">Price per share ({{ equityCurrency }})</label>
              <input id="price-value" type="number" min="0.01" step="0.01" inputmode="decimal" [value]="priceForm().pricePerShare ?? ''"
                (input)="priceForm.set({ ...priceForm(), pricePerShare: number($event) })" />
            </div>
            <div class="field">
              <label for="price-date">From</label>
              <input id="price-date" type="date" [value]="priceForm().effectiveDate"
                (input)="priceForm.set({ ...priceForm(), effectiveDate: $any($event.target).value })" />
            </div>
            <div class="field span-all">
              <label for="price-note">Note <span class="acme-label__optional">(optional)</span></label>
              <input id="price-note" type="text" maxlength="500" placeholder="For example: Series C" [value]="priceForm().note"
                (input)="priceForm.set({ ...priceForm(), note: $any($event.target).value })" />
            </div>
            @if (priceFormProblem(); as problem) {
              <p class="span-all preview is-problem" role="status">{{ problem }}</p>
            }
          </div>
          <div class="dialog-actions">
            <button class="btn" type="button" (click)="priceDialog.close()">Cancel</button>
            <button class="btn btn-primary" type="submit" [disabled]="busy() || !!priceFormProblem()">Save valuation</button>
          </div>
        </form>
      </dialog>
    </div>
  `,
  styles: `
    .stats { display: grid; gap: var(--acme-space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr)); }
    .stat { display: grid; gap: 0.15rem; }
    .stat-label { font-size: var(--acme-text-sm); color: var(--acme-color-text-muted); }
    .stat-value { font: 650 var(--acme-text-2xl) / 1.2 var(--acme-font-display); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .stat-note { font-size: var(--acme-text-xs); color: var(--acme-color-text-subtle); }
    .proposal { grid-template-columns: 36px minmax(0, 1fr) auto; }
    .proposal .row-body a { font-weight: 600; text-decoration: none; color: var(--acme-color-text); }
    .proposal .row-body a:hover { color: var(--acme-color-link); text-decoration: underline; }
    .band-cell { min-width: 8rem; }
    .block { display: block; }
    .data-table td .badge { margin-inline-start: var(--acme-space-1); }
    .big { margin: 0; font: 700 var(--acme-text-3xl) / 1.1 var(--acme-font-display); font-variant-numeric: tabular-nums; }
    .history { list-style: none; margin: var(--acme-space-4) 0 0; padding: 0; display: grid; }
    .history li {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr) auto;
      gap: var(--acme-space-3);
      padding: var(--acme-space-2) 0;
      border-top: 1px solid var(--acme-color-border);
      font-size: var(--acme-text-sm);
      font-variant-numeric: tabular-nums;
    }
    .preview { margin: 0; font-size: var(--acme-text-sm); }
    .preview.is-problem { color: var(--acme-color-danger); }
    @media (max-width: 640px) {
      .proposal { grid-template-columns: 36px minmax(0, 1fr); }
      .proposal .row-actions { grid-column: 2; }
    }
  `,
  imports: [RouterLink, AvatarComponent, BandMeterComponent, PeopleSectionsComponent],
})
export class CompensationOverviewComponent {
  /** `?tab=bands` or `?tab=equity` from the route. */
  tabParam = input<string>('', { alias: 'tab' });

  private readonly compensation = inject(CompensationService);
  private readonly employeeService = inject(EmployeeService);
  private readonly access = inject(AccessScope);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionsService);
  readonly canManage = this.permissions.can('ManageCompensation');
  readonly orgWide = this.access.orgWide;

  readonly tabs = TABS;
  readonly departments = DEPARTMENTS;
  readonly currencies = PAY_CURRENCIES;
  readonly equityCurrency = EQUITY_CURRENCY;
  readonly standingLabel = STANDING_LABEL;

  readonly tab = linkedSignal<Tab>(() => (TABS.some((t) => t.id === this.tabParam()) ? (this.tabParam() as Tab) : 'people'));
  readonly search = signal('');
  readonly department = signal('');
  readonly standing = signal<'' | BandStanding>('');
  readonly bandCurrency = signal<PayCurrency>('GBP');

  readonly busy = signal(false);
  readonly error = signal('');
  readonly saved = signal('');

  private readonly todayIso = toIsoDate(new Date());

  readonly data = rxResource({
    stream: () =>
      forkJoin({
        employees: this.employeeService.getEmployees(),
        changes: this.compensation.getSalaryChanges(),
        bands: this.compensation.getPayBands(),
        grants: this.compensation.getGrants(),
        prices: this.compensation.getSharePrices(),
      }),
  });
  private readonly loaded = computed(() =>
    this.data.hasValue() ? this.data.value() : { employees: [], changes: [], bands: [], grants: [], prices: [] },
  );

  /** Everyone whose pay this viewer may see: the whole company for HR, their reporting line for a lead. */
  readonly rows = computed<PaySummary[]>(() => {
    const { employees, changes, bands, grants, prices } = this.loaded();
    const scope = this.access.of(employees);
    return employees
      .filter((e) => inScope(scope, e.id))
      .map((e) => paySummary(e, changes, bands, grants, prices, this.todayIso))
      .sort((a, b) => `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(`${b.employee.firstName} ${b.employee.lastName}`));
  });

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.rows().filter((row) =>
      (!this.department() || row.employee.department === this.department()) &&
      (!this.standing() || row.standing === this.standing()) &&
      (!term || `${row.employee.firstName} ${row.employee.lastName} ${row.employee.jobTitle ?? ''}`.toLowerCase().includes(term)),
    );
  });

  /** "£1.1m · €610k": one total per pay currency, never added across currencies. */
  readonly payroll = computed(() =>
    PAY_CURRENCIES.map((currency) => {
      const total = this.rows().reduce((sum, row) => sum + (row.salary?.currency === currency ? row.salary.baseSalary : 0), 0);
      return total ? formatCompact(total, currency) : '';
    }).filter(Boolean).join(' · '),
  );

  readonly medianCompa = computed(() => {
    const value = median(this.rows().flatMap((row) => (row.compa === undefined ? [] : [row.compa])));
    return value === null ? null : value.toFixed(2);
  });

  readonly counts = computed(() => ({
    below: this.rows().filter((row) => row.standing === 'below').length,
    above: this.rows().filter((row) => row.standing === 'above').length,
  }));

  readonly totals = computed(() => {
    const rows = this.rows();
    return {
      holders: rows.filter((row) => row.sharesGranted > 0).length,
      granted: rows.reduce((sum, row) => sum + row.sharesGranted, 0),
      vested: rows.reduce((sum, row) => sum + row.sharesVested, 0),
      vestedValue: rows.reduce((sum, row) => sum + row.vestedValue, 0),
      unvestedValue: rows.reduce((sum, row) => sum + row.unvestedValue, 0),
    };
  });

  /** Proposals for the people in this viewer's scope. */
  readonly pending = computed(() => {
    const { changes } = this.loaded();
    const names = new Map(this.rows().map((row) => [row.employee.id, `${row.employee.firstName} ${row.employee.lastName}`]));
    return changes
      .filter((c) => c.status === 'Pending' && names.has(c.employeeId))
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      .map((change) => {
        const before = previousSalary(changes, change);
        return {
          change,
          name: names.get(change.employeeId)!,
          from: before ? formatMoney(before.baseSalary, before.currency) : 'No salary yet',
          percent: before && before.currency === change.currency ? `(${formatChange(percentChange(before.baseSalary, change.baseSalary))})` : '',
        };
      });
  });

  readonly bands = computed(() =>
    this.loaded().bands
      .filter((b) => b.currency === this.bandCurrency())
      .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)),
  );

  readonly bandHeadcount = computed(() => {
    const counts = new Map<number, number>();
    for (const row of this.rows()) {
      if (row.band) counts.set(row.band.id, (counts.get(row.band.id) ?? 0) + 1);
    }
    return counts;
  });

  readonly price = computed(() => sharePriceOn(this.loaded().prices, this.todayIso));
  readonly priceHistory = computed(() => [...this.loaded().prices].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)));

  private readonly bandDialog = viewChild<ElementRef<HTMLDialogElement>>('bandDialog');
  private readonly priceDialog = viewChild<ElementRef<HTMLDialogElement>>('priceDialog');

  money = formatMoney;
  compact = formatCompact;
  mid = bandMidpoint;
  percent = formatChange;

  shares(n: number) {
    return n.toLocaleString('en-GB');
  }

  shortDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  number(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.router.navigate([], { queryParams: { tab: tab === 'people' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  decide(change: SalaryChange, status: 'Approved' | 'Rejected') {
    this.run(this.compensation.decideSalaryChange(change.id, status), status === 'Approved' ? 'Approved the change.' : 'Declined the proposal.');
  }

  withdraw(change: SalaryChange) {
    this.run(this.compensation.deleteSalaryChange(change.id), 'Withdrew the proposal.');
  }

  // ---------- Bands ----------

  readonly editingBand = signal<PayBand | null>(null);
  readonly bandForm = signal<{ min: number | null; max: number | null }>({ min: null, max: null });
  readonly bandFormProblem = computed(() => {
    const { min, max } = this.bandForm();
    return bandProblem({ min: min ?? undefined, max: max ?? undefined });
  });

  openBand(band: PayBand) {
    this.editingBand.set(band);
    this.bandForm.set({ min: band.min, max: band.max });
    this.open(this.bandDialog());
  }

  saveBand() {
    const band = this.editingBand();
    const { min, max } = this.bandForm();
    if (!band || min === null || max === null || this.bandFormProblem()) return;
    this.run(this.compensation.updatePayBand(band.id, { min, max }), `Saved the ${band.level} ${band.position} band.`, this.bandDialog());
  }

  // ---------- Share price ----------

  readonly priceForm = signal<{ pricePerShare: number | null; effectiveDate: string; note: string }>({ pricePerShare: null, effectiveDate: '', note: '' });
  readonly priceFormProblem = computed(() => {
    const form = this.priceForm();
    return form.pricePerShare === null ? null : sharePriceProblem({ ...form, note: form.note || undefined });
  });

  openPrice() {
    this.priceForm.set({ pricePerShare: null, effectiveDate: this.todayIso, note: '' });
    this.open(this.priceDialog());
  }

  savePrice() {
    const form = this.priceForm();
    if (form.pricePerShare === null || this.priceFormProblem()) return;
    this.run(
      this.compensation.addSharePrice({
        pricePerShare: form.pricePerShare,
        effectiveDate: form.effectiveDate,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }),
      'Saved the new valuation.',
      this.priceDialog(),
    );
  }

  exportCsv() {
    const url = URL.createObjectURL(new Blob([payCsv(this.filtered())], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'acme-compensation.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private open(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (!dialog) return;
    this.error.set('');
    enableLightDismissFallback(dialog.nativeElement);
    dialog.nativeElement.showModal();
  }

  private run(action: Observable<unknown>, done: string, dialog?: ElementRef<HTMLDialogElement>) {
    this.busy.set(true);
    this.error.set('');
    this.saved.set('');
    action.subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.set(done);
        dialog?.nativeElement.close();
        this.data.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(error.error?.message ?? "That didn't save. Try again.");
        dialog?.nativeElement.close();
      },
    });
  }
}
