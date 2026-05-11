import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CommitteeService } from '../../../services/committee.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-create-committee',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-committee.component.html',
  styleUrl: './create-committee.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateCommitteeComponent {
  authService = inject(AuthService);
  committeeService = inject(CommitteeService);
  notificationService = inject(NotificationService);
  router = inject(Router);
  name = signal('');
  description = signal('');
  durationMonths = signal(10);
  monthlyAmount = signal(0);
  maxMembers = signal(10);
  error = signal('');
  success = signal('');
  isLoading = signal(false);

  async handleCreateCommittee() {
    this.error.set('');
    this.success.set('');

    if (!this.name() || !this.description() || !this.monthlyAmount()) {
      this.error.set('Please fill in all required fields');
      return;
    }

    if (this.durationMonths() < 1 || this.durationMonths() > 60) {
      this.error.set('Duration must be between 1 and 60 months');
      return;
    }

    if (this.monthlyAmount() <= 0) {
      this.error.set('Monthly amount must be greater than 0');
      return;
    }

    if (this.maxMembers() < 2 || this.maxMembers() > 11) {
      this.error.set('Maximum members must be between 2 and 11 (including you)');
      return;
    }

    this.isLoading.set(true);

    const user = this.authService.getCurrentUser();
    if (!user?.user?.id) {
      this.error.set('User not authenticated');
      this.isLoading.set(false);
      return;
    }

    const result = await this.committeeService.createCommittee(
      user.user.id,
      this.name(),
      this.description(),
      this.durationMonths(),
      this.monthlyAmount(),
      this.maxMembers()
    );

    if (result.success) {
      this.success.set('Committee created successfully!');
      
      // Notify all users about the new committee
      await this.notificationService.createNotification(
        user.user.id,
        'new_committee',
        result.committee.id,
        `You have created a new committee: ${this.name()}`
      );

      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1500);
    } else {
      this.error.set('Failed to create committee. Please try again.');
    }

    this.isLoading.set(false);
  }

  onNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.name.set(target.value);
  }

  onDescriptionInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.description.set(target.value);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
