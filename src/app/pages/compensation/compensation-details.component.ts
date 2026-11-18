import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import {
  EQUITY_CURRENCY,
  GRANT_KINDS,
  GrantKind,
  PAY_CHANGE_REASONS,
  PayChangeReason,
  SalaryChange,
  StockGrant,
} from 'src/app/infrastructure/types/compensation';
import { CompensationService } from 'src/app/services/compensation.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AccessScope } from 'src/app/services/access-scope.service';
import { BandMeterComponent } from 'src/app/shared/components/band-meter.component';
import { ProgressMeterComponent } from 'src/app/shared/components/progress-meter.component';
import { enableLightDismissFallback } from 'src/app/shared/functions/light-dismiss';
import { addMonths, firstOfNextMonth, toIsoDate } from 'src/app/shared/functions/dates';
import { formatLongDate } from 'src/app/shared/functions/tenure';
import {
  bandFor,
  bandStanding,
  compaRatio,
  currencyFor,
  formatChange,
  formatMoney,
  percentChange,
  previousSalary,
  salaryChangeProblem,
} from 'src/app/shared/functions/pay';
import {
  DEFAULT_CLIFF_MONTHS,
  DEFAULT_VESTING_MONTHS,
  OPTION_TERM_YEARS,
  describeVesting,
  exercisableShares,
  grantProblem,
  grantValue,
  isExpired,
  nextVesting,
  sharePriceOn,
  vestedShares,
} from 'src/app/shared/functions/equity';
import { STANDING_LABEL, paySummary } from './compensation';

const today = () => toIsoDate(new Date());
const shares = (n: number) => n.toLocaleString('en-GB');

