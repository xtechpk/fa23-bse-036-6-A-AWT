import { Component, signal, computed, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommitteeService, Committee } from '../../services/committee.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  committeeService = inject(CommitteeService);
  notificationService = inject(NotificationService);
  router = inject(Router);

  currentUser = this.authService.currentUser;
  committees = this.committeeService.committees;
  unreadNotifications = this.notificationService.unreadCount;
  isLoading = this.committeeService.isLoading;
  userCommittees = computed(() => {
    const user = this.currentUser();
    if (!user?.user) return [];
    return this.committees().filter(c => c.creator_id === user.user.id);
  });

  ngOnInit() {
    this.loadNotifications();
  }

  private loadNotifications() {
    const user = this.currentUser();
    if (user?.user?.id) {
      this.notificationService.loadNotifications(user.user.id);
    }
  }

  navigateToCreateCommittee() {
    this.router.navigate(['/create-committee']);
  }

  navigateToCommitteeDetails(committeeId: string) {
    this.router.navigate(['/committee', committeeId]);
  }

  async handleLogout() {
    const result = await this.authService.signOut();
    if (result.success) {
      this.router.navigate(['/login']);
    }
  }

  navigateToNotifications() {
    this.router.navigate(['/notifications']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
