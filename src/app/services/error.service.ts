import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Types ──────────────────────────────────────────────────────────────────

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type ErrorStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface ErrorReportDTO {
  id?: number;
  projectId: number;
  projectName?: string;
  taskId: number;
  taskName?: string;
  pageTitle: string;
  errorDescription: string;
  expectedResult: string;
  priority: Priority | string;
  screenshotUrl?: string | null;
  screenshotName?: string | null;
  assignedUserId?: number;
  assignedUserName?: string;
  status: ErrorStatus | string;
  comments?: string | null;
  createdDate?: string;
  updatedAt?: string;
  version?: number;
}

export interface ErrorFilterParams {
  keyword?: string;
  status?: string;
  priority?: string;
  assignedUserId?: number;
  projectId?: number;
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ErrorReportApiService {

  private readonly base = 'https://nexus-backend-uoox.onrender.com/api/errors';

  constructor(private http: HttpClient) {}

  // ── Field 1 & 2: Search + Filter ──
  getAll(filters?: ErrorFilterParams): Observable<ErrorReportDTO[]> {
    let params = new HttpParams();
    if (filters?.keyword) params = params.set('keyword', filters.keyword);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.assignedUserId) params = params.set('assignedUserId', String(filters.assignedUserId));
    if (filters?.projectId) params = params.set('projectId', String(filters.projectId));
    return this.http.get<ErrorReportDTO[]>(this.base, { params });
  }

  // ── Field 13: Show More ──
  getById(id: number): Observable<ErrorReportDTO> {
    return this.http.get<ErrorReportDTO>(`${this.base}/${id}`);
  }

  // ── Field 14: Create Error ──
  create(dto: Omit<ErrorReportDTO, 'id'>, screenshot?: File | null): Observable<ErrorReportDTO> {
    return this.http.post<ErrorReportDTO>(this.base, this.buildFormData(dto, screenshot));
  }

  // ── Field 15: Update Error ──
  update(id: number, dto: ErrorReportDTO, screenshot?: File | null): Observable<ErrorReportDTO> {
    return this.http.put<ErrorReportDTO>(`${this.base}/${id}`, this.buildFormData(dto, screenshot));
  }

  // ── Field 11: Quick status update ──
  updateStatus(id: number, status: string, version: number): Observable<ErrorReportDTO> {
    return this.http.patch<ErrorReportDTO>(`${this.base}/${id}/status`, { status, version });
  }

  // ── Field 14 (S#14): Delete ──
  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  screenshotUrl(id: number): string {
    return `${this.base}/${id}/screenshot`;
  }

  private buildFormData(dto: unknown, screenshot?: File | null): FormData {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    if (screenshot) form.append('screenshot', screenshot, screenshot.name);
    return form;
  }
}