import { Component, OnInit, HostListener, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import {
  FormsModule, ReactiveFormsModule, FormBuilder,
  Validators, AbstractControl, ValidationErrors,
} from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService, Project, ProjectPayload } from '../../services/api.service';

type Operator = '+' | '-' | '*' | '/';

type ExtraFormulaField = {
  type: 'parameter' | 'operator';
  parameter: string;
  operator: Operator | '';
  value: number | null;
};

type FormulaRow = {
  parameter1: string;
  operator: Operator | '';
  parameter2: string;
  value1: number | null;
  value2: number | null;
  extraFields: ExtraFormulaField[];
};

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.css',
})
export class ProjectsList implements OnInit {

  projects: Project[] = [];
  existingProjectNames: string[] = [];
  isLoadingProjects = false;
  loadError: string | null = null;

  showProjectPopup = false;
  isSavingProject = false;
  editingProject: Project | null = null;

  showDeleteConfirm = false;
  deletingProjectId: number | null = null;
  deletingProjectName = '';
  isDeletingProject = false;

  expandedProjectIds = new Set<number>();
  expandUserDropdownId: number | null = null;
  showUserDropdown = false;
  showAddChoiceIndex: number | null = null;

  formulaRows: FormulaRow[] = [this.createFormulaRow()];
  operatorOptions: Operator[] = ['+', '-', '*', '/'];
  formulaOptions = [
    { parameter1: 'Total Working Minutes', parameter2: 'Minutes per Unit', sampleValue1: 480, sampleValue2: 30 },
    { parameter1: 'Total Working Hours',   parameter2: 'Hours per Unit',   sampleValue1: 8,   sampleValue2: 2  },
    { parameter1: 'Monthly Target',        parameter2: 'Working Days',     sampleValue1: 1200, sampleValue2: 24 },
  ];

  users = ['test name 1', 'test name 2', 'test name 3'];
  todayInputValue = ProjectsList.toDateInputValue(new Date());

