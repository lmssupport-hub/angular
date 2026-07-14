import { Component, OnInit, signal, HostListener, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser }      from '@angular/common';
import { FormsModule }       from '@angular/forms';

import { MeetingApiService, MeetingDTO, MemberInfo } from '../../services/meeting-api.service';
import { ProjectService, Project } from '../../services/project.service';
import { AppUser } from '../../services/auth.service';
import { CreateMeetingModalComponent,UserOption,ProjectOption,} from '../../../PopUp/create-meeting-modal/create-meeting-modal';

// ── Inline-row edit form ───────────────────────────────────────────────────────

interface RowEditForm {
  title: string;
  date: string;        // YYYY-MM-DD (required format for <input type="date">)
  time: string;        // HH:MM, 24-hour (required format for <input type="time">)
  agenda: string;
  decisionsPolls: string;
  status: string;
  projectId: number | null;
  memberIds: number[];
}

interface RowErrors {
  title?: string;
  date?: string;
  time?: string;
  agenda?: string;
  members?: string;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function isoToDateParts(iso: string): { date: string; time: string; amPm: 'AM' | 'PM' } {
  const dt   = new Date(iso);
  const yyyy = dt.getFullYear();
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const dd   = String(dt.getDate()).padStart(2, '0');
  const h24  = dt.getHours();
  const min  = String(dt.getMinutes()).padStart(2, '0');
  const amPm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  return {
    date: `${yyyy}-${mm}-${dd}`,                   // matches <input type="date">
    time: `${String(h24).padStart(2, '0')}:${min}`, // matches <input type="time"> (24h)
    amPm,
  };
}

function parseDateTimeISO(date: string, time: string): Date | null {
  const dp = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tp = time.match(/^(\d{2}):(\d{2})$/);
  if (!dp || !tp) return null;
  const h = parseInt(tp[1], 10);
  const m = parseInt(tp[2], 10);
  return new Date(parseInt(dp[1], 10), parseInt(dp[2], 10) - 1, parseInt(dp[3], 10), h, m);
}

// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector:    'app-meeting-workspace',
  standalone:  true,
  imports:     [CommonModule, FormsModule, CreateMeetingModalComponent],
  templateUrl: './meeting-workspace.html',
  styleUrl:    './meeting-workspace.css',
})
export class MeetingWorkspace implements OnInit {

  // ── State ──────────────────────────────────────────────────────
  meetings:    MeetingDTO[]    = [];
  users:       UserOption[]    = [];
  projects:    ProjectOption[] = [];

  isLoading  = false;
  errorMsg   = '';

viewMode = signal<'grid' | 'list'>('grid');

  

  // ── Create-modal ───────────────────────────────────────────────
  
  isCreateMeetingOpen = signal(false);

  // ── Expanded row ───────────────────────────────────────────────
  expandedRowId: number | null = null;
  rowForms:   Map<number, RowEditForm>   = new Map();
  rowErrors:  Map<number, RowErrors>     = new Map();

  // ── Search & filter ────────────────────────────────────────────
  searchKeyword  = '';
  filterStatus   = '';
  filterOwnerId: number | null = null;
  isFilterOpen   = signal(false);

  // ── Delete confirm ─────────────────────────────────────────────
  deleteConfirmId: number | null = null;

  readonly statusOptions = ['Scheduled', 'In Progress', 'Completed', 'Expiry'];
  readonly maxTitle    = 200;
  readonly maxAgenda   = 2000;
  readonly maxDecisions = 1000;

constructor(
  private meetingApi: MeetingApiService,
  private projectService: ProjectService,
  private elRef: ElementRef,
  @Inject(PLATFORM_ID) private platformId: object,
) {}

  private openMemberDropdowns = new Set<number>();

  toggleMemberDropdown(meetingId: number) {
    if (this.openMemberDropdowns.has(meetingId)) {
      this.openMemberDropdowns.delete(meetingId);
    } else {
      this.openMemberDropdowns.add(meetingId);
    }
  }

  isMemberDropdownOpen(meetingId: number): boolean {
    return this.openMemberDropdowns.has(meetingId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.member-dropdown-wrapper')) {
      this.openMemberDropdowns.clear();
    }
    if (!target.closest('.filter-wrapper')) {
      this.isFilterOpen.set(false);
    }
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadAll();
  }

  setViewMode(mode: 'grid' | 'list'): void {
  console.log('setViewMode called with:', mode, 'current viewMode:', this.viewMode());
  this.viewMode.set(mode);
  console.log('after set, viewMode is:', this.viewMode());
}

getProjectName(id: number | null | undefined): string {
  return this.projects.find(p => p.id === id)?.projectName ?? '—';
}

