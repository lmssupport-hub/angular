import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  achievedCount?:    number;
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

  constructor(private http: HttpClient) {}  // PLATFORM_ID & headers no longer needed

  getTasksByProject(projectId: number): Observable<TaskResponse[]> {
    return this.http.get<TaskResponse[]>(`${this.baseUrl}?projectId=${projectId}`);
  }

  getTaskById(id: number): Observable<TaskResponse> {
    return this.http.get<TaskResponse>(`${this.baseUrl}/${id}`);
  }

  createTask(data: CreateTaskRequest): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(this.baseUrl, data);
  }

  updateTask(id: number, data: Partial<CreateTaskRequest>): Observable<TaskResponse> {
    return this.http.put<TaskResponse>(`${this.baseUrl}/${id}`, data);
  }

  deleteTask(id: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/${id}`, {
      responseType: 'text',
    });
  }
}