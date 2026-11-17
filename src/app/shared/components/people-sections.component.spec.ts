import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DemoRole } from 'src/app/demo/demo-data';
import { User } from 'src/app/infrastructure/types/user';
import { AuthService } from 'src/app/services/auth.service';
import { grantRole } from 'src/testing/roles';
import { PeopleSectionsComponent } from './people-sections.component';

describe('PeopleSectionsComponent', () => {
  let fixture: ComponentFixture<PeopleSectionsComponent>;
  const currentUser = signal<User | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser } }],
    });
  });

  const links = (role: DemoRole, employeeId?: number) => {
    grantRole(role);
    currentUser.set({ name: 'Viewer', email: '', role, ...(employeeId ? { employeeId } : {}) });
    fixture = TestBed.createComponent(PeopleSectionsComponent);
    fixture.detectChanges();
    return Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>)
      .map((a) => `${a.textContent!.trim()} ${a.getAttribute('href')}`);
  };

  it('should add Compensation for people who can see others\' pay', () => {
    expect(links('HR Administrator')).toEqual(['People /employees', 'Projects /work/projects', 'Compensation /compensation']);
    expect(links('Team Lead', 1)).toContain('Compensation /compensation');
  });

  it('should give everyone else with a People record their own pay', () => {
    expect(links('Employee', 15)).toEqual(['People /employees', 'Projects /work/projects', 'Your pay /compensation/15']);
  });

  it('should leave pay out for someone with neither', () => {
    expect(links('Recruiter')).toEqual(['People /employees', 'Projects /work/projects']);
  });
});
