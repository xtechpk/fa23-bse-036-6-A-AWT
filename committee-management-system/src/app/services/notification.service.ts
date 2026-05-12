import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { signal } from '@angular/core';

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_committee' | 'upcoming_turn' | 'payment_update' | 'member_joined';
  committee_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();
  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);

  constructor() {}

  async loadNotifications(userId: string): Promise<{ success: boolean; error?: unknown }> {
    if (!userId) {
      this.notifications.set([]);
      this.unreadCount.set(0);
      return { success: false, error: 'Missing user id' };
    }

    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.notifications.set(data || []);
      this.updateUnreadCount();
      return { success: true };
    } catch (error) {
      console.error('Load notifications error:', error);
      return { success: false, error };
    }
  }

  async createNotification(
    userId: string,
    type: Notification['type'],
    committeeId: string,
    message: string
  ) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert([
          {
            user_id: userId,
            type,
            committee_id: committeeId,
            message,
            read: false,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Create notification error:', error);
    }
  }

  async markAsRead(notificationId: string, userId?: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      const resolvedUserId =
        userId || this.notifications().find(notification => notification.id === notificationId)?.user_id;

      if (resolvedUserId) {
        await this.loadNotifications(resolvedUserId);
      }
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  }

  async markAllAsRead(userId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId);

      if (error) throw error;
      await this.loadNotifications(userId);
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
    }
  }

  private updateUnreadCount() {
    const count = this.notifications().filter(n => !n.read).length;
    this.unreadCount.set(count);
  }
}
