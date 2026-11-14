import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { LeaveBalance } from '../shared/functions/leave';

@Injectable({ providedIn: 'root' })
export class LeaveBalanceService {
  private readonly http = inject(HttpClient);

  /** One person's balances for the current leave year. */
  getBalances(employeeId: number) {
    return this.http.get<LeaveBalance[]>(`/leave-balances?employeeId=${employeeId}`);
  }

  /** Balances for everyone the signed-in person may see: themselves and their scope. */
  getVisibleBalances() {
    return this.http.get<LeaveBalance[]>('/leave-balances');
  }
}
