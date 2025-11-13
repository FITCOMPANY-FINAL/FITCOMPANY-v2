import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Evita que un usuario autenticado entre a /login.
 */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    // Ya logueado: lo mandamos al dashboard
    router.navigate(['/dashboard'], { replaceUrl: true });
    return false;
  }
  return true;
};
