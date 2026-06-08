import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, Project } from '../../services/api.service';
import { TaskService, TaskResponse } from '../../services/task.service';
import { isPlatformBrowser } from '@angular/common';


interface VelocityBar {
  day: string;
  actual: number;
  predicted: number;
}

@Component({
  selector: 'app-tasks',
  imports: [CommonModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css',
})
export class Tasks implements OnInit {
  private router      = inject(Router);
  private api         = inject(ApiService);
  private taskService = inject(TaskService);
  private platformId  = inject(PLATFORM_ID);

  // ── Signals ───────────────────────────────────────────────────────
  projects          = signal<Project[]>([]);
  tasks             = signal<TaskResponse[]>([]);
  selectedProjectId = signal<number | null>(null);
  selectedProject   = signal<Project | null>(null);
  selectedTaskId    = signal<number | null>(null);
  selectedTask      = signal<TaskResponse | null>(null);

  isLoadingProjects = signal(false);
  isLoadingTasks    = signal(false);
  taskLoadError     = signal<string | null>(null);
  showValidation    = signal(false);

  // Snapshot of ALL tasks for selected project — used for project-level metrics.
  projectTasks = signal<TaskResponse[]>([]);

  // ── Static velocity chart data (illustrative trend) ───────────────
  velocityBars: VelocityBar[] = [
    { day: 'MON', actual: 72,  predicted: 40 },
    { day: 'TUE', actual: 100, predicted: 50 },
    { day: 'WED', actual: 85,  predicted: 45 },
    { day: 'THU', actual: 125, predicted: 60 },
    { day: 'FRI', actual: 110, predicted: 70 },
    { day: 'SAT', actual: 55,  predicted: 90 },
    { day: 'SUN', actual: 35,  predicted: 80 },
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
  this.loadProjects();

  // guard: history is not available in SSR
  if (isPlatformBrowser(this.platformId)) {
    const state = history.state as { projectId?: number };
    if (state?.projectId) {
      this.selectedProjectId.set(state.projectId);
      this.loadTasks(state.projectId);
    }
  }
}

  // ── Data loading ───────────────────────────────────────────────────
  private loadProjects(): void {
    this.isLoadingProjects.set(true);
    this.api.getProjects().subscribe({
      next: (data) => {
        this.projects.set(Array.isArray(data) ? data : []);
        this.isLoadingProjects.set(false);
        const pid = this.selectedProjectId();
        if (pid) {
          this.selectedProject.set(this.projects().find(p => p.id === pid) ?? null);
        }
      },
      error: () => {
        this.isLoadingProjects.set(false);
      },
    });
  }

  private loadTasks(projectId: number): void {
    this.isLoadingTasks.set(true);
    this.taskLoadError.set(null);
    this.tasks.set([]);
    this.projectTasks.set([]);
    this.selectedTaskId.set(null);
    this.selectedTask.set(null);

    this.taskService.getTasksByProject(projectId).subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : [];
        this.tasks.set(list);
        this.projectTasks.set(list);
        this.isLoadingTasks.set(false);
      },
      error: (err) => {
        this.isLoadingTasks.set(false);
        if (!navigator.onLine) {
          this.taskLoadError.set('No internet connection. Please check your network.');
        } else if (err?.status === 401 || err?.status === 403) {
          this.router.navigate(['/login']);
        } else {
          this.taskLoadError.set('Failed to load tasks. Please try again.');
        }
      },
    });
  }

  retryTasks(): void {
    const id = this.selectedProjectId();
    if (id) this.loadTasks(id);
  }

  // ── Tab switch ─────────────────────────────────────────────────────
  switchTab(tab: string): void {
    if (tab === 'project') {
      this.router.navigate(['/dashboard/projects']);
    }
  }

  // ── Selectors ──────────────────────────────────────────────────────
  onProjectSelect(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.selectedProjectId.set(id);
    this.selectedProject.set(this.projects().find(p => p.id === id) ?? null);
    this.showValidation.set(false);
    this.loadTasks(id);
  }

  onTaskSelect(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.selectedTaskId.set(id);
    this.showValidation.set(false);
    const found = this.tasks().find(t => t.id === id) ?? null;
    this.selectedTask.set(found);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Computed metrics
  // ═══════════════════════════════════════════════════════════════════

  /**
   * §2 — Total Target
   * Source: project.target (formula-calculated on the Project)
   */
  taskTarget = computed<number>(() => {
    return this.selectedProject()?.target ?? 0;
  });

  /**
   * §3 / §12 — Achieved
   * • No task selected → sum of targetCount of all Completed tasks in project
   * • Task selected    → that task's own targetCount
   */
  taskAchieved = computed<number>(() => {
    const task = this.selectedTask();
    if (task) return task.targetCount ?? 0;
    return this.projectTasks()
      .filter(t => t.status === 'Completed')
      .reduce((sum, t) => sum + (t.targetCount ?? 0), 0);
  });

  /**
 * §13 — Target Completion %
 * Formula: (Task Achieved Target / Task Target) × 100
 * Range: 0% – 100%
 */
taskCompletionRate = computed<number>(() => {
  const target   = this.taskTarget();   // project target (e.g. 16)
  const achieved = this.taskAchieved(); // task targetCount (e.g. 12)
  if (!target) return 0;
  return Math.min(100, Math.round((achieved / target) * 100));
});

  /**
   * §14 — Task Duration (days)
   * Formula: Task Due Date − Task Start Date
   */
  taskDuration = computed<number>(() => {
    const task = this.selectedTask();
    if (!task?.startDate || !task?.dueDate) return 0;
    const start = new Date(task.startDate as unknown as string);
    const due   = new Date(task.dueDate   as unknown as string);
    return Math.max(0, Math.round((due.getTime() - start.getTime()) / 86_400_000));
  });

  /**
   * §15 — Task Delay (days)
   * Only > 0 when task is NOT Completed AND today > Due Date
   */
  taskDelay = computed<number>(() => {
    const task = this.selectedTask();
    if (!task?.dueDate) return 0;
    if (task.status === 'Completed') return 0;
    const due   = new Date(task.dueDate as unknown as string);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - due.getTime()) / 86_400_000);
    return diff > 0 ? diff : 0;
  });

  /**
   * §18 — Task Risk Level
   * HIGH RISK → overdue (delay > 0) OR completion < 30%
   * MEDIUM    → no delay AND 30% ≤ completion < 70%
   * LOW RISK  → Completed OR completion ≥ 70% with no delay
   */
  taskRiskLevel = computed<'HIGH RISK' | 'MEDIUM' | 'LOW RISK'>(() => {
    const task = this.selectedTask();
    if (!task) return 'LOW RISK';
    if (task.status === 'Completed') return 'LOW RISK';

    const delay      = this.taskDelay();
    const completion = this.taskCompletionRate();

    if (delay > 0)       return 'HIGH RISK';
    if (completion < 30) return 'HIGH RISK';
    if (completion < 70) return 'MEDIUM';
    return 'LOW RISK';
  });

  // ═══════════════════════════════════════════════════════════════════
  //  Badge / styling helpers
  // ═══════════════════════════════════════════════════════════════════

  statusBadgeClass(status?: string): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed':   'bg-emerald-100 text-emerald-700',
      'Not Started': 'bg-gray-100 text-gray-500',
      'Pending':     'bg-purple-100 text-purple-700',
    };
    return map[status ?? ''] ?? 'bg-gray-100 text-gray-500';
  }

  priorityTextClass(priority?: string): string {
    const map: Record<string, string> = {
      'High':   'text-red-500',
      'Medium': 'text-orange-500',
      'Low':    'text-gray-500',
    };
    return map[priority ?? ''] ?? 'text-gray-400';
  }

  riskTextClass(risk: string): string {
    if (risk === 'HIGH RISK') return 'text-red-500';
    if (risk === 'MEDIUM')    return 'text-orange-500';
    return 'text-emerald-600';
  }

  /**
   * Risk bar segments (1–3):
   * HIGH RISK → 3 bars red
   * MEDIUM    → 2 bars orange
   * LOW RISK  → 1 bar green
   */
  riskBarClass(risk: string, segment: number): string {
    if (risk === 'HIGH RISK') return 'bg-red-400';
    if (risk === 'MEDIUM')    return segment <= 2 ? 'bg-orange-300' : 'bg-gray-200';
    return segment === 1 ? 'bg-emerald-400' : 'bg-gray-200';
  }
}