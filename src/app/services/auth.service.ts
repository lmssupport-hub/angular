import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface AppUser {
  id:       number;
  username: string;
  email:    string;
  active:   boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl   = 'https://nexus-backend-uoox.onrender.com/api';
  private usersUrl = `${this.apiUrl}/users`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  // ── Token helpers ─────────────────────────────────────────────────

  isAuthenticated(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() < payload.exp * 1000;
    } catch {
      return false;
    }
  }

  logout(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUser');
  }

  // ── Auth ──────────────────────────────────────────────────────────

  registerUser(data: unknown): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/register`, data);
  }

  loginUser(data: unknown): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/login`, data);
  }

  getUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.usersUrl);  // interceptor adds token
  }

  // ── Forgot Password ───────────────────────────────────────────────

  forgotPassword(data: { email: string }): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/forgot-password`, data);
  }

  verifyOtp(data: { email: string; otp: string }): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/verify-otp`, data);
  }

  resetPassword(data: { resetToken: string; newPassword: string; confirmPassword: string }): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/reset-password`, data);
  }
}