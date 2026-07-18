import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { ErrorReportApiService, ErrorReportDTO, Priority } from '../../services/error.service';
import { ProjectService, Project } from '../../services/project.service';
import { TaskService, TaskResponse } from '../../services/task.service';
import { AuthService } from '../../services/auth.service'; // NEW
import {
  CreateErrorModal,
  CreateErrorPayload,
} from '../../../PopUp/create-error-modal/create-error-modal';

const ALLOWED_SCREENSHOT_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

interface EditTaskOption {
  id: number;
  taskName: string;
  assignedUserId?: number;
  assignedUserName?: string;
}

@Component({
  selector: 'app-error-list',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CreateErrorModal],
  templateUrl: './error-list.html',
  styleUrl: './error-list.css',
})
export class ErrorList implements OnInit {

  // ── Field 1: Search / Field 2: Filter ──
  searchKeyword = '';
  isFilterOpen = signal(false);
  filterStatus = '';
  filterPriority = '';
  filterAssignedUserId: number | null = null;

  readonly statusOptions: string[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
  readonly priorityOptions: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  // ── Data ──
 errors = signal<ErrorReportDTO[]>([]);
loading = signal(false);
errorMessage = signal('');

  projects: Project[] = [];
  tasksForEdit: EditTaskOption[] = [];

  // ── Create modal ──
  isCreateModalOpen = signal(false);

  // ── Expanded / edit row ──
  expandedId: number | null = null;
  editForm: FormGroup;
  editScreenshotFile: File | null = null;
  editScreenshotError = '';
  editSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private errorApi: ErrorReportApiService,
    private projectService: ProjectService,
    private taskService: TaskService,
    private authService: AuthService, 
  ) {
    this.editForm = this.fb.group({
      projectId: [null, Validators.required],
      taskId: [{ value: null, disabled: true }, Validators.required],
      pageTitle: ['', Validators.required],
      errorDescription: ['', [Validators.required, Validators.maxLength(1000)]],
      expectedResult: ['', [Validators.required, Validators.maxLength(1000)]],
      priority: ['', Validators.required],
      comments: ['', Validators.maxLength(500)],
      status: ['', Validators.required],
      version: [null],
    });
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadErrors();
  }

  // feature-level permission getters (error-mgmt → error-tracker) ──
  get canCreateError(): boolean {
    return this.authService.hasFeatureAccess('error-tracker', 'create');
  }

  get canViewError(): boolean {
    return this.authService.hasFeatureAccess('error-tracker', 'read');
  }

  get canEditError(): boolean {
    return this.authService.hasFeatureAccess('error-tracker', 'update');
  }

  get canDeleteError(): boolean {
    return this.authService.hasFeatureAccess('error-tracker', 'delete');
  }

  // ── Loading data ──────────────────────────────────────────────────────

  loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (list: Project[]) => (this.projects = list),
      error: () => (this.projects = []),
    });
  }



loadErrors(): void {
  this.loading.set(true);
  this.errorMessage.set('');
  this.errorApi
    .getAll({
      keyword: this.searchKeyword || undefined,
      status: this.filterStatus || undefined,
      priority: this.filterPriority || undefined,
      assignedUserId: this.filterAssignedUserId || undefined,
    })
    .subscribe({
      next: (list) => {
        this.errors.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Unable to load error list');
        this.loading.set(false);
      },
    });
}

  // ── Field 1: Search ──
  onSearchChange(): void {
    this.loadErrors();
  }

  // ── Field 2: Filter ──
 toggleFilter(): void {
  this.isFilterOpen.update(open => !open);
}

applyFilters(): void {
  this.isFilterOpen.set(false);
  this.loadErrors();
}

