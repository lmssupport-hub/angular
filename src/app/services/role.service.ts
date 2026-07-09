import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../dashboard/create-package/create-package';

export interface AppRole {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  permissions: Category[];
}

export interface RoleWithPermissionsRequest {
  name: string;
  permissions: Category[];
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private apiUrl = 'https://nexus-backend-uoox.onrender.com/api';
  private rolesUrl = `${this.apiUrl}/roles`;

  constructor(private http: HttpClient) {}

  getAssignedFeatures(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.rolesUrl}/assigned-features`);
  }

  getMyRoles(): Observable<AppRole[]> {
    return this.http.get<AppRole[]>(this.rolesUrl);
  }

  getRoleById(id: number): Observable<AppRole> {
    return this.http.get<AppRole>(`${this.rolesUrl}/${id}`);
  }

  createRole(data: RoleWithPermissionsRequest): Observable<unknown> {
    return this.http.post(this.rolesUrl, data);
  }

  updateRole(id: number, data: RoleWithPermissionsRequest): Observable<unknown> {
    return this.http.put(`${this.rolesUrl}/${id}`, data);
  }

  deleteRole(id: number): Observable<unknown> {
    return this.http.delete(`${this.rolesUrl}/${id}`);
  }

  assignRole(roleId: number, userId: number): Observable<unknown> {
    return this.http.post(`${this.rolesUrl}/${roleId}/assign/${userId}`, {});
  }
}