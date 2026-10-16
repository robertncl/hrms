import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LearningOverviewComponent } from './learning-overview.component';
import { LearningMocks, createLearningMocks, provideLearningTesting } from 'src/testing/learning.mock';

describe('LearningOverviewComponent', () => {
  let fixture: ComponentFixture<LearningOverviewComponent>;
  let component: LearningOverviewComponent;
  let mocks: LearningMocks;

  const render = async (canManage = true) => {
    mocks = createLearningMocks();
    TestBed.configureTestingModule({ providers: provideLearningTesting(mocks, canManage) });
    fixture = TestBed.createComponent(LearningOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const courseTitles = () => Array.from(el().querySelectorAll('.course h3')).map((h) => h.textContent!.trim());

  it('should show the learning figures', async () => {
    await render();
    const stats = Array.from(el().querySelectorAll('.stat')).map((stat) => [
      stat.querySelector('.stat-label')!.textContent!.trim(),
      stat.querySelector('.stat-value')!.textContent!.trim(),
    ]);
    expect(stats).toEqual([
      ['Active assignments', '3'],
      ['Completion rate', '25%'],
      ['Overdue', '1'],
      ['Mandatory training', '33%'],
    ]);
  });

  it('should list overdue training with the employee and course', async () => {
    await render();
    const items = el().querySelectorAll('.list li');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('Grace Hopper');
    expect(items[0].textContent).toContain('Security Basics');
  });

  it('should chart completion only for courses with enrollments', async () => {
    await render();
    const labels = Array.from(el().querySelectorAll('app-bar-list .label')).map((l) => l.textContent!.trim());
    const values = Array.from(el().querySelectorAll('app-bar-list .value')).map((v) => v.textContent!.trim());
    expect(labels).toEqual(['Security Basics', 'Angular Workshop']);
    expect(values).toEqual(['33%', '0%']);
  });

  it('should list every course in the catalog with its enrollment count', async () => {
    await render();
    expect(courseTitles()).toEqual(['Security Basics', 'Angular Workshop', 'Leading Teams']);
    expect(el().querySelector('.course')!.textContent).toContain('3 enrolled');
    expect(el().querySelector('.course .badge')!.textContent).toContain('Mandatory');
  });

  it('should filter the catalog by search and category', async () => {
    await render();
    component.search.set('signals');
    fixture.detectChanges();
    expect(courseTitles()).toEqual(['Angular Workshop']);

    component.search.set('');
    component.categoryFilter.set('Leadership');
    fixture.detectChanges();
    expect(courseTitles()).toEqual(['Leading Teams']);
  });

  it('should take the category filter from the route', async () => {
    await render();
    fixture.componentRef.setInput('category', 'Compliance');
    fixture.detectChanges();
    expect(courseTitles()).toEqual(['Security Basics']);
  });

  it('should only offer "New course" to people who can manage courses', async () => {
    await render(true);
    expect(el().textContent).toContain('New course');
    TestBed.resetTestingModule();

    await render(false);
    expect(el().textContent).not.toContain('New course');
  });
});
