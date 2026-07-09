import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category } from '../dashboard/create-package/create-package';

export interface AppPackage {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  assignedAdminCount?: number;
  permissions: Category[];
}

export interface PackageWithPermissionsRequest {
  name: string;
  permissions: Category[];
}

@Injectable({
  providedIn: 'root',
})
export class PackageService {
  private apiUrl = 'https://nexus-backend-uoox.onrender.com/api';
  private packagesUrl = `${this.apiUrl}/packages`;

  constructor(private http: HttpClient) {}

  getAllPackages(): Observable<AppPackage[]> {
    return this.http.get<AppPackage[]>(this.packagesUrl);
  }

  getPackageById(id: number): Observable<AppPackage> {
    return this.http.get<AppPackage>(`${this.packagesUrl}/${id}`);
  }

  createPackageWithPermissions(data: PackageWithPermissionsRequest): Observable<unknown> {
    return this.http.post(this.packagesUrl, data);
  }

  updatePackageWithPermissions(id: number, data: PackageWithPermissionsRequest): Observable<unknown> {
    return this.http.put(`${this.packagesUrl}/${id}`, data);
  }

  deletePackage(id: number): Observable<unknown> {
    return this.http.delete(`${this.packagesUrl}/${id}`);
  }

  // Used by the "Update package" modal to assign a package's permissions to a user
  assignPackage(packageId: number, userId: number): Observable<unknown> {
    return this.http.post(`${this.packagesUrl}/${packageId}/assign/${userId}`, {});
  }

  unassignPackage(userId: number): Observable<unknown> {
    return this.http.delete(`${this.packagesUrl}/assign/${userId}`);
  }

  getAssignedPackage(userId: number): Observable<AppPackage> {
    return this.http.get<AppPackage>(`${this.packagesUrl}/assign/${userId}`);
  }
}