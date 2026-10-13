import { Observable, concat, interval, map, of } from 'rxjs';
import { Notification } from '../infrastructure/types/notification';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** Notifications already waiting for the user when the demo starts. Fixed ids keep read state across reloads. */
export function demoNotificationBacklog(): Notification[] {
    return [
        { id: 1, title: 'Time off request', message: 'Liam Chen requested 5 days of vacation.', type: 'TimeOff', read: false, date: hoursAgo(1) },
        { id: 2, title: 'Birthday today', message: 'Wish Mia Okafor a happy birthday!', type: 'Birthday', read: false, date: hoursAgo(3) },
        { id: 3, title: 'Interview tomorrow', message: 'Hannah Becker — QA, Senior — at 10:00.', type: 'Other', read: false, date: hoursAgo(20) },
        { id: 4, title: 'Scheduled maintenance', message: 'HRMS will be read-only on Saturday 02:00–03:00 UTC.', type: 'Maintenance', read: true, date: hoursAgo(48) },
    ];
}

const LIVE_TEMPLATES: Omit<Notification, 'id' | 'read' | 'date'>[] = [
    { title: 'New application', message: 'A new candidate applied for Developer, Middle.', type: 'Other' },
    { title: 'Time off request', message: 'Amelia García requested a day off.', type: 'TimeOff' },
    { title: 'Work anniversary', message: 'Lucas Moreau celebrates 5 years with the company.', type: 'Birthday' },
];

/** Simulates a notifications socket: the backlog on connect, then a new notification every `periodMs`. */
export function demoNotificationFeed(periodMs = 60_000): Observable<Notification[]> {
    return concat(
        of(demoNotificationBacklog()),
        interval(periodMs).pipe(
            map(tick => [{
                ...LIVE_TEMPLATES[tick % LIVE_TEMPLATES.length],
                id: Date.now(),
                read: false,
                date: new Date().toISOString(),
            }]),
        ),
    );
}
