import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, finalize, tap } from 'rxjs';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CandidateService } from 'src/app/services/candidate.service';

/**
 * Shared state for one candidate's details page. Provided by
 * CandidateDetailsComponent, so the stage components it renders can read the
 * candidate and move it through the hiring pipeline.
 */
@Injectable()
export class CandidateWorkflow {
  private readonly candidateService = inject(CandidateService);
  readonly candidate = signal<Candidate | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  /** Emits the saved candidate after every successful update. */
  readonly updated$ = new Subject<Candidate>();

  update(changes: Partial<Candidate>): Observable<Candidate> {
    const candidate = this.candidate();
    if (!candidate) {
      throw new Error('No candidate loaded');
    }
    this.saving.set(true);
    this.error.set('');
    return this.candidateService.updateCandidate(candidate.id, changes).pipe(
      tap({
        next: (updated) => {
          this.candidate.set(updated);
          this.updated$.next(updated);
        },
        error: () => this.error.set('The change could not be saved. Please try again.'),
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  /** Fire-and-forget variant for template event handlers. */
  save(changes: Partial<Candidate>) {
    this.update(changes).subscribe({ error: () => undefined });
  }
}
