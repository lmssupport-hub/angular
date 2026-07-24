import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;                          // 'New Instruction' | 'Reminder Notification'
  status: 'Unread' | 'Read';
  relatedType: 'PROJECT' | 'TASK' | 'MEETING' | 'INSTRUCTION' | 'ERROR' | null;
  relatedId: number | null;
  createdAt: string;
}

export interface UnreadCount {
  unreadCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private apiUrl = 'https://nexus-backend-uoox.onrender.com/api/notifications';

  // Call notifyChanged() right after any action that creates/touches a
  // notification (e.g. task/meeting/instruction assign success) to make
  // the bell refresh instantly instead of waiting for the next poll.
  private refreshSubject = new Subject<void>();
  refresh$ = this.refreshSubject.asObservable();

  constructor(private http: HttpClient) {}

  notifyChanged(): void {
    this.refreshSubject.next();
  }

  getMyNotifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(this.apiUrl);
  }

  getUnreadCount(): Observable<UnreadCount> {
    return this.http.get<UnreadCount>(`${this.apiUrl}/unread-count`);
  }

  markAsRead(id: number): Observable<NotificationItem> {
    return this.http.put<NotificationItem>(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<string> {
    return this.http.put(`${this.apiUrl}/read-all`, {}, { responseType: 'text' });
  }
}