import api from '../config/api';
import type { SystemStats, BroadcastData } from '../types/admin.types';

export const adminService = {
  getStats: async () => {
    const response = await api.get<{ success: boolean; data: SystemStats }>('/admin/stats');
    return response.data.data;
  },

  sendBroadcast: async (data: BroadcastData) => {
    const response = await api.post('/admin/broadcast', data);
    return response.data;
  }
};