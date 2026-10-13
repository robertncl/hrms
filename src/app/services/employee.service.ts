import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Employee } from '../infrastructure/types/employee';

export type NewEmployee = Omit<Employee, 'id' | 'isAvailable' | 'profilePicture'> & {
    profilePicture?: string;
};

@Injectable({providedIn: 'root'})
export class EmployeeService {
    private readonly http = inject(HttpClient);

    getEmployees() {
        return this.http.get<Employee[]>('/employees');
    }

    getEmployee(id: number) {
        return this.http.get<Employee>(`/employees/${id}`);
    }

    createEmployee(employee: NewEmployee) {
        return this.http.post<Employee>('/employees', employee);
    }

    updateEmployee(id: number, changes: Partial<Employee>) {
        return this.http.patch<Employee>(`/employees/${id}`, changes);
    }

    deleteEmployee(id: number) {
        return this.http.delete(`/employees/${id}`);
    }
}
