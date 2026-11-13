export const TIME_OFF_TYPES = ['Vacation', 'Sick Leave', 'Maternity Leave', 'Paternity Leave', 'Other'] as const;
export const TIME_OFF_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

export type TimeOffRequest = {
    id: number;
    employeeId: number;
    startDate: string;
    endDate: string;
    type: (typeof TIME_OFF_TYPES)[number];
    status: (typeof TIME_OFF_STATUSES)[number];
    comment?: string;
};