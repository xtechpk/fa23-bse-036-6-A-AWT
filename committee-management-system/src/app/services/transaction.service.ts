import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { signal } from '@angular/core';

export interface Transaction {
  id: string;
  committee_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  month: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();
  transactions = signal<Transaction[]>([]);

  constructor() {}

  async loadTransactions(committeeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('committee_id', committeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.transactions.set(data || []);
    } catch (error) {
      console.error('Load transactions error:', error);
    }
  }

  async createTransaction(
    committeeId: string,
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    month: number
  ) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .insert([
          {
            committee_id: committeeId,
            from_member_id: fromMemberId,
            to_member_id: toMemberId,
            amount,
            month,
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
      await this.loadTransactions(committeeId);
      return { success: true, transaction: data };
    } catch (error) {
      console.error('Create transaction error:', error);
      return { success: false, error };
    }
  }

  async updateTransactionStatus(
    transactionId: string,
    status: 'pending' | 'completed' | 'failed'
  ) {
    try {
      const { error } = await this.supabase
        .from('transactions')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', transactionId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update transaction status error:', error);
      return { success: false, error };
    }
  }

  async getCommitteeTransactions(committeeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('committee_id', committeeId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get committee transactions error:', error);
      return [];
    }
  }
}
