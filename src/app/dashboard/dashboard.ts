  import {
    ChangeDetectorRef,
    Component,
    Inject,
    NgZone,
    OnInit,
    PLATFORM_ID,
  } from '@angular/core';
  import { CommonModule, isPlatformBrowser } from '@angular/common';
  import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
  import { AuthService } from '../services/auth.service';

  @Component({
    selector: 'app-dashboard',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css',
  })
  export class Dashboard implements OnInit {
    isProjectsOpen = false;
    isTasksOpen = false;
    isSidebarOpen = true;
    isDarkMode = false;
    loggedInUser: any = null;
    userPhotoLoadFailed = false;

    constructor(
      @Inject(PLATFORM_ID) private platformId: object,
      private router: Router,
      private apiService: AuthService,
      private ngZone: NgZone,
      private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
      if (!isPlatformBrowser(this.platformId)) return;

      const userData = localStorage.getItem('loggedInUser');

      if (userData) {
        this.loggedInUser = JSON.parse(userData);
        this.userPhotoLoadFailed = false;
      }

      const saved = localStorage.getItem('theme');

      this.isDarkMode = saved === 'dark';

      if (this.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    toggleSidebar(event?: Event): void {
      event?.preventDefault();
      event?.stopPropagation();

      this.ngZone.run(() => {
        this.isSidebarOpen = !this.isSidebarOpen;

        if (!this.isSidebarOpen) {
          this.isProjectsOpen = false;
          this.isTasksOpen = false;
        }

        this.cdr.detectChanges();
      });
    }

    toggleDarkMode(): void {
      if (!isPlatformBrowser(this.platformId)) return;

      this.ngZone.run(() => {
        this.isDarkMode = !this.isDarkMode;

        if (this.isDarkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }

        this.cdr.detectChanges();
      });
    }

    get activePageTitle(): string {
      const currentUrl = this.router.url.split('?')[0].split('#')[0];

      const titles: Record<string, string> = {
        '/dashboard': 'Dashboard',
        '/dashboard/home': 'Dashboard',
        '/dashboard/projects': 'Projects',
        '/dashboard/projects-list': 'Projects List',
        '/dashboard/tasks': 'Tasks',
        '/dashboard/task-list': 'Task List',
        '/dashboard/meeting-workspace': 'Meeting workspace',
        '/dashboard/error-list': 'Error List',
        '/dashboard/settings': 'Settings',
        '/dashboard/our-circle': 'Our Circle',
        '/dashboard/create-package': 'Create Package',
      };

      return titles[currentUrl] ?? 'Dashboard';
    }

    get userDisplayName(): string {
      const user = this.loggedInUser;
      if (!user) return 'User';

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

      return (
        fullName ||
        user.fullName ||
        user.name ||
        user.username ||
        user.email?.split('@')[0] ||
        'User'
      );
    }

    get userInitials(): string {
      const user = this.loggedInUser;

      if (user?.firstName || user?.lastName) {
        return `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase();
      }

      return this.userDisplayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase() || 'U';
    }

    get userPhotoUrl(): string | null {
      if (this.userPhotoLoadFailed) return null;

      const user = this.loggedInUser;
      const photo =
        user?.avatarUrl ||
        user?.photoUrl ||
        user?.photo ||
        user?.profilePhoto ||
        user?.profileImage ||
        user?.profilePicture ||
        user?.imageUrl ||
        user?.picture;

      return typeof photo === 'string' && photo.trim() ? photo.trim() : null;
    }

    onUserPhotoError(): void {
      this.userPhotoLoadFailed = true;
      this.cdr.detectChanges();
    }

    openProjectsMenu(): void {
      this.isProjectsOpen = !this.isProjectsOpen;
      this.isTasksOpen = false;
    }

    closeProjectsMenu(): void {
      this.isProjectsOpen = false;
    }

    openTasksMenu(): void {
      this.isTasksOpen = !this.isTasksOpen;
      this.isProjectsOpen = false;
    }

    closeTasksMenu(): void {
      this.isTasksOpen = false;
    }

    logout(): void {
      this.apiService.logout();
      this.router.navigate(['/login']);
    }
  }
