import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OnboardingPreparationComponent } from './onboarding-preparation.component';
import { createMockWorkflow, provideStageTesting } from 'src/testing/candidate-workflow.mock';
import { EmployeeService } from 'src/app/services/employee.service';
import { grantRole } from 'src/testing/roles';

describe('OnboardingPreparationComponent', () => {
  let workflow: ReturnType<typeof createMockWorkflow>;
  let component: OnboardingPreparationComponent;
  let fixture: ComponentFixture<OnboardingPreparationComponent>;

  beforeEach(async () => {
    workflow = createMockWorkflow();
    await TestBed.configureTestingModule({
      imports: [OnboardingPreparationComponent],
      providers: provideStageTesting(workflow),
    }).compileComponents();

    grantRole('Recruiter');
    fixture = TestBed.createComponent(OnboardingPreparationComponent);
    component = fixture.componentInstance;
    component.candidateId = 5;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(5);
  });

  it('should render the onboarding preparation text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Onboarding preparation');
  });

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label)!;

  it('should create an employee record once the checklist is done', () => {
    expect(button('Create employee record').disabled).toBeTrue();

    component.done.set(component.checklist.map(() => true));
    fixture.detectChanges();
    button('Create employee record').click();

    const employeeService = TestBed.inject(EmployeeService) as unknown as { createEmployee: jasmine.Spy };
    expect(employeeService.createEmployee).toHaveBeenCalledWith(jasmine.objectContaining({
      firstName: 'Jane', lastName: 'Doe', position: 'Developer', level: 'Senior',
    }));
    expect(workflow.update).toHaveBeenCalledWith({ employeeId: 99 });
  });

  it('should leave creating the record to a recruiter or HR when a team lead is onboarding', () => {
    grantRole('Team Lead');
    fixture = TestBed.createComponent(OnboardingPreparationComponent);
    fixture.detectChanges();

    expect(buttons().some((b) => b.textContent!.includes('Create employee record'))).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain("a recruiter or HR administrator creates Jane's employee record");
  });
});
