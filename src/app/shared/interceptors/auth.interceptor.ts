import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('fit_token');
  const router = inject(Router);
  const auth = inject(AuthService);

  if (!req.url.startsWith('http')) {
    return next(req);
  }

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError(err => {
      if (err?.status === 401 || err?.status === 403) {
        auth.clearSession();
        router.navigate(['/login'], { replaceUrl: true });
      }
      return throwError(() => err);
    })
  );
};
