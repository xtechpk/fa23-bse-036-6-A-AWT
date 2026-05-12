import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  authService = inject(AuthService);
  router = inject(Router);
  email = signal('');
  password = signal('');
  error = signal('');
  isLoading = signal(false);

  async handleLogin() {
    this.error.set('');

    if (!this.email() || !this.password()) {
      this.error.set('Please fill in all fields');
      return;
    }

    this.isLoading.set(true);

    const result = await this.authService.signIn(this.email(), this.password());

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      const err: any = result.error || {};
      // Prefer explicit server message if available
      if (err.message) {
        // Handle known codes/messages
        if (err.code === 'email_not_confirmed' || (typeof err.message === 'string' && err.message.toLowerCase().includes('email not confirmed'))) {
          this.error.set('Email not confirmed. Please check your email for the confirmation link.');
        } else if (err.code === 'PGRST205' || (typeof err.message === 'string' && err.message.includes("Could not find the table 'public.users'"))) {
          this.error.set('Server misconfiguration: users table not found. Run database migrations or contact the admin.');
        } else {
          this.error.set(err.message);
        }
      } else {
        this.error.set('Login failed. Please check your credentials.');
      }
    }

    this.isLoading.set(false);
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }
}
