import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CandidatesListComponent } from './candidates-list.component';
import { CandidateService } from 'src/app/services/candidate.service';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { flushChanges } from 'src/testing/flush-changes';

describe('CandidatesListComponent', () => {
  let component: CandidatesListComponent;
  let fixture: ComponentFixture<CandidatesListComponent>;
  let mockCandidateService: {
    getCandidates: jasmine.Spy;
    getCandidatesByName: jasmine.Spy;
  };

  const mockCandidates: Candidate[] = [
    {
      id: 1,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      position: 'Developer',
      level: 'Senior',
      status: 'CV evaluation',
      offerAccepted: false,
    },
    {
      id: 2,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      position: 'Designer',
      level: 'Junior',
      status: 'Rejected',
      offerAccepted: false,
    },
  ];

  const filteredCandidates: Candidate[] = [mockCandidates[1]];

  beforeEach(async () => {
    mockCandidateService = {
      getCandidates: jasmine.createSpy('getCandidates').and.returnValue(of(mockCandidates)),
      getCandidatesByName: jasmine.createSpy('getCandidatesByName').and.returnValue(of(filteredCandidates)),
    };

    await TestBed.configureTestingModule({
      imports: [CandidatesListComponent],
      providers: [
        provideRouter([]),
        { provide: CandidateService, useValue: mockCandidateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CandidatesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load all candidates on init', () => {
    expect(mockCandidateService.getCandidates).toHaveBeenCalled();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Jane Doe');
    expect(rows[0].textContent).toContain('jane.doe@example.com');
    expect(rows[0].textContent).toContain('Developer');
  });

  it('should render a routerLink to the candidate details for each row', () => {
    const link = fixture.nativeElement.querySelector('tbody tr a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/1');
  });

  it('should search candidates by name after debounce and update the list', fakeAsync(() => {
    component.searchControl.setValue('John');
    tick(500);
    flushChanges(fixture);

    expect(mockCandidateService.getCandidatesByName).toHaveBeenCalledWith('John');
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('John Smith');
  }));

  it('should reload all candidates when the search value is cleared', fakeAsync(() => {
    component.searchControl.setValue('John');
    tick(500);
    fixture.detectChanges();

    mockCandidateService.getCandidates.calls.reset();
    component.searchControl.setValue('');
    tick(500);
    flushChanges(fixture);

    expect(mockCandidateService.getCandidates).toHaveBeenCalled();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  }));

  it('should update the search input value when the user types', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('caption input');
    input.value = 'Jane';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.searchControl.value).toBe('Jane');
  });
});
