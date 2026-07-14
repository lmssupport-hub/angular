import { Component, OnInit, HostListener, Inject, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProjectService, Project } from '../../services/project.service';
import { CreateProjectModalComponent } from '../../../PopUp/create-project-modal/create-project-modal';


@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [CommonModule, CreateProjectModalComponent],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.css',
})
export class ProjectsList implements OnInit {

  // ── State (signals — plain properties don't repaint the view under
  //    zoneless change detection, which is why Filter / Create Project
  //    weren't opening; task-list.ts already uses this pattern) ────────
  projects = signal<Project[]>([]);
  isLoadingProjects = signal(false);
  loadError = signal<string | null>(null);

  showProjectPopup = signal(false);
  editingProject = signal<Project | null>(null);

  showFilterDropdown = signal(false);

  showDeleteConfirm = signal(false);
  deletingProjectId = signal<number | null>(null);
  deletingProjectName = signal('');
  isDeletingProject = signal(false);

  expandedProjectIds = signal<Set<number>>(new Set());
  expandUserDropdownId = signal<number | null>(null);
  showAddChoiceIndex: number | null = null;

  // Static / never reassigned after init — fine as plain fields
  users = ['test name 1', 'test name 2', 'test name 3'];
  todayInputValue = new Date().toISOString().split('T')[0];

  constructor(
    private apiService: ProjectService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadProjects();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.expand-user-dropdown-wrapper')) this.expandUserDropdownId.set(null);
    if (!target.closest('.filter-dropdown-wrapper')) this.showFilterDropdown.set(false);
  }

  // ── Load ──────────────────────────────────────────────────────────

  loadProjects(): void {
    this.isLoadingProjects.set(true);
    this.loadError.set(null);
    this.apiService.getProjects().subscribe({
      next: (data) => {
        this.projects.set(Array.isArray(data) ? data : []);
        this.isLoadingProjects.set(false);
      },
      error: (err) => {
        console.error('Load projects failed', err);
        this.projects.set([]);
        this.loadError.set('Cannot reach the server. Check your connection.');
        this.isLoadingProjects.set(false);
      },
    });
  }

  // ── Filter dropdown ──────────────────────────────────────────────

  toggleFilterDropdown(event: Event): void {
    event.stopPropagation();
    this.showFilterDropdown.update(v => !v);
  }

  clearFilter(): void {
    // filter state reset logic varum idha inga
    this.showFilterDropdown.set(false);
  }

  applyFilter(): void {
    // filter apply logic varum idha inga
    this.showFilterDropdown.set(false);
  }

  // ── Modal ─────────────────────────────────────────────────────────

  openProjectPopup(project?: Project, event?: Event): void {
    event?.stopPropagation();
    this.editingProject.set(project ?? null);
    this.showProjectPopup.set(true);
  }

  closeProjectPopup(): void {
    this.showProjectPopup.set(false);
    this.editingProject.set(null);
  }

  onProjectSaved(saved: Project): void {
    if (this.editingProject()) {
      this.projects.update(list => list.map(p => p.id === saved.id ? saved : p));
    } else {
      this.projects.update(list => [...list, saved]);
    }
    this.closeProjectPopup();
  }

  // ── Expand ────────────────────────────────────────────────────────

  isExpanded(id: number): boolean {
    return this.expandedProjectIds().has(id);
  }

  toggleExpand(id: number, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedProjectIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.expandedProjectIds.set(next);
  }

  // ── Inline date edit ──────────────────────────────────────────────

  getEditDateValue(project: Project, field: 'projectReceivedDate' | 'startDate' | 'dueDate'): string {
    return project[field] ? project[field].substring(0, 10) : '';
  }

