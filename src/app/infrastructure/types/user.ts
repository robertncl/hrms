export type User = {
    name: string;
    email: string;
    role: string;
    /** The signed-in person's own record in People, when they have one. */
    employeeId?: number;
};