@Component({
  selector: 'app-compensation-details',
  template: `
    <div class="page">
      @if (data.hasValue()) {
        @let person = employee();
        <nav class="breadcrumb" aria-label="Breadcrumb">
          @if (canViewOthers()) {
            <a routerLink="/compensation">Compensation</a>
          } @else {
            <a routerLink="/employees">People</a>
          }
          <span aria-hidden="true">/</span>
          @if (person) {
            <a [routerLink]="['/employees/details', person.id]">{{ person.firstName }} {{ person.lastName }}</a>
            <span aria-hidden="true">/</span>
          }
          <span aria-current="page">Pay and equity</span>
        </nav>

        @if (!person) {
          <section class="card empty-state">
            <h1>Person not found</h1>
            <p><a routerLink="/employees">Back to People</a></p>
          </section>
        } @else if (!canSee()) {
          <section class="card empty-state">
            <h1>{{ person.firstName }}'s pay is private</h1>
            <p>Only {{ person.firstName }}, HR and the people {{ person.firstName }} reports to can see it.</p>
          </section>
        } @else {
          <div class="page-header">
            <div>
              <h1>{{ isSelf() ? 'Your pay and equity' : person.firstName + ' ' + person.lastName }}</h1>
              <p>{{ person.jobTitle || person.position }} · {{ person.level }} · {{ person.location || 'No location' }}</p>
            </div>
            @if (canManage() || canPropose()) {
              <div class="page-actions">
                @if (canManage()) {
                  <button class="btn" type="button" (click)="openGrant()">Grant equity</button>
                }
                <button class="btn btn-primary" type="button" (click)="openChange()">
                  {{ canManage() ? 'Change salary' : 'Propose a change' }}
                </button>
              </div>
            }
          </div>

          @if (error()) {
            <p class="alert alert-error" role="alert">{{ error() }}</p>
          }
          @if (saved()) {
            <p class="alert alert-info" role="status">{{ saved() }}</p>
          }

          @for (change of summary().pending; track change.id) {
            <section class="callout" aria-label="Waiting for a decision">
              <div class="callout-body">
                <strong>
                  {{ change.proposedBy || 'Someone' }} proposed {{ money(change.baseSalary, change.currency) }}
                  @if (changePercent(change); as percent) { ({{ percent }}) }
                  from {{ longDate(change.effectiveDate) }}
                </strong>
                <span>{{ change.reason }}{{ change.note ? ': ' + change.note : '.' }} Waiting for HR.</span>
              </div>
              @if (canManage()) {
                <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="decide(change, 'Rejected')">Decline</button>
                <button class="btn btn-sm btn-primary" type="button" [disabled]="busy()" (click)="decide(change, 'Approved')">Approve</button>
              } @else if (canPropose()) {
                <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="withdraw(change)">Withdraw</button>
              }
            </section>
          }

          <div class="split even">
            <div class="stack">
              <section class="card" aria-labelledby="salary-title">
                <div class="card-header">
                  <h2 id="salary-title">Base salary</h2>
                  @if (summary().standing; as standing) {
                    <span class="badge" [class.badge-warning]="standing !== 'within'" [class.badge-good]="standing === 'within'">
                      {{ standingLabel[standing] }}
                    </span>
                  }
                </div>
                @if (summary().salary; as salary) {
                  <p class="big">{{ money(salary.baseSalary, salary.currency) }} <span class="muted small">a year</span></p>
                  <p class="muted small">Since {{ longDate(salary.effectiveDate) }} · {{ salary.reason }}</p>
                  @if (summary().band; as band) {
                    <app-band-meter [salary]="salary.baseSalary" [band]="band" />
                    <p class="small">
                      Compa-ratio <strong>{{ summary().compa!.toFixed(2) }}</strong>:
                      {{ compaText() }} for a {{ person.level }} {{ person.position.toLowerCase() }} paid in {{ band.currency }}.
                    </p>
                  } @else {
                    <p class="muted small">There's no {{ salary.currency }} pay band for {{ person.level }} {{ person.position }}.</p>
                  }
                } @else {
                  <p class="empty-state">No salary on record yet.</p>
                }
              </section>

              <section class="card flush" aria-labelledby="history-title">
                <div class="card-header"><h2 id="history-title">Salary history</h2></div>
                @if (history().length) {
                  <div class="table-wrap">
                    <table class="data-table stack">
                      <thead>
                        <tr>
                          <th scope="col">From</th>
                          <th scope="col" class="num">Base salary</th>
                          <th scope="col" class="num">Change</th>
                          <th scope="col">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of history(); track row.change.id) {
                          <tr [class.is-muted]="row.change.status !== 'Approved'">
                            <td data-label="From">
                              {{ shortDate(row.change.effectiveDate) }}
                              @if (row.change.status !== 'Approved') {
                                <span class="badge" [class.badge-selected]="row.change.status === 'Pending'"
                                  [class.badge-critical]="row.change.status === 'Rejected'">
                                  {{ row.change.status === 'Pending' ? 'Waiting' : 'Declined' }}
                                </span>
                              }
                            </td>
                            <td class="num" data-label="Base salary">{{ money(row.change.baseSalary, row.change.currency) }}</td>
                            <td class="num" data-label="Change">{{ row.percent ?? '—' }}</td>
                            <td data-label="Reason">
                              {{ row.change.reason }}
                              @if (row.change.proposedBy) {
                                <span class="muted small block">by {{ row.change.proposedBy }}</span>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <p class="empty-state">No salary changes yet.</p>
                }
              </section>
            </div>

            <section class="card" aria-labelledby="equity-title">
              <div class="card-header">
                <h2 id="equity-title">Equity</h2>
                @if (price(); as p) {
                  <span class="muted small">{{ money(p.pricePerShare, equityCurrency, 2) }} a share since {{ shortDate(p.effectiveDate) }}</span>
                }
              </div>
              @if (grants().length) {
                <dl class="totals">
                  <div><dt>Vested</dt><dd>{{ money(summary().vestedValue, equityCurrency) }}</dd></div>
                  <div><dt>Still to vest</dt><dd>{{ money(summary().unvestedValue, equityCurrency) }}</dd></div>
                </dl>
                <p class="muted small">At today's share price. Options count only what the share price is above their strike price.</p>
                @for (row of grants(); track row.grant.id) {
                  <article class="grant" [attr.aria-label]="row.title">
                    <div class="grant-head">
                      <h3>{{ row.title }}</h3>
                      @if (row.expired) {
                        <span class="badge badge-critical">Expired</span>
                      } @else if (row.vested === row.grant.shares) {
                        <span class="badge badge-good">Fully vested</span>
                      }
                    </div>
                    <p class="muted small">
                      Granted {{ shortDate(row.grant.grantDate) }}
                      @if (row.grant.strikePrice !== undefined) { · strike {{ money(row.grant.strikePrice, equityCurrency, 2) }} }
                      · {{ row.vesting }}
                    </p>
                    <app-progress-meter [value]="row.percent" [label]="row.title + ' vested'" />
                    <p class="small">
                      {{ shares(row.vested) }} of {{ shares(row.grant.shares) }} vested.
                      @if (row.next) {
                        Next {{ shares(row.next.shares) }} on {{ shortDate(row.next.date) }}.
                      }
                    </p>
                    @if (row.grant.kind === 'Stock options') {
                      <p class="small">
                        {{ shares(row.grant.exercisedShares) }} exercised · {{ shares(row.exercisable) }} can be exercised
                        @if (!row.expired && row.grant.expirationDate) { until {{ shortDate(row.grant.expirationDate) }} }
                      </p>
                    }
                    @if (row.grant.note) {
                      <p class="muted small">{{ row.grant.note }}</p>
                    }
                    @if (canManage() && row.exercisable > 0) {
                      <button class="btn btn-sm" type="button" (click)="openExercise(row.grant)">Record exercise</button>
                    }
                  </article>
                }
              } @else {
                <p class="empty-state">No equity granted yet.</p>
              }
            </section>
          </div>
        }

        <dialog #changeDialog closedby="any" aria-labelledby="change-title" class="wide">
          <h2 id="change-title">{{ canManage() ? 'Change salary' : 'Propose a salary change' }}</h2>
          @if (!canManage()) {
            <p>HR decides proposals. The new salary takes effect only once it's approved.</p>
          }
          <form (submit)="$event.preventDefault(); submitChange()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="change-salary">New base salary ({{ changeCurrency() }} a year)</label>
                <input id="change-salary" type="number" min="1" step="500" inputmode="numeric"
                  [value]="changeForm().baseSalary ?? ''" (input)="patchChange({ baseSalary: number($event) })" />
              </div>
              <div class="field">
                <label for="change-date">Takes effect</label>
                <input id="change-date" type="date" [value]="changeForm().effectiveDate"
                  (input)="patchChange({ effectiveDate: value($event) })" />
              </div>
              <div class="field span-all">
                <label for="change-reason">Reason</label>
                <select id="change-reason" (change)="patchChange({ reason: $any(value($event)) })">
                  @for (reason of reasons; track reason) {
                    <option [value]="reason" [selected]="reason === changeForm().reason">{{ reason }}</option>
                  }
                </select>
              </div>
              <div class="field span-all">
                <label for="change-note">Note <span class="acme-label__optional">(optional)</span></label>
                <textarea id="change-note" rows="2" maxlength="500" [value]="changeForm().note"
                  (input)="patchChange({ note: value($event) })"></textarea>
              </div>
              @if (changePreview(); as preview) {
                <p class="span-all preview" [class.is-problem]="!!preview.problem" role="status">
                  @if (preview.problem) {
                    {{ preview.problem }}
                  } @else {
                    {{ preview.text }}
                  }
                </p>
              }
            </div>
            <div class="dialog-actions">
              <button class="btn" type="button" (click)="changeDialog.close()">Cancel</button>
              <button class="btn btn-primary" type="submit" [disabled]="busy() || !!changePreview()?.problem">
                {{ canManage() ? 'Save change' : 'Send to HR' }}
              </button>
            </div>
          </form>
        </dialog>

        <dialog #grantDialog closedby="any" aria-labelledby="grant-title" class="wide">
          <h2 id="grant-title">Grant equity</h2>
          <form (submit)="$event.preventDefault(); submitGrant()" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="grant-kind">Kind</label>
                <select id="grant-kind" (change)="patchGrant({ kind: $any(value($event)) })">
                  @for (kind of kinds; track kind) {
                    <option [value]="kind" [selected]="kind === grantForm().kind">{{ kind }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="grant-shares">Shares</label>
                <input id="grant-shares" type="number" min="1" step="100" inputmode="numeric"
                  [value]="grantForm().shares ?? ''" (input)="patchGrant({ shares: number($event) })" />
              </div>
              @if (grantForm().kind === 'Stock options') {
                <div class="field">
                  <label for="grant-strike">Strike price ({{ equityCurrency }} a share)</label>
                  <span class="hint">Usually today's share price.</span>
                  <input id="grant-strike" type="number" min="0.01" step="0.01" inputmode="decimal"
                    [value]="grantForm().strikePrice ?? ''" (input)="patchGrant({ strikePrice: number($event) })" />
                </div>
              }
              <div class="field">
                <label for="grant-date">Grant date</label>
                <input id="grant-date" type="date" [value]="grantForm().grantDate" (input)="patchGrant({ grantDate: value($event) })" />
              </div>
              <div class="field">
                <label for="grant-months">Vests over (months)</label>
                <input id="grant-months" type="number" min="1" max="120" inputmode="numeric"
                  [value]="grantForm().vestingMonths ?? ''" (input)="patchGrant({ vestingMonths: number($event) })" />
              </div>
              <div class="field">
                <label for="grant-cliff">Cliff (months)</label>
                <input id="grant-cliff" type="number" min="0" max="120" inputmode="numeric"
                  [value]="grantForm().cliffMonths ?? ''" (input)="patchGrant({ cliffMonths: number($event) })" />
              </div>
              <div class="field span-all">
                <label for="grant-note">Note <span class="acme-label__optional">(optional)</span></label>
                <input id="grant-note" type="text" maxlength="500" [value]="grantForm().note" (input)="patchGrant({ note: value($event) })" />
              </div>
              @if (grantPreview(); as preview) {
                <p class="span-all preview" [class.is-problem]="!!preview.problem" role="status">{{ preview.problem || preview.text }}</p>
              }
            </div>
            <div class="dialog-actions">
              <button class="btn" type="button" (click)="grantDialog.close()">Cancel</button>
              <button class="btn btn-primary" type="submit" [disabled]="busy() || !!grantPreview()?.problem">Grant</button>
            </div>
          </form>
        </dialog>

        <dialog #exerciseDialog closedby="any" aria-labelledby="exercise-title">
          <h2 id="exercise-title">Record an exercise</h2>
          @if (exercising(); as grant) {
            <p>{{ shares(exercisableOf(grant)) }} vested options can be bought at {{ money(grant.strikePrice ?? 0, equityCurrency, 2) }} each.</p>
            <form (submit)="$event.preventDefault(); submitExercise()" novalidate>
              <div class="field">
                <label for="exercise-shares">Options exercised</label>
                <input id="exercise-shares" type="number" min="1" [max]="exercisableOf(grant)" inputmode="numeric"
                  [value]="exerciseCount() ?? ''" (input)="exerciseCount.set(number($event))" />
              </div>
              @if (exercisePreview(); as preview) {
                <p class="preview" [class.is-problem]="!!preview.problem" role="status">{{ preview.problem || preview.text }}</p>
              }
              <div class="dialog-actions">
                <button class="btn" type="button" (click)="exerciseDialog.close()">Cancel</button>
                <button class="btn btn-primary" type="submit" [disabled]="busy() || !!exercisePreview()?.problem">Record</button>
              </div>
            </form>
          }
        </dialog>
      } @else if (data.error()) {
        <p class="alert alert-error" role="alert">Pay details didn't load. Reload the page to try again.</p>
      } @else {
        <p class="loading">Loading pay…</p>
      }
    </div>
  `,
  styles: `
    .big { margin: 0; font: 700 var(--acme-text-3xl, 2rem) / 1.1 var(--acme-font-display); font-variant-numeric: tabular-nums; }
    .card > p { margin: 0 0 var(--acme-space-3); }
    .card > p:last-child { margin-bottom: 0; }
    app-band-meter { margin: var(--acme-space-4) 0 var(--acme-space-3); }
    .block { display: block; }
    tr.is-muted td { color: var(--acme-color-text-muted); }
    .totals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--acme-space-4); margin: 0 0 var(--acme-space-2); }
    .totals dt { font-size: var(--acme-text-sm); color: var(--acme-color-text-muted); }
    .totals dd { margin: 0; font: 700 var(--acme-text-2xl) / 1.2 var(--acme-font-display); font-variant-numeric: tabular-nums; }
    .grant { display: grid; gap: var(--acme-space-2); padding: var(--acme-space-4) 0; border-top: 1px solid var(--acme-color-border); }
    .grant:last-child { padding-bottom: 0; }
    .grant p { margin: 0; }
    .grant .btn { justify-self: start; }
    .grant-head { display: flex; align-items: center; justify-content: space-between; gap: var(--acme-space-2); }
    .grant-head h3 { margin: 0; font-size: var(--acme-text-md); }
    .preview { margin: 0; font-size: var(--acme-text-sm); color: var(--acme-color-text-muted); }
    .preview.is-problem { color: var(--acme-color-danger); }
    .callout { margin: 0; }
    /* The card is the frame; the table inside doesn't need its own. */
    .card.flush .table-wrap { border: 0; border-radius: 0; box-shadow: none; }
  `,
  imports: [RouterLink, BandMeterComponent, ProgressMeterComponent],
})
export class CompensationDetailsComponent {
  /** Route parameter. */
  id = input.required<string>();

