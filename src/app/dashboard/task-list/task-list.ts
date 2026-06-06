import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
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
import { TaskService, TaskResponse, CreateTaskRequest } from '../../services/task.service';
import { ApiService, Project, AppUser } from '../../services/api.service';

type ModalMode = 'create' | 'edit' | 'view';

interface TaskRow {
  serialNo: string;
  task: TaskResponse;
  isSubTask: boolean;
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-list.html',
})
export class TaskListComponent implements OnInit {
  private fb          = inject(FormBuilder);
  private taskService = inject(TaskService);   // ← task API
  private api         = inject(ApiService);    // ← projects + users

  // ── State signals ─────────────────────────────────────────────────
  tasks      = signal<TaskResponse[]>([]);
  projects   = signal<Project[]>([]);
users      = signal<AppUser[]>([
  { id: 44,username: 'sing', email: 'admin@test.com', active: true },
  { id: 45,username: 'Test User', email: 'test@test.com', active: true },
]);
  loading    = signal(false);
  tableError = signal<string | null>(null);

  selectedProjectId = signal<number | null>(null);
  expandedTasks     = signal<Set<number>>(new Set());

  // Modal
  modalVisible = signal(false);
  modalMode    = signal<ModalMode>('create');
  modalLoading = signal(false);
  modalError   = signal<string | null>(null);
  editTaskId   = signal<number | undefined>(undefined);

  // ── Computed ──────────────────────────────────────────────────────
allUsers = computed(() => this.users());

userDisplayName(u: AppUser): string {
  const user = u as AppUser & {
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    name?: string;
  };

  return (
    user.username ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.name ||
    user.email ||
    `User ${user.id}`
  );
}
  projectName = computed(() =>
    this.projects().find((p: Project) => p.id === this.selectedProjectId())?.projectName ?? ''
  );

  totalTasks = computed(() => this.tasks().length);

  flatRows = computed<TaskRow[]>(() => {
    const expanded = this.expandedTasks();
    const rows: TaskRow[] = [];
    let idx = 0;
    for (const task of this.tasks()) {
      idx++;
      rows.push({ serialNo: `${idx}`, task, isSubTask: false });
      if (expanded.has(task.id!) && task.subTasks?.length) {
        task.subTasks.forEach((sub, si) => {
          const subAsTask: TaskResponse = {
            id: sub.id, projectId: task.projectId,
            taskName: sub.title, description: sub.description,
            targetCount: task.targetCount, priority: task.priority,
            status: task.status, assignedUserId: task.assignedUserId,
            assignedUserName: task.assignedUserName,
            startDate: task.startDate, dueDate: task.dueDate, subTasks: [],
          };
          rows.push({ serialNo: `${idx}.${si + 1}`, task: subAsTask, isSubTask: true });
        });
      }
    }
    return rows;
  });

  // ── Form ──────────────────────────────────────────────────────────
  form!: FormGroup;

