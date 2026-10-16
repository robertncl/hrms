import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Course, CourseCategory, CourseFormat } from 'src/app/infrastructure/types/course';
import { CourseService, NewCourse } from 'src/app/services/course.service';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { COURSE_CATEGORIES, COURSE_FORMATS } from './learning';

const moduleControl = (title = '') => new FormControl(title, { nonNullable: true, validators: [Validators.required] });

/** Creates a course, or edits one when the route has an `id`. */
@Component({
  selector: 'app-course-form',
  template: `
    <div class="page narrow">
      <div>
        <a class="back-link" [routerLink]="backLink()"><app-icon name="arrow-left" [size]="16" /> {{ isEdit() ? 'Course' : 'Learning' }}</a>
        <div class="page-header">
          <h1>{{ isEdit() ? 'Edit course' : 'New course' }}</h1>
        </div>
      </div>

      @if (state() === 'missing') {
        <p class="alert alert-error" role="alert">This course no longer exists.</p>
      } @else if (state() === 'loading') {
        <p class="loading">Loading course…</p>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="form-grid">
            <div class="field span-all">
              <label for="course-title">Title</label>
              <input id="course-title" type="text" formControlName="title" [attr.aria-invalid]="showError('title')"
                aria-describedby="course-title-error" />
              @if (showError('title')) {
                <span id="course-title-error" class="error-msg">Give the course a title.</span>
              }
            </div>
            <div class="field">
              <label for="course-category">Category</label>
              <select id="course-category" formControlName="category">
                @for (category of categories; track category) {
                  <option [value]="category">{{ category }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="course-format">Format</label>
              <select id="course-format" formControlName="format">
                @for (format of formats; track format) {
                  <option [value]="format">{{ format }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="course-duration">Duration (hours)</label>
              <input id="course-duration" type="number" min="0.25" max="200" step="0.25" formControlName="durationHours"
                [attr.aria-invalid]="showError('durationHours')" aria-describedby="course-duration-error" />
              @if (showError('durationHours')) {
                <span id="course-duration-error" class="error-msg">Enter between 0.25 and 200 hours.</span>
              }
            </div>
            <div class="field span-all">
              <label for="course-description">Description</label>
              <textarea id="course-description" rows="3" formControlName="description"
                [attr.aria-invalid]="showError('description')" aria-describedby="course-description-error"></textarea>
              @if (showError('description')) {
                <span id="course-description-error" class="error-msg">Describe what people will learn.</span>
              }
            </div>
            <div class="field span-all">
              <label class="check">
                <input type="checkbox" formControlName="mandatory" aria-describedby="course-mandatory-hint" />
                Mandatory for everyone
              </label>
              <span id="course-mandatory-hint" class="hint">
                New hires are enrolled automatically, with 30 days to complete it.
              </span>
            </div>
          </div>

          <fieldset class="modules">
            <legend>Modules</legend>
            @for (module of form.controls.modules.controls; track module; let i = $index) {
              <div class="module-row">
                <label class="visually-hidden" [for]="'course-module-' + i">Module {{ i + 1 }}</label>
                <span class="module-number" aria-hidden="true">{{ i + 1 }}</span>
                <input [id]="'course-module-' + i" type="text" [formControl]="module" placeholder="Module title"
                  [attr.aria-invalid]="module.touched && module.invalid" />
                <button class="btn btn-sm btn-ghost" type="button" [disabled]="form.controls.modules.length === 1"
                  (click)="removeModule(i)">
                  Remove<span class="visually-hidden"> module {{ i + 1 }}</span>
                </button>
              </div>
            }
            @if (modulesInvalid()) {
              <span class="error-msg">Every module needs a title.</span>
            }
            <div>
              <button class="btn btn-sm" type="button" (click)="addModule()"><app-icon name="plus" [size]="16" /> Add module</button>
            </div>
          </fieldset>

          @if (error()) {
            <p class="alert alert-error" role="alert">{{ error() }}</p>
          }
          <div class="form-actions">
            <a class="btn" [routerLink]="backLink()">Cancel</a>
            <button class="btn btn-primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Saving…' : isEdit() ? 'Save changes' : 'Create course' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 760px; }
    .check { display: flex; align-items: center; gap: 0.55rem; font-weight: 550; }
    .check input { width: 1.05rem; height: 1.05rem; }
    .modules {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.5rem;
      margin: 1.25rem 0 0;
      padding: 0.9rem 1rem;
      border: 1px solid var(--acme-color-border);
      border-radius: var(--acme-radius-md);
    }
    .modules legend { padding: 0 0.35rem; font-size: 0.88rem; font-weight: 600; }
    .module-row { display: flex; align-items: center; gap: 0.5rem; }
    .module-number {
      flex: none;
      width: 1.5rem;
      text-align: center;
      color: var(--acme-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .module-row input {
      flex: 1;
      min-width: 0;
      min-height: 2.25rem;
      padding: 0.4rem 0.65rem;
      border: 1px solid var(--acme-color-border-strong);
      border-radius: var(--acme-radius-md);
      background: var(--acme-color-surface);
      color: var(--acme-color-text);
      font: inherit;
    }
    .module-row input[aria-invalid='true'] { border-color: var(--acme-color-danger); }
    .error-msg { font-size: 0.82rem; color: var(--acme-color-danger); }
  `,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
})
export class CourseFormComponent implements OnInit {
  private readonly courseService = inject(CourseService);
  private readonly router = inject(Router);