  private readonly compensation = inject(CompensationService);
  private readonly employeeService = inject(EmployeeService);
  private readonly access = inject(AccessScope);
  private readonly permissions = inject(PermissionsService);
  readonly canViewOthers = this.permissions.can('ViewCompensation');
  private readonly canManageAll = this.permissions.can('ManageCompensation');

  readonly reasons = PAY_CHANGE_REASONS;
  readonly kinds = GRANT_KINDS;
  readonly equityCurrency = EQUITY_CURRENCY;
  readonly standingLabel = STANDING_LABEL;
  readonly shares = shares;
  readonly longDate = formatLongDate;

  private readonly changeDialog = viewChild<ElementRef<HTMLDialogElement>>('changeDialog');
  private readonly grantDialog = viewChild<ElementRef<HTMLDialogElement>>('grantDialog');
  private readonly exerciseDialog = viewChild<ElementRef<HTMLDialogElement>>('exerciseDialog');

  readonly data = rxResource({
    params: () => Number(this.id()),
    stream: ({ params: employeeId }) =>
      forkJoin({
        employees: this.employeeService.getEmployees(),
        changes: this.compensation.getSalaryChanges(employeeId),
        bands: this.compensation.getPayBands(),
        grants: this.compensation.getGrants(employeeId),
        prices: this.compensation.getSharePrices(),
      }),
  });

