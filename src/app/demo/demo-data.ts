import { Candidate } from '../infrastructure/types/candidate';
import { Employee } from '../infrastructure/types/employee';
import { Permissions } from '../infrastructure/types/permissions';
import { Project } from '../infrastructure/types/project';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { User } from '../infrastructure/types/user';

export type DemoAccount = User & {
    password: string;
    permissions: Partial<Record<Permissions, boolean>>;
};

export type DemoDatabase = {
    users: DemoAccount[];
    employees: Employee[];
    projects: Project[];
    candidates: Candidate[];
    'time-off-requests': TimeOffRequest[];
};

const ALL_PERMISSIONS: Record<Permissions, boolean> = {
    ViewEmployees: true,
    EditEmployeeGeneralDetails: true,
    EditEmployeePrivateDetails: true,
    DeleteEmployee: true,
    CreateEmployee: true,
};

export const DEMO_PASSWORD = 'demo';

export const DEMO_ACCOUNTS: DemoAccount[] = [
    {
        name: 'Alex Morgan',
        email: 'admin@acme.com',
        role: 'HR Administrator',
        password: DEMO_PASSWORD,
        permissions: ALL_PERMISSIONS,
    },
    {
        name: 'Sam Rivera',
        email: 'lead@acme.com',
        role: 'Team Lead',
        password: DEMO_PASSWORD,
        permissions: { ...ALL_PERMISSIONS, EditEmployeePrivateDetails: false },
    },
];

/** Company email from a person's name, e.g. "James O'Connor" -> james.oconnor@acme.com. */
export function workEmail(firstName: string, lastName: string): string {
    const slug = (part: string) => part.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase();
    return `${slug(firstName)}.${slug(lastName)}@acme.com`;
}

