import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CandidateService } from 'src/app/services/candidate.service';
import { candidateDetailsResolver } from './candidate-details.resolver';

describe('candidateDetailsResolver', () => {
  let mockCandidateService: { getCandidate: jasmine.Spy };

  const mockCandidate: Candidate = {
    id: 5,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    position: 'Developer',
    level: 'Senior',
    status: 'Interviewing',
    offerAccepted: false,
  };

  const buildSnapshot = (id: string | null): ActivatedRouteSnapshot =>
    ({ paramMap: { get: () => id } } as unknown as ActivatedRouteSnapshot);

  beforeEach(() => {
    mockCandidateService = { getCandidate: jasmine.createSpy('getCandidate').and.returnValue(of(mockCandidate)) };

    TestBed.configureTestingModule({
      providers: [{ provide: CandidateService, useValue: mockCandidateService }],
    });
  });

  it('should call CandidateService.getCandidate with the numeric id from the route', (done) => {
    TestBed.runInInjectionContext(() => {
      const result = candidateDetailsResolver(buildSnapshot('5'), null as any);
      (result as Observable<Candidate>).subscribe((candidate) => {
        expect(mockCandidateService.getCandidate).toHaveBeenCalledWith(5);
        expect(candidate).toEqual(mockCandidate);
        done();
      });
    });
  });

  it('should default to id 0 when the route has no id param', () => {
    TestBed.runInInjectionContext(() => {
      candidateDetailsResolver(buildSnapshot(null), null as any);
    });

    expect(mockCandidateService.getCandidate).toHaveBeenCalledWith(0);
  });
});
