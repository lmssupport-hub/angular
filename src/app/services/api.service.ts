import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export type ExtraField = {
  type: 'parameter' | 'operator';
  parameter: string;
  operator: string;
  value: number | null;
};

export type FormulaRow = {
  parameter1: string;
  value1: number;
  operator: string;
  parameter2: string;
  value2: number;
  extraFields: ExtraField[];
};

export type ProjectPayload = {
  projectName: string;
  projectDescription: string;
  projectReceivedDate: string;
  startDate: string;
  dueDate: string;
  assignedUsers: string[];
  formulaRows: FormulaRow[];
};

export type Project = ProjectPayload & {
  id: number;
  target: number;
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = 'https://nexus-backend-uoox.onrender.com/api';
  private usersUrl = `${this.apiUrl}/users`;
  private projectsUrl = `${this.apiUrl}/projects`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object   
  ) {}

  private getAuthHeaders(): HttpHeaders {
    if (!isPlatformBrowser(this.platformId)) return new HttpHeaders(); 
    const token = localStorage.getItem('token');
    if (!token) return new HttpHeaders();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
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

  // ── Projects ──────────────────────────────────────────────────────

  createProject(data: ProjectPayload): Observable<Project> {
    return this.http.post<Project>(this.projectsUrl, data, {
      headers: this.getAuthHeaders(),
    });
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.projectsUrl, {
      headers: this.getAuthHeaders(),
    });
  }

  // ✅ NEW
  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.projectsUrl}/${id}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // ✅ NEW
  updateProject(id: number, data: ProjectPayload): Observable<Project> {
    return this.http.put<Project>(`${this.projectsUrl}/${id}`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteProject(id: number): Observable<string> {
  return this.http.delete(`${this.projectsUrl}/${id}`, {
    headers: this.getAuthHeaders(),
    responseType: 'text',
  });
}

}