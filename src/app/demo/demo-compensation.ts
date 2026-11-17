import { Employee } from '../infrastructure/types/employee';
import { PayBand, PayChangeReason, SalaryChange, SharePrice, StockGrant } from '../infrastructure/types/compensation';
import { addMonths, firstOfNextMonth, parseIso, toIsoDate } from '../shared/functions/dates';
import { DEFAULT_CLIFF_MONTHS, DEFAULT_VESTING_MONTHS, OPTION_TERM_YEARS, sharePriceOn } from '../shared/functions/equity';
import { currencyFor } from '../shared/functions/pay';

type Position = Employee['position'];
type Level = Employee['level'];

/** Yearly salary ranges in pounds, [min, max], by role and level. */
const GBP_BANDS: Record<Position, Record<Level, [number, number]>> = {
    Developer: { Junior: [38_000, 52_000], Middle: [52_000, 70_000], Senior: [70_000, 95_000], Lead: [90_000, 120_000] },
    Designer: { Junior: [34_000, 46_000], Middle: [46_000, 62_000], Senior: [60_000, 82_000], Lead: [78_000, 100_000] },
    QA: { Junior: [32_000, 44_000], Middle: [44_000, 58_000], Senior: [56_000, 74_000], Lead: [70_000, 90_000] },
    Manager: { Junior: [50_000, 65_000], Middle: [65_000, 85_000], Senior: [85_000, 110_000], Lead: [105_000, 140_000] },
};

/** Euro bands follow the pound ones, converted and rounded to the nearest thousand. */
const EUR_PER_GBP = 1.05;

export function createPayBands(): PayBand[] {
    const bands: PayBand[] = [];
    for (const currency of ['GBP', 'EUR'] as const) {
        for (const [position, levels] of Object.entries(GBP_BANDS) as [Position, Record<Level, [number, number]>][]) {
            for (const [level, [min, max]] of Object.entries(levels) as [Level, [number, number]][]) {
                const convert = (amount: number) =>
                    currency === 'GBP' ? amount : Math.round((amount * EUR_PER_GBP) / 1000) * 1000;
                bands.push({ id: bands.length + 1, position, level, currency, min: convert(min), max: convert(max) });
            }
        }
    }
    return bands;
}

/**
 * Today's salary per person, in their pay currency, and what their last
 * annual review was for. Lucas and Mia in Lisbon sit below their bands and
 * Benjamin above his, so the overview has something to flag.
 */
const CURRENT_PAY: Record<number, { salary: number; lastReview?: { reason: PayChangeReason; rate: number } }> = {
    1: { salary: 128_000 },
    2: { salary: 84_000, lastReview: { reason: 'Market adjustment', rate: 0.07 } },
    3: { salary: 74_000 },
    4: { salary: 61_000 },
    5: { salary: 52_000 },
    6: { salary: 44_000 },
    7: { salary: 102_000 },
    8: { salary: 88_000, lastReview: { reason: 'Promotion', rate: 0.12 } },
    9: { salary: 52_000 },
    10: { salary: 50_000 },
    11: { salary: 76_000 },
    12: { salary: 66_000 },
    13: { salary: 38_000 },
    14: { salary: 35_000 },
    15: { salary: 42_000 },
    16: { salary: 97_000 },
    17: { salary: 78_000, lastReview: { reason: 'Promotion', rate: 0.1 } },
    18: { salary: 57_000 },
};

/** Valuations, in USD, from the founding round to the latest one. */
const VALUATIONS: { daysAgo: number; price: number; note: string }[] = [
    { daysAgo: 2400, price: 0.85, note: 'Founding valuation' },
    { daysAgo: 1460, price: 1.8, note: 'Seed round' },
    { daysAgo: 730, price: 4.2, note: 'Series A' },
    { daysAgo: 365, price: 6.8, note: 'Annual valuation' },
    { daysAgo: 90, price: 9.4, note: 'Series B' },
];

/** Grants by person: shares, kind, how long ago (default: when they joined), and options already exercised. */
const GRANTS: { employeeId: number; shares: number; kind?: StockGrant['kind']; daysAgo?: number; exercised?: number; note?: string }[] = [
    { employeeId: 1, shares: 40_000 },
    { employeeId: 1, shares: 8_000, kind: 'RSUs', daysAgo: 200, note: 'Refresher grant' },
    { employeeId: 2, shares: 12_000 },
    { employeeId: 3, shares: 10_000 },
    { employeeId: 4, shares: 6_000 },
    { employeeId: 5, shares: 10_000, exercised: 3_000 },
    { employeeId: 7, shares: 30_000, exercised: 10_000 },
    { employeeId: 8, shares: 15_000 },
    { employeeId: 11, shares: 8_000 },
    { employeeId: 12, shares: 5_000 },
    { employeeId: 13, shares: 3_000 },
    { employeeId: 15, shares: 2_000, kind: 'RSUs' },
    { employeeId: 16, shares: 12_000, exercised: 6_000 },
    { employeeId: 17, shares: 9_000 },
];

