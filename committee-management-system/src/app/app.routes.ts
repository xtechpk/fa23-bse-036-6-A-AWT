import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './components/auth/login/login.component';
import { SignupComponent } from './components/auth/signup/signup.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CreateCommitteeComponent } from './components/committees/create-committee/create-committee.component';
import { CommitteeDetailsComponent } from './components/committees/committee-details/committee-details.component';
import { NotificationsComponent } from './components/notifications/notifications.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'signup',
    component: SignupComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'create-committee',
    component: CreateCommitteeComponent,
    canActivate: [authGuard]
  },
  {
    path: 'committee/:id',
    component: CommitteeDetailsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    component: NotificationsComponent,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
