import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser } from '../../services/auth.service';
import { PackageService } from '../../services/package.service';
import { RoleService, AppRole } from '../../services/role.service';
import { InviteService } from '../../services/invite.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-our-circle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './our-circle.html',
  styleUrl: './our-circle.css',
})
export class OurCircle implements OnInit {
  users: AppUser[] = [];
  loading = true;
  errorMsg = '';

  // Pagination
  pageSize = 5;
  currentPage = 1;

  // ── Role-based UI ────────────────────────────────────────────────
  currentUserRole: string | null = null;

  get isSuperAdmin(): boolean {
    return this.currentUserRole === 'SUPER_ADMIN';
  }

  get isAdmin(): boolean {
    return this.currentUserRole === 'ADMIN';
  }

  // ── Update package modal ─────────────────────────────────────────
  // Signals instead of plain booleans: guarantees the view updates
  // the instant these change, even under coalesced change detection.
  showUpdateModal = signal(false);
  savingUpdate = false;
  updateError = '';
  selectedUpdateEmail: string | null = null;
  selectedUpdatePackageId: number | null = null;
  availablePackages: { id: number; name: string }[] = [];

  emailDropdownOpen = false;
  emailSearchQuery = '';

  packageDropdownOpen = false;
  packageSearchQuery = '';

  // ── Delete user modal ─────────────────────────────────────────────
  showDeleteModal = signal(false);
  deletingUser = false;
  deleteError = '';
  userToDelete: AppUser | null = null;
  deleteConfirmText = '';

  // ── Invite People modal (Admin-only) ───────────────────────────────
  showInviteModal = signal(false);
  sendingInvite = false;
  inviteError = '';

  inviteEmailInput = '';
  invitedEmails: { email: string; valid: boolean }[] = [];

  // Categories dropdown = roles created by THIS admin (same source as create-package's role dropdown)
  inviteRoles: AppRole[] = [];
  loadingInviteRoles = signal(false);
  inviteRoleDropdownOpen = false;
  inviteRoleSearchQuery = '';
  selectedInviteRoleId: number | null = null;

  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private authService: AuthService,
    private packageService: PackageService,
    private roleService: RoleService,
    private inviteService: InviteService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserRole = this.authService.getCurrentUserRole();

    this.authService.getUsers().subscribe({
      next: (res) => {
        this.users = res;
        this.loading = false;
      },
      error: (err) => {
        console.log('Failed to load users', err);
        this.errorMsg = 'Unable to load members right now';
        this.loading = false;
      }
    });