const HR = 'Alex Morgan';
const round500 = (amount: number) => Math.round(amount / 500) * 500;

export type CompensationData = {
    'pay-bands': PayBand[];
    'salary-changes': SalaryChange[];
    'stock-grants': StockGrant[];
    'share-prices': SharePrice[];
};

export function createCompensationData(employees: Employee[], today = new Date()): CompensationData {
    const iso = (daysAgo: number) => toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo));
    const todayIso = iso(0);

    const prices: SharePrice[] = VALUATIONS.map((v, i) => ({ id: i + 1, effectiveDate: iso(v.daysAgo), pricePerShare: v.price, note: v.note }));

    // Salaries: a hire record, then up to three annual reviews on 1 April,
    // worked backwards from today's pay.
    const changes: SalaryChange[] = [];
    const add = (change: Omit<SalaryChange, 'id'>) => changes.push({ id: changes.length + 1, ...change });
    for (const person of employees) {
        const pay = CURRENT_PAY[person.id];
        if (!pay || !person.startDate) continue;
        const currency = currencyFor(person.location);
        const start = parseIso(person.startDate);
        const reviews: string[] = [];
        for (let year = start.getFullYear() + 1; year <= today.getFullYear(); year++) {
            const review = `${year}-04-01`;
            const sixMonthsIn = addMonths(person.startDate, 6);
            if (review >= sixMonthsIn && review <= todayIso) reviews.push(review);
        }
        const kept = reviews.slice(-3);
        // Salaries before each review, newest first.
        let salary = pay.salary;
        const steps: { date: string; salary: number; reason: PayChangeReason }[] = [];
        for (let i = kept.length - 1; i >= 0; i--) {
            const special = i === kept.length - 1 ? pay.lastReview : undefined;
            steps.unshift({ date: kept[i], salary, reason: special?.reason ?? 'Merit increase' });
            salary = round500(salary / (1 + (special?.rate ?? 0.04)));
        }
        add({
            employeeId: person.id, effectiveDate: person.startDate, baseSalary: salary, currency, reason: 'New hire',
            status: 'Approved', proposedBy: HR, proposedAt: person.startDate, decidedBy: HR, decidedAt: person.startDate,
        });
        for (const step of steps) {
            add({
                employeeId: person.id, effectiveDate: step.date, baseSalary: step.salary, currency, reason: step.reason,
                status: 'Approved', proposedBy: HR, proposedAt: step.date, decidedBy: HR, decidedAt: step.date,
            });
        }
    }

    // Waiting on HR: Olivia's market adjustment for Liam and Sophia's for Mia.
    // Olivia's earlier request for Ethan was declined.
    const nextMonth = firstOfNextMonth(todayIso);
    const has = (id: number) => employees.some(e => e.id === id);
    if (has(2)) {
        add({
            employeeId: 2, effectiveDate: nextMonth, baseSalary: 90_000, currency: 'GBP', reason: 'Market adjustment', status: 'Pending',
            note: 'Two competing offers this quarter; this brings him to the band midpoint.', proposedBy: 'Olivia Bennett', proposedAt: iso(3),
        });
    }
    if (has(5)) {
        add({
            employeeId: 5, effectiveDate: nextMonth, baseSalary: 60_000, currency: 'EUR', reason: 'Market adjustment', status: 'Pending',
            note: 'Below the band since moving to Lisbon.', proposedBy: 'Sophia Lindqvist', proposedAt: iso(6),
        });
    }
    if (has(6)) {
        add({
            employeeId: 6, effectiveDate: firstOfNextMonth(iso(40)), baseSalary: 50_000, currency: 'EUR', reason: 'Promotion', status: 'Rejected',
            note: 'Ready for Middle.', proposedBy: 'Olivia Bennett', proposedAt: iso(45), decidedBy: HR, decidedAt: iso(38),
        });
    }

    const grants: StockGrant[] = [];
    for (const g of GRANTS) {
        const person = employees.find(e => e.id === g.employeeId);
        if (!person?.startDate) continue;
        const grantDate = g.daysAgo === undefined ? person.startDate : iso(g.daysAgo);
        const kind = g.kind ?? 'Stock options';
        grants.push({
            id: grants.length + 1,
            employeeId: g.employeeId,
            kind,
            grantDate,
            shares: g.shares,
            ...(kind === 'Stock options'
                ? {
                    strikePrice: sharePriceOn(prices, grantDate)?.pricePerShare ?? 0.85,
                    expirationDate: addMonths(grantDate, OPTION_TERM_YEARS * 12),
                }
                : {}),
            vestingStart: grantDate,
            vestingMonths: DEFAULT_VESTING_MONTHS,
            cliffMonths: g.kind === 'RSUs' && g.daysAgo !== undefined ? 0 : DEFAULT_CLIFF_MONTHS,
            exercisedShares: g.exercised ?? 0,
            ...(g.note ? { note: g.note } : {}),
        });
    }

    return { 'pay-bands': createPayBands(), 'salary-changes': changes, 'stock-grants': grants, 'share-prices': prices };
}
