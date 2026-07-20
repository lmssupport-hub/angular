import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TaskService, TaskResponse, CreateTaskRequest } from '../../services/task.service';
import { ProjectService, Project } from '../../services/project.service';
import { AuthService, TeamMember } from '../../services/auth.service';

import { CreateTaskModalComponent, TaskModalMode } from '../../../PopUp/create-task-modal/create-task-modal';

interface TaskRow {
  serialNo:  string;
  task:      TaskResponse;
  isSubTask: boolean;
}

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'] as const;
const STATUS_OPTIONS   = ['Not Started', 'In Progress', 'Completed'] as const;

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    CreateTaskModalComponent,
  ],
  templateUrl: './task-list.html',
})
export class TaskListComponent implements OnInit {

  private fb          = inject(TaskService);
  private taskService = inject(TaskService);
  private api         = inject(ProjectService);
  private authService  = inject(AuthService);


// feature-level permission getters (task-mgmt category) ──
  get canCreateTask(): boolean {
    return this.authService.hasFeatureAccess('task-hub', 'create');
  }

  get canViewTask(): boolean {
    return this.authService.hasFeatureAccess('task-hub', 'read');
  }

  get canEditTask(): boolean {
    return this.authService.hasFeatureAccess('task-hub', 'update');
  }

  get canDeleteTask(): boolean {
    return this.authService.hasFeatureAccess('task-hub', 'delete');
  }


  // ── State signals ─────────────────────────────────────────────────
  tasks      = signal<TaskResponse[]>([]);
  projects   = signal<Project[]>([]);
  loading    = signal(false);
  tableError = signal<string | null>(null);

  // null = "All Projects" selected (default)
  selectedProjectId = signal<number | null>(null);
  expandedTasks     = signal<Set<number>>(new Set());

  // ✅ CHANGED — team-scoped members (admin + invited members), not global user list
  allUsers = signal<TeamMember[]>([]);

  // ── Modal signals ─────────────────────────────────────────────────
  modalVisible = signal(false);
  modalMode    = signal<TaskModalMode>('create');
  editTaskId   = signal<number | undefined>(undefined);

  // ── Action menu (3-dot) signal ──────────────────────────────────
  openMenuId = signal<number | null>(null);

  // ── Filter panel signals ─────────────────────────────────────────
  filterPanelOpen   = signal(false);
  priorityOptions   = PRIORITY_OPTIONS;
  statusOptions     = STATUS_OPTIONS;
  selectedPriorities = signal<Set<string>>(new Set());
  selectedStatuses    = signal<Set<string>>(new Set());

  activeFilterCount = computed(() =>
    this.selectedPriorities().size + this.selectedStatuses().size
  );

  // ── Computed ──────────────────────────────────────────────────────
  projectName = computed(() => {
    const id = this.selectedProjectId();
    if (id === null) return 'All Projects';
    return this.projects().find((p: Project) => p.id === id)?.projectName ?? '';
  });

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

