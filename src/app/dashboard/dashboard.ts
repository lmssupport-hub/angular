import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';



@Component({
  selector: 'app-dashboard',
  imports: [RouterOutlet, RouterLink, RouterLinkActive,CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

isProjectsOpen = false;
isSidebarOpen = true;

openProjectsMenu() {
  this.isProjectsOpen = true;
}

closeProjectsMenu() {
  this.isProjectsOpen = false;
}

toggleSidebar() {
  this.isSidebarOpen = !this.isSidebarOpen;

  if (!this.isSidebarOpen) {
    this.isProjectsOpen = false;
  }
}
}
