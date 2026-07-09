import { Component, OnInit , signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PackageService } from '../../services/package.service';
import { RoleService } from '../../services/role.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';


export interface Permission { create: boolean; read: boolean; update: boolean; delete: boolean; }
export interface Feature { id: string; name: string; permissions: Permission; }
export interface Category { id: string; name: string; enabled: boolean; features: Feature[]; }

type Mode = 'PACKAGE' | 'ROLE';

@Component({
  selector: 'app-create-package',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-package.html',
  styleUrl: './create-package.css',
})
export class CreatePackage implements OnInit {

  mode: Mode = 'PACKAGE';

  labels = {
    dropdownPlaceholder: 'Available packages',
    nameFieldPlaceholder: 'Enter package name',
    saveButton: 'Save package',
    updateButton: 'Update package',
    savingLabel: 'Saving...',
    updatingLabel: 'Updating...',
  };

  packageName = '';
  selectedExistingId: number | null = null;
  availableItems: { id: number; name: string }[] = [];

  featureSearch = '';
  categories: Category[] = [];

  // Ceiling inherited from the Admin's assigned package. null in PACKAGE mode = no ceiling.
  allowedFeatures: Category[] | null = null;

  saving = false;
  loadError = '';
loadingItems = signal(false);

readonly permissionKeys: (keyof Permission)[] = ['create', 'read', 'update', 'delete'];

  constructor(
    private packageService: PackageService,
    private roleService: RoleService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const role = this.authService.getCurrentUserRole();
    this.mode = role === 'ADMIN' ? 'ROLE' : 'PACKAGE';

    if (this.mode === 'ROLE') {
      this.labels = {
        dropdownPlaceholder: 'Available roles',
        nameFieldPlaceholder: 'Enter role name',
        saveButton: 'Save role',
        updateButton: 'Update role',
        savingLabel: 'Saving...',
        updatingLabel: 'Updating...',
      };
      this.loadAdminModeData();
    } else {
      this.categories = this.defaultCategories();
      this.loadAvailablePackages();
    }
  }

  private loadAdminModeData(): void {
    this.roleService.getAssignedFeatures().subscribe({
      next: (features) => {
        this.allowedFeatures = features;
        this.categories = this.blankCopyOf(features);
        this.loadAvailableRoles();
      },
      error: () => {
        this.allowedFeatures = [];
        this.categories = [];
        this.loadError = 'No package has been assigned to you yet. Contact your Super Admin.';
      },
    });
  }

  private blankCopyOf(source: Category[]): Category[] {
    return source.map(cat => ({
      id: cat.id,
      name: cat.name,
      enabled: false,
      features: cat.features.map(f => ({
        id: f.id,
        name: f.name,
        permissions: { create: false, read: false, update: false, delete: false },
      })),
    }));
  }

  private defaultCategories(): Category[] {
    const blankPerm = (): Permission => ({ create: false, read: false, update: false, delete: false });
    return [
      { id: 'auth', name: 'Authentication', enabled: false, features: [
        { id: 'auth-access', name: 'User Authentication & Access', permissions: blankPerm() },
      ]},
      { id: 'project-mgmt', name: 'Project Management', enabled: false, features: [
        { id: 'create-project', name: 'Create project', permissions: blankPerm() },
        { id: 'project-hub', name: 'Project hub', permissions: blankPerm() },
      ]},
      { id: 'task-mgmt', name: 'Task management', enabled: false, features: [
        { id: 'create-task', name: 'Create task', permissions: blankPerm() },
        { id: 'task-hub', name: 'Task hub', permissions: blankPerm() },
      ]},
      { id: 'report-mgmt', name: 'Report management', enabled: false, features: [
        { id: 'dashboard', name: 'Dashboard', permissions: blankPerm() },
      ]},
      { id: 'error-mgmt', name: 'Error management', enabled: false, features: [
        { id: 'error-tracker', name: 'Error tracker', permissions: blankPerm() },
      ]},
    ];
  }

  get filteredCategories(): Category[] {
    const term = this.featureSearch.trim().toLowerCase();
    if (!term) return this.categories;
    return this.categories
      .map(cat => {
        const catMatches = cat.name.toLowerCase().includes(term);
        const matchingFeatures = cat.features.filter(f => f.name.toLowerCase().includes(term));
        if (catMatches || matchingFeatures.length > 0) {
          return { ...cat, features: catMatches ? cat.features : matchingFeatures };
        }
        return null;
      })
      .filter((c): c is Category => c !== null);
  }

  // ── Ceiling checks (ROLE mode only — always true in PACKAGE mode) ──
  isPermissionAllowed(catId: string, featureId: string, key: keyof Permission): boolean {
    if (this.mode === 'PACKAGE' || !this.allowedFeatures) return true;
    const cat = this.allowedFeatures.find(c => c.id === catId);
    const feature = cat?.features.find(f => f.id === featureId);
    return !!feature?.permissions[key];
  }

