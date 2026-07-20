import {
  Component,
  OnInit,
  OnChanges,
  Input,
  Output,
  EventEmitter,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProjectService, Project, ProjectPayload } from '../../app/services/project.service';
import { AuthService, TeamMember } from '../../app/services/auth.service';
type Operator = '+' | '-' | '*' | '/';

export type ExtraFormulaField = {
  type: 'parameter' | 'operator';
  parameter: string;
  operator: Operator | '';
  value: number | null;
};

export type FormulaRow = {
  parameter1: string;
  operator: Operator | '';
  parameter2: string;
  value1: number | null;
  value2: number | null;
  extraFields: ExtraFormulaField[];
};

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './create-project-modal.html',
})
export class CreateProjectModalComponent implements OnInit, OnChanges {

  // ── Inputs ────────────────────────────────────────────────────────
  @Input() editingProject: Project | null = null;
  @Input() existingProjects: Project[] = [];

  // ── Outputs ───────────────────────────────────────────────────────
  @Output() projectSaved  = new EventEmitter<Project>();
  @Output() modalClosed   = new EventEmitter<void>();

  // ── State ─────────────────────────────────────────────────────────
  isSaving = false;
  showUserDropdown = false;
  showAddChoiceIndex: number | null = null;

  formulaRows: FormulaRow[] = [this.createFormulaRow()];
  operatorOptions: Operator[] = ['+', '-', '*', '/'];
  formulaOptions = [
    { parameter1: 'Total Working Minutes', parameter2: 'Minutes per Unit', sampleValue1: 480, sampleValue2: 30 },
    { parameter1: 'Total Working Hours',   parameter2: 'Hours per Unit',   sampleValue1: 8,   sampleValue2: 2  },
    { parameter1: 'Monthly Target',        parameter2: 'Working Days',     sampleValue1: 1200, sampleValue2: 24 },
  ];

  users: string[] = [];
  todayInputValue = CreateProjectModalComponent.toDateInputValue(new Date());

  projectForm;

  constructor(
  private fb: FormBuilder,
  private projectService: ProjectService,
  private authService: AuthService,
  @Inject(PLATFORM_ID) private platformId: object,
) {
  this.projectForm = this.buildForm();
}


  ngOnInit(): void {
    this.loadTeamMembers();
    this.initForm();
  }

  ngOnChanges(): void {
    this.initForm();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-dropdown-wrapper')) this.showUserDropdown = false;
  }

  private loadTeamMembers(): void {
  this.authService.getTeamMembers().subscribe({
    next: (members: TeamMember[]) => {
      this.users = members.map(m => `${m.firstName} ${m.lastName}`.trim());
    },
    error: (err) => console.error('Failed to load team members', err),
  });
}

