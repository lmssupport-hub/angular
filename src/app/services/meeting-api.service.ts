import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MemberInfo {
  id: number;
  username: string;
  email: string;
}

export interface MeetingDTO {
  id?: number;
  title: string;
  meetingDateTime: string;
  agenda: string;
  decisionsPolls?: string;
  status: string;
  ownerId: number;
  projectId?: number | null;
  memberIds: number[];
  documentUrls?: string[];
  actionItems?: string[];
  ownerName?: string;
  projectName?: string;
  members?: MemberInfo[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingFilterParams {
  search?: string;
  status?: string;
  ownerId?: number;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MeetingApiService {

  private readonly base = 'https://nexus-backend-uoox.onrender.com/api/meetings';

  constructor(private http: HttpClient) {}  // PLATFORM_ID & AuthService no longer needed

  // ── READ ───────────────────────────────────────────────────────

  getAll(filters?: MeetingFilterParams): Observable<MeetingDTO[]> {
    let params = new HttpParams();
    if (filters?.search)  params = params.set('search',  filters.search);
    if (filters?.status)  params = params.set('status',  filters.status);
    if (filters?.ownerId) params = params.set('ownerId', String(filters.ownerId));
    return this.http.get<MeetingDTO[]>(this.base, { params });
  }

  getById(id: number): Observable<MeetingDTO> {
    return this.http.get<MeetingDTO>(`${this.base}/${id}`);
  }

  // ── CREATE (multipart) ─────────────────────────────────────────

  create(dto: MeetingDTO, files?: File[]): Observable<MeetingDTO> {
    return this.http.post<MeetingDTO>(this.base, this.buildFormData(dto, files));
  }

  // ── UPDATE (multipart) ─────────────────────────────────────────

  update(id: number, dto: MeetingDTO, files?: File[]): Observable<MeetingDTO> {
    return this.http.put<MeetingDTO>(`${this.base}/${id}`, this.buildFormData(dto, files));
  }

  // ── START ──────────────────────────────────────────────────────

  startMeeting(id: number): Observable<MeetingDTO> {
    return this.http.patch<MeetingDTO>(`${this.base}/${id}/start`, {});
  }

  // ── DELETE ─────────────────────────────────────────────────────

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  // ── HELPER ─────────────────────────────────────────────────────

  private buildFormData(dto: MeetingDTO, files?: File[]): FormData {
    const form = new FormData();
    form.append('dto', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    files?.forEach(f => form.append('files', f, f.name));
    return form;
  }
}