import {
  Component, EventEmitter, Input, OnInit, Output, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MeetingDTO } from '../../app/services/meeting-api.service';

export interface UserOption  { id: number; username: string; email: string; }
export interface ProjectOption { id: number; projectName: string; }

// ── Default empty form ─────────────────────────────────────────────────────────

export function emptyForm(): CreateMeetingForm {
  return {
    title: '',
    date: '',
    time: '',
    agenda: '',
    decisionsPolls: '',
    status: 'Scheduled',
    projectId: null,
    memberIds: [],
    polls: [{ question: '' }],
  };
}

export interface CreateMeetingForm {
  title: string;
  date: string;          // DD/MM/YYYY
  time: string;          // HH:MM
  agenda: string;
  decisionsPolls: string;
  status: string;
  projectId: number | null;
  memberIds: number[];
  polls: { question: string }[];
}

// ── Validation ─────────────────────────────────────────────────────────────────

export interface FormErrors {
  title?: string;
  dateTime?: string;
  agenda?: string;
  members?: string;
  status?: string;
  documents?: string;
}

function parseDateTimeISO(date: string, time: string): Date | null {
  const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = time.match(/^(\d{2}):(\d{2})$/);
  if (!dateParts || !timeParts) return null;

  const hours   = parseInt(timeParts[1], 10);
  const minutes = parseInt(timeParts[2], 10);

  return new Date(
    parseInt(dateParts[1], 10),
    parseInt(dateParts[2], 10) - 1,
    parseInt(dateParts[3], 10),
    hours,
    minutes
  );
}

const MAX_FILE_MB   = 10;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];


// ── Component ──────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-create-meeting-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-meeting-modal.html',
  styleUrl: './create-meeting-modal.css',
})
export class CreateMeetingModalComponent implements OnInit {
  @Input()  isOpen   = false;
  @Input()  users:    UserOption[]    = [];
  @Input()  projects: ProjectOption[] = [];
  @Output() closed  = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ dto: MeetingDTO; files: File[] }>();

  form: CreateMeetingForm = emptyForm();
  errors: FormErrors = {};
  selectedFiles: File[] = [];

  currentStep = signal<number>(1);
stepOneErrors: FormErrors = {};

  readonly statusOptions = ['Scheduled', 'In Progress', 'Completed', 'Expiry'];
  readonly maxAgenda = 2000;
  readonly maxDecisions = 1000;
  readonly maxTitle = 200;

  
  isMembersDropdownOpen = signal(false);

  ngOnInit(): void {}



  // ── Step control ───────────────────────────────────────────────

/** Validates only Step 1 fields (title, members) */
private validateStepOne(): boolean {
  this.stepOneErrors = {};

  if (!this.form.title.trim())
    this.stepOneErrors['title'] = 'Meeting title is required';
  else if (this.form.title.length > this.maxTitle)
    this.stepOneErrors['title'] = `Max ${this.maxTitle} characters`;

  if (!this.form.memberIds.length)
    this.stepOneErrors['members'] = 'At least one member is required';

  return Object.keys(this.stepOneErrors).length === 0;
}

goNext(): void {
  if (this.validateStepOne()) {
    this.currentStep.set(2);
  }
}

goBack(): void {
  this.currentStep.set(1);
}

  // ── Member multi-select ────────────────────────────────────────

  toggleMembersDropdown(): void {
    this.isMembersDropdownOpen.set(!this.isMembersDropdownOpen());
  }

  closeMembersDropdown(): void {
    this.isMembersDropdownOpen.set(false);
  }

  isMemberSelected(id: number): boolean {
    return this.form.memberIds.includes(id);
  }

  toggleMember(id: number): void {
    const idx = this.form.memberIds.indexOf(id);
    if (idx === -1) {
      this.form.memberIds = [...this.form.memberIds, id];
    } else {
      this.form.memberIds = this.form.memberIds.filter(m => m !== id);
    }
    if (this.errors['members']) delete this.errors['members'];
  }

  removeMember(id: number): void {
    this.form.memberIds = this.form.memberIds.filter(m => m !== id);
  }

  getMemberName(id: number): string {
    return this.users.find(u => u.id === id)?.username ?? String(id);
  }

  // ── Polls ──────────────────────────────────────────────────────

  addPollQuestion(): void {
    this.form.polls.push({ question: '' });
  }

  removePoll(index: number): void {
    this.form.polls.splice(index, 1);
  }

  // ── Files ──────────────────────────────────────────────────────

  triggerFileInput(el: HTMLInputElement): void { el.click(); }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const invalid: string[] = [];
    Array.from(input.files).forEach(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        invalid.push(`${f.name}: invalid format`);
        return;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        invalid.push(`${f.name}: exceeds 10 MB`);
        return;
      }
      this.selectedFiles.push(f);
    });
    if (invalid.length) {
      this.errors['documents'] = invalid.join(', ');
    } else {
      delete this.errors['documents'];
    }
    input.value = '';
  }

  removeFile(i: number): void {
    this.selectedFiles.splice(i, 1);
    if (!this.selectedFiles.length) delete this.errors['documents'];
  }

  // ── Validation ─────────────────────────────────────────────────

  private validate(): boolean {
    this.errors = {};
    if (!this.form.title.trim())
      this.errors['title'] = 'Meeting title is required';
    else if (this.form.title.length > this.maxTitle)
      this.errors['title'] = `Max ${this.maxTitle} characters`;

          if (!this.form.date || !this.form.time) {
        this.errors['dateTime'] = 'Meeting date and time is required';
      } else {
        const dt = parseDateTimeISO(this.form.date, this.form.time);
        if (!dt) {
          this.errors['dateTime'] = 'Invalid date or time';
        } else if (dt <= new Date()) {
          this.errors['dateTime'] = 'Meeting date and time must be in the future';
        }
      }

    if (!this.form.agenda.trim())
      this.errors['agenda'] = 'Agenda is required';
    else if (this.form.agenda.length > this.maxAgenda)
      this.errors['agenda'] = `Max ${this.maxAgenda} characters`;

    if (!this.form.memberIds.length)
      this.errors['members'] = 'At least one member is required';

    if (!this.form.status)
      this.errors['status'] = 'Meeting status is required';

    return Object.keys(this.errors).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────

  submit(): void {
  if (!this.validate()) return;

  const dt = parseDateTimeISO(this.form.date, this.form.time)!;

  // Logged-in user id — adjust to however you store it
  const ownerId: number =
    JSON.parse(localStorage.getItem('loggedInUser') ?? '{}')?.id ?? 0;

  const dto: MeetingDTO = {
    title:           this.form.title.trim(),
    meetingDateTime: this.toLocalDateTimeString(dt),   // ← was dt.toISOString().slice(0, 19)
    agenda:          this.form.agenda.trim(),
    decisionsPolls:  this.form.decisionsPolls.trim() || undefined,
    status:          this.form.status,
    ownerId,
    projectId:       this.form.projectId ?? undefined,
    memberIds:       this.form.memberIds,
  };

  this.created.emit({ dto, files: this.selectedFiles });
  this.resetForm();
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

  private resetForm(): void {
    this.form = emptyForm();
    this.errors = {};
    this.selectedFiles = [];
    this.isMembersDropdownOpen.set(false);
  }

  onBackdropClick(): void { this.close(); }

  close(): void {
    this.resetForm();
    this.closed.emit();
  }
}