  get subTasksArray(): FormArray { return this.form.get('subTasks') as FormArray; }
  get modalTitle(): string {
    return this.modalMode() === 'create' ? 'Create Task'
         : this.modalMode() === 'edit'   ? 'Edit Task' : 'View Task';
  }
  get isReadOnly(): boolean { return this.modalMode() === 'view'; }

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.api.getProjects().subscribe({ next: p => this.projects.set(p), error: () => {} });
    // this.api.getUsers().subscribe({ next: u => this.users.set(u), error: () => {} });
    this.buildForm();
  }

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
      status:         [{ value: 'Not Started', disabled: true }],
      assignedUserId: [null, Validators.required],
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Table interactions
  // ─────────────────────────────────────────────────────────────────
  onProjectSelect(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.selectedProjectId.set(id);
    this.expandedTasks.set(new Set());
    this.loading.set(true);
    this.tableError.set(null);
    this.taskService.getTasksByProject(id).subscribe({
      next:  t => { this.tasks.set(t); this.loading.set(false); },
      error: () => { this.tableError.set('Failed to load tasks'); this.loading.set(false); },
    });
  }

  toggleExpand(id: number): void {
    const s = new Set(this.expandedTasks());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedTasks.set(s);
  }

  isExpanded(id: number): boolean { return this.expandedTasks().has(id); }
  hasSubTasks(t: TaskResponse): boolean { return (t.subTasks?.length ?? 0) > 0; }

  // ─────────────────────────────────────────────────────────────────
  // Modal open / close
  // ─────────────────────────────────────────────────────────────────
  openCreate(): void {
    this.buildForm();
    if (this.selectedProjectId()) this.form.patchValue({ projectId: this.selectedProjectId() });
    this.editTaskId.set(undefined);
    this.modalMode.set('create');
    this.modalError.set(null);
    this.modalVisible.set(true);
  }

  openEdit(taskId: number): void {
    this.buildForm();
    this.form.get('status')?.enable();
    this.editTaskId.set(taskId);
    this.modalMode.set('edit');
    this.modalError.set(null);
    this.modalVisible.set(true);
    this.loadTaskIntoForm(taskId, false);
  }

  openView(taskId: number): void {
    this.buildForm();
    this.editTaskId.set(taskId);
    this.modalMode.set('view');
    this.modalError.set(null);
    this.modalVisible.set(true);
    this.loadTaskIntoForm(taskId, true);
  }

  closeModal(): void { this.modalVisible.set(false); this.modalError.set(null); }

  private loadTaskIntoForm(id: number, readOnly: boolean): void {
    this.modalLoading.set(true);
    this.taskService.getTaskById(id).subscribe({
      next: task => {
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
        if (readOnly) this.form.disable();
        this.modalLoading.set(false);
      },
      error: () => { this.modalError.set('Failed to load task data.'); this.modalLoading.set(false); },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Sub-tasks
  // ─────────────────────────────────────────────────────────────────
  canAddSubTask(): boolean {
    return (this.form.get('taskName')?.value?.length ?? 0) >= 3
        && (this.form.get('description')?.value?.length ?? 0) > 0;
  }
  addSubTask(): void {
    if (!this.canAddSubTask()) return;
    this.subTasksArray.push(this.fb.group({ title: ['', Validators.minLength(3)], description: [''] }));
  }
  removeSubTask(i: number): void { this.subTasksArray.removeAt(i); }

  // ─────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────
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

    this.modalLoading.set(true);
    const id = this.editTaskId();
    const obs = id
      ? this.taskService.updateTask(id, payload).pipe(tap(t => this.tasks.update(l => l.map(x => x.id === id ? t : x))))
      : this.taskService.createTask(payload).pipe(tap(t => this.tasks.update(l => [...l, t])));

    obs.subscribe({
      next:  () => { this.modalLoading.set(false); this.closeModal(); },
      error: (err) => {
  console.error('Task save failed:', err);

  const message =
    err?.error?.message ||
    Object.values(err?.error?.errors ?? {}).join(', ') ||
    'Failed to save task. Please try again.';

  this.modalError.set(message);
  this.modalLoading.set(false);
},

      
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Validation helpers
  // ─────────────────────────────────────────────────────────────────
  fieldError(name: string): string | null {
    const c = this.form.get(name);
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

  // ─────────────────────────────────────────────────────────────────
  // Badge helpers
  // ─────────────────────────────────────────────────────────────────
  priorityClass(p: string): string {
    return ({ High:   'bg-red-100 text-red-700 border-red-200',
              Medium: 'bg-orange-100 text-orange-700 border-orange-200',
              Low:    'bg-emerald-100 text-emerald-700 border-emerald-200' } as any)[p]
           ?? 'bg-gray-100 text-gray-600 border-gray-200';
  }

  statusClass(s: string): string {
    return ({ 'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
              'Completed':   'bg-emerald-100 text-emerald-700 border-emerald-200',
              'Not Started': 'bg-gray-100 text-gray-500 border-gray-200' } as any)[s]
           ?? 'bg-gray-100 text-gray-600 border-gray-200';
  }
}