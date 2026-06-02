import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ProjectPayload = {
  projectName: string;
  projectDescription: string;
  projectReceivedDate: string;
  startDate: string;
  dueDate: string;
  assignedUsers: string[];
  formulaRows: {
    parameter1: string;
    value1: number;
    operator: string;
    parameter2: string;
    value2: number;
    extraFields: {
      type: 'parameter' | 'operator';
      parameter: string;
      operator: string;
      value: number | null;
    }[];
  }[];
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  apiUrl = 'https://nexus-backend-uoox.onrender.com/api';
  usersUrl = `${this.apiUrl}/users`;
  projectsUrl = `${this.apiUrl}/projects`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('accessToken');

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  registerUser(data: unknown): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/register`, data);
  }

  loginUser(data: unknown): Observable<unknown> {
    return this.http.post(`${this.usersUrl}/login`, data);
  }

  createProject(data: ProjectPayload): Observable<unknown> {
    return this.http.post(this.projectsUrl, data, {
      headers: this.getAuthHeaders(),
    });
  }

  getProjects(): Observable<unknown> {
    return this.http.get(this.projectsUrl, {
      headers: this.getAuthHeaders(),
    });
  }
}