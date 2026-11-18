import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PayBand, SalaryChange, SharePrice, StockGrant } from '../infrastructure/types/compensation';

export type NewSalaryChange = Pick<SalaryChange, 'employeeId' | 'effectiveDate' | 'baseSalary' | 'currency' | 'reason'> & { note?: string };
export type NewStockGrant = Omit<StockGrant, 'id' | 'exercisedShares'>;

/**
 * Pay and equity. The API only returns the records the signed-in person may
 * see: their own, plus whoever they can see pay for.
 */
@Injectable({ providedIn: 'root' })
export class CompensationService {
  private readonly http = inject(HttpClient);

  getSalaryChanges(employeeId?: number) {
    return this.http.get<SalaryChange[]>(employeeId === undefined ? '/salary-changes' : `/salary-changes?employeeId=${employeeId}`);
  }

  /** Recorded at once for HR; a proposal waiting for HR from anyone else. */
  addSalaryChange(change: NewSalaryChange) {
    return this.http.post<SalaryChange>('/salary-changes', change);
  }

  decideSalaryChange(id: number, status: 'Approved' | 'Rejected') {
    return this.http.patch<SalaryChange>(`/salary-changes/${id}`, { status });
  }

  /** Withdraws a proposal, or removes a record (HR). */
  deleteSalaryChange(id: number) {
    return this.http.delete(`/salary-changes/${id}`);
  }

  getPayBands() {
    return this.http.get<PayBand[]>('/pay-bands');
  }

  updatePayBand(id: number, changes: Pick<PayBand, 'min' | 'max'>) {
    return this.http.patch<PayBand>(`/pay-bands/${id}`, changes);
  }

  getGrants(employeeId?: number) {
    return this.http.get<StockGrant[]>(employeeId === undefined ? '/stock-grants' : `/stock-grants?employeeId=${employeeId}`);
  }

  addGrant(grant: NewStockGrant) {
    return this.http.post<StockGrant>('/stock-grants', grant);
  }

  /** Sets how many of a grant's options have been bought in total. */
  recordExercise(id: number, exercisedShares: number) {
    return this.http.patch<StockGrant>(`/stock-grants/${id}`, { exercisedShares });
  }

  deleteGrant(id: number) {
    return this.http.delete(`/stock-grants/${id}`);
  }

  getSharePrices() {
    return this.http.get<SharePrice[]>('/share-prices');
  }

  addSharePrice(price: Omit<SharePrice, 'id'>) {
    return this.http.post<SharePrice>('/share-prices', price);
  }
}
