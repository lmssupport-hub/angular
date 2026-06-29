import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { tap } from 'rxjs';
import { TaskService, TaskResponse, CreateTaskRequest } from '../../services/task.service';
import { ProjectService, Project } from '../../services/project.service';
import { AppUser } from '../../services/auth.service';

// ── Import the new standalone modal ──────────────────────────────────────────
import { CreateTaskModalComponent, TaskModalMode } from '../../../PopUp/create-task-modal/create-task-modal';

interface TaskRow {
  serialNo:  string;
  task:      TaskResponse;
  isSubTask: boolean;
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    CreateTaskModalComponent,   // ← replaces the inline modal
  ],
  templateUrl: './task-list.html',
})
export class TaskListComponent implements OnInit {

  private fb          = inject(TaskService);   // kept for potential future use
  private taskService = inject(TaskService);
  private api         = inject(ProjectService);

  // ── State signals ─────────────────────────────────────────────────
  tasks      = signal<TaskResponse[]>([]);
  projects   = signal<Project[]>([]);
  loading    = signal(false);
  tableError = signal<string | null>(null);

  selectedProjectId = signal<number | null>(null);
  expandedTasks     = signal<Set<number>>(new Set());

  // Hardcoded users — replace with API call when available
  allUsers = signal<AppUser[]>([
    { id: 44, username: 'sing',      email: 'admin@test.com', active: true },
    { id: 45, username: 'Test User', email: 'test@test.com',  active: true },
  ]);

  // ── Modal signals ─────────────────────────────────────────────────
  modalVisible = signal(false);
  modalMode    = signal<TaskModalMode>('create');
  editTaskId   = signal<number | undefined>(undefined);

  // ── Computed ──────────────────────────────────────────────────────
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
            id:               sub.id,
            projectId:        task.projectId,
            taskName:         sub.title,
            description:      sub.description,
            targetCount:      task.targetCount,
            priority:         task.priority,
            status:           task.status,
            assignedUserId:   task.assignedUserId,
            assignedUserName: task.assignedUserName,
            startDate:        task.startDate,
            dueDate:          task.dueDate,
            subTasks:         [],
          };
          rows.push({ serialNo: `${idx}.${si + 1}`, task: subAsTask, isSubTask: true });
        });
      }
    }
    return rows;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.api.getProjects().subscribe({ next: p => this.projects.set(p), error: () => {} });
  }

  // ── Table interactions ────────────────────────────────────────────
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

  isExpanded(id: number): boolean  { return this.expandedTasks().has(id); }
  hasSubTasks(t: TaskResponse): boolean { return (t.subTasks?.length ?? 0) > 0; }

  // ── Modal open helpers ────────────────────────────────────────────
  openCreate(): void {
    this.editTaskId.set(undefined);
    this.modalMode.set('create');
    this.modalVisible.set(true);
  }

  openEdit(taskId: number): void {
    this.editTaskId.set(taskId);
    this.modalMode.set('edit');
    this.modalVisible.set(true);
  }

  openView(taskId: number): void {
    this.editTaskId.set(taskId);
    this.modalMode.set('view');
    this.modalVisible.set(true);
  }

  closeModal(): void { this.modalVisible.set(false); }

  // ── Modal event handlers ──────────────────────────────────────────
  handleTaskCreated(task: TaskResponse): void {
    this.tasks.update(list => [...list, task]);
    this.closeModal();
  }

  handleTaskUpdated(task: TaskResponse): void {
    const id = this.editTaskId();
    this.tasks.update(list => list.map(x => x.id === id ? task : x));
    this.closeModal();
  }

  // ── Badge helpers ─────────────────────────────────────────────────
  priorityClass(p: string): string {
    return ({
      High:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      Medium: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
      Low:    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    } as any)[p] ?? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
  }

  statusClass(s: string): string {
    return ({
      'In Progress': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      'Completed':   'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
      'Not Started': 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600',
    } as any)[s] ?? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
  }
}