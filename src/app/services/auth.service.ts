import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Category } from '../dashboard/create-package/create-package';

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

// NEW — resolved permission set for the logged-in user
export interface EffectivePermissions {
  roleType: string;
  fullAccess: boolean;
  permissions: Category[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
private apiUrl   = 'https://nexus-backend-uoox.onrender.com/api';
  private usersUrl = `${this.apiUrl}/users`;
  private permissionsUrl = `${this.apiUrl}/permissions`; // NEW

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
    localStorage.removeItem('userPermissions'); // NEW
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

  // ── NEW: Effective permissions (fetch after login / on app init) ──────
  getMyPermissions(): Observable<EffectivePermissions> {
    return this.http.get<EffectivePermissions>(`${this.permissionsUrl}/me`);
  }

  setStoredPermissions(perms: EffectivePermissions): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem('userPermissions', JSON.stringify(perms));
  }

  getStoredPermissions(): EffectivePermissions | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem('userPermissions');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EffectivePermissions;
    } catch {
      return null;
    }
  }

  isSuperAdmin(): boolean {
    return this.getStoredPermissions()?.fullAccess === true || this.getCurrentUserRole() === 'SUPER_ADMIN';
  }

  // Use this to gate a create/edit/delete button or a route
  hasFeatureAccess(featureId: string, action: 'create' | 'read' | 'update' | 'delete' = 'read'): boolean {
    if (this.isSuperAdmin()) return true;
    const perms = this.getStoredPermissions();
    if (!perms) return false;
    for (const cat of perms.permissions) {
      const feature = cat.features.find(f => f.id === featureId);
      if (feature) return !!feature.permissions[action];
    }
    return false;
  }

  // Use this to show/hide a whole sidebar section/category
  hasCategoryAccess(categoryId: string): boolean {
    if (this.isSuperAdmin()) return true;
    const perms = this.getStoredPermissions();
    return !!perms?.permissions.find(c => c.id === categoryId && c.enabled);
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