  /** Route parameter; absent when creating a course. */
  id = input<string | undefined>(undefined);
  readonly categories = COURSE_CATEGORIES;
  readonly formats = COURSE_FORMATS;

  state = signal<'loading' | 'ready' | 'missing'>('ready');
  saving = signal(false);
  error = signal('');

  form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    category: new FormControl<CourseCategory>('Technical', { nonNullable: true }),
    format: new FormControl<CourseFormat>('Self-paced', { nonNullable: true }),
    durationHours: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.25), Validators.max(200)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    mandatory: new FormControl(false, { nonNullable: true }),
    modules: new FormArray([moduleControl()]),
  });

  isEdit() {
    return this.id() !== undefined;
  }

  backLink() {
    return this.isEdit() ? ['/learning/courses', this.id()] : ['/learning'];
  }

  ngOnInit() {
    const id = this.id();
    if (id === undefined) return;
    this.state.set('loading');
    this.courseService.getCourse(Number(id)).subscribe({
      next: (course) => {
        this.load(course);
        this.state.set('ready');
      },
      error: () => this.state.set('missing'),
    });
  }

  showError(name: 'title' | 'durationHours' | 'description') {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  modulesInvalid() {
    return this.form.controls.modules.controls.some((c) => c.touched && c.invalid);
  }

  addModule() {
    this.form.controls.modules.push(moduleControl());
  }

  removeModule(index: number) {
    this.form.controls.modules.removeAt(index);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const course: NewCourse = {
      ...value,
      title: value.title.trim(),
      description: value.description.trim(),
      modules: value.modules.map((m) => m.trim()),
    };
    const id = this.id();
    this.saving.set(true);
    this.error.set('');
    const request = id === undefined
      ? this.courseService.createCourse(course)
      : this.courseService.updateCourse(Number(id), course);
    request.subscribe({
      next: (saved) => this.router.navigate(['/learning/courses', saved.id]),
      error: () => {
        this.saving.set(false);
        this.error.set('The course could not be saved. Please try again.');
      },
    });
  }

  private load(course: Course) {
    const modules = this.form.controls.modules;
    modules.clear();
    for (const title of course.modules.length ? course.modules : ['']) {
      modules.push(moduleControl(title));
    }
    this.form.patchValue({
      title: course.title,
      category: course.category,
      format: course.format,
      durationHours: course.durationHours,
      description: course.description,
      mandatory: course.mandatory,
    });
  }
}