  private readonly loaded = computed(() =>
    this.data.hasValue() ? this.data.value() : { employees: [], changes: [], bands: [], grants: [], prices: [] },
  );
  readonly employee = computed(() => this.loaded().employees.find((e) => e.id === Number(this.id())));
  readonly isSelf = computed(() => this.access.ownId() === this.employee()?.id);
  /** People above them in the reporting line, and HR. */
  private readonly inScope = computed(() => {
    const person = this.employee();
    return !!person && this.access.covers(this.loaded().employees, person.id);
  });
  readonly canSee = computed(() => this.isSelf() || (this.canViewOthers() && this.inScope()));
  readonly canManage = computed(() => this.canManageAll() && this.inScope());
  /** A lead proposes; HR decides. Nobody proposes their own raise. */
  readonly canPropose = computed(() => !this.canManage() && this.canViewOthers() && this.inScope() && !this.isSelf());

  readonly busy = signal(false);
  readonly error = signal('');
  readonly saved = signal('');

  private readonly todayIso = today();
  readonly price = computed(() => sharePriceOn(this.loaded().prices, this.todayIso));
  readonly summary = computed(() => {
    const { changes, bands, grants, prices } = this.loaded();
    return paySummary(this.employee()!, changes, bands, grants, prices, this.todayIso);
  });

