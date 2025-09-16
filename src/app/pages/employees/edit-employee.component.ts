import { Component, inject, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';
import { PermissionsService } from 'src/app/services/permissions.service';

@Component({
  selector: 'app-edit-employee',
  template: `<h2>Edit Employee</h2>`,
  standalone: true,
})
export class EditEmployeeComponent implements OnInit {
  permissionsService = inject(PermissionsService);
  destroyRef = inject(DestroyRef);
  route = inject(ActivatedRoute);
  form = new FormGroup<EmployeeForm>({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    lastName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    position: new FormControl('', { nonNullable: true }),
    level: new FormControl('', { nonNullable: true }),
  });

  ngOnInit() {
    const employee = this.route.snapshot.data['employee'] as Employee;
    this.form.patchValue(employee);
    this.permissionsService.hasPermission('EditEmployeePrivateDetails').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(hasPermission => {
      if (!hasPermission) {
        this.form.controls.firstName.disable();
        this.form.controls.lastName.disable();
        this.form.controls.email.disable();
      } else {
        this.form.controls.firstName.enable();
        this.form.controls.lastName.enable();
        this.form.controls.email.enable();
      }
    });
  }
}
