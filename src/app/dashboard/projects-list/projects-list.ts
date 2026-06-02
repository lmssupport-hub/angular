import { Component } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ApiService } from '../../services/api.service';

type Operator = '+' | '-' | '×' | '÷';

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
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.css',
})
export class ProjectsList {
  showProjectPopup = false;
  showAddChoiceIndex: number | null = null;
  showUserDropdown = false;
  isSavingProject = false;

  users = ['test name 1', 'test name2', 'test name 3'];
  existingProjects = ['Cloud Migration Alpha', 'Brand Refresh 2024'];

  operatorOptions: Operator[] = ['+', '-', '×', '÷'];

  formulaOptions = [
    { parameter1: 'Total Working Minutes', parameter2: 'Minutes per Unit', sampleValue1: 480, sampleValue2: 30 },
    { parameter1: 'Total Working Hours', parameter2: 'Hours per Unit', sampleValue1: 8, sampleValue2: 2 },
    { parameter1: 'Monthly Target', parameter2: 'Working Days', sampleValue1: 1200, sampleValue2: 24 },
  ];

  formulaRows: FormulaRow[] = [this.createFormulaRow()];
  todayInputValue = ProjectsList.toDateInputValue(new Date());

  projectForm;

  constructor(private fb: FormBuilder, private apiService: ApiService) {
    this.projectForm = this.fb.group(
      {
        projectName: ['', [Validators.required, this.uniqueProjectName.bind(this)]],
        projectReceivedDate: ['', [Validators.required, this.validDDMMYYYY, this.notFutureDate]],
        assignedUsers: this.fb.control<string[]>([], [Validators.required]),
        startDate: ['', [Validators.required, this.validDDMMYYYY]],
        dueDate: ['', [Validators.required, this.validDDMMYYYY]],
        target: [{ value: '', disabled: true }],
        projectDescription: ['', [this.maxWords(500)]],
      },
      {
        validators: [this.dateDependencyValidator],
      }
    );
  }

  createFormulaRow(): FormulaRow {
    return {
      parameter1: '',
      operator: '',
      parameter2: '',
      value1: null,
      value2: null,
      extraFields: [],
    };
  }

  openProjectPopup(): void {
    this.showProjectPopup = true;
  }

  closeProjectPopup(): void {
    this.showProjectPopup = false;
    this.showAddChoiceIndex = null;
    this.showUserDropdown = false;
    this.isSavingProject = false;

    this.projectForm.reset({
      projectName: '',
      projectReceivedDate: '',
      assignedUsers: [],
      startDate: '',
      dueDate: '',
      target: '',
      projectDescription: '',
    });

    this.formulaRows = [this.createFormulaRow()];
    this.calculateFormulaTarget();
  }

  toggleUserDropdown(): void {
    this.showUserDropdown = !this.showUserDropdown;
  }

  getAssignedUsers(): string[] {
    const value = this.projectForm.get('assignedUsers')?.value;
    return Array.isArray(value) ? value : [];
  }

  getAssignedUsersLabel(): string {
    const selectedUsers = this.getAssignedUsers();

    if (selectedUsers.length === 0) {
      return 'Select users...';
    }

    return selectedUsers.join(', ');
  }

  isUserSelected(user: string): boolean {
    return this.getAssignedUsers().includes(user);
  }

  toggleAssignedUser(user: string): void {
    const selectedUsers = this.getAssignedUsers();
    const nextUsers = selectedUsers.includes(user)
      ? selectedUsers.filter(item => item !== user)
      : [...selectedUsers, user];

    this.projectForm.get('assignedUsers')?.setValue(nextUsers);
    this.projectForm.get('assignedUsers')?.markAsTouched();
    this.projectForm.get('assignedUsers')?.updateValueAndValidity();
  }

