import { ApplicationConfig, APP_INITIALIZER, Injectable, inject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { RouterStateSnapshot, TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IMAGE_LOADER } from '@angular/common';

import { routes } from './app.routes';
import { addApiUrl } from './shared/interceptors/api-url.interceptor';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { employeePermissionsInterceptor } from './shared/interceptors/employee-permissions.interceptor';
import { AuthService } from './services/auth.service';
import { TruncateLimit } from './shared/directives/truncate.directive';
import { ImageLoaderConfig } from '@angular/common';
import { environment } from 'src/environments/environment';
import { demoBackendInterceptor } from './demo/demo-backend';

export const imageLoader = (config: ImageLoaderConfig) => {
  return config.loaderParams?.['src'];
}

/** Sets the document title to "<route title> · HRMS". */
@Injectable({ providedIn: 'root' })
export class HrmsTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot) {
    const pageTitle = this.buildTitle(snapshot);
    this.title.setTitle(pageTitle ? `${pageTitle} · HRMS` : 'HRMS');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        addApiUrl,
        authInterceptor,
        employeePermissionsInterceptor,
        // Last, so the interceptors above still see every request and response.
        ...(environment.demo ? [demoBackendInterceptor] : []),
      ]),
    ),
    { provide: TitleStrategy, useClass: HrmsTitleStrategy },
    { provide: TruncateLimit, useValue: 70 },
    {
      provide: IMAGE_LOADER,
      useValue: imageLoader,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const authService = inject(AuthService);
        return () => authService.restoreSession();
      },
      multi: true,
    },
  ],
};
