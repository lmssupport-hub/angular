import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface AppUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  assignedPackageId: number | null;
  assignedRoleId: number | null;   // custom role assigned to invited members
  createdByAdminId: number | null; // NEW — which admin invited this user (null for self-registered)
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

  // ── Current user / role ─────────────────────────────────────────
  getCurrentUser(): AppUser | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem('loggedInUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null;
    }
  }

  getCurrentUserRole(): string | null {
    return this.getCurrentUser()?.role ?? null;
  }

  // ── Auth ──────────────────────────────────────────────────────────

  // inviteToken is present when the user arrived via an admin's invite link
  // (?invite=... on /auth). The backend validates it, locks in createdByAdminId
  // and assignedRoleId on the new user, and marks the invite used.
  registerUser(data: unknown, inviteToken?: string | null): Observable<unknown> {
    const url = inviteToken
      ? `${this.usersUrl}/register?inviteToken=${encodeURIComponent(inviteToken)}`
      : `${this.usersUrl}/register`;
    return this.http.post(url, data);
  }

  loginUser(data: unknown): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/login`, data);
  }

  getUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.usersUrl);
  }

  deleteUser(id: number): Observable<unknown> {
    return this.http.delete(`${this.usersUrl}/${id}`);
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