  private initForm(): void {
    this.projectForm = this.buildForm();
    this.showUserDropdown = false;
    this.showAddChoiceIndex = null;

    if (this.editingProject) {
      this.projectForm.patchValue({
        projectName:         this.editingProject.projectName,
        projectReceivedDate: CreateProjectModalComponent.dateInputToDDMMYYYY(this.editingProject.projectReceivedDate.substring(0, 10)),
        startDate:           CreateProjectModalComponent.dateInputToDDMMYYYY(this.editingProject.startDate.substring(0, 10)),
        dueDate:             CreateProjectModalComponent.dateInputToDDMMYYYY(this.editingProject.dueDate.substring(0, 10)),
        assignedUsers:       [...this.editingProject.assignedUsers],
        projectDescription:  this.editingProject.projectDescription || '',
      });

      this.formulaRows = (this.editingProject.formulaRows || []).map(row => ({
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

      if (this.formulaRows.length === 0) this.formulaRows = [this.createFormulaRow()];
    } else {
      this.formulaRows = [this.createFormulaRow()];
    }

    this.calculateFormulaTarget();
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

  // ── Save ──────────────────────────────────────────────────────────

  save(): void {
    if (this.isSaving) return;
    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid || !this.canAddFormulaRow()) return;

    const fv = this.projectForm.getRawValue();
    const payload: ProjectPayload = {
      projectName:         fv.projectName || '',
      projectDescription:  fv.projectDescription || '',
      projectReceivedDate: CreateProjectModalComponent.ddmmyyyyToDateInput(fv.projectReceivedDate || ''),
      startDate:           CreateProjectModalComponent.ddmmyyyyToDateInput(fv.startDate || ''),
      dueDate:             CreateProjectModalComponent.ddmmyyyyToDateInput(fv.dueDate || ''),
      assignedUsers:       Array.isArray(fv.assignedUsers) ? fv.assignedUsers : [],
      formulaRows:         this.serializeFormulaRows(this.formulaRows),
    };

    this.isSaving = true;

    const request$ = this.editingProject
      ? this.projectService.updateProject(this.editingProject.id, payload)
      : this.projectService.createProject(payload);

    request$.subscribe({
      next: (result) => {
        this.isSaving = false;
        this.projectSaved.emit(result);
      },
      error: (err) => {
        console.error('Save failed', err);
        this.isSaving = false;
      },
    });
  }

  close(): void {
    this.modalClosed.emit();
  }

  // ── User dropdown ─────────────────────────────────────────────────

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

  // ── Formula ───────────────────────────────────────────────────────

  createFormulaRow(): FormulaRow {
    return { parameter1: '', operator: '', parameter2: '', value1: null, value2: null, extraFields: [] };
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
        if (e.type === 'operator') { pending = e.operator; continue; }
        if (!pending || !e.parameter || !this.isPositiveNumber(e.value)) continue;
        const next = this.applyOperator(v, pending, Number(e.value));
        if (next !== null) { v = next; pending = ''; }
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

  // ── Date helpers ──────────────────────────────────────────────────

  onDatePickerChange(ctrl: 'projectReceivedDate' | 'startDate' | 'dueDate', e: Event): void {
    const val = CreateProjectModalComponent.dateInputToDDMMYYYY((e.target as HTMLInputElement).value);
    this.projectForm.get(ctrl)?.setValue(val);
    this.projectForm.get(ctrl)?.markAsTouched();
    this.projectForm.updateValueAndValidity();
  }

  getDatePickerValue(ctrl: 'projectReceivedDate' | 'startDate' | 'dueDate'): string {
    return CreateProjectModalComponent.ddmmyyyyToDateInput(this.projectForm.get(ctrl)?.value || '');
  }

  // ── Validators ────────────────────────────────────────────────────

  uniqueProjectName(control: AbstractControl): ValidationErrors | null {
    const v = String(control.value || '').trim();
    if (!v) return null;
    const editId = this.editingProject?.id ?? null;
    const names = this.existingProjects
      .filter(p => editId ? p.id !== editId : true)
      .map(p => p.projectName);
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
    return v ? (CreateProjectModalComponent.parseDate(v) ? null : { invalidDateFormat: true }) : null;
  }

  notFutureDate(c: AbstractControl): ValidationErrors | null {
    const d = CreateProjectModalComponent.parseDate(c.value);
    if (!d) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d > today ? { futureDate: true } : null;
  }

  dateDependencyValidator(g: AbstractControl): ValidationErrors | null {
    const rec   = CreateProjectModalComponent.parseDate(g.get('projectReceivedDate')?.value);
    const start = CreateProjectModalComponent.parseDate(g.get('startDate')?.value);
    const due   = CreateProjectModalComponent.parseDate(g.get('dueDate')?.value);
    if (rec && start && start < rec) return { startBeforeReceived: true };
    if (start && due && due < start) return { dueBeforeStart: true };
    return null;
  }

  // ── Static helpers ────────────────────────────────────────────────

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
    const d = CreateProjectModalComponent.parseDate(v);
    return d ? CreateProjectModalComponent.toDateInputValue(d) : '';
  }

  static toDateInputValue(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}