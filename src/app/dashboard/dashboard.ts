import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

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
  loggedInUser: any = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const userData = localStorage.getItem('loggedInUser');
      if (userData) {
        this.loggedInUser = JSON.parse(userData);
      }
    }
  }

  openProjectsMenu() {
    this.isProjectsOpen = true;
  }

  closeProjectsMenu() {
    this.isProjectsOpen = false;
  }

  openTasksMenu() {
  this.isTasksOpen = true;
}

closeTasksMenu() {
  this.isTasksOpen = false;
}

  toggleSidebar() {
  this.isSidebarOpen = !this.isSidebarOpen;

  if (!this.isSidebarOpen) {
    this.isProjectsOpen = false;
    this.isTasksOpen = false;
  }
}
}