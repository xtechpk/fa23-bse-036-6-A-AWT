import { Component, signal, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { CommitteeService, CommitteeMember } from '../../../services/committee.service';
import { TransactionService, Transaction } from '../../../services/transaction.service';

@Component({
  selector: 'app-committee-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './committee-details.component.html',
  styleUrl: './committee-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommitteeDetailsComponent implements OnInit {
  authService = inject(AuthService);
  committeeService = inject(CommitteeService);
  transactionService = inject(TransactionService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  committeeId = signal('');
  committee = signal<any>(null);
  members = this.committeeService.committeeMembers;
  transactions = this.transactionService.transactions;
  currentUser = this.authService.currentUser;
  isLoading = signal(true);
  showAddMemberForm = signal(false);
  newMemberEmail = signal('');
  newMemberTransactionId = signal('');
  newMemberIban = signal('');
  newMemberBankAccountId = signal('');
  formError = signal('');

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.committeeId.set(params['id']);
        this.loadCommitteeDetails();
      }
    });
  }

  private loadCommitteeDetails() {
    const id = this.committeeId();
    const committee = this.committeeService.getCommitteeById(id)();
    if (committee) {
      this.committee.set(committee);
      this.committeeService.loadCommitteeMembers(id);
      this.transactionService.loadTransactions(id);
    }
    this.isLoading.set(false);
  }

  isCreator(): boolean {
    const committee = this.committee();
    const user = this.currentUser();
    return committee && user?.user?.id === committee.creator_id;
  }

  toggleAddMemberForm() {
    this.showAddMemberForm.set(!this.showAddMemberForm());
    this.formError.set('');
    this.resetForm();
  }

  async handleAddMember() {
    this.formError.set('');

    if (!this.newMemberEmail() || !this.newMemberTransactionId() || 
        !this.newMemberIban() || !this.newMemberBankAccountId()) {
      this.formError.set('Please fill in all fields');
      return;
    }

    const committee = this.committee();
    if (committee.current_members >= committee.max_members) {
      this.formError.set('Committee is full. Cannot add more members.');
      return;
    }

    const result = await this.committeeService.addMember(
      this.committeeId(),
      this.newMemberEmail(),
      committee.current_members + 1,
      this.newMemberTransactionId(),
      this.newMemberIban(),
      this.newMemberBankAccountId()
    );

    if (result.success) {
      this.resetForm();
      this.showAddMemberForm.set(false);
      this.loadCommitteeDetails();
    } else {
      this.formError.set('Failed to add member. Please try again.');
    }
  }

  private resetForm() {
    this.newMemberEmail.set('');
    this.newMemberTransactionId.set('');
    this.newMemberIban.set('');
    this.newMemberBankAccountId.set('');
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  getProgressPercentage(): number {
    const committee = this.committee();
    if (!committee) return 0;
    return (committee.current_members / committee.max_members) * 100;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getNextMember(): CommitteeMember | null {
    const allMembers = this.members();
    const activeMembers = allMembers.filter(m => m.status === 'active');
    const pendingMembers = allMembers.filter(m => m.status === 'pending');
    
    if (activeMembers.length > 0) {
      return activeMembers[activeMembers.length - 1];
    }
    return pendingMembers[0] || null;
  }

  getTotalPending(): number {
    return this.transactions().filter(t => t.status === 'pending').length;
  }

  getTotalCompleted(): number {
    return this.transactions().filter(t => t.status === 'completed').length;
  }
}
