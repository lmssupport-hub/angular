import { Routes } from '@angular/router';
import { Auth } from './auth/auth';
import { Dashboard } from './dashboard/dashboard';
import { Projects } from './dashboard/projects/projects';
import { ProjectsList } from './dashboard/projects-list/projects-list';
import { Settings } from './dashboard/settings/settings';
import { DashboardHome } from './dashboard/dashboard-home/dashboard-home';
import { TaskListComponent } from './dashboard/task-list/task-list';
import { Tasks } from './dashboard/tasks/tasks';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },

  {
    path: 'auth',
    component: Auth
  },

  {
    path: 'dashboard',
    component: Dashboard,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: DashboardHome },
      { path: 'projects', component: Projects },
      { path: 'projects-list', component: ProjectsList },
      { path: 'settings', component: Settings },
       { path: 'task-list', component: TaskListComponent },
       { path: 'tasks', component: Tasks}
    ],
  },

  {
    path: '**',
    redirectTo: 'auth'
  }
];