import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupComponent {
  authService = inject(AuthService);
  router = inject(Router);
  fullName = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  error = signal('');
  isLoading = signal(false);

  async handleSignup() {
    this.error.set('');

    if (!this.fullName() || !this.email() || !this.password() || !this.confirmPassword()) {
      this.error.set('Please fill in all fields');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match');
      return;
    }

    if (this.password().length < 6) {
      this.error.set('Password must be at least 6 characters long');
      return;
    }

    this.isLoading.set(true);

    const result = await this.authService.signUp(
      this.email(),
      this.password(),
      this.fullName()
    );

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set('Sign up failed. Please try again.');
    }

    this.isLoading.set(false);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
