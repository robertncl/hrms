import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CourseFormComponent } from './course-form.component';
import { LearningMocks, createLearningMocks, provideLearningTesting, testCourses } from 'src/testing/learning.mock';

describe('CourseFormComponent', () => {
  let fixture: ComponentFixture<CourseFormComponent>;
  let component: CourseFormComponent;
  let mocks: LearningMocks;
  let navigateSpy: jasmine.Spy;

  const render = (id?: string) => {
    mocks = createLearningMocks();
    TestBed.configureTestingModule({ providers: provideLearningTesting(mocks) });
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CourseFormComponent);
    component = fixture.componentInstance;
    if (id !== undefined) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const fill = () => {
    component.form.patchValue({ title: '  New course ', description: 'About it', durationHours: 2 });
    component.form.controls.modules.at(0).setValue(' First ');
  };

  it('should start as an empty create form with one module', () => {
    render();
    expect(el().querySelector('h1')!.textContent).toContain('New course');
    expect(component.form.controls.modules.length).toBe(1);
    expect(component.form.valid).toBeFalse();
  });

  it('should show errors instead of saving an invalid course', () => {
    render();
    component.submit();
    fixture.detectChanges();

    expect(mocks.courseService.createCourse).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Give the course a title.');
    expect(el().textContent).toContain('Every module needs a title.');
  });

  it('should add and remove modules, keeping at least one', () => {
    render();
    (Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Add module')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.module-row').length).toBe(2);

    (el().querySelector('.module-row button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('.module-row').length).toBe(1);
    expect((el().querySelector('.module-row button') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('should reject durations out of range', () => {
    render();
    component.form.controls.durationHours.setValue(0);
    expect(component.form.controls.durationHours.hasError('min')).toBeTrue();
    component.form.controls.durationHours.setValue(500);
    expect(component.form.controls.durationHours.hasError('max')).toBeTrue();
  });

  it('should create a trimmed course and open it', () => {
    render();
    fill();
    (el().querySelector('button[type="submit"]') as HTMLButtonElement).click();

    expect(mocks.courseService.createCourse).toHaveBeenCalledWith({
      title: 'New course',
      category: 'Technical',
      format: 'Self-paced',
      durationHours: 2,
      description: 'About it',
      mandatory: false,
      modules: ['First'],
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/learning/courses', 9]);
  });

  it('should load an existing course for editing and save the changes', async () => {
    render('2');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mocks.courseService.getCourse).toHaveBeenCalledWith(2);
    expect(el().querySelector('h1')!.textContent).toContain('Edit course');
    expect(component.form.value.title).toBe(testCourses[1].title);
    expect(el().querySelectorAll('.module-row').length).toBe(testCourses[1].modules.length);

    component.form.controls.mandatory.setValue(true);
    component.submit();
    expect(mocks.courseService.updateCourse).toHaveBeenCalledWith(2, jasmine.objectContaining({ mandatory: true, modules: testCourses[1].modules }));
    expect(navigateSpy).toHaveBeenCalledWith(['/learning/courses', 2]);
  });

  it('should say so when the course to edit is missing', async () => {
    render('404');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el().textContent).toContain('This course no longer exists.');
  });
});
