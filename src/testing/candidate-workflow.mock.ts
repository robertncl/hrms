import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CandidateWorkflow } from 'src/app/pages/recruitment/candidate-workflow';
import { EmployeeService } from 'src/app/services/employee.service';

export const mockCandidate: Candidate = {
  id: 2,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  position: 'Developer',
  level: 'Senior',
  status: 'CV evaluation',
  offerAccepted: false,
};

export function createMockWorkflow(candidate: Candidate = mockCandidate) {
  return {
    candidate: signal<Candidate | null>(candidate),
    saving: signal(false),
    error: signal(''),
    save: jasmine.createSpy('save'),
    update: jasmine.createSpy('update').and.callFake((changes: Partial<Candidate>) => of({ ...candidate, ...changes })),
  };
}

/** Providers a recruitment stage component needs when rendered on its own. */
export function provideStageTesting(workflow = createMockWorkflow()): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter([]),
    { provide: CandidateWorkflow, useValue: workflow },
    {
      provide: EmployeeService,
      useValue: {
        getEmployees: () => of([]),
        createEmployee: jasmine.createSpy('createEmployee').and.returnValue(of({ id: 99 })),
      },
    },
  ];
}
