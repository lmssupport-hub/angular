import {
  ChangeDetectorRef,
  Component,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService, NotificationItem } from '../services/notification.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  isProjectsOpen = false;
  isTasksOpen = false;
  isSidebarOpen = true;
  isDarkMode = false;
  loggedInUser: any = null;
  userPhotoLoadFailed = false;

  // ── Notification bell state ──────────────────────────────────
  isNotificationPanelOpen = false;
  notifications: NotificationItem[] = [];
  unreadCount = 0;
  notificationsLoading = false;
  notificationsError = false;
  bellBump = false; // drives the CSS "pop" animation on new notifications

  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private refreshSub: Subscription | null = null;
  private bellAudio: HTMLAudioElement | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router,
    private apiService: AuthService,
    private notificationService: NotificationService,
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

    // Preload the bell sound once. Browsers block autoplay until the
    // user has interacted with the page at least once — that's fine,
    // the .play() call in playBellSound() just no-ops until then.
    this.bellAudio = new Audio('/assets/sounds/notification-bell.mp3');
    this.bellAudio.volume = 0.5;

    // Load unread count on entry, then poll every 10s so the badge
    // stays fresh without the user needing to refresh the page.
    this.loadUnreadCount();
    this.pollHandle = setInterval(() => this.loadUnreadCount(), 10000);

    // Instant refresh whenever anything in the app calls
    // notificationService.notifyChanged() — e.g. right after a task
    // assign / project update succeeds in this same browser session.
    this.refreshSub = this.notificationService.refresh$.subscribe(() => {
      this.loadUnreadCount();
    });
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
    this.refreshSub?.unsubscribe();
  }

  // ── Sidebar menu visibility based on assigned package (ADMIN) / role (MEMBER) ──
  // SUPER_ADMIN always sees everything.
  get canSeeDashboard(): boolean {
    return this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('report-mgmt');
  }

  get canSeeProjects(): boolean {
    return this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('project-mgmt');
  }

  get canSeeTasks(): boolean {
    return this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('task-mgmt');
  }

  get canSeeErrorTracking(): boolean {
    return this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('error-mgmt');
  }

  get canSeeMeetings(): boolean {
    return this.apiService.isSuperAdmin() || this.apiService.hasCategoryAccess('meeting-mgmt');
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

  // ════════════════════════════════════════════════════════════════════
  //  Notification bell
  // ════════════════════════════════════════════════════════════════════

  loadUnreadCount(): void {
    const previous = this.unreadCount;

    this.notificationService.getUnreadCount().subscribe({
      next: (res) => {
        this.unreadCount = res.unreadCount;

        // Only fire the sound/bump when the count actually went UP —
        // avoids noise on the initial load or when it drops (mark as read).
        if (this.unreadCount > previous) {
          this.playBellSound();
          this.triggerBump();
        }

        this.cdr.detectChanges();
      },
      error: () => {
        // Fail silently for the background poll — badge just stays as-is.
      },
    });
  }

  playBellSound(): void {
    console.log('playBellSound called, audio object:', this.bellAudio);
    this.bellAudio?.play()
      .then(() => console.log('Bell sound played successfully'))
      .catch((err) => {
        console.error('Bell sound failed to play:', err);
      });
  }

  private triggerBump(): void {
    this.bellBump = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.bellBump = false;
      this.cdr.detectChanges();
    }, 400);
  }

  toggleNotificationPanel(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.isNotificationPanelOpen = !this.isNotificationPanelOpen;

    if (this.isNotificationPanelOpen) {
      this.loadNotifications();
    }
  }

  closeNotificationPanel(): void {
    this.isNotificationPanelOpen = false;
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationsError = false;

    this.notificationService.getMyNotifications().subscribe({
      next: (list) => {
        this.notifications = list;
        this.notificationsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificationsLoading = false;
        this.notificationsError = true;
        this.cdr.detectChanges();
      },
    });
  }

  openNotification(notification: NotificationItem): void {
    // Optimistically update local state so the panel/badge feel instant
    if (notification.status === 'Unread') {
      notification.status = 'Read';
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      error: () => {
        // Non-fatal — worst case the badge is off by one until next poll
      },
    });

    this.isNotificationPanelOpen = false;

    if (notification.relatedType === 'PROJECT' && notification.relatedId) {
      this.router.navigate(['/dashboard/projects-list'], {
        queryParams: { projectId: notification.relatedId },
      });
    } else if (notification.relatedType === 'TASK' && notification.relatedId) {
      this.router.navigate(['/dashboard/task-list'], {
        queryParams: { taskId: notification.relatedId },
      });
    } else if (notification.relatedType === 'MEETING' && notification.relatedId) {
      this.router.navigate(['/dashboard/meeting-workspace'], {
        queryParams: { meetingId: notification.relatedId },
      });
    } else if (notification.relatedType === 'ERROR' && notification.relatedId) {
      this.router.navigate(['/dashboard/error-list'], {
        queryParams: { errorId: notification.relatedId },
      });
    } else if (notification.relatedType === 'INSTRUCTION' && notification.relatedId) {
      // Adjust this route to wherever your Instructions list actually lives
      this.router.navigate(['/dashboard/our-circle'], {
        queryParams: { instructionId: notification.relatedId },
      });
    }
  }

  markAllNotificationsRead(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.notifications.forEach((n) => (n.status = 'Read'));
    this.unreadCount = 0;

    this.notificationService.markAllAsRead().subscribe({
      error: () => {
        // Non-fatal — refresh will reconcile on next load
      },
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

    return (
      this.userDisplayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase() || 'U'
    );
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
    window.location.href = '/auth';
  }
}