import { Injectable } from '@angular/core';
import { NEVER, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Notification } from '../infrastructure/types/notification';
import { demoNotificationFeed } from '../demo/demo-notifications';

@Injectable({
    providedIn: 'root',
})
export class SocketService {
    // No notifications server exists yet. The demo simulates one; otherwise
    // the stream stays silent until a real socket is wired in here.
    notifications$: Observable<Notification[]> = environment.demo ? demoNotificationFeed() : NEVER;
}
