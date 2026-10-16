import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CandidatesListComponent } from './candidates-list.component';
import { CandidateService } from 'src/app/services/candidate.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { Employee } from 'src/app/infrastructure/types/employee';

describe('CandidatesListComponent', () => {
  let component: CandidatesListComponent;
  let fixture: ComponentFixture<CandidatesListComponent>;

  const candidates: Candidate[] = [
    {
      id: 1, firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@acme.com',
      position: 'Developer', level: 'Senior', status: 'CV evaluation', offerAccepted: false,
      appliedAt: '2026-10-10',
    },
    {
      id: 2, firstName: 'John', lastName: 'Smith', email: 'john.smith@acme.com',
      position: 'Designer', level: 'Junior', status: 'Interview preparation', offerAccepted: false,
      appliedAt: '2026-10-08',
    },
    {
      id: 3, firstName: 'Ada', lastName: 'Byron', email: 'ada.byron@acme.com',
      position: 'Developer', level: 'Lead', status: 'Approved', offerAccepted: false,
      appliedAt: '2026-10-01',
    },
    {
      id: 4, firstName: 'Rejected', lastName: 'Person', email: 'rp@acme.com',
      position: 'QA', level: 'Middle', status: 'Rejected', offerAccepted: false,
      appliedAt: '2026-10-02',
    },
  ];

  const employees: Employee[] = [
    {
      id: 10, firstName: 'Liam', lastName: 'Chen', email: 'liam.chen@acme.com',
      position: 'Developer', level: 'Senior', isAvailable: true, profilePicture: '',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidatesListComponent],
      providers: [
        provideRouter([]),
        {
          provide: CandidateService,
          useValue: { getCandidates: () => of(candidates) },
        },
        {
          provide: EmployeeService,
          useValue: { getEmployees: () => of(employees) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CandidatesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function columnTitles(): string[] {
    return fixture.debugElement
      .queryAll(By.css('.board-col > header > span:first-child'))
      .map((el) => el.nativeElement.textContent.trim());
  }

  function cardNames(): string[] {
    return fixture.debugElement
      .queryAll(By.css('.board-card .b-name'))
      .map((el) => el.nativeElement.textContent.trim());
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the board with all five pipeline columns', () => {
    expect(columnTitles()).toEqual(['New', 'Interview', 'Feedback', 'Offer', 'Onboarding']);
  });

  it('should place each candidate in the column for its stage', () => {
    const columns = fixture.debugElement.queryAll(By.css('.board-col'));
    expect(columns[0].nativeElement.textContent).toContain('Jane Doe');
    expect(columns[1].nativeElement.textContent).toContain('John Smith');
    // Approved without an accepted offer sits at Offer.
    expect(columns[3].nativeElement.textContent).toContain('Ada Byron');
  });

  it('should leave rejected candidates off the board until asked for', () => {
    expect(cardNames()).not.toContain('Rejected Person');

    component.showRejected.set(true);
    fixture.detectChanges();

    // Rejected candidates have no pipeline stage, so no column claims them;
    // the count in the toolbar is what surfaces them.
    expect(component.rejectedCount()).toBe(1);
  });

  it('should link each card to the candidate details page', () => {
    const link: HTMLAnchorElement = fixture.debugElement.query(By.css('.board-card')).nativeElement;
    expect(link.getAttribute('href')).toBe('/recruitment/candidates/1');
  });

  it('should filter by role from the chips', () => {
    component.roleFilter.set('Designer');
    fixture.detectChanges();

    expect(cardNames()).toEqual(['John Smith']);
  });

  it('should filter by the search term', () => {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('.search input')).nativeElement;
    input.value = 'ada';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(cardNames()).toEqual(['Ada Byron']);
  });

  it('should switch to a table when list view is chosen', () => {
    const toggle: HTMLButtonElement = fixture.debugElement
      .queryAll(By.css('.page-actions button'))
      .find((b) => b.nativeElement.textContent.includes('List view'))!.nativeElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.board'))).toBeFalsy();
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(3);
    expect(rows[0].nativeElement.textContent).toContain('Jane Doe');
  });

  it('should count candidates in play in the summary', () => {
    expect(fixture.debugElement.query(By.css('.page-header p')).nativeElement.textContent)
      .toContain('3 candidates in play');
  });
});