  isCategoryAllowed(catId: string): boolean {
    if (this.mode === 'PACKAGE' || !this.allowedFeatures) return true;
    return !!this.allowedFeatures.find(c => c.id === catId)?.enabled;
  }

  toggleCategory(category: Category): void {
    if (!this.isCategoryAllowed(category.id)) return;
    category.enabled = !category.enabled;
    category.features.forEach(f => {
      this.permissionKeys.forEach(key => {
        f.permissions[key] = category.enabled && this.isPermissionAllowed(category.id, f.id, key);
      });
    });
  }

  togglePermission(category: Category, feature: Feature, key: keyof Permission): void {
    if (!this.isPermissionAllowed(category.id, feature.id, key)) return;
    feature.permissions[key] = !feature.permissions[key];
    category.enabled = category.features.some(f =>
      f.permissions.create || f.permissions.read || f.permissions.update || f.permissions.delete);
  }

  private loadAvailablePackages(): void {
    this.loadingItems.set(true);
    this.packageService.getAllPackages().subscribe({
      next: (packages) => {
        this.availableItems = packages.map(p => ({ id: p.id, name: p.name }));
        this.loadingItems.set(false);
      },
      error: () => {
        this.availableItems = [];
        this.loadingItems.set(false);
      },
    });
}

private loadAvailableRoles(): void {
    this.loadingItems.set(true);
    this.roleService.getMyRoles().subscribe({
      next: (roles) => {
        this.availableItems = roles.map(r => ({ id: r.id, name: r.name }));
        this.loadingItems.set(false);
      },
      error: (err) => {
        console.error('Failed to load roles:', err.status, err.error);
        this.availableItems = [];
        this.loadingItems.set(false);
      },
    });
}

  onExistingItemChange(): void {
    if (this.selectedExistingId == null) {
      this.packageName = '';
      this.categories = this.mode === 'ROLE' ? this.blankCopyOf(this.allowedFeatures ?? []) : this.defaultCategories();
      return;
    }

    if (this.mode === 'ROLE') {
      this.roleService.getRoleById(this.selectedExistingId).subscribe({
        next: (role) => {
          this.packageName = role.name;
          this.categories = this.mergeWithAllowed(role.permissions);
        },
      });
    } else {
      this.packageService.getPackageById(this.selectedExistingId).subscribe({
        next: (pkg) => {
          this.packageName = pkg.name;
          this.categories = pkg.permissions?.length ? pkg.permissions : this.defaultCategories();
        },
      });
    }
  }

  // Guards against a saved role holding permissions the package no longer grants
  private mergeWithAllowed(saved: Category[]): Category[] {
    if (!this.allowedFeatures) return saved;
    const base = this.blankCopyOf(this.allowedFeatures);
    base.forEach(cat => {
      const savedCat = saved.find(c => c.id === cat.id);
      if (!savedCat) return;
      cat.features.forEach(f => {
        const savedFeature = savedCat.features.find(sf => sf.id === f.id);
        if (!savedFeature) return;
        this.permissionKeys.forEach(key => {
          f.permissions[key] = savedFeature.permissions[key] && this.isPermissionAllowed(cat.id, f.id, key);
        });
      });
      cat.enabled = cat.features.some(f => Object.values(f.permissions).some(Boolean));
    });
    return base;
  }

  cancel(): void {
    this.packageName = '';
    this.selectedExistingId = null;
    this.categories = this.mode === 'ROLE' ? this.blankCopyOf(this.allowedFeatures ?? []) : this.defaultCategories();
  }

  savePackage(): void {
    if (!this.packageName.trim()) {
      alert(`Enter a ${this.mode === 'ROLE' ? 'role' : 'package'} name before saving`);
      return;
    }

    this.saving = true;
    const payload = { name: this.packageName.trim(), permissions: this.categories };

    const request$ = this.mode === 'ROLE'
      ? (this.selectedExistingId
          ? this.roleService.updateRole(this.selectedExistingId, payload)
          : this.roleService.createRole(payload))
      : (this.selectedExistingId
          ? this.packageService.updatePackageWithPermissions(this.selectedExistingId, payload)
          : this.packageService.createPackageWithPermissions(payload));

    request$.subscribe({
      next: () => {
        this.saving = false;
        const label = this.mode === 'ROLE' ? 'Role' : 'Package';
        alert(this.selectedExistingId ? `${label} updated successfully` : `${label} saved successfully`);
        this.resetForm();
        this.router.navigate(['/dashboard/our-circle']);
      },
      error: (err) => {
        this.saving = false;
        alert(err?.error?.message ?? 'Failed to save');
      },
    });
}

private resetForm(): void {
    this.packageName = '';
    this.selectedExistingId = null;
    this.featureSearch = '';
    this.categories = this.mode === 'ROLE' ? this.blankCopyOf(this.allowedFeatures ?? []) : this.defaultCategories();
}
}