  // ✅ NEW — applies Priority + Status filters on top of flatRows
  filteredRows = computed<TaskRow[]>(() => {
    const rows = this.flatRows();
    const priorities = this.selectedPriorities();
    const statuses   = this.selectedStatuses();

    if (priorities.size === 0 && statuses.size === 0) return rows;

    return rows.filter(row => {
      const priorityOk = priorities.size === 0 || priorities.has(row.task.priority);
      const statusOk   = statuses.size === 0   || statuses.has(row.task.status);
      return priorityOk && statusOk;
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loading.set(true);
    this.api.getProjects().subscribe({
      next: p => {
        this.projects.set(p);
        // default view = All Projects, load tasks for every project
        this.loadAllProjectsTasks(p);
      },
      error: () => { this.loading.set(false); },
    });

    // ✅ CHANGED — team-scoped members (works for both Admin and Member login)
    this.authService.getTeamMembers().subscribe({
      next:  u => this.allUsers.set(u),
      error: () => this.allUsers.set([]),
    });
  }

  // ── Table interactions ────────────────────────────────────────────
  onProjectSelect(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.expandedTasks.set(new Set());
    this.tableError.set(null);

    if (raw === '') {
      // "All Projects" chosen
      this.selectedProjectId.set(null);
      this.loading.set(true);
      this.loadAllProjectsTasks(this.projects());
      return;
    }

    const id = +raw;
    this.selectedProjectId.set(id);
    this.loading.set(true);
    this.taskService.getTasksByProject(id).subscribe({
      next:  t => { this.tasks.set(t); this.loading.set(false); },
      error: () => { this.tableError.set('Failed to load tasks'); this.loading.set(false); },
    });
  }

  // fetch tasks across all projects and merge into one list
  private loadAllProjectsTasks(projectList: Project[]): void {
    if (!projectList.length) {
      this.tasks.set([]);
      this.loading.set(false);
      return;
    }

    const requests = projectList.map(p =>
      this.taskService.getTasksByProject(p.id!).pipe(
        catchError(() => of([] as TaskResponse[])) // one bad project shouldn't kill the whole list
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        this.tasks.set(results.flat());
        this.loading.set(false);
      },
      error: () => {
        this.tableError.set('Failed to load tasks');
        this.loading.set(false);
      },
    });
  }

  toggleExpand(id: number): void {
    const s = new Set(this.expandedTasks());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedTasks.set(s);
  }

  isExpanded(id: number): boolean  { return this.expandedTasks().has(id); }
  hasSubTasks(t: TaskResponse): boolean { return (t.subTasks?.length ?? 0) > 0; }

  // ── 3-dot Action menu ────────────────────────────────────────────
  toggleMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.filterPanelOpen.set(false);
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  closeMenu(): void { this.openMenuId.set(null); }

  // ── Filter panel ──────────────────────────────────────────────────
  toggleFilterPanel(event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    this.filterPanelOpen.set(!this.filterPanelOpen());
  }

  togglePriorityFilter(value: string, event: Event): void {
    event.stopPropagation();
    const s = new Set(this.selectedPriorities());
    s.has(value) ? s.delete(value) : s.add(value);
    this.selectedPriorities.set(s);
  }

  toggleStatusFilter(value: string, event: Event): void {
    event.stopPropagation();
    const s = new Set(this.selectedStatuses());
    s.has(value) ? s.delete(value) : s.add(value);
    this.selectedStatuses.set(s);
  }

  isPrioritySelected(value: string): boolean { return this.selectedPriorities().has(value); }
  isStatusSelected(value: string): boolean   { return this.selectedStatuses().has(value); }

  clearFilters(event: Event): void {
    event.stopPropagation();
    this.selectedPriorities.set(new Set());
    this.selectedStatuses.set(new Set());
  }

  // close menu / filter panel on any outside click
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
    this.filterPanelOpen.set(false);
  }

  confirmDelete(taskId: number, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    const ok = window.confirm('Delete this task? This cannot be undone.');
    if (!ok) return;

    this.taskService.deleteTask(taskId).subscribe({
      next: () => {
        this.tasks.update(list => list.filter(t => t.id !== taskId));
      },
      error: () => {
        this.tableError.set('Failed to delete task');
      },
    });
  }

  // ── Modal open helpers ────────────────────────────────────────────
  openCreate(): void {
    this.modalMode.set('create');
    this.editTaskId.set(undefined);
    this.modalVisible.set(true);
  }

  openEdit(taskId: number, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    this.editTaskId.set(taskId);
    this.modalMode.set('edit');
    this.modalVisible.set(true);
  }

  openView(taskId: number, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    this.editTaskId.set(taskId);
    this.modalMode.set('view');
    this.modalVisible.set(true);
  }

  closeModal(): void { this.modalVisible.set(false); }

  // ── Modal event handlers ──────────────────────────────────────────
  handleTaskCreated(task: TaskResponse): void {
    // refresh so "All Projects" view / current filter stays accurate
    if (this.selectedProjectId() === null) {
      this.loadAllProjectsTasks(this.projects());
    } else {
      this.tasks.update(list => [...list, task]);
    }
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