clearFilters(): void {
  this.filterStatus = '';
  this.filterPriority = '';
  this.filterAssignedUserId = null;
  this.isFilterOpen.set(false);
  this.loadErrors();
}

  // ── Create Error modal ───────────────────────────────────────────────

  openCreateModal(): void {
    this.expandedId = null;
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  // Field 14: Create Error — fired by CreateErrorModalComponent's `created` output
 handleErrorCreated(payload: { dto: CreateErrorPayload; file: File | null }): void {
  this.errorApi.create(payload.dto, payload.file).subscribe({
    next: () => {
      this.closeCreateModal();
      this.loadErrors();
    },
    error: (err) => {
      this.errorMessage.set(err?.error?.message || 'Unable to create error');
      this.closeCreateModal();
    },
  });
}

  // ── Field 13: Show More (Expand Row) ────────────────────────────────

  toggleExpand(row: ErrorReportDTO): void {
    if (this.expandedId === row.id) {
      this.expandedId = null;
      return;
    }
    this.expandedId = row.id ?? null;
    this.editScreenshotFile = null;
    this.editScreenshotError = '';

    this.editForm.reset();
    this.editForm.patchValue({
      projectId: row.projectId,
      taskId: row.taskId,
      pageTitle: row.pageTitle,
      errorDescription: row.errorDescription,
      expectedResult: row.expectedResult,
      priority: row.priority,
      comments: row.comments,
      status: row.status,
      version: row.version,
    });
    this.editForm.get('taskId')?.enable();

    if (row.projectId) {
      this.taskService.getTasksByProject(row.projectId).subscribe({
        next: (tasks: TaskResponse[]) =>
          (this.tasksForEdit = tasks.map(t => ({
            id: t.id!,
            taskName: t.taskName,
            assignedUserId: t.assignedUserId,
            assignedUserName: t.assignedUserName,
          }))),
        error: () => (this.tasksForEdit = []),
      });
    }
  }

  // Field 16: Close expanded row
  closeExpand(): void {
    this.expandedId = null;
  }

  onEditProjectChange(): void {
    const projectId = this.editForm.get('projectId')?.value;
    this.editForm.get('taskId')?.reset();
    this.tasksForEdit = [];
    if (!projectId) return;
    this.taskService.getTasksByProject(projectId).subscribe({
      next: (tasks: TaskResponse[]) =>
        (this.tasksForEdit = tasks.map(t => ({
          id: t.id!,
          taskName: t.taskName,
          assignedUserId: t.assignedUserId,
          assignedUserName: t.assignedUserName,
        }))),
      error: () => (this.tasksForEdit = []),
    });
  }

  onEditScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.editScreenshotError = this.validateScreenshot(file);
    this.editScreenshotFile = this.editScreenshotError ? null : file;
  }

  private validateScreenshot(file: File | null): string {
    if (!file) return '';
    if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type) || file.size > MAX_SCREENSHOT_BYTES) {
      return 'Invalid file format or file size exceeds 5 MB';
    }
    return '';
  }

  // Field 15: Update Error (inline save, no page reload)
  submitEdit(row: ErrorReportDTO): void {
  if (this.editForm.invalid || this.editScreenshotError || !row.id) {
    this.editForm.markAllAsTouched();
    return;
  }
  this.editSubmitting = true;
  const raw = this.editForm.getRawValue();
  const dto: ErrorReportDTO = {
    ...row,
    projectId: raw.projectId,
    taskId: raw.taskId,
    pageTitle: raw.pageTitle,
    errorDescription: raw.errorDescription,
    expectedResult: raw.expectedResult,
    priority: raw.priority,
    comments: raw.comments,
    status: raw.status,
    version: raw.version,
  };

  this.errorApi.update(row.id, dto, this.editScreenshotFile).subscribe({
    next: (updated) => {
      this.editSubmitting = false;
      this.errors.update(list =>
        list.map(e => (e.id === row.id ? updated : e))
      );
      this.expandedId = null;
    },
    error: (err) => {
      this.editSubmitting = false;
      this.errorMessage.set(
        err?.status === 409
          ? err?.error?.message || 'This error was updated by another user. Please refresh and try again.'
          : err?.error?.message || 'Unable to update error'
      );
    },
  });
}

deleteError(row: ErrorReportDTO): void {
  if (!row.id) return;
  if (!confirm('Are you sure you want to delete this error?')) return;

  this.errorApi.delete(row.id).subscribe({
    next: () => {
      this.errors.update(list => list.filter(e => e.id !== row.id));
      if (this.expandedId === row.id) this.expandedId = null;
    },
    error: (err) => {
      this.errorMessage.set(err?.error?.message || 'Unable to delete error');
    },
  });
}

  statusBadgeClasses(status: string): string {
    switch (status) {
      case 'Open': return 'bg-blue-50 text-blue-600';
      case 'In Progress': return 'bg-amber-50 text-amber-600';
      case 'Resolved': return 'bg-emerald-50 text-emerald-600';
      case 'Closed': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-50 text-gray-500';
    }
  }

  priorityBadgeClasses(priority: string): string {
    switch (priority) {
      case 'Critical': return 'text-red-600';
      case 'High': return 'text-orange-500';
      case 'Medium': return 'text-amber-500';
      case 'Low': return 'text-emerald-600';
      default: return 'text-gray-500';
    }
  }
}