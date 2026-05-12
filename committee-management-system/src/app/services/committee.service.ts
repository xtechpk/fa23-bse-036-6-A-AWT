import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { signal, computed } from '@angular/core';

export interface Committee {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  duration_months: number;
  monthly_amount: number;
  max_members: number;
  current_members: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  created_by?: any;
}

export interface CommitteeMember {
  id: string;
  committee_id: string;
  user_id: string;
  order_number: number;
  transaction_id: string;
  iban: string;
  bank_account_id: string;
  status: 'pending' | 'active' | 'completed';
  joined_at: string;
  user?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CommitteeService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();
  committees = signal<Committee[]>([]);
  committeeMembers = signal<CommitteeMember[]>([]);
  isLoading = signal(false);

  constructor() {
    this.loadCommittees();
  }

  async loadCommittees() {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('committees')
        .select(`
          *,
          creator:creator_id(id, full_name, reputation_score)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.committees.set(data || []);
    } catch (error) {
      console.error('Load committees error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createCommittee(
    creatorId: string,
    name: string,
    description: string,
    durationMonths: number,
    monthlyAmount: number,
    maxMembers: number
  ) {
    try {
      const { data, error } = await this.supabase
        .from('committees')
        .insert([
          {
            creator_id: creatorId,
            name,
            description,
            duration_months: durationMonths,
            monthly_amount: monthlyAmount,
            max_members: maxMembers,
            status: 'active',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // NOTE: Creator/Holder is NOT automatically added as a member.
      // The creator_id field in committees table identifies the committee admin.
      // They only become a member if they explicitly opt-in via addMember().

      await this.loadCommittees();
      return { success: true, committee: data };
    } catch (error) {
      console.error('Create committee error:', error);
      return { success: false, error };
    }
  }

  async addMember(
    committeeId: string,
    userId: string,
    orderNumber: number,
    transactionId: string,
    iban: string,
    bankAccountId: string
  ) {
    try {
      const { data, error } = await this.supabase
        .from('committee_members')
        .insert([
          {
            committee_id: committeeId,
            user_id: userId,
            order_number: orderNumber,
            transaction_id: transactionId,
            iban,
            bank_account_id: bankAccountId,
            status: 'pending',
            joined_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update committee member count (some deployments may not have `current_members` column)
      try {
        await this.supabase
          .from('committees')
          .update({ current_members: orderNumber })
          .eq('id', committeeId);
      } catch (e) {
        const err: any = e || {};
        const msg = err.message || '';
        // Ignore error if column doesn't exist, log otherwise
        if (!msg.includes("Could not find the 'current_members'")) {
          console.error('Update committee current_members error:', e);
        }
      }

      await this.loadCommittees();
      return { success: true, member: data };
    } catch (error) {
      console.error('Add member error:', error);
      return { success: false, error };
    }
  }

  async loadCommitteeMembers(committeeId: string) {
    try {
      const { data, error } = await this.supabase
        .from('committee_members')
        .select(`
          *,
          user:user_id(id, full_name, email, reputation_score)
        `)
        .eq('committee_id', committeeId)
        .order('order_number', { ascending: true });

      if (error) throw error;
      this.committeeMembers.set(data || []);
    } catch (error) {
      console.error('Load committee members error:', error);
    }
  }

  async updateMemberStatus(memberId: string, status: 'pending' | 'active' | 'completed') {
    try {
      const { error } = await this.supabase
        .from('committee_members')
        .update({ status })
        .eq('id', memberId);

      if (error) throw error;
      await this.loadCommittees();
      return { success: true };
    } catch (error) {
      console.error('Update member status error:', error);
      return { success: false, error };
    }
  }

  getCommitteeById(id: string) {
    return computed(() => {
      return this.committees().find(c => c.id === id);
    });
  }
}