  projectForm;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.projectForm = this.buildForm();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadProjects();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown-wrapper')) this.showUserDropdown = false;
    if (!target.closest('.expand-user-dropdown-wrapper')) this.expandUserDropdownId = null;
  }

  private buildForm() {
    return this.fb.group({
      projectName:         ['', [Validators.required, this.uniqueProjectName.bind(this)]],
      projectReceivedDate: ['', [Validators.required, this.validDDMMYYYY, this.notFutureDate]],
      assignedUsers:       this.fb.control<string[]>([], [Validators.required, Validators.minLength(1)]),
      startDate:           ['', [Validators.required, this.validDDMMYYYY]],
      dueDate:             ['', [Validators.required, this.validDDMMYYYY]],
      target:              [{ value: '', disabled: true }],
      projectDescription:  ['', [this.maxWords(500)]],
    }, { validators: [this.dateDependencyValidator] });
  }

  loadProjects(): void {
    this.isLoadingProjects = true;
    this.loadError = null;

    this.apiService.getProjects().subscribe({
      next: (data) => {
        this.projects = Array.isArray(data) ? data : [];
        this.existingProjectNames = this.projects.map(p => p.projectName);
        this.isLoadingProjects = false;
      },
      error: (err) => {
        console.error('Load projects failed', err);
        this.projects = [];
        this.existingProjectNames = [];
        this.loadError = 'Cannot reach the server. Check your connection.';
        this.isLoadingProjects = false;
      },
    });
  }

  isExpanded(id: number): boolean { return this.expandedProjectIds.has(id); }

  toggleExpand(id: number, event: Event): void {
    event.stopPropagation();
    this.expandedProjectIds.has(id)
      ? this.expandedProjectIds.delete(id)
      : this.expandedProjectIds.add(id);
  }

  getEditDateValue(project: Project, field: 'projectReceivedDate' | 'startDate' | 'dueDate'): string {
    return project[field] ? project[field].substring(0, 10) : '';
  }

  onEditDateChange(project: Project, field: 'projectReceivedDate' | 'startDate' | 'dueDate', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val) return;

    const oldValue = project[field];

    const payload: ProjectPayload = {
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
      next: (updatedProject) => {
        // Update local state only — no reload
        this.projects = this.projects.map(p =>
          p.id === project.id ? { ...p, ...updatedProject } : p
        );
      },
      error: (err) => {
        console.error('Inline date update failed', err);
        project[field] = oldValue;
      },
    });
  }

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

    const payload: ProjectPayload = {
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
      next: (updatedProject) => {
        // Update local state only — no reload
        this.projects = this.projects.map(p =>
          p.id === project.id ? { ...p, ...updatedProject } : p
        );
      },
      error: (err) => {
        console.error('User update failed', err);
        project.assignedUsers = oldUsers;
      },
    });
  }

  openProjectPopup(project?: Project, event?: Event): void {
    event?.stopPropagation();

    this.editingProject = project ?? null;
    this.showProjectPopup = true;
    this.projectForm = this.buildForm();
    this.showUserDropdown = false;
    this.showAddChoiceIndex = null;

    if (project) {
      this.projectForm.patchValue({
        projectName:         project.projectName,
        projectReceivedDate: ProjectsList.dateInputToDDMMYYYY(project.projectReceivedDate.substring(0, 10)),
        startDate:           ProjectsList.dateInputToDDMMYYYY(project.startDate.substring(0, 10)),
        dueDate:             ProjectsList.dateInputToDDMMYYYY(project.dueDate.substring(0, 10)),
        assignedUsers:       [...project.assignedUsers],
        projectDescription:  project.projectDescription || '',
      });

      this.formulaRows = (project.formulaRows || []).map(row => ({
        parameter1:  row.parameter1,
        operator:    row.operator as Operator | '',
        parameter2:  row.parameter2,
        value1:      row.value1,
        value2:      row.value2,
        extraFields: (row.extraFields || []).map(ef => ({
          type:      ef.type as 'parameter' | 'operator',
          parameter: ef.parameter || '',
          operator:  ef.operator as Operator | '',
          value:     ef.value,
        })),
      }));

      if (this.formulaRows.length === 0) {
        this.formulaRows = [this.createFormulaRow()];
      }
    } else {
      this.formulaRows = [this.createFormulaRow()];
    }

    this.calculateFormulaTarget();
  }

  closeProjectPopup(): void {
    this.showProjectPopup = false;
    this.editingProject = null;
    this.showUserDropdown = false;
    this.showAddChoiceIndex = null;
    this.isSavingProject = false;
  }

  saveProject(): void {
    if (this.isSavingProject) return;

    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid || !this.canAddFormulaRow()) return;

    const fv = this.projectForm.getRawValue();
    const payload: ProjectPayload = {
      projectName:         fv.projectName || '',
      projectDescription:  fv.projectDescription || '',
      projectReceivedDate: ProjectsList.ddmmyyyyToDateInput(fv.projectReceivedDate || ''),
      startDate:           ProjectsList.ddmmyyyyToDateInput(fv.startDate || ''),
      dueDate:             ProjectsList.ddmmyyyyToDateInput(fv.dueDate || ''),
      assignedUsers:       Array.isArray(fv.assignedUsers) ? fv.assignedUsers : [],
      formulaRows:         this.serializeFormulaRows(this.formulaRows),
    };

    this.isSavingProject = true;

    if (this.editingProject) {
      // UPDATE — patch local state, no reload
      const editId = this.editingProject.id;
      this.apiService.updateProject(editId, payload).subscribe({
        next: (updatedProject) => {
          this.projects = this.projects.map(p =>
            p.id === editId ? { ...p, ...updatedProject } : p
          );
          this.existingProjectNames = this.projects.map(p => p.projectName);
          this.isSavingProject = false;
          this.closeProjectPopup();
        },
        error: (err) => {
          console.error('Update failed', err);
          this.isSavingProject = false;
        },
      });
    } else {
      // CREATE — append to local list, no reload
      this.apiService.createProject(payload).subscribe({
        next: (newProject) => {
          this.projects = [...this.projects, newProject];
          this.existingProjectNames = this.projects.map(p => p.projectName);
          this.isSavingProject = false;
          this.closeProjectPopup();
        },
        error: (err) => {
          console.error('Save failed', err);
          this.isSavingProject = false;
        },
      });
    }
  }

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
        // Remove from local state — no reload
        this.projects = this.projects.filter(p => p.id !== deleteId);
        this.existingProjectNames = this.projects.map(p => p.projectName);
        this.expandedProjectIds.delete(deleteId);
        this.isDeletingProject = false;
        this.cancelDelete();
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.isDeletingProject = false;
      },
    });
  }

  createFormulaRow(): FormulaRow {
    return { parameter1: '', operator: '', parameter2: '', value1: null, value2: null, extraFields: [] };
  }

  toggleUserDropdown(event: Event): void {
    event.stopPropagation();
    this.showUserDropdown = !this.showUserDropdown;
  }

  getAssignedUsers(): string[] {
    const v = this.projectForm.get('assignedUsers')?.value;
    return Array.isArray(v) ? v : [];
  }

  getAssignedUsersLabel(): string {
    const s = this.getAssignedUsers();
    return s.length === 0 ? 'Select users...' : s.join(', ');
  }

  isUserSelected(user: string): boolean { return this.getAssignedUsers().includes(user); }

  toggleAssignedUser(user: string): void {
    const next = this.isUserSelected(user)
      ? this.getAssignedUsers().filter(u => u !== user)
      : [...this.getAssignedUsers(), user];

    this.projectForm.get('assignedUsers')?.setValue(next);
    this.projectForm.get('assignedUsers')?.markAsTouched();
    this.projectForm.get('assignedUsers')?.updateValueAndValidity();
  }

  getAllParameterOptions(): string[] {
    return [...new Set([
      ...this.formulaOptions.map(i => i.parameter1),
      ...this.formulaOptions.map(i => i.parameter2),
    ])];
  }

  getSampleValue(parameter: string): number | null {
    const a = this.formulaOptions.find(i => i.parameter1 === parameter);
    if (a) return a.sampleValue1;
    const b = this.formulaOptions.find(i => i.parameter2 === parameter);
    return b ? b.sampleValue2 : null;
  }

  onParameter1Change(i: number): void {
    this.formulaRows[i].value1 = this.getSampleValue(this.formulaRows[i].parameter1);
    this.calculateFormulaTarget();
  }

  onParameter2Change(i: number): void {
    this.formulaRows[i].value2 = this.getSampleValue(this.formulaRows[i].parameter2);
    this.calculateFormulaTarget();
  }

  onExtraParameterChange(extra: ExtraFormulaField): void {
    extra.value = this.getSampleValue(extra.parameter);
    this.calculateFormulaTarget();
  }

  onAnyFormulaChange(): void { this.calculateFormulaTarget(); }

  toggleAddChoice(i: number, event: Event): void {
    event.stopPropagation();
    this.showAddChoiceIndex = this.showAddChoiceIndex === i ? null : i;
  }

  addExtraField(i: number, type: 'parameter' | 'operator'): void {
    this.formulaRows[i].extraFields.push({ type, parameter: '', operator: '', value: null });
    this.showAddChoiceIndex = null;
    this.calculateFormulaTarget();
  }

  removeExtraField(ri: number, ei: number): void {
    this.formulaRows[ri].extraFields.splice(ei, 1);
    this.calculateFormulaTarget();
  }

  isPositiveNumber(v: number | string | null | undefined): boolean {
    return v !== null && v !== undefined && Number(v) > 0;
  }

  canAddFormulaRow(): boolean {
    return this.formulaRows.every(row => {
      const main = !!row.parameter1 && !!row.operator && !!row.parameter2
        && this.isPositiveNumber(row.value1) && this.isPositiveNumber(row.value2);

      const extras = row.extraFields.every(e =>
        e.type === 'operator' ? !!e.operator : !!e.parameter && this.isPositiveNumber(e.value));

      return main && extras;
    });
  }

  calculateFormulaTarget(): void {
    let total = 0;
    let hasValue = false;

    for (const row of this.formulaRows) {
      if (!row.parameter1 || !row.operator || !row.parameter2
        || !this.isPositiveNumber(row.value1) || !this.isPositiveNumber(row.value2)) continue;

      let v = this.applyOperator(Number(row.value1), row.operator, Number(row.value2));
      if (v === null) continue;

      hasValue = true;
      let pending: Operator | '' = '';

      for (const e of row.extraFields) {
        if (e.type === 'operator') {
          pending = e.operator;
          continue;
        }

        if (!pending || !e.parameter || !this.isPositiveNumber(e.value)) continue;

        const next = this.applyOperator(v, pending, Number(e.value));
        if (next !== null) {
          v = next;
          pending = '';
        }
      }

      total += v;
    }

    this.projectForm.get('target')?.setValue(hasValue ? total.toFixed(2) : '', { emitEvent: false });
  }

  applyOperator(v1: number, op: Operator | '', v2: number): number | null {
    if (op === '+') return v1 + v2;
    if (op === '-') return v1 - v2;
    if (op === '*') return v1 * v2;
    if (op === '/') return v2 > 0 ? v1 / v2 : null;
    return null;
  }

  onDatePickerChange(ctrl: 'projectReceivedDate' | 'startDate' | 'dueDate', e: Event): void {
    const val = ProjectsList.dateInputToDDMMYYYY((e.target as HTMLInputElement).value);
    this.projectForm.get(ctrl)?.setValue(val);
    this.projectForm.get(ctrl)?.markAsTouched();
    this.projectForm.updateValueAndValidity();
  }

  getDatePickerValue(ctrl: 'projectReceivedDate' | 'startDate' | 'dueDate'): string {
    return ProjectsList.ddmmyyyyToDateInput(this.projectForm.get(ctrl)?.value || '');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  getMonthYear(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getCalendarCells(dateStr: string): { day: number | null; isSelected: boolean }[] {
    if (!dateStr) return [];
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();
    const selectedDay = d.getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number | null; isSelected: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, isSelected: false });
    for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, isSelected: i === selectedDay });
    return cells;
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

  private serializeFormulaRows(rows: FormulaRow[]) {
    return rows.map(row => ({
      parameter1:  row.parameter1,
      value1:      Number(row.value1) || 0,
      operator:    row.operator || '',
      parameter2:  row.parameter2,
      value2:      Number(row.value2) || 0,
      extraFields: row.extraFields.map(ef => ({
        type:      ef.type,
        parameter: ef.parameter || '',
        operator:  ef.operator || '',
        value:     ef.value !== null ? Number(ef.value) : 0,
      })),
    }));
  }

  uniqueProjectName(control: AbstractControl): ValidationErrors | null {
    const v = String(control.value || '').trim();
    if (!v) return null;
    const editId = this.editingProject?.id ?? null;
    const names = editId
      ? this.existingProjectNames.filter((_, i) => this.projects[i]?.id !== editId)
      : this.existingProjectNames;
    return names.some(n => n.toLowerCase() === v.toLowerCase()) ? { duplicateProject: true } : null;
  }

  maxWords(max: number) {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = String(c.value || '').trim();
      return v && v.split(/\s+/).length > max ? { maxWords: true } : null;
    };
  }

  validDDMMYYYY(c: AbstractControl): ValidationErrors | null {
    const v = String(c.value || '').trim();
    return v ? (ProjectsList.parseDate(v) ? null : { invalidDateFormat: true }) : null;
  }

  notFutureDate(c: AbstractControl): ValidationErrors | null {
    const d = ProjectsList.parseDate(c.value);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today ? { futureDate: true } : null;
  }

  dateDependencyValidator(g: AbstractControl): ValidationErrors | null {
    const rec   = ProjectsList.parseDate(g.get('projectReceivedDate')?.value);
    const start = ProjectsList.parseDate(g.get('startDate')?.value);
    const due   = ProjectsList.parseDate(g.get('dueDate')?.value);
    if (rec && start && start < rec) return { startBeforeReceived: true };
    if (start && due && due < start) return { dueBeforeStart: true };
    return null;
  }

  static parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const v = String(value).trim();
    if (!/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(v)) return null;
    const [d, m, y] = v.split('/').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
  }

  static dateInputToDDMMYYYY(v: string): string {
    if (!v) return '';
    const [y, m, d] = v.split('-');
    return `${d}/${m}/${y}`;
  }

  static ddmmyyyyToDateInput(v: string): string {
    const d = ProjectsList.parseDate(v);
    return d ? ProjectsList.toDateInputValue(d) : '';
  }

  static toDateInputValue(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}