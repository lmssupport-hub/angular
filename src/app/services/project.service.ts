import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
export class ProjectService {
  private apiUrl      = 'https://nexus-backend-uoox.onrender.com/api';
  private projectsUrl = `${this.apiUrl}/projects`;

  constructor(private http: HttpClient) {}  // AuthService no longer needed

  // ── Projects ──────────────────────────────────────────────────────

  createProject(data: ProjectPayload): Observable<Project> {
    return this.http.post<Project>(this.projectsUrl, data);
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.projectsUrl);
  }

  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.projectsUrl}/${id}`);
  }

  updateProject(id: number, data: ProjectPayload): Observable<Project> {
    return this.http.put<Project>(`${this.projectsUrl}/${id}`, data);
  }

  deleteProject(id: number): Observable<string> {
    return this.http.delete(`${this.projectsUrl}/${id}`, {
      responseType: 'text',
    });
  }
}