  private loadAll(): void {
    this.isLoading = true;
    this.errorMsg  = '';

    // ── TEMPORARY: hardcoded members instead of API ──────────────
    this.users = [
      { id: 1, username: 'Member 1', email: 'member1@example.com' },
      { id: 2, username: 'Member 2', email: 'member2@example.com' },
      { id: 3, username: 'Member 3', email: 'member3@example.com' },
    ];
    // ─────────────────────────────────────────────────────────────

    this.projectService.getProjects().subscribe({
      next: (projects: Project[]) => {
        this.projects = projects.map(p => ({ id: p.id, projectName: p.projectName }));
      },
      error: (err: unknown) => {
        console.error('Failed to load projects', err);
      },
    });

    this.meetingApi.getAll().subscribe({
      next: (meetings: MeetingDTO[]) => {
        this.meetings  = meetings;
        this.isLoading = false;
      },
      error: (err: unknown) => {
        this.isLoading = false;
        console.error('Failed to load meetings', err);
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403) {
          this.errorMsg = 'Meetings are unavailable right now (403). Other data has still loaded.';
        } else {
          this.errorMsg = 'Failed to load meetings. Please try again.';
        }
      },
    });
  }

  // ── Search & filter ────────────────────────────────────────────

  onSearch(): void {
    this.meetingApi.getAll({
      search:  this.searchKeyword || undefined,
      status:  this.filterStatus  || undefined,
      ownerId: this.filterOwnerId ?? undefined,
    }).subscribe((m: MeetingDTO[]) => this.meetings = m);
  }

  toggleFilter(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.isFilterOpen.update(open => !open);
  }

  applyFilter(): void {
    this.isFilterOpen.set(false);
    this.onSearch();
  }

  clearFilter(): void {
    this.filterStatus = '';
    this.filterOwnerId = null;
    this.isFilterOpen.set(false);
    this.onSearch();
  }

  // ── Expanded row ───────────────────────────────────────────────

  toggleRow(meeting: MeetingDTO): void {
    const id = meeting.id!;
    if (this.expandedRowId === id) {
      this.expandedRowId = null;
      return;
    }
    this.expandedRowId = id;
    // Build the edit form for this row
    const parts = isoToDateParts(meeting.meetingDateTime);
    this.rowForms.set(id, {
      title:          meeting.title,
      date:           parts.date,
      time:           parts.time,
      agenda:         meeting.agenda,
      decisionsPolls: meeting.decisionsPolls ?? '',
      status:         meeting.status,
      projectId:      meeting.projectId ?? null,
      memberIds:      [...(meeting.memberIds ?? [])],
    });
    this.rowErrors.set(id, {});
  }

  isExpanded(id: number): boolean {
    return this.expandedRowId === id;
  }

  getRowForm(id: number): RowEditForm {
    return this.rowForms.get(id)!;
  }

  getRowErrors(id: number): RowErrors {
    return this.rowErrors.get(id) ?? {};
  }

  // ── Row member multi-select ────────────────────────────────────

  isRowMemberSelected(meetingId: number, userId: number): boolean {
    return this.getRowForm(meetingId)?.memberIds.includes(userId) ?? false;
  }

  toggleRowMember(meetingId: number, userId: number): void {
    const form = this.getRowForm(meetingId);
    const idx  = form.memberIds.indexOf(userId);
    form.memberIds = idx === -1
      ? [...form.memberIds, userId]
      : form.memberIds.filter(m => m !== userId);
  }

  removeRowMember(meetingId: number, userId: number): void {
    const form = this.getRowForm(meetingId);
    form.memberIds = form.memberIds.filter(m => m !== userId);
  }

  getMemberName(id: number): string {
    return this.users.find(u => u.id === id)?.username ?? String(id);
  }

  // ── Row validation ─────────────────────────────────────────────

  private validateRow(id: number): boolean {
    const form   = this.getRowForm(id);
    const errors: RowErrors = {};

    if (!form.title.trim())
      errors['title'] = 'Meeting title is required';
    else if (form.title.length > this.maxTitle)
      errors['title'] = `Max ${this.maxTitle} characters`;

    if (!form.date) {
      errors['date'] = 'Date is required';
    }
    if (!form.time) {
      errors['time'] = 'Time is required';
    }
    if (form.date && form.time) {
      const dt = parseDateTimeISO(form.date, form.time);
      if (!dt) {
        errors['date'] = 'Invalid format';
        errors['time'] = 'Invalid format';
      } else if (dt <= new Date()) {
        errors['date'] = 'Must be a future date';
      }
    }

    if (!form.agenda.trim())
      errors['agenda'] = 'Agenda is required';
    else if (form.agenda.length > this.maxAgenda)
      errors['agenda'] = `Max ${this.maxAgenda} characters`;

    if (!form.memberIds.length)
      errors['members'] = 'At least one member is required';

    this.rowErrors.set(id, errors);
    return Object.keys(errors).length === 0;
  }

  // ── Row update ─────────────────────────────────────────────────

  updateMeeting(meeting: MeetingDTO): void {
  const id   = meeting.id!;
  if (!this.validateRow(id)) return;

  const form = this.getRowForm(id);
  const dt   = parseDateTimeISO(form.date, form.time)!;

  const dto: MeetingDTO = {
    ...meeting,
    title:           form.title.trim(),
    meetingDateTime: this.toLocalDateTimeString(dt),   // ← changed
    agenda:          form.agenda.trim(),
    decisionsPolls:  form.decisionsPolls.trim() || undefined,
    status:          form.status,
    projectId:       form.projectId ?? undefined,
    memberIds:       form.memberIds,
  };

  this.meetingApi.update(id, dto).subscribe({
    next: (updated: MeetingDTO) => {
      const idx = this.meetings.findIndex(m => m.id === id);
      if (idx !== -1) this.meetings[idx] = updated;
      this.expandedRowId = null;
    },
    error: (err: unknown) => {
      console.error('Update failed', err);
      this.errorMsg = 'Failed to update meeting.';
    },
  });
}



  // ── Start meeting ──────────────────────────────────────────────

  startMeeting(event: Event, meeting: MeetingDTO): void {
    event.stopPropagation();
    if (!meeting.id) return;
    this.meetingApi.startMeeting(meeting.id).subscribe({
      next: (updated: MeetingDTO) => {
        const idx = this.meetings.findIndex(m => m.id === meeting.id);
        if (idx !== -1) this.meetings[idx] = updated;
      },
      error: (err: unknown) => console.error('Start meeting failed', err),
    });
  }

  // ── Delete ─────────────────────────────────────────────────────

  requestDelete(event: Event, id: number): void {
    event.stopPropagation();
    this.deleteConfirmId = id;
  }

  confirmDelete(): void {
    if (this.deleteConfirmId == null) return;
    this.meetingApi.delete(this.deleteConfirmId).subscribe({
      next: () => {
        this.meetings      = this.meetings.filter(m => m.id !== this.deleteConfirmId);
        if (this.expandedRowId === this.deleteConfirmId) this.expandedRowId = null;
        this.deleteConfirmId = null;
      },
      error: (err: unknown) => {
        console.error('Delete failed', err);
        this.deleteConfirmId = null;
      },
    });
  }

  cancelDelete(): void { this.deleteConfirmId = null; }

  // ── Create modal ───────────────────────────────────────────────

  openCreateMeeting():  void { this.isCreateMeetingOpen.set(true); }
  closeCreateMeeting(): void { this.isCreateMeetingOpen.set(false); }

  handleMeetingCreated(payload: { dto: MeetingDTO; files: File[] }): void {
    this.meetingApi.create(payload.dto, payload.files).subscribe({
      next: (created: MeetingDTO) => {
        this.meetings = [created, ...this.meetings];
        this.closeCreateMeeting();
      },
      error: (err: unknown) => {
        console.error('Create failed', err);
        this.errorMsg = 'Failed to create meeting.';
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

formatDateTime(iso: string): { date: string; time: string } {
  const parts = isoToDateParts(iso);
  return { date: parts.date, time: `${parts.time} ${parts.amPm}` };
}

/** Formats a Date as yyyy-MM-ddTHH:mm:ss using LOCAL time (no UTC shift). */
private toLocalDateTimeString(dt: Date): string {
  const yyyy = dt.getFullYear();
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const dd   = String(dt.getDate()).padStart(2, '0');
  const hh   = String(dt.getHours()).padStart(2, '0');
  const min  = String(dt.getMinutes()).padStart(2, '0');
  const ss   = String(dt.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Scheduled':   return 'bg-blue-50 text-blue-600';
    case 'In Progress': return 'bg-yellow-50 text-yellow-600';
    case 'Completed':   return 'bg-green-50 text-green-600';
    default:            return 'bg-gray-50 text-gray-500';
  }
}

canStartMeeting(status: string): boolean {
  return status === 'Scheduled';
}

getMeetingMembers(meeting: MeetingDTO): MemberInfo[] {
  return (meeting.members ?? []).slice(0, 3);
}

getExtraMembers(meeting: MeetingDTO): number {
  return Math.max(0, (meeting.memberIds?.length ?? 0) - 3);
}
}
