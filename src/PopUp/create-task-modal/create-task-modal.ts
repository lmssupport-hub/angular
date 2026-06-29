import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { tap } from 'rxjs';
import { TaskService, TaskResponse, CreateTaskRequest } from '../../app/services/task.service';
import { AppUser } from '../../app/services/auth.service';
import { Project} from '../../app/services/project.service';

export type TaskModalMode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-create-task-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-task-modal.html',
})
export class CreateTaskModalComponent implements OnChanges {


  private fb          = inject(FormBuilder);
  private taskService = inject(TaskService);

  // ── Inputs ────────────────────────────────────────────────────────
  /** Whether the modal is open */
  @Input() isOpen = false;

  /** 'create' | 'edit' | 'view' */
  @Input() mode: TaskModalMode = 'create';

  /** Task id — required for edit/view, undefined for create */
  @Input() taskId: number | undefined = undefined;

  /** Project list for the dropdown */
  @Input() projects: Project[] = [];

  /** User list for the assigned-user dropdown */
  @Input() allUsers: AppUser[] = [];

  /** Pre-select a project when opening in create mode */
  @Input() defaultProjectId: number | null = null;

  // ── Outputs ───────────────────────────────────────────────────────
  /** Emitted when the modal should close (no data) */
  @Output() closed = new EventEmitter<void>();

  /** Emitted after a successful create */
  @Output() created = new EventEmitter<TaskResponse>();

  /** Emitted after a successful update */
  @Output() updated = new EventEmitter<TaskResponse>();

  // ── Internal state ────────────────────────────────────────────────
  isLoading  = false;
  submitError: string | null = null;
  form!: FormGroup;

  // ── Derived getters ───────────────────────────────────────────────
  get subTasksArray(): FormArray { return this.form?.get('subTasks') as FormArray; }

  get modalTitle(): string {
    return this.mode === 'create' ? 'Create Task'
         : this.mode === 'edit'   ? 'Edit Task'
                                  : 'View Task';
  }

  get isReadOnly(): boolean { return this.mode === 'view'; }

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    // React whenever the modal opens or the task/mode changes
    if (changes['isOpen'] && this.isOpen) {
      this.buildForm();
      this.submitError = null;

      if (this.mode === 'create') {
        // Pre-select project if provided
        if (this.defaultProjectId) {
          this.form.patchValue({ projectId: this.defaultProjectId });
        }
      } else if (this.taskId !== undefined) {
        // Load task data for edit / view
        this.loadTask(this.taskId);
      }
    }
  }

  // ── Form builder ──────────────────────────────────────────────────
  private buildForm(): void {
    this.form = this.fb.group({
      projectId:      [null, Validators.required],
      taskName:       ['',   [Validators.required, Validators.minLength(3)]],
      description:    ['',   Validators.required],
      subTasks:       this.fb.array([]),
      startDate:      ['',   Validators.required],
      dueDate:        ['',   Validators.required],
      targetCount:    [null, [Validators.required, Validators.min(1)]],
      priority:       ['',   Validators.required],
      status:         [{ value: 'Not Started', disabled: this.mode === 'create' }],
      assignedUserId: [null, Validators.required],
    });
  }

  // ── Load existing task ────────────────────────────────────────────
  private loadTask(id: number): void {
    this.isLoading = true;
    this.taskService.getTaskById(id).subscribe({
      next: (task) => {
        // Enable status for edit mode
        if (this.mode === 'edit') this.form.get('status')?.enable();

        this.form.patchValue({
          projectId:      task.projectId,
          taskName:       task.taskName,
          description:    task.description,
          startDate:      task.startDate,
          dueDate:        task.dueDate,
          targetCount:    task.targetCount,
          priority:       task.priority,
          status:         task.status,
          assignedUserId: task.assignedUserId,
        });

        // Populate sub-tasks
        const arr = this.subTasksArray;
        arr.clear();
        (task.subTasks ?? []).forEach(st =>
          arr.push(this.fb.group({
            title:       [st.title, Validators.minLength(3)],
            description: [st.description],
          }))
        );

        // Disable everything for view mode
        if (this.mode === 'view') this.form.disable();

        this.isLoading = false;
      },
      error: () => {
        this.submitError = 'Failed to load task data.';
        this.isLoading = false;
      },
    });
  }

  // ── Sub-tasks ─────────────────────────────────────────────────────
  canAddSubTask(): boolean {
    return (this.form.get('taskName')?.value?.length ?? 0) >= 3
        && (this.form.get('description')?.value?.length ?? 0) > 0;
  }

  addSubTask(): void {
    if (!this.canAddSubTask()) return;
    this.subTasksArray.push(
      this.fb.group({ title: ['', Validators.minLength(3)], description: [''] })
    );
  }

  removeSubTask(i: number): void { this.subTasksArray.removeAt(i); }

  // ── Submit ────────────────────────────────────────────────────────
  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const raw = this.form.getRawValue();
    const payload: CreateTaskRequest = {
      projectId:      Number(raw.projectId),
      taskName:       raw.taskName,
      description:    raw.description,
      targetCount:    Number(raw.targetCount),
      priority:       raw.priority,
      status:         raw.status || 'Not Started',
      assignedUserId: Number(raw.assignedUserId),
      startDate:      raw.startDate,
      dueDate:        raw.dueDate,
      subTasks:       (raw.subTasks ?? []).filter((s: any) => s.title?.trim()),
    };

    this.isLoading   = true;
    this.submitError = null;

    const obs = this.taskId
      ? this.taskService.updateTask(this.taskId, payload).pipe(tap(t => this.updated.emit(t)))
      : this.taskService.createTask(payload).pipe(tap(t => this.created.emit(t)));

    obs.subscribe({
      next:  () => { this.isLoading = false; this.close(); },
      error: (err) => {
        const message =
          err?.error?.message ||
          Object.values(err?.error?.errors ?? {}).join(', ') ||
          'Failed to save task. Please try again.';
        this.submitError = message;
        this.isLoading   = false;
      },
    });
  }

  // ── Close ─────────────────────────────────────────────────────────
  close(): void {
    this.submitError = null;
    this.closed.emit();
  }

  onBackdropClick(): void { this.close(); }

  // ── Validation helpers ────────────────────────────────────────────
  fieldError(name: string): string | null {
    const c = this.form?.get(name);
    if (!c || !c.touched || !c.errors) return null;
    const msgs: Record<string, string> = {
      projectId:      'Project selection is required',
      taskName:       'Main Task Name is required',
      description:    'Main Task Description is required',
      startDate:      'Start Date is required',
      dueDate:        'Due Date is required',
      targetCount:    'Target Count is required',
      priority:       'Priority selection is required',
      assignedUserId: 'User selection is required',
    };
    if (c.errors['required'])  return msgs[name] ?? 'This field is required';
    if (c.errors['minlength']) return `Minimum ${c.errors['minlength'].requiredLength} characters`;
    if (c.errors['min'])       return 'Value must be greater than 0';
    return null;
  }

  subTaskError(i: number, field: string): string | null {
    const c = this.subTasksArray.at(i)?.get(field);
    if (!c || !c.touched || !c.errors) return null;
    if (c.errors['minlength']) return 'Sub Task Name must be at least 3 characters';
    return null;
  }
}