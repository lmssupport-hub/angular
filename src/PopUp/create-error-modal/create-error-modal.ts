import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProjectService, Project } from '../../app/services/project.service';
import { TaskService, TaskResponse } from '../../app/services/task.service';

export interface ProjectOption {
  id: number;
  projectName: string;
}

export interface TaskOption {
  id: number;
  taskName: string;
  assignedUserId?: number;
  assignedUserName?: string;
}

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface CreateErrorPayload {
  projectId: number;
  taskId: number;
  pageTitle: string;
  errorDescription: string;
  expectedResult: string;
  priority: Priority;
  comments?: string;
  status: 'Open';
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

@Component({
  selector: 'app-create-error-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-error-modal.html',
  styleUrl: './create-error-modal.css',
})
export class CreateErrorModal implements OnChanges {

  // ── Inputs / Outputs (same contract style as CreateMeetingModalComponent) ──
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ dto: CreateErrorPayload; file: File | null }>();

  readonly priorityOptions: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

  projects: ProjectOption[] = [];
  tasks: TaskOption[] = [];
  assignedUserName = '';

  form: FormGroup;
  screenshotFile: File | null = null;
  screenshotError = '';
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private taskService: TaskService,
  ) {
    this.form = this.fb.group({
      projectId: [null, Validators.required],
      taskId: [{ value: null, disabled: true }, Validators.required],
      pageTitle: ['', Validators.required],
      errorDescription: ['', [Validators.required, Validators.maxLength(1000)]],
      expectedResult: ['', [Validators.required, Validators.maxLength(1000)]],
      priority: ['', Validators.required],
      comments: ['', Validators.maxLength(500)],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
      this.loadProjects();
    }
  }

  private resetForm(): void {
    this.form.reset();
    this.form.get('taskId')?.disable();
    this.tasks = [];
    this.assignedUserName = '';
    this.screenshotFile = null;
    this.screenshotError = '';
    this.submitting = false;
  }

  private loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (projects: Project[]) =>
        (this.projects = projects.map(p => ({ id: p.id, projectName: p.projectName }))),
      error: () => (this.projects = []),
    });
  }

  // Field 4 dependency: load tasks only after a project is selected
  onProjectChange(): void {
    const projectId = this.form.get('projectId')?.value;
    this.form.get('taskId')?.reset();
    this.tasks = [];
    this.assignedUserName = '';

    if (!projectId) {
      this.form.get('taskId')?.disable();
      return;
    }
    this.form.get('taskId')?.enable();
    this.taskService.getTasksByProject(projectId).subscribe({
      next: (tasks: TaskResponse[]) => {
        this.tasks = tasks.map(t => ({
          id: t.id!,
          taskName: t.taskName,
          assignedUserId: t.assignedUserId,
          assignedUserName: t.assignedUserName,
        }));
      },
      error: () => (this.tasks = []),
    });
  }

  // Field 10: Assign User auto-populates from the selected task, read-only
  onTaskChange(): void {
    const taskId = this.form.get('taskId')?.value;
    const task = this.tasks.find(t => t.id === taskId);
    this.assignedUserName = task?.assignedUserName ?? '';
  }

  // Field 9: Screenshot validation (JPG/PNG/JPEG, max 5MB)
  onScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.screenshotFile = null;
      this.screenshotError = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      this.screenshotError = 'Invalid file format or file size exceeds 5 MB';
      this.screenshotFile = null;
      input.value = '';
      return;
    }
    this.screenshotError = '';
    this.screenshotFile = file;
  }

  submit(): void {
    if (this.form.invalid || this.screenshotError) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const raw = this.form.getRawValue();
    const dto: CreateErrorPayload = {
      projectId: raw.projectId,
      taskId: raw.taskId,
      pageTitle: raw.pageTitle.trim(),
      errorDescription: raw.errorDescription.trim(),
      expectedResult: raw.expectedResult.trim(),
      priority: raw.priority,
      comments: raw.comments?.trim() || undefined,
      status: 'Open',
    };
    this.created.emit({ dto, file: this.screenshotFile });
  }

  // Called by the parent once the API call settles, so the modal can
  // re-enable the submit button on failure instead of staying stuck.
  setSubmitting(value: boolean): void {
    this.submitting = value;
  }

  close(): void {
    this.closed.emit();
  }
}