    this.loadAvailablePackages();
  }

  goToCreatePackage(): void {
    this.router.navigate(['/dashboard/create-package']);
  }

  initials(u: AppUser): string {
    return (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  lastActive(u: AppUser): string {
    if (!u.lastLoginAt) return 'Never';

    const diffMs = Date.now() - new Date(u.lastLoginAt).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === 2) return 'Day before';
    return `${diffDays} days ago`;
  }

  lastActiveColor(u: AppUser): string {
    if (!u.lastLoginAt) return 'bg-gray-300';
    const diffMs = Date.now() - new Date(u.lastLoginAt).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'bg-green-500';
    if (diffDays === 1) return 'bg-red-500';
    return 'bg-gray-300';
  }

  packageName(u: AppUser): string {
    if (!u.assignedPackageId) return '—';
    const pkg = this.availablePackages.find(p => p.id === u.assignedPackageId);
    return pkg ? pkg.name : '—';
  }

  // ── Pagination helpers ──────────────────────────────────────────

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.users.length / this.pageSize));
  }

  get pagedUsers(): AppUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.users.slice(start, start + this.pageSize);
  }

  get rangeStart(): number {
    return this.users.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.users.length);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  private fixPageAfterDelete(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  // ── Update package modal ──────────────────────────────────────────

  get filteredEmailUsers(): AppUser[] {
    const q = this.emailSearchQuery.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u => u.email.toLowerCase().includes(q));
  }

  get filteredPackages(): { id: number; name: string }[] {
    const q = this.packageSearchQuery.trim().toLowerCase();
    if (!q) return this.availablePackages;
    return this.availablePackages.filter(p => p.name.toLowerCase().includes(q));
  }

  get selectedPackageName(): string | null {
    const p = this.availablePackages.find(pk => pk.id === this.selectedUpdatePackageId);
    return p ? p.name : null;
  }

  toggleEmailDropdown(): void {
    this.emailDropdownOpen = !this.emailDropdownOpen;
    this.packageDropdownOpen = false;
    if (this.emailDropdownOpen) this.emailSearchQuery = '';
  }

  togglePackageDropdown(): void {
    this.packageDropdownOpen = !this.packageDropdownOpen;
    this.emailDropdownOpen = false;
    if (this.packageDropdownOpen) this.packageSearchQuery = '';
  }

  selectUpdateEmail(email: string): void {
    this.selectedUpdateEmail = email;
    this.emailDropdownOpen = false;
    this.updateError = '';

    const matchedUser = this.users.find(u => u.email === email);
    this.selectedUpdatePackageId = matchedUser?.assignedPackageId ?? null;
  }

  selectUpdatePackage(id: number): void {
    this.selectedUpdatePackageId = id;
    this.packageDropdownOpen = false;
  }

  openUpdateModal(): void {
    this.updateError = '';
    this.selectedUpdateEmail = null;
    this.selectedUpdatePackageId = null;
    this.emailDropdownOpen = false;
    this.packageDropdownOpen = false;
    this.emailSearchQuery = '';
    this.packageSearchQuery = '';
    this.loadAvailablePackages();
    this.showUpdateModal.set(true);
  }

  closeUpdateModal(): void {
    this.showUpdateModal.set(false);
    this.emailDropdownOpen = false;
    this.packageDropdownOpen = false;
    this.updateError = '';
  }

  private loadAvailablePackages(): void {
    this.packageService.getAllPackages().subscribe({
      next: (packages) => {
        this.availablePackages = packages.map(p => ({ id: p.id, name: p.name }));
      },
      error: () => {
        this.availablePackages = [];
      },
    });
  }

  saveUpdate(): void {
    this.updateError = '';

    if (!this.selectedUpdateEmail) {
      this.updateError = 'Select an email ID';
      return;
    }
    if (!this.selectedUpdatePackageId) {
      this.updateError = 'Select a package';
      return;
    }

    const matchedUser = this.users.find(u => u.email === this.selectedUpdateEmail);
    if (!matchedUser) {
      this.updateError = 'Could not find that user';
      return;
    }

    this.savingUpdate = true;
    this.packageService.assignPackage(this.selectedUpdatePackageId, matchedUser.id).subscribe({
      next: () => {
        this.savingUpdate = false;
        matchedUser.assignedPackageId = this.selectedUpdatePackageId;
        alert('Package updated successfully');
        this.closeUpdateModal();
      },
      error: (err) => {
        this.savingUpdate = false;
        this.updateError = err?.error?.message ?? 'Failed to update package';
      },
    });
  }

  // ── Delete user modal ──────────────────────────────────────────────

  openDeleteModal(u: AppUser): void {
    this.userToDelete = u;
    this.deleteConfirmText = '';
    this.deleteError = '';
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.userToDelete = null;
    this.deleteConfirmText = '';
    this.deleteError = '';
  }

  get canConfirmDelete(): boolean {
    return this.deleteConfirmText.trim() === 'DELETE';
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;

    if (!this.canConfirmDelete) {
      this.deleteError = 'Type DELETE exactly to confirm';
      return;
    }

    this.deletingUser = true;
    this.deleteError = '';

    this.authService.deleteUser(this.userToDelete.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== this.userToDelete!.id);
        this.deletingUser = false;
        this.fixPageAfterDelete();
        this.closeDeleteModal();
      },
      error: (err) => {
        this.deletingUser = false;
        this.deleteError = err?.error?.message ?? 'Failed to delete user';
      },
    });
  }

  // ── Invite People modal (Admin-only) ────────────────────────────────

  openInviteModal(): void {
    this.inviteError = '';
    this.inviteEmailInput = '';
    this.invitedEmails = [];
    this.selectedInviteRoleId = null;
    this.inviteRoleDropdownOpen = false;
    this.inviteRoleSearchQuery = '';
    this.loadMyRoles();
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
    this.inviteError = '';
    this.inviteRoleDropdownOpen = false;
  }

  private loadMyRoles(): void {
    this.loadingInviteRoles.set(true);
    this.roleService.getMyRoles().subscribe({
      next: (roles) => {
        this.inviteRoles = roles;
        this.loadingInviteRoles.set(false);
      },
      error: () => {
        this.inviteRoles = [];
        this.loadingInviteRoles.set(false);
      },
    });
  }

  get filteredInviteRoles(): AppRole[] {
    const q = this.inviteRoleSearchQuery.trim().toLowerCase();
    if (!q) return this.inviteRoles;
    return this.inviteRoles.filter(r => r.name.toLowerCase().includes(q));
  }

  get selectedInviteRoleName(): string | null {
    return this.inviteRoles.find(r => r.id === this.selectedInviteRoleId)?.name ?? null;
  }

  toggleInviteRoleDropdown(): void {
    this.inviteRoleDropdownOpen = !this.inviteRoleDropdownOpen;
    if (this.inviteRoleDropdownOpen) this.inviteRoleSearchQuery = '';
  }

  selectInviteRole(roleId: number): void {
    this.selectedInviteRoleId = roleId;
    this.inviteRoleDropdownOpen = false;
  }

  addInviteEmail(): void {
    const value = this.inviteEmailInput.trim();
    if (!value) return;

    const alreadyAdded = this.invitedEmails.some(e => e.email.toLowerCase() === value.toLowerCase());
    if (!alreadyAdded) {
      this.invitedEmails.push({ email: value, valid: this.emailPattern.test(value) });
    }
    this.inviteEmailInput = '';
  }

  onInviteEmailKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addInviteEmail();
    }
  }

  removeInviteEmail(index: number): void {
    this.invitedEmails.splice(index, 1);
  }

  get canSendInvite(): boolean {
    return this.invitedEmails.length > 0 && this.invitedEmails.every(e => e.valid);
  }

  sendInvite(): void {
    this.inviteError = '';

    if (this.inviteEmailInput.trim()) this.addInviteEmail();

    if (!this.invitedEmails.length) {
      this.inviteError = 'Add at least one email ID';
      return;
    }
    if (!this.canSendInvite) {
      this.inviteError = 'Fix the invalid email addresses before sending';
      return;
    }

    this.sendingInvite = true;

    const requests = this.invitedEmails.map(e =>
      this.inviteService.sendInvite({
        email: e.email,
        roleId: this.selectedInviteRoleId,
      })
    );

    let completed = 0;
    let failed = false;

    requests.forEach(req => {
      req.subscribe({
        next: () => {
          completed++;
          if (completed === requests.length && !failed) {
            this.sendingInvite = false;
            alert('Invite(s) sent — the recipient will get an email with a link to register.');
            this.closeInviteModal();
          }
        },
        error: (err) => {
          failed = true;
          this.sendingInvite = false;
          this.inviteError = err?.error?.message ?? 'Failed to send one or more invites';
        },
      });
    });
  }

  // ── Create Role (placeholder — page not built yet) ──────────────────

  goToCreateRole(): void {
  this.router.navigate(['/dashboard/create-package']);
}
}