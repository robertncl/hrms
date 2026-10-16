import { FormControl } from '@angular/forms';

export type EmployeeForm = {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  position: FormControl<string>;
  level: FormControl<string>;
  startDate: FormControl<string>;
  location: FormControl<string>;
  managerId: FormControl<number | null>;
  phone: FormControl<string>;
  personalEmail: FormControl<string>;
};
