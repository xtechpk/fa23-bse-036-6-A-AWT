import { Component, signal, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent implements OnInit {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  router = inject(Router);
  notifications = this.notificationService.notifications;
  currentUser = this.authService.currentUser;
  isLoading = signal(true);

  ngOnInit() {
    const user = this.currentUser();
    if (user?.user?.id) {
      this.notificationService.loadNotifications(user.user.id);
    }
    this.isLoading.set(false);
  }

  async markAsRead(notificationId: string) {
    await this.notificationService.markAsRead(notificationId);
  }

  async markAllAsRead() {
    const user = this.currentUser();
    if (user?.user?.id) {
      await this.notificationService.markAllAsRead(user.user.id);
    }
  }

  navigateToCommittee(committeeId: string) {
    this.router.navigate(['/committee', committeeId]);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_committee':
        return '📝';
      case 'upcoming_turn':
        return '🔔';
      case 'payment_update':
        return '💳';
      case 'member_joined':
        return '👥';
      default:
        return '📬';
    }
  }
}
