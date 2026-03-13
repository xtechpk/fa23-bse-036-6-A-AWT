import api from '../config/api';
import type { LabOrder } from '../types/lab.types';

// Define Catalog Item Type locally or import if shared
export interface CatalogItem {
  id: number;
  name: string;
  price: number;
  requiresFasting: boolean;
}

export const labService = {
  // --- TECHNICIAN METHODS ---
  getPendingOrders: async () => {
    const response = await api.get<{ success: boolean; data: LabOrder[] }>('/lab/pending');
    return response.data.data;
  },

  addResult: async (orderId: number, data: { resultValue: string; technicianNotes?: string }) => {
    const response = await api.post<{ success: boolean; message: string }>(`/lab/order/${orderId}/result`, data);
    return response.data;
  },

  // --- PATIENT METHODS (These were missing) ---
  
  // 1. Get My History
  getMyOrders: async () => {
    const response = await api.get<{ success: boolean; data: LabOrder[] }>('/lab/my-orders');
    return response.data.data;
  },

  // 2. Book a Test
  bookTest: async (testId: number) => {
    const response = await api.post('/lab/order', { testId });
    return response.data;
  },

  // 3. Get Available Tests (Mock Catalog)
  getCatalog: async (): Promise<CatalogItem[]> => {
    // In a real app, you would have a public GET /api/lab/catalog endpoint
    // For this prototype, we return a static list to ensure it works instantly
    return [
      { id: 1, name: 'Complete Blood Count (CBC)', price: 500, requiresFasting: false },
      { id: 2, name: 'Lipid Profile', price: 1500, requiresFasting: true },
      { id: 3, name: 'Covid-19 PCR', price: 3000, requiresFasting: false },
      { id: 4, name: 'Liver Function Test (LFT)', price: 1200, requiresFasting: false },
    ];
  }
};