import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject, input, linkedSignal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CandidateService } from 'src/app/services/candidate.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { createSearch } from 'src/app/shared/functions/create-search';
import { candidateStage, candidateTone } from 'src/app/shared/functions/status-badge';

const STAGES = ['CV evaluation', 'Interview preparation', 'Interview Feedback', 'Offer sent', 'Onboarding', 'Hired', 'Rejected'];

@Component({
  selector: 'app-candidates-list',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Recruitment</h1>
          <p>Move candidates from application to their first day.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table stack">
          <caption>
            <div class="toolbar">
              <label class="visually-hidden" for="candidate-search">Search candidates by first name</label>
              <input id="candidate-search" class="input" type="search" placeholder="Search by first name" [formControl]="searchControl"/>
              <label class="visually-hidden" for="candidate-stage">Stage</label>
              <select id="candidate-stage" class="input" [value]="stageFilter()" (change)="stageFilter.set($any($event.target).value)">
                <option value="">All stages</option>
                @for (stage of stages; track stage) {
                  <option [value]="stage">{{ stage }}</option>
                }
              </select>
            </div>
          </caption>
          <thead>
            <tr>
              <th scope="col">Full Name</th>
              <th scope="col">Email</th>
              <th scope="col">Position</th>
              <th scope="col">Stage</th>
              <th scope="col">Applied</th>
            </tr>
          </thead>
          <tbody>
            @if (candidates$ | async; as candidates) {
              @for (candidate of byStage(candidates); track candidate.id) {
                <tr>
                  <td>
                    <div class="person">
                      <app-avatar [name]="candidate.firstName + ' ' + candidate.lastName" size="2rem" />
                      <a [routerLink]="[candidate.id]">{{ candidate.firstName }} {{ candidate.lastName }}</a>
                    </div>
                  </td>
                  <td data-label="Email">{{ candidate.email }}</td>
                  <td data-label="Position">{{ candidate.position }} <span class="muted small">{{ candidate.level }}</span></td>
                  <td><span [class]="'badge badge-' + tone(candidate)">{{ stageLabel(candidate) }}</span></td>
                  <td class="num" data-label="Applied">{{ candidate.appliedAt | date: 'MMM d' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty-state">No candidates match your filters.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
    `,
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, ReactiveFormsModule, AvatarComponent],
})
export class CandidatesListComponent implements OnInit {
  private readonly candidateService = inject(CandidateService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly stages = STAGES;
  stageLabel = candidateStage;
  tone = candidateTone;

  /** Bound from the `?stage=` query parameter (e.g. links from the dashboard). */
  stageParam = input<string>('', { alias: 'stage' });
  stageFilter = linkedSignal(() => this.stageParam() ?? '');

  candidates$ = this.candidateService.getCandidates();
  searchControl = new FormControl('');
  search$ = createSearch(this.searchControl);

  ngOnInit(): void {
    this.search$.subscribe((value) => {
      if (value) {
        this.candidates$ = this.candidateService.getCandidatesByName(value);
      } else {
        this.candidates$ = this.candidateService.getCandidates();
      }
      // Runs after a debounce timer, so request a render explicitly.
      this.changeDetector.markForCheck();
    });
  }

  byStage(candidates: Candidate[]) {
    const stage = this.stageFilter();
    return stage ? candidates.filter((c) => candidateStage(c) === stage) : candidates;
  }
}
