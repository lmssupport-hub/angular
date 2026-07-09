import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InviteInfo {
  email: string;
  roleName: string | null;
}

@Injectable({ providedIn: 'root' })
export class InviteService {
  private apiUrl = 'https://nexus-backend-uoox.onrender.com/api';
  private invitesUrl = `${this.apiUrl}/invites`;

  constructor(private http: HttpClient) {}

  // Admin: "Invite peoples" → Send Invite
  sendInvite(data: { email: string; roleId: number | null }): Observable<unknown> {
    return this.http.post(this.invitesUrl, data);
  }

  // Register page: called with the ?invite=token from the email link.
  // No auth header — the invited user isn't logged in yet.
  getInvite(token: string): Observable<InviteInfo> {
    return this.http.get<InviteInfo>(`${this.invitesUrl}/${token}`);
  }
}