  saveProject(): void {
    if (this.isSavingProject) {
      return;
    }

    if (this.projectForm.invalid || !this.canAddFormulaRow()) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const formValue = this.projectForm.getRawValue();
    const assignedUsers = Array.isArray(formValue.assignedUsers) ? formValue.assignedUsers : [];

    const payload = {
      projectName: formValue.projectName || '',
      projectDescription: formValue.projectDescription || '',
      projectReceivedDate: ProjectsList.ddmmyyyyToDateInput(formValue.projectReceivedDate || ''),
      startDate: ProjectsList.ddmmyyyyToDateInput(formValue.startDate || ''),
      dueDate: ProjectsList.ddmmyyyyToDateInput(formValue.dueDate || ''),
      assignedUsers,
      formulaRows: this.formulaRows.map(row => ({
        parameter1: row.parameter1,
        value1: Number(row.value1),
        operator: row.operator || '',
        parameter2: row.parameter2,
        value2: Number(row.value2),
        extraFields: row.extraFields.map(extra => ({
          type: extra.type,
          parameter: extra.parameter || '',
          operator: extra.operator || '',
          value: extra.value === null ? null : Number(extra.value),
        })),
      })),
    };

    this.isSavingProject = true;

    this.apiService.createProject(payload).subscribe({
      next: (res: unknown) => {
        console.log('Project saved successfully', res);
        this.isSavingProject = false;
        this.closeProjectPopup();
      },
      error: (err: unknown) => {
        console.error('Project save failed', err);
        this.isSavingProject = false;
        this.projectForm.markAllAsTouched();
      },
    });
  }

  getAllParameterOptions(): string[] {
    const parameter1List = this.formulaOptions.map(item => item.parameter1);
    const parameter2List = this.formulaOptions.map(item => item.parameter2);
    return [...new Set([...parameter1List, ...parameter2List])];
  }

  getSampleValue(parameter: string): number | null {
    const asParameter1 = this.formulaOptions.find(item => item.parameter1 === parameter);
    if (asParameter1) return asParameter1.sampleValue1;

    const asParameter2 = this.formulaOptions.find(item => item.parameter2 === parameter);
    if (asParameter2) return asParameter2.sampleValue2;

    return null;
  }

  onParameter1Change(index: number): void {
    const row = this.formulaRows[index];
    row.value1 = this.getSampleValue(row.parameter1);
    this.calculateFormulaTarget();
  }

  onParameter2Change(index: number): void {
    const row = this.formulaRows[index];
    row.value2 = this.getSampleValue(row.parameter2);
    this.calculateFormulaTarget();
  }

  onExtraParameterChange(extra: ExtraFormulaField): void {
    extra.value = this.getSampleValue(extra.parameter);
    this.calculateFormulaTarget();
  }

  onAnyFormulaChange(): void {
    this.calculateFormulaTarget();
  }

  toggleAddChoice(index: number): void {
    this.showAddChoiceIndex = this.showAddChoiceIndex === index ? null : index;
  }

  addExtraField(index: number, type: 'parameter' | 'operator'): void {
    this.formulaRows[index].extraFields.push({
      type,
      parameter: '',
      operator: '',
      value: null,
    });

    this.showAddChoiceIndex = null;
    this.calculateFormulaTarget();
  }

  removeExtraField(rowIndex: number, extraIndex: number): void {
    this.formulaRows[rowIndex].extraFields.splice(extraIndex, 1);
    this.calculateFormulaTarget();
  }

  isPositiveNumber(value: number | string | null | undefined): boolean {
    return value !== null && value !== undefined && Number(value) > 0;
  }

  canAddFormulaRow(): boolean {
    return this.formulaRows.every(row => {
      const mainRowValid =
        !!row.parameter1 &&
        !!row.operator &&
        !!row.parameter2 &&
        this.isPositiveNumber(row.value1) &&
        this.isPositiveNumber(row.value2);

      const extraFieldsValid = row.extraFields.every(extra => {
        if (extra.type === 'operator') return !!extra.operator;
        return !!extra.parameter && this.isPositiveNumber(extra.value);
      });

      return mainRowValid && extraFieldsValid;
    });
  }

