import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CandidateService } from './candidate.service';
import { Candidate } from '../infrastructure/types/candidate';

describe('CandidateService', () => {
  let service: CandidateService;
  let httpMock: HttpTestingController;

  const mockCandidates: Candidate[] = [
    {
      id: 1,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      position: 'Developer',
      level: 'Senior',
      status: 'Interviewing',
      offerAccepted: false,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CandidateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all candidates', () => {
    service.getCandidates().subscribe((candidates) => {
      expect(candidates).toEqual(mockCandidates);
    });

    const req = httpMock.expectOne('/candidates');
    expect(req.request.method).toBe('GET');
    req.flush(mockCandidates);
  });

  it('should fetch candidates by name', () => {
    service.getCandidatesByName('Jane').subscribe((candidates) => {
      expect(candidates).toEqual(mockCandidates);
    });

    const req = httpMock.expectOne('/candidates?firstName_like=Jane');
    expect(req.request.method).toBe('GET');
    req.flush(mockCandidates);
  });

  it('should fetch a single candidate by id', () => {
    service.getCandidate(1).subscribe((candidate) => {
      expect(candidate).toEqual(mockCandidates[0]);
    });

    const req = httpMock.expectOne('/candidates/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockCandidates[0]);
  });
});
