import { Component, signal, computed, effect, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationsComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  router = inject(Router);
  notifications = this.notificationService.notifications;
  currentUser = this.authService.currentUser;
  isLoading = signal(true);
  loadError = signal<string | null>(null);
  hasUnreadNotifications = computed(() => this.notifications().some(notification => !notification.read));
  private lastLoadedUserId = '';

  constructor() {
    effect(() => {
      const isAuthLoading = this.authService.isLoading();
      const userId = this.currentUser()?.user?.id;

      if (isAuthLoading) {
        return;
      }

      if (!userId) {
        this.isLoading.set(false);
        this.loadError.set('Please sign in to view notifications.');
        return;
      }

      if (userId !== this.lastLoadedUserId) {
        this.lastLoadedUserId = userId;
        void this.refreshNotifications(userId);
      }
    });
  }

  private async refreshNotifications(userId: string) {
    this.isLoading.set(true);
    this.loadError.set(null);

    const result = await this.notificationService.loadNotifications(userId);
    if (!result.success) {
      this.loadError.set('Unable to load notifications right now. Please try again.');
    }

    this.isLoading.set(false);
  }

  async markAsRead(notificationId: string) {
    const userId = this.currentUser()?.user?.id;
    await this.notificationService.markAsRead(notificationId, userId);
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
