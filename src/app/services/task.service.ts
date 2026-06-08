import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Priority   = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface SubTaskItem {
  id?:          number;
  title:        string;
  description:  string;
  createdAt?:   string;
  updatedAt?:   string;
}

export interface TaskResponse {
  id?:               number;
  projectId:         number;
  taskName:          string;
  description:       string;
  targetCount:       number;
  achievedCount?:    number;   // actual completed units; optional until API supports it
  priority:          Priority;
  status:            TaskStatus;
  assignedUserId:    number;
  assignedUserName?: string;
  startDate:         string;
  dueDate:           string;
  subTasks?:         SubTaskItem[];
  createdAt?:        string;
  updatedAt?:        string;
}

export interface CreateTaskRequest {
  projectId:      number;
  taskName:       string;
  description:    string;
  targetCount:    number;
  priority:       Priority;
  status:         TaskStatus;
  assignedUserId: number;
  startDate:      string;
  dueDate:        string;
  subTasks:       { title: string; description: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly baseUrl = 'https://nexus-backend-uoox.onrender.com/api/tasks';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  private getHeaders(): HttpHeaders {
    if (!isPlatformBrowser(this.platformId)) return new HttpHeaders();
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  getTasksByProject(projectId: number): Observable<TaskResponse[]> {
    return this.http.get<TaskResponse[]>(`${this.baseUrl}?projectId=${projectId}`, {
      headers: this.getHeaders(),
    });
  }

  getTaskById(id: number): Observable<TaskResponse> {
    return this.http.get<TaskResponse>(`${this.baseUrl}/${id}`, {
      headers: this.getHeaders(),
    });
  }

  createTask(data: CreateTaskRequest): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(this.baseUrl, data, {
      headers: this.getHeaders(),
    });
  }

  updateTask(id: number, data: Partial<CreateTaskRequest>): Observable<TaskResponse> {
    return this.http.put<TaskResponse>(`${this.baseUrl}/${id}`, data, {
      headers: this.getHeaders(),
    });
  }

  deleteTask(id: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/${id}`, {
      headers: this.getHeaders(),
      responseType: 'text',
    });
  }
}