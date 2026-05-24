import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-registration',
    template: `
        <div class="registration-container">
            <h1>Registration</h1>
            <form>
                <input type="text" name="email" placeholder="Email" [(ngModel)]="credentials.email">
                <input type="password" name="password" placeholder="Password" [(ngModel)]="credentials.password">
                <input type="password" name="confirmPassword" placeholder="Confirm Password" [(ngModel)]="credentials.confirmPassword">
                @if (passwordMismatch) {
                    <span class="error">Passwords do not match</span>
                }
                <button type="submit" (click)="submit()">Register</button>
            </form>
        </div>
    `,
    standalone: true,
    imports: [FormsModule],
})
export class RegistrationComponent {
    credentials = { email: '', password: '', confirmPassword: '' };

    get passwordMismatch(): boolean {
        return this.credentials.confirmPassword.length > 0 &&
            this.credentials.password !== this.credentials.confirmPassword;
    }

    submit() {
        if (this.credentials.email && this.credentials.password &&
            this.credentials.password === this.credentials.confirmPassword) {
            // TODO: call registration API
        }
    }
}