  onEditDateChange(project: Project, field: 'projectReceivedDate' | 'startDate' | 'dueDate', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;
    const oldValue = project[field];
    const payload = {
      projectName:         project.projectName,
      projectDescription:  project.projectDescription || '',
      projectReceivedDate: field === 'projectReceivedDate' ? val : project.projectReceivedDate.substring(0, 10),
      startDate:           field === 'startDate'           ? val : project.startDate.substring(0, 10),
      dueDate:             field === 'dueDate'             ? val : project.dueDate.substring(0, 10),
      assignedUsers:       project.assignedUsers,
      formulaRows:         project.formulaRows || [],
    };
    project[field] = val;
    this.projects.update(list => [...list]); // new array reference → view refreshes
    this.apiService.updateProject(project.id, payload).subscribe({
      next: (updated) => {
        this.projects.update(list => list.map(p => p.id === project.id ? { ...p, ...updated } : p));
      },
      error: (err) => {
        console.error('Inline date update failed', err);
        project[field] = oldValue;
        this.projects.update(list => [...list]);
      },
    });
  }

  // ── User management ───────────────────────────────────────────────

  toggleExpandUserDropdown(id: number, event: Event): void {
    event.stopPropagation();
    this.expandUserDropdownId.update(current => current === id ? null : id);
  }

  getUnassignedUsers(project: Project): string[] {
    return this.users.filter(u => !project.assignedUsers.includes(u));
  }

  addUserToProject(project: Project, user: string): void {
    this.patchProjectUsers(project, [...project.assignedUsers, user]);
  }

  removeUserFromProject(project: Project, user: string, event: Event): void {
    event.stopPropagation();
    if (project.assignedUsers.length <= 1) return;
    this.patchProjectUsers(project, project.assignedUsers.filter(u => u !== user));
  }

  private patchProjectUsers(project: Project, assignedUsers: string[]): void {
    const oldUsers = [...project.assignedUsers];
    const payload = {
      projectName:         project.projectName,
      projectDescription:  project.projectDescription || '',
      projectReceivedDate: project.projectReceivedDate.substring(0, 10),
      startDate:           project.startDate.substring(0, 10),
      dueDate:             project.dueDate.substring(0, 10),
      assignedUsers,
      formulaRows:         project.formulaRows || [],
    };
    project.assignedUsers = assignedUsers;
    this.expandUserDropdownId.set(null);
    this.projects.update(list => [...list]);
    this.apiService.updateProject(project.id, payload).subscribe({
      next: (updated) => {
        this.projects.update(list => list.map(p => p.id === project.id ? { ...p, ...updated } : p));
      },
      error: (err) => {
        console.error('User update failed', err);
        project.assignedUsers = oldUsers;
        this.projects.update(list => [...list]);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────

  deleteProject(id: number, event: Event): void {
    event.stopPropagation();
    const project = this.projects().find(p => p.id === id);
    this.deletingProjectId.set(id);
    this.deletingProjectName.set(project?.projectName || '');
    this.showDeleteConfirm.set(true);
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.deletingProjectId.set(null);
    this.deletingProjectName.set('');
    this.isDeletingProject.set(false);
  }

  confirmDelete(): void {
    const deleteId = this.deletingProjectId();
    if (!deleteId) return;
    this.isDeletingProject.set(true);
    this.apiService.deleteProject(deleteId).subscribe({
      next: () => {
        this.projects.update(list => list.filter(p => p.id !== deleteId));
        const next = new Set(this.expandedProjectIds());
        next.delete(deleteId);
        this.expandedProjectIds.set(next);
        this.isDeletingProject.set(false);
        this.cancelDelete();
      },
      error: (err) => { console.error('Delete failed', err); this.isDeletingProject.set(false); },
    });
  }

  // ── Display helpers ───────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  targetBadgeClasses = [
    'bg-purple-100 text-purple-700',
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
  ];

  getTargetBadgeClass(i: number): string {
    return this.targetBadgeClasses[i % this.targetBadgeClasses.length];
  }

  getTargetLabel(project: Project): string {
    return project.target ? project.target.toString() : '—';
  }
}