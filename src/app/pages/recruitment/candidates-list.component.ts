import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CandidateService } from 'src/app/services/candidate.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { candidateStage, candidateTone } from 'src/app/shared/functions/status-badge';
import { buildBoard } from './hiring-board';

const ROLES = ['Developer', 'Designer', 'QA', 'Manager'];

@Component({
  selector: 'app-candidates-list',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Hiring</h1>
          <p>{{ summary() }}</p>
        </div>
        <div class="page-actions">
          <button class="btn" type="button" (click)="view.set(view() === 'board' ? 'list' : 'board')">
            {{ view() === 'board' ? 'List view' : 'Board view' }}
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="search">
          <app-icon name="search" [size]="16" />
          <label class="visually-hidden" for="candidate-search">Search candidates by name</label>
          <input id="candidate-search" type="search" placeholder="Search by name"
            [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>

        <div class="chips">
          @for (chip of chips(); track chip.role) {
            <button class="chip" type="button" [attr.aria-pressed]="roleFilter() === chip.role"
              (click)="roleFilter.set(chip.role)">{{ chip.label }} {{ chip.count }}</button>
          }
        </div>

        @if (rejectedCount()) {
          <span class="push small muted">
            {{ rejectedCount() }} rejected ·
            <button class="link-btn" type="button" (click)="showRejected.set(!showRejected())">
              {{ showRejected() ? 'hide' : 'show' }}
            </button>
          </span>
        }
      </div>

      @if (!loaded()) {
        <p class="loading">Loading candidates…</p>
      } @else if (view() === 'board') {
        <div class="board">
          @for (column of board(); track column.title) {
            <section class="board-col" [attr.aria-label]="column.title + ': ' + column.cards.length">
              <header>
                <span>{{ column.title }}</span>
                <span class="count">{{ column.cards.length }}</span>
              </header>
              @for (card of column.cards; track card.candidate.id) {
                <a class="board-card" [routerLink]="['/recruitment/candidates', card.candidate.id]">
                  <div class="person">
                    <app-avatar [name]="card.name" size="1.875rem" />
                    <div>
                      <span class="b-name">{{ card.name }}</span>
                      <span class="muted">{{ card.role }}</span>
                    </div>
                  </div>
                  <div class="b-meta">
                    <span [class.is-late]="card.late">{{ card.note }}</span>
                    <span class="age">{{ card.age }}</span>
                  </div>
                </a>
              } @empty {
                <p class="col-empty">Nothing here.</p>
              }
            </section>
          }
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table stack">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Stage</th>
                <th scope="col">Applied</th>
              </tr>
            </thead>
            <tbody>
              @for (candidate of listRows(); track candidate.id) {
                <tr>
                  <td>
                    <div class="person">
                      <app-avatar [name]="candidate.firstName + ' ' + candidate.lastName" />
                      <a [routerLink]="['/recruitment/candidates', candidate.id]">
                        {{ candidate.firstName }} {{ candidate.lastName }}
                      </a>
                    </div>
                  </td>
                  <td class="muted" data-label="Email">{{ candidate.email }}</td>
                  <td data-label="Role">
                    {{ candidate.position }} <span class="muted">{{ candidate.level }}</span>
                  </td>
                  <td data-label="Stage">
                    <span [class]="'badge badge-' + tone(candidate)">{{ stageLabel(candidate) }}</span>
                  </td>
                  <td class="num" data-label="Applied">{{ candidate.appliedAt | date: 'd MMM' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-state">No candidates match those filters.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
    `,
  styles: `
    .link-btn {
      border: 0;
      padding: 0;
      background: none;
      color: var(--acme-color-link);
      font-family: inherit;
      font-size: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .link-btn:hover { text-decoration: underline; }

    .b-name { font-size: var(--acme-text-sm); font-weight: 600; }
    .board-card .person { gap: var(--acme-space-2); }
    .board-card .muted { font-size: var(--acme-text-xs); }

    .col-empty {
      padding: var(--acme-space-3) var(--acme-space-1);
      font-size: var(--acme-text-xs);
      color: var(--acme-color-text-subtle);
    }
  `,
  standalone: true,
  imports: [DatePipe, RouterLink, AvatarComponent, IconComponent],
})
export class CandidatesListComponent {
  private readonly candidateService = inject(CandidateService);
  private readonly employeeService = inject(EmployeeService);

  readonly roles = ROLES;
  stageLabel = candidateStage;
  tone = candidateTone;

  /** Bound from `?stage=` so Home's pipeline can deep-link a column. */
  stageParam = input<string>('', { alias: 'stage' });
  stageFilter = linkedSignal(() => this.stageParam() ?? '');

  search = signal('');
  roleFilter = signal('');
  showRejected = signal(false);
  view = signal<'board' | 'list'>('board');

  private readonly result = toSignal(
    forkJoin({
      candidates: this.candidateService.getCandidates(),
      employees: this.employeeService.getEmployees(),
    }),
  );

  loaded = computed(() => this.result() !== undefined);
  private readonly employees = computed(() => this.result()?.employees ?? []);
  private readonly candidates = computed(() => this.result()?.candidates ?? []);

  rejectedCount = computed(() => this.candidates().filter((c) => c.status === 'Rejected').length);

  chips = computed(() => {
    const candidates = this.inPlay();
    return [
      { role: '', label: 'All roles', count: candidates.length },
      ...this.roles
        .map((role) => ({
          role,
          label: role,
          count: candidates.filter((c) => c.position === role).length,
        }))
        .filter((chip) => chip.count > 0),
    ];
  });

  /** Everyone still moving through the pipeline, rejected ones aside. */
  private readonly inPlay = computed(() =>
    this.candidates().filter((c) => c.status !== 'Rejected' && !c.employeeId),
  );

  private readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    const pool = this.showRejected()
      ? this.candidates().filter((c) => !c.employeeId)
      : this.inPlay();
    return pool.filter(
      (c) =>
        (!role || c.position === role) &&
        (!term || `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(term)),
    );
  });

  board = computed(() => buildBoard(this.filtered(), this.employees()));

  listRows = computed(() => {
    const stage = this.stageFilter();
    const rows = stage
      ? this.filtered().filter((c) => candidateStage(c) === stage)
      : this.filtered();
    return rows.slice().sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''));
  });

  summary = computed(() => {
    const total = this.inPlay().length;
    if (!total) return 'No candidates in play.';
    const late = this.board()
      .flatMap((column) => column.cards)
      .filter((card) => card.late).length;
    const inPlay = `${total} ${total === 1 ? 'candidate' : 'candidates'} in play.`;
    return late
      ? `${inPlay} ${late} ${late === 1 ? 'is' : 'are'} waiting on interview scores.`
      : inPlay;
  });
}
