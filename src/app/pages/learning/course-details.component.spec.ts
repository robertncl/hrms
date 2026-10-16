import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CourseDetailsComponent } from './course-details.component';
import { LearningMocks, createLearningMocks, provideLearningTesting } from 'src/testing/learning.mock';
import { daysFromToday } from 'src/app/demo/demo-data';

describe('CourseDetailsComponent', () => {
  let fixture: ComponentFixture<CourseDetailsComponent>;
  let component: CourseDetailsComponent;
  let mocks: LearningMocks;
  let navigateSpy: jasmine.Spy;

  const render = async (courseId = 1, canManage = true, canAssign = true, employeeId?: number) => {
    mocks = createLearningMocks();
    TestBed.configureTestingModule({ providers: provideLearningTesting(mocks, canManage, canAssign, employeeId) });
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', String(courseId));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tbody tr')) as HTMLElement[];
  const button = (root: Element, label: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent!.trim() === label) as HTMLButtonElement;

  it('should show the course and its modules', async () => {
    await render();
    expect(el().querySelector('h1')!.textContent).toContain('Security Basics');
    expect(Array.from(el().querySelectorAll('.modules li')).map((li) => li.textContent!.trim())).toEqual(['Phishing', 'Passwords']);
    expect(el().textContent).toContain('Mandatory');
  });

  it('should list enrolled employees, overdue first and completed last', async () => {
    await render();
    expect(rows().map((r) => r.querySelector('.person a')!.textContent!.trim())).toEqual(['Grace Hopper', 'Alan Turing', 'Ada Lovelace']);
    expect(rows()[0].querySelector('.badge')!.textContent).toContain('Overdue');
    expect(rows()[0].textContent).toContain('1 of 2 modules');
    expect(rows()[2].textContent).toContain('Done');
  });

  it('should only offer progress actions for unfinished training', async () => {
    await render();
    expect(button(rows()[0], 'Log module')).toBeTruthy();
    expect(button(rows()[2], 'Log module')).toBeUndefined();
    expect(button(rows()[2], 'Unenroll')).toBeTruthy();
  });

  it('should log a module and reload', async () => {
    await render();
    mocks.enrollmentService.getEnrollmentsByCourse.calls.reset();

    button(rows()[0], 'Log module').click();
    TestBed.tick();

    expect(mocks.enrollmentService.setCompletedModules).toHaveBeenCalledWith(2, 2);
    expect(mocks.enrollmentService.getEnrollmentsByCourse).toHaveBeenCalledWith(1);
  });

  it('should mark training complete and unenroll', async () => {
    await render();
    button(rows()[1], 'Mark complete').click();
    expect(mocks.enrollmentService.setCompletedModules).toHaveBeenCalledWith(3, 2);

    button(rows()[1], 'Unenroll').click();
    expect(mocks.enrollmentService.unenroll).toHaveBeenCalledWith(3);
  });

  it('should only offer people who are not enrolled yet', async () => {
    await render(2);
    expect(component.assignable().map((e) => e.firstName)).toEqual(['Grace', 'Alan']);

    component.assignSearch.set('qa');
    expect(component.assignable().map((e) => e.firstName)).toEqual(['Alan']);
  });

  it('should assign the course to the selected people with a due date', async () => {
    await render(2);
    component.openAssign();
    fixture.detectChanges();
    expect((el().querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
    expect(component.dueDate()).toBe(daysFromToday(30));

    component.selectAllShown();
    fixture.detectChanges();
    const submit = el().querySelector('dialog button[type="submit"]') as HTMLButtonElement;
    expect(submit.textContent).toContain('Assign to 2 people');
    submit.click();

    expect(mocks.enrollmentService.assign).toHaveBeenCalledWith(2, [2, 3], daysFromToday(30));
    expect((el().querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
  });

  it('should not allow assigning nobody', async () => {
    await render(2);
    component.openAssign();
    fixture.detectChanges();
    expect((el().querySelector('dialog button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('should delete the course after confirmation and go back to the catalog', async () => {
    await render();
    button(el(), 'Delete').click();
    fixture.detectChanges();
    const dialog = el().querySelector('app-confirmation-dialog dialog') as HTMLDialogElement;
    expect(dialog.textContent).toContain('its 3 enrollments will be removed');

    button(dialog, 'Delete course').click();
    expect(mocks.courseService.deleteCourse).toHaveBeenCalledWith(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/learning']);
  });

  it('should hide edit and delete from people who cannot manage courses', async () => {
    await render(1, false);
    expect(button(el(), 'Delete')).toBeUndefined();
    expect(el().querySelector('a[href="/learning/courses/1/edit"]')).toBeNull();
    expect(button(el(), 'Assign employees')).toBeTruthy();
  });

  it('should explain when the course does not exist', async () => {
    await render(404);
    expect(el().textContent).toContain('Course not found');
  });

  describe('for a learner', () => {
    it('should show only their own progress, with no assigning', async () => {
      await render(1, false, false, 2);
      expect(el().textContent).toContain('Your progress');
      expect(rows().map((r) => r.querySelector('.person a')!.textContent!.trim())).toEqual(['Grace Hopper']);
      expect(button(el(), 'Assign employees')).toBeUndefined();
      expect(button(rows()[0], 'Unenroll')).toBeUndefined();
    });

    it('should let them log their own progress', async () => {
      await render(1, false, false, 2);
      button(rows()[0], 'Log module').click();
      expect(mocks.enrollmentService.setCompletedModules).toHaveBeenCalledWith(2, 2);
    });

    it('should keep the course summary company-wide', async () => {
      await render(1, false, false, 2);
      expect(el().querySelector('.details-list')!.textContent).toContain('3');
    });

    it('should say so when they are not enrolled', async () => {
      await render(1, false, false, 99);
      expect(el().textContent).toContain("You aren't enrolled in this course.");
    });
  });
});
