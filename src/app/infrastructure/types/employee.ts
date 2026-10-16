export type Employee = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    position: 'Developer' | 'Designer' | 'QA' | 'Manager';
    level: 'Junior' | 'Middle' | 'Senior' | 'Lead';
    isAvailable: boolean;
    profilePicture: string;
    /** ISO date they joined. */
    startDate?: string;
    location?: string;
    /** Who they report to; null when cleared. */
    managerId?: number | null;
    /** Private: only HR and the person themselves see these. */
    phone?: string;
    personalEmail?: string;
};

/** Fields only HR (EditEmployeePrivateDetails) may change. */
export const PRIVATE_EMPLOYEE_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'personalEmail'] as const;

export const LOCATIONS = ['London', 'Lisbon', 'Berlin', 'Remote'] as const;