  calculateFormulaTarget(): void {
    let total = 0;
    let hasCalculatedValue = false;

    for (const row of this.formulaRows) {
      if (
        !row.parameter1 ||
        !row.operator ||
        !row.parameter2 ||
        !this.isPositiveNumber(row.value1) ||
        !this.isPositiveNumber(row.value2)
      ) {
        continue;
      }

      let rowValue = this.applyOperator(Number(row.value1), row.operator, Number(row.value2));
      if (rowValue === null) continue;

      hasCalculatedValue = true;
      let pendingOperator: Operator | '' = '';

      for (const extra of row.extraFields) {
        if (extra.type === 'operator') {
          pendingOperator = extra.operator;
        }

        if (extra.type === 'parameter') {
          if (!pendingOperator || !extra.parameter || !this.isPositiveNumber(extra.value)) continue;

          const nextValue = this.applyOperator(rowValue, pendingOperator, Number(extra.value));
          if (nextValue === null) continue;

          rowValue = nextValue;
          pendingOperator = '';
        }
      }

      total += rowValue;
    }

    this.projectForm.get('target')?.setValue(hasCalculatedValue ? total.toFixed(2) : '', {
      emitEvent: false,
    });
  }

  applyOperator(value1: number, operator: Operator | '', value2: number): number | null {
    if (operator === '+') return value1 + value2;
    if (operator === '-') return value1 - value2;
    if (operator === '×') return value1 * value2;
    if (operator === '÷') return value2 > 0 ? value1 / value2 : null;
    return null;
  }

  onDatePickerChange(
    controlName: 'projectReceivedDate' | 'startDate' | 'dueDate',
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const formattedDate = ProjectsList.dateInputToDDMMYYYY(input.value);

    this.projectForm.get(controlName)?.setValue(formattedDate);
    this.projectForm.get(controlName)?.markAsTouched();
    this.projectForm.updateValueAndValidity();
  }

  getDatePickerValue(controlName: 'projectReceivedDate' | 'startDate' | 'dueDate'): string {
    return ProjectsList.ddmmyyyyToDateInput(this.projectForm.get(controlName)?.value || '');
  }

  uniqueProjectName(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').trim();
    if (!value) return null;

    const exists = this.existingProjects.some(
      name => name.toLowerCase() === value.toLowerCase()
    );

    return exists ? { duplicateProject: true } : null;
  }

  maxWords(max: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value || '').trim();
      if (!value) return null;

      const words = value.split(/\s+/).length;
      return words > max ? { maxWords: true } : null;
    };
  }

  validDDMMYYYY(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').trim();
    if (!value) return null;

    return ProjectsList.parseDate(value) ? null : { invalidDateFormat: true };
  }

  notFutureDate(control: AbstractControl): ValidationErrors | null {
    const date = ProjectsList.parseDate(control.value);
    if (!date) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date > today ? { futureDate: true } : null;
  }

  dateDependencyValidator(group: AbstractControl): ValidationErrors | null {
    const received = ProjectsList.parseDate(group.get('projectReceivedDate')?.value);
    const start = ProjectsList.parseDate(group.get('startDate')?.value);
    const due = ProjectsList.parseDate(group.get('dueDate')?.value);

    if (received && start && start < received) {
      return { startBeforeReceived: true };
    }

    if (start && due && due < start) {
      return { dueBeforeStart: true };
    }

    return null;
  }

  static parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;

    const dateValue = String(value).trim();
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!regex.test(dateValue)) return null;

    const [day, month, year] = dateValue.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  static dateInputToDDMMYYYY(value: string): string {
    if (!value) return '';

    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  static ddmmyyyyToDateInput(value: string): string {
    const date = ProjectsList.parseDate(value);
    if (!date) return '';

    return ProjectsList.toDateInputValue(date);
  }

  static toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}