/** ISO date (yyyy-mm-dd) `offset` days from today, so the demo always looks current. */
export function daysFromToday(offset: number, today = new Date()): string {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

const employee = (
    id: number,
    firstName: string,
    lastName: string,
    position: Employee['position'],
    level: Employee['level'],
    isAvailable = true,
): Employee => ({
    id,
    firstName,
    lastName,
    email: workEmail(firstName, lastName),
    position,
    level,
    isAvailable,
    profilePicture: '',
});

export function createDemoDatabase(today = new Date()): DemoDatabase {
    const day = (offset: number) => daysFromToday(offset, today);

    return {
        users: DEMO_ACCOUNTS.map(account => ({ ...account })),
        employees: [
            employee(1, 'Olivia', 'Bennett', 'Manager', 'Lead'),
            employee(2, 'Liam', 'Chen', 'Developer', 'Senior'),
            employee(3, 'Ava', 'Patel', 'Designer', 'Senior'),
            employee(4, 'Noah', 'Kowalski', 'Developer', 'Middle', false),
            employee(5, 'Mia', 'Okafor', 'QA', 'Senior'),
            employee(6, 'Ethan', 'Novak', 'Developer', 'Junior'),
            employee(7, 'Sophia', 'Lindqvist', 'Manager', 'Senior'),
            employee(8, 'Lucas', 'Moreau', 'Developer', 'Lead'),
            employee(9, 'Isabella', 'Rossi', 'Designer', 'Middle', false),
            employee(10, 'Mason', 'Tanaka', 'QA', 'Middle'),
            employee(11, 'Amelia', 'García', 'Developer', 'Senior'),
            employee(12, 'Elijah', 'Schmidt', 'Developer', 'Middle'),
            employee(13, 'Harper', 'Nguyen', 'Designer', 'Junior'),
            employee(14, 'James', "O'Connor", 'QA', 'Junior'),
            employee(15, 'Charlotte', 'Dubois', 'Developer', 'Junior'),
            employee(16, 'Benjamin', 'Haddad', 'Developer', 'Senior', false),
            employee(17, 'Evelyn', 'Kim', 'Manager', 'Middle'),
            employee(18, 'Henry', 'Silva', 'Developer', 'Middle'),
        ],
        projects: [
            {
                id: 1,
                name: 'Dark Side of the Moon',
                description:
                    'Self-service analytics platform that surfaces workforce trends — attrition, ' +
                    'hiring velocity and engagement — for every team lead.',
                image: 'assets/images/dark-side-of-the-moon.jpg',
                employees: [1, 2, 3, 6, 10],
                subProjectIds: [5],
            },
            {
                id: 2,
                name: 'Golden Gate',
                description:
                    'Integration gateway that connects payroll, benefits and identity providers ' +
                    'through one audited API.',
                image: 'assets/images/golden-gate-bridge.jpg',
                employees: [7, 8, 11, 14],
                subProjectIds: [],
            },
            {
                id: 3,
                name: 'Hadron',
                description:
                    'High-throughput event pipeline that processes time tracking and access logs ' +
                    'in near real time.',
                image: 'assets/images/hadron-collider.jpg',
                employees: [4, 12, 15, 16, 5],
                subProjectIds: [],
            },
            {
                id: 4,
                name: 'The Wall',
                description:
                    'Company-wide security hardening: single sign-on, device posture checks and ' +
                    'role-based access reviews.',
                image: 'assets/images/the-wall.avif',
                employees: [17, 18, 9, 13],
                subProjectIds: [6],
            },
            {
                id: 5,
                name: 'Moon Lander',
                description: 'Executive dashboards and scheduled reports built on the analytics platform.',
                image: 'assets/images/dark-side-of-the-moon.jpg',
                employees: [2, 3],
                subProjectIds: [],
            },
            {
                id: 6,
                name: 'Brick by Brick',
                description: 'Quarterly access reviews and automated offboarding checklists.',
                image: 'assets/images/the-wall.avif',
                employees: [18, 13],
                subProjectIds: [],
            },
        ],
        candidates: [
            { id: 1, firstName: 'Zoe', lastName: 'Martins', email: 'zoe.martins@mail.demo', position: 'Developer', level: 'Senior', status: 'CV evaluation', offerAccepted: false, appliedAt: day(-2) },
            { id: 2, firstName: 'Daniel', lastName: 'Ivanov', email: 'daniel.ivanov@mail.demo', position: 'QA', level: 'Middle', status: 'CV evaluation', offerAccepted: false, appliedAt: day(-1) },
            { id: 3, firstName: 'Priya', lastName: 'Raman', email: 'priya.raman@mail.demo', position: 'Designer', level: 'Middle', status: 'CV evaluation', offerAccepted: false, appliedAt: day(-4) },
            { id: 4, firstName: 'Marcus', lastName: 'Webb', email: 'marcus.webb@mail.demo', position: 'Developer', level: 'Middle', status: 'Interview preparation', offerAccepted: false, appliedAt: day(-9) },
            { id: 5, firstName: 'Leila', lastName: 'Haddad', email: 'leila.haddad@mail.demo', position: 'Manager', level: 'Senior', status: 'Interview preparation', offerAccepted: false, appliedAt: day(-11) },
            { id: 6, firstName: 'Tomás', lastName: 'Herrera', email: 'tomas.herrera@mail.demo', position: 'Developer', level: 'Junior', status: 'Interview Feedback', offerAccepted: false, appliedAt: day(-15), interviewDate: day(-2), interviewerId: 8 },
            { id: 7, firstName: 'Hannah', lastName: 'Becker', email: 'hannah.becker@mail.demo', position: 'QA', level: 'Senior', status: 'Interview Feedback', offerAccepted: false, appliedAt: day(-18), interviewDate: day(-3), interviewerId: 5 },
            { id: 8, firstName: 'Kenji', lastName: 'Watanabe', email: 'kenji.watanabe@mail.demo', position: 'Developer', level: 'Senior', status: 'Approved', offerAccepted: false, appliedAt: day(-25), interviewDate: day(-10), interviewerId: 2, rating: 5, feedback: 'Excellent system design round; strong mentoring instincts.' },
            { id: 9, firstName: 'Nora', lastName: 'Fitzgerald', email: 'nora.fitzgerald@mail.demo', position: 'Designer', level: 'Junior', status: 'Approved', offerAccepted: true, appliedAt: day(-30), interviewDate: day(-14), interviewerId: 3, rating: 4, feedback: 'Thoughtful portfolio, great accessibility awareness.' },
            { id: 10, firstName: 'Omar', lastName: 'Saleh', email: 'omar.saleh@mail.demo', position: 'Developer', level: 'Middle', status: 'Rejected', offerAccepted: false, appliedAt: day(-20), interviewDate: day(-8), interviewerId: 11, rating: 2, feedback: 'Struggled with the debugging exercise.' },
        ],
        'time-off-requests': [
            { id: 1, employeeId: 4, startDate: day(-3), endDate: day(4), type: 'Vacation', status: 'Approved', comment: 'Family trip to Lisbon' },
            { id: 2, employeeId: 9, startDate: day(-1), endDate: day(1), type: 'Sick Leave', status: 'Approved', comment: 'Flu' },
            { id: 3, employeeId: 16, startDate: day(-20), endDate: day(70), type: 'Paternity Leave', status: 'Approved' },
            { id: 4, employeeId: 2, startDate: day(6), endDate: day(10), type: 'Vacation', status: 'Pending', comment: 'Hiking week' },
            { id: 5, employeeId: 11, startDate: day(12), endDate: day(12), type: 'Other', status: 'Pending', comment: 'Moving house' },
            { id: 6, employeeId: 13, startDate: day(3), endDate: day(5), type: 'Vacation', status: 'Pending' },
            { id: 7, employeeId: 5, startDate: day(20), endDate: day(30), type: 'Vacation', status: 'Pending', comment: 'Wedding and honeymoon' },
            { id: 8, employeeId: 18, startDate: day(8), endDate: day(9), type: 'Other', status: 'Rejected', comment: 'Conference — overlaps release' },
            { id: 9, employeeId: 6, startDate: day(-14), endDate: day(-10), type: 'Vacation', status: 'Approved' },
            { id: 10, employeeId: 10, startDate: day(-7), endDate: day(-7), type: 'Sick Leave', status: 'Approved' },
            { id: 11, employeeId: 7, startDate: day(15), endDate: day(19), type: 'Vacation', status: 'Approved', comment: 'Ski trip' },
            { id: 12, employeeId: 17, startDate: day(40), endDate: day(130), type: 'Maternity Leave', status: 'Pending' },
        ],
    };
}