  readonly compaText = computed(() => {
    const compa = this.summary().compa ?? 1;
    if (compa < 0.95) return 'below the market midpoint';
    if (compa > 1.05) return 'above the market midpoint';
    return 'close to the market midpoint';
  });

  /** Every change, newest first, with how much each moved pay. */
  readonly history = computed(() =>
    [...this.loaded().changes]
      .filter((c) => c.employeeId === this.employee()?.id)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id)
      .map((change) => ({ change, percent: this.changePercent(change) })),
  );

  readonly grants = computed(() => {
    const price = this.price()?.pricePerShare ?? 0;
    return this.loaded().grants
      .filter((g) => g.employeeId === this.employee()?.id)
      .sort((a, b) => b.grantDate.localeCompare(a.grantDate))
      .map((grant) => {
        const vested = vestedShares(grant, this.todayIso);
        return {
          grant,
          title: `${shares(grant.shares)} ${grant.kind === 'RSUs' ? 'RSUs' : 'stock options'}`,
          vested,
          percent: (vested / grant.shares) * 100,
          next: nextVesting(grant, this.todayIso),
          exercisable: exercisableShares(grant, this.todayIso),
          expired: grant.kind === 'Stock options' && isExpired(grant, this.todayIso),
          vesting: describeVesting(grant),
          value: grantValue(grant, price, this.todayIso),
        };
      });
  });

  money = formatMoney;

  shortDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** "+7.1%" against the approved salary before it, or null for the first. */
  changePercent(change: SalaryChange): string | null {
    const before = previousSalary(this.loaded().changes, change);
    return before && before.currency === change.currency
      ? formatChange(percentChange(before.baseSalary, change.baseSalary))
      : null;
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  number(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  // ---------- Salary change ----------

  readonly changeForm = signal<{ baseSalary: number | null; effectiveDate: string; reason: PayChangeReason; note: string }>({
    baseSalary: null, effectiveDate: '', reason: 'Merit increase', note: '',
  });
  readonly changeCurrency = computed(() =>
    // The dialog is in the page even when the person isn't found.
    (this.employee() ? this.summary().salary?.currency : undefined) ?? currencyFor(this.employee()?.location));

  patchChange(patch: Partial<ReturnType<typeof this.changeForm>>) {
    this.changeForm.update((form) => ({ ...form, ...patch }));
  }

  /** What the change would do: the raise, and where it lands in the band. */
  readonly changePreview = computed(() => {
    const form = this.changeForm();
    if (form.baseSalary === null) return null;
    const currency = this.changeCurrency();
    const problem = salaryChangeProblem({ ...form, currency, note: form.note || undefined });
    if (problem) return { problem, text: '' };
    const parts: string[] = [];
    const current = this.summary().salary;
    if (current && current.currency === currency) {
      parts.push(`${formatChange(percentChange(current.baseSalary, form.baseSalary))} on ${formatMoney(current.baseSalary, currency)}.`);
    }
    const band = bandFor(this.loaded().bands, this.employee()!, currency);
    if (band) {
      const standing = bandStanding(form.baseSalary, band);
      const where = standing === 'within' ? 'within the band' : standing === 'below' ? `below the band (from ${formatMoney(band.min, currency)})` : `above the band (up to ${formatMoney(band.max, currency)})`;
      parts.push(`Compa-ratio ${compaRatio(form.baseSalary, band).toFixed(2)}, ${where}.`);
    }
    return { problem: null, text: parts.join(' ') };
  });

  openChange() {
    const current = this.summary().salary;
    this.changeForm.set({ baseSalary: current?.baseSalary ?? null, effectiveDate: firstOfNextMonth(this.todayIso), reason: 'Merit increase', note: '' });
    this.open(this.changeDialog());
  }

  submitChange() {
    const form = this.changeForm();
    if (form.baseSalary === null || this.changePreview()?.problem) return;
    const person = this.employee()!;
    this.run(
      this.compensation.addSalaryChange({
        employeeId: person.id,
        baseSalary: form.baseSalary,
        currency: this.changeCurrency(),
        effectiveDate: form.effectiveDate,
        reason: form.reason,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }),
      this.canManage()
        ? `Saved ${person.firstName}'s new salary.`
        : `Sent to HR. ${person.firstName}'s salary changes once it's approved.`,
      this.changeDialog(),
    );
  }

  decide(change: SalaryChange, status: 'Approved' | 'Rejected') {
    this.run(
      this.compensation.decideSalaryChange(change.id, status),
      status === 'Approved' ? `Approved: ${formatMoney(change.baseSalary, change.currency)} from ${formatLongDate(change.effectiveDate)}.` : 'Declined the proposal.',
    );
  }

  withdraw(change: SalaryChange) {
    this.run(this.compensation.deleteSalaryChange(change.id), 'Withdrew the proposal.');
  }

  // ---------- Equity grant ----------

  readonly grantForm = signal<{
    kind: GrantKind; shares: number | null; strikePrice: number | null; grantDate: string;
    vestingMonths: number | null; cliffMonths: number | null; note: string;
  }>({ kind: 'Stock options', shares: null, strikePrice: null, grantDate: '', vestingMonths: DEFAULT_VESTING_MONTHS, cliffMonths: DEFAULT_CLIFF_MONTHS, note: '' });

  patchGrant(patch: Partial<ReturnType<typeof this.grantForm>>) {
    this.grantForm.update((form) => ({ ...form, ...patch }));
  }

  private grantDraft(): Omit<StockGrant, 'id'> | null {
    const form = this.grantForm();
    if (form.shares === null || form.vestingMonths === null || form.cliffMonths === null) return null;
    const options = form.kind === 'Stock options';
    return {
      employeeId: this.employee()!.id,
      kind: form.kind,
      shares: form.shares,
      grantDate: form.grantDate,
      vestingStart: form.grantDate,
      vestingMonths: form.vestingMonths,
      cliffMonths: form.cliffMonths,
      exercisedShares: 0,
      ...(options && form.strikePrice !== null ? { strikePrice: form.strikePrice } : {}),
      ...(options && form.grantDate ? { expirationDate: addMonths(form.grantDate, OPTION_TERM_YEARS * 12) } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    };
  }

  readonly grantPreview = computed(() => {
    this.grantForm();
    const draft = this.grantDraft();
    if (!draft) return null;
    const problem = grantProblem(draft, this.todayIso);
    if (problem) return { problem, text: '' };
    const price = this.price()?.pricePerShare ?? 0;
    const worth = draft.shares * (draft.kind === 'RSUs' ? price : Math.max(0, price - (draft.strikePrice ?? 0)));
    const value = draft.kind === 'RSUs'
      ? `Worth ${formatMoney(worth, EQUITY_CURRENCY)} at today's share price.`
      : worth > 0
        ? `Worth ${formatMoney(worth, EQUITY_CURRENCY)} today, over the strike price.`
        : 'They gain value as the share price rises above the strike price.';
    return { problem: null, text: `Vests over ${describeVesting(draft)}. ${value}` };
  });

  openGrant() {
    this.grantForm.set({
      kind: 'Stock options', shares: null, strikePrice: this.price()?.pricePerShare ?? null, grantDate: this.todayIso,
      vestingMonths: DEFAULT_VESTING_MONTHS, cliffMonths: DEFAULT_CLIFF_MONTHS, note: '',
    });
    this.open(this.grantDialog());
  }

  submitGrant() {
    const draft = this.grantDraft();
    if (!draft || this.grantPreview()?.problem) return;
    const { exercisedShares: _, ...grant } = draft;
    this.run(this.compensation.addGrant(grant), `Granted ${shares(draft.shares)} ${draft.kind === 'RSUs' ? 'RSUs' : 'stock options'}.`, this.grantDialog());
  }

  // ---------- Exercise ----------

  readonly exercising = signal<StockGrant | null>(null);
  readonly exerciseCount = signal<number | null>(null);

  exercisableOf(grant: StockGrant) {
    return exercisableShares(grant, this.todayIso);
  }

  readonly exercisePreview = computed(() => {
    const grant = this.exercising();
    const count = this.exerciseCount();
    if (!grant || count === null) return null;
    const most = this.exercisableOf(grant);
    if (!Number.isInteger(count) || count < 1) return { problem: 'Enter a whole number of options.', text: '' };
    if (count > most) return { problem: `Only ${shares(most)} can be exercised.`, text: '' };
    const cost = count * (grant.strikePrice ?? 0);
    const worth = count * (this.price()?.pricePerShare ?? 0);
    return { problem: null, text: `Costs ${formatMoney(cost, EQUITY_CURRENCY)} at the strike price, for shares worth ${formatMoney(worth, EQUITY_CURRENCY)} today.` };
  });

  openExercise(grant: StockGrant) {
    this.exercising.set(grant);
    this.exerciseCount.set(null);
    this.open(this.exerciseDialog());
  }

  submitExercise() {
    const grant = this.exercising();
    const count = this.exerciseCount();
    if (!grant || count === null || this.exercisePreview()?.problem) return;
    this.run(
      this.compensation.recordExercise(grant.id, grant.exercisedShares + count),
      `Recorded ${shares(count)} options exercised.`,
      this.exerciseDialog(),
    );
  }

  // ---------- Shared ----------

  private open(dialog: ElementRef<HTMLDialogElement> | undefined) {
    if (!dialog) return;
    this.error.set('');
    enableLightDismissFallback(dialog.nativeElement);
    dialog.nativeElement.showModal();
  }

  /** Sends one change, then reloads; a refusal is shown with the API's reason. */
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
