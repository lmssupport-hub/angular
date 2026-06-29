import { Component, OnInit, HostListener, Inject, PLATFORM_ID } from '@angular/core';
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

  projects: Project[] = [];
  isLoadingProjects = false;
  loadError: string | null = null;

  showProjectPopup = false;
  editingProject: Project | null = null;

  showDeleteConfirm = false;
  deletingProjectId: number | null = null;
  deletingProjectName = '';
  isDeletingProject = false;

  expandedProjectIds = new Set<number>();
  expandUserDropdownId: number | null = null;
  showAddChoiceIndex: number | null = null;

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
    if (!target.closest('.expand-user-dropdown-wrapper')) this.expandUserDropdownId = null;
  }

  // ── Load ──────────────────────────────────────────────────────────

  loadProjects(): void {
    this.isLoadingProjects = true;
    this.loadError = null;
    this.apiService.getProjects().subscribe({
      next: (data) => {
        this.projects = Array.isArray(data) ? data : [];
        this.isLoadingProjects = false;
      },
      error: (err) => {
        console.error('Load projects failed', err);
        this.projects = [];
        this.loadError = 'Cannot reach the server. Check your connection.';
        this.isLoadingProjects = false;
      },
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────

  openProjectPopup(project?: Project, event?: Event): void {
    event?.stopPropagation();
    this.editingProject = project ?? null;
    this.showProjectPopup = true;
  }

  closeProjectPopup(): void {
    this.showProjectPopup = false;
    this.editingProject = null;
  }

  onProjectSaved(saved: Project): void {
    if (this.editingProject) {
      this.projects = this.projects.map(p => p.id === saved.id ? saved : p);
    } else {
      this.projects = [...this.projects, saved];
    }
    this.closeProjectPopup();
  }

  // ── Expand ────────────────────────────────────────────────────────

  isExpanded(id: number): boolean { return this.expandedProjectIds.has(id); }

  toggleExpand(id: number, event: Event): void {
    event.stopPropagation();
    this.expandedProjectIds.has(id)
      ? this.expandedProjectIds.delete(id)
      : this.expandedProjectIds.add(id);
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
    this.apiService.updateProject(project.id, payload).subscribe({
      next: (updated) => { this.projects = this.projects.map(p => p.id === project.id ? { ...p, ...updated } : p); },
      error: (err) => { console.error('Inline date update failed', err); project[field] = oldValue; },
    });
  }

  // ── User management ───────────────────────────────────────────────

  toggleExpandUserDropdown(id: number, event: Event): void {
    event.stopPropagation();
    this.expandUserDropdownId = this.expandUserDropdownId === id ? null : id;
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
    this.expandUserDropdownId = null;
    this.apiService.updateProject(project.id, payload).subscribe({
      next: (updated) => { this.projects = this.projects.map(p => p.id === project.id ? { ...p, ...updated } : p); },
      error: (err) => { console.error('User update failed', err); project.assignedUsers = oldUsers; },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────

  deleteProject(id: number, event: Event): void {
    event.stopPropagation();
    const project = this.projects.find(p => p.id === id);
    this.deletingProjectId = id;
    this.deletingProjectName = project?.projectName || '';
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deletingProjectId = null;
    this.deletingProjectName = '';
    this.isDeletingProject = false;
  }

  confirmDelete(): void {
    if (!this.deletingProjectId) return;
    const deleteId = this.deletingProjectId;
    this.isDeletingProject = true;
    this.apiService.deleteProject(deleteId).subscribe({
      next: () => {
        this.projects = this.projects.filter(p => p.id !== deleteId);
        this.expandedProjectIds.delete(deleteId);
        this.isDeletingProject = false;
        this.cancelDelete();
      },
      error: (err) => { console.error('Delete failed', err); this.isDeletingProject = false; },
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