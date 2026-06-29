import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService, Project } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { TaskService, TaskResponse } from '../../services/task.service';


@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.html',
  styleUrl: './projects.css',
})
export class Projects implements OnInit, OnDestroy {

  // ── Data ──────────────────────────────────────────────────────────
  projects: Project[] = [];
  selectedProject: Project | null = null;
  tasks: TaskResponse[] = [];

  // ── UI state ──────────────────────────────────────────────────────
  activeTab = 'project';
  riskLevel = 'medium';
  isLoadingProjects = false;
  isLoadingTasks = false;
  projectLoadError: string | null = null;
  taskLoadError: string | null = null;
  sessionExpired = false;

  private _lastProjectId: number | null = null;
  private _refreshTimer: any = null;

  constructor(
    private api: ProjectService,
    private authService: AuthService,
    private taskService: TaskService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.checkSession();
    this.loadProjects();
  }

  ngOnDestroy(): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
  }

  // ── Session check (Scenario 10) ───────────────────────────────────
  private checkSession(): void {
    if (!this.authService.isAuthenticated()) {
      this.sessionExpired = true;
      setTimeout(() => this.router.navigate(['/login']), 2500);
    }
  }

  // ── Tab switch (Scenario 12) ──────────────────────────────────────
  switchTab(tab: string): void {
  this.activeTab = tab;
  if (tab === 'tasks') {  
    setTimeout(() => this.router.navigate(['/dashboard/tasks']), 400);
  }
}

  // ── Load projects (Scenarios 3, 5, 6, 7) ─────────────────────────
  loadProjects(): void {
    this.isLoadingProjects = true;
    this.projectLoadError = null;

    this.api.getProjects().subscribe({
      next: (data) => {
        this.projects = Array.isArray(data) ? data : [];
        this.isLoadingProjects = false;
        // Scenario 4 & 8: auto-refresh selected project after reload
        if (this._lastProjectId) {
          const found = this.projects.find(p => p.id === this._lastProjectId);
          if (found) {
            this.selectedProject = found;
            this.loadTasksForProject(this._lastProjectId);
          }
        }
      },
      error: (err) => {
        this.isLoadingProjects = false;
        // Scenario 10: 401 → redirect to login
        if (err?.status === 401 || err?.status === 403) {
          this.sessionExpired = true;
          setTimeout(() => this.router.navigate(['/login']), 2500);
          return;
        }
        // Scenario 5: no internet
        if (!navigator.onLine) {
          this.projectLoadError = 'No internet connection. Please check your network and retry.';
          return;
        }
        // Scenario 6: server unavailable
        if (err?.status === 0 || err?.status >= 500) {
          this.projectLoadError = 'Unable to load dashboard data. Please try again later.';
          return;
        }
        // Scenario 11: forbidden / restricted
        if (err?.status === 403) {
          this.projectLoadError = 'You do not have permission to view this data.';
          return;
        }
        this.projectLoadError = 'Failed to load projects. Please try again.';
      },
    });
  }

  // ── Project select (Scenario 1, 3) ───────────────────────────────
  onProjectSelect(event: Event): void {
    const id = +(event.target as HTMLSelectElement).value;
    this.selectedProject = this.projects.find(p => p.id === id) ?? null;
    this._lastProjectId = id;
    this.tasks = [];
    this.taskLoadError = null;
    this.loadTasksForProject(id);
  }

  // ── Load tasks (Scenarios 1, 3, 5, 6, 7) ─────────────────────────
  private loadTasksForProject(id: number): void {
    this.isLoadingTasks = true;
    this.taskLoadError = null;

    this.taskService.getTasksByProject(id).subscribe({
      next: (data) => {
        this.tasks = Array.isArray(data) ? data : [];
        this.isLoadingTasks = false;
        // Scenario 1: project selected but no task data
        // (handled in template with @if tasks.length === 0)
      },
      error: (err) => {
        this.isLoadingTasks = false;
        this.tasks = [];

        if (err?.status === 401 || err?.status === 403) {
          this.sessionExpired = true;
          setTimeout(() => this.router.navigate(['/login']), 2500);
          return;
        }
        if (!navigator.onLine) {
          this.taskLoadError = 'No internet connection. Please check your network and retry.';
          return;
        }
        if (err?.status === 0 || err?.status >= 500) {
          this.taskLoadError = 'Unable to load dashboard data. Please try again later.';
          return;
        }
        this.taskLoadError = 'Failed to load task data. Please try again.';
      },
    });
  }

  // ── Retry handlers (Scenario 5) ───────────────────────────────────
  retryTaskLoad(): void {
    if (this._lastProjectId) this.loadTasksForProject(this._lastProjectId);
  }

  // ── Refresh (Scenario 4 & 8) ──────────────────────────────────────
  refreshProject(): void {
    this.loadProjects();
  }

  // ── Computed getters ──────────────────────────────────────────────
  get completionRate(): number {
    if (!this.tasks.length) return 0;
    return Math.round((this.completedCount / this.tasks.length) * 100);
  }

  get achievedCount(): number {
    return this.tasks
      .filter(t => t.status === 'Completed')
      .reduce((s, t) => s + (t.targetCount || 0), 0);
  }

  get notStartedCount(): number {
    return this.tasks.filter(t => t.status === 'Not Started').length;
  }

  get inProgressCount(): number {
    return this.tasks.filter(t => t.status === 'In Progress').length;
  }

  get completedCount(): number {
    return this.tasks.filter(t => t.status === 'Completed').length;
  }

  get durationDays(): number {
    if (!this.selectedProject?.startDate || !this.selectedProject?.dueDate) return 0;
    const start = new Date(this.selectedProject.startDate);
    const due = new Date(this.selectedProject.dueDate);
    return Math.max(0, Math.round((due.getTime() - start.getTime()) / 86400000));
  }

  get delayDays(): number {
    if (!this.selectedProject?.dueDate) return 0;
    const due = new Date(this.selectedProject.dueDate);
    const today = new Date();
    const diff = Math.round((today.getTime() - due.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  get highPct(): number {
    const t = this.tasks.length;
    return t ? Math.round((this.tasks.filter(x => x.priority === 'High').length / t) * 100) : 0;
  }

  get medPct(): number {
    const t = this.tasks.length;
    return t ? Math.round((this.tasks.filter(x => x.priority === 'Medium').length / t) * 100) : 0;
  }

  get lowPct(): number {
    const t = this.tasks.length;
    return t ? Math.round((this.tasks.filter(x => x.priority === 'Low').length / t) * 100) : 0;
  }
}