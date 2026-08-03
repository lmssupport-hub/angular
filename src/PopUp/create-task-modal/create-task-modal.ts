import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { tap } from 'rxjs';
import { TaskService, TaskResponse, CreateTaskRequest } from '../../app/services/task.service';
import { Project } from '../../app/services/project.service';
import { TeamMember } from '../../app/services/auth.service';

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
  @Input() isOpen = false;
  @Input() mode: TaskModalMode = 'create';
  @Input() taskId: number | undefined = undefined;
  @Input() projects: Project[] = [];
 @Input() allUsers: TeamMember[] = [];
  @Input() defaultProjectId: number | null = null;

  // ── Outputs ───────────────────────────────────────────────────────
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<TaskResponse>();
  @Output() updated = new EventEmitter<TaskResponse>();

  // ── Internal state — SIGNALS (zoneless-safe) ────────────────────
  isLoading   = signal(false);
  submitError = signal<string | null>(null);

  // subTasks length as a signal so the template repaints on push/removeAt
  subTasksVersion = signal(0);
  mainTaskReady = signal(false);
descLength    = signal(0);

  form!: FormGroup;

  // fields that must stay disabled until a Project is chosen (Form Open-02)
  private readonly DEPENDENT_FIELDS = [
    'taskName', 'description', 'startDate', 'dueDate',
    'targetCount', 'priority', 'assignedUserId', 'status',
  ];

  // ── Derived getters ───────────────────────────────────────────────
  get subTasksArray(): FormArray { return this.form?.get('subTasks') as FormArray; }

  get modalTitle(): string {
    return this.mode === 'create' ? 'Create Task'
         : this.mode === 'edit'   ? 'Edit Task'
                                  : 'View Task';
  }

  get isReadOnly(): boolean { return this.mode === 'view'; }

  // ✅ FIX (Session Handling-02): warn on tab close / browser refresh while there are unsaved changes
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification(event: BeforeUnloadEvent): void {
    if (this.isOpen && !this.isReadOnly && this.form?.dirty) {
      event.preventDefault();
      event.returnValue = true;
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.buildForm();
      this.submitError.set(null);

      if (this.mode === 'create') {
        if (this.defaultProjectId) {
          this.form.patchValue({ projectId: this.defaultProjectId });
        }
      } else if (this.taskId !== undefined) {
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
  this.subTasksVersion.set(0);

  const taskNameCtrl = this.form.get('taskName')!;
  const descCtrl     = this.form.get('description')!;
  const projectCtrl  = this.form.get('projectId')!;

  const refreshMainTaskState = () => {
    this.descLength.set(descCtrl.value?.length ?? 0);
    this.mainTaskReady.set(
      (taskNameCtrl.value?.length ?? 0) >= 3 &&
      (descCtrl.value?.length ?? 0) > 0
    );
  };

  taskNameCtrl.valueChanges.subscribe(refreshMainTaskState);
  descCtrl.valueChanges.subscribe(refreshMainTaskState);
  refreshMainTaskState(); // initial state (also covers patchValue in loadTask)

  // ✅ FIX (Form Open-02): task detail fields stay disabled until a Project is selected
  projectCtrl.valueChanges.subscribe(projectId => this.toggleDependentFields(projectId));
  this.toggleDependentFields(projectCtrl.value); // initial state on form build
}

  // ✅ FIX (Form Open-02): enable/disable dependent fields based on Project selection
  private toggleDependentFields(projectId: any): void {
    if (this.isReadOnly) return; // view mode has its own full-form disable in loadTask()

    this.DEPENDENT_FIELDS.forEach(name => {
      const ctrl = this.form.get(name);
      if (!ctrl) return;

      // status stays disabled on create regardless of project (existing rule)
      if (name === 'status' && this.mode === 'create') return;

      if (projectId) {
        ctrl.enable({ emitEvent: false });
      } else {
        ctrl.disable({ emitEvent: false });
      }
    });
  }

  // ── Load existing task ────────────────────────────────────────────
  private loadTask(id: number): void {
    this.isLoading.set(true);
    this.taskService.getTaskById(id).subscribe({
      next: (task) => {
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

        const arr = this.subTasksArray;
        arr.clear();
        (task.subTasks ?? []).forEach(st =>
          arr.push(this.fb.group({
            title:       [st.title, Validators.minLength(3)],
            description: [st.description],
          }))
        );
        this.subTasksVersion.update(v => v + 1);   // ✅ trigger repaint

        if (this.mode === 'view') this.form.disable();

        // form was just populated from the server — nothing "unsaved" yet
        this.form.markAsPristine();

        this.isLoading.set(false);
      },
      error: () => {
        this.submitError.set('Failed to load task data.');
        this.isLoading.set(false);
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
    this.subTasksVersion.update(v => v + 1);   // ✅ force template repaint
  }

  removeSubTask(i: number): void {
    this.subTasksArray.removeAt(i);
    this.subTasksVersion.update(v => v + 1);   // ✅ force template repaint
  }

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

    this.isLoading.set(true);
    this.submitError.set(null);

    const obs = this.taskId
      ? this.taskService.updateTask(this.taskId, payload).pipe(tap(t => this.updated.emit(t)))
      : this.taskService.createTask(payload).pipe(tap(t => this.created.emit(t)));

    obs.subscribe({
      next:  (t) => {
        this.form.markAsPristine(); // saved successfully — no more "unsaved changes"
        this.isLoading.set(false);
        this.close();
      },
      error: (err) => {
        // ✅ FIX (Connectivity-01): status 0 = browser couldn't reach the server at all
        // (offline / DNS / connection refused) — HttpErrorResponse.error is not JSON in this case
        let message: string;
        if (err.status === 0) {
          message = 'No internet connection. Please check your network and try again.';
        } else {
          message =
            err?.error?.message ||
            Object.values(err?.error?.errors ?? {}).join(', ') ||
            'Failed to save task. Please try again.';
        }
        this.submitError.set(message);
        this.isLoading.set(false);
      },
    });
  }

  // ── Close ─────────────────────────────────────────────────────────
  close(): void {
    this.submitError.set(null);
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