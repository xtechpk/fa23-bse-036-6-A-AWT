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
      this.error.set('Login failed. Please check your credentials.');
    }

    this.isLoading.set(false);
  }

  navigateToSignup() {
    this.router.navigate(['/signup']);
  }
}
