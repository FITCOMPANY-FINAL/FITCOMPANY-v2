import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TokenPayload } from '../models/usuario.model';

interface LoginRequest {
  correo: string;
  password: string;
}

interface LoginResponse {
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private TOKEN_KEY = 'fit_token';

  login(body: LoginRequest) {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/login`, body);
  }

  saveToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const t = this.getToken();
    if (!t) return false;
    const payload = this.decodePayload(t);
    if (!payload?.exp) return true; // si no viene exp, dejamos pasar
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp > nowSec;
  }

  getUserFromToken(): TokenPayload | null {
    const t = this.getToken();
    if (!t) return null;
    return this.decodePayload(t);
  }

  getFormulariosFromToken() {
    return this.getUserFromToken()?.formularios ?? [];
  }

  private decodePayload<T = TokenPayload>(jwt: string): T | null {
    try {
      const [, payloadB64] = jwt.split('.');
      const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
      return null;
    }
  }
}
