import api from '../config/api';
import type { Medicine, StoreInventory, AddMedicineData, AddStockData } from '../types/pharmacy.types';

export const pharmacyService = {
  // 1. Get Low Stock Report
  getLowStock: async (storeId: number) => {
    const response = await api.get<{ success: boolean; data: StoreInventory[] }>(`/pharmacy/store/${storeId}/low-stock`);
    return response.data.data;
  },

  // 2. Add New Medicine to Catalog
  addMedicine: async (data: AddMedicineData) => {
    const response = await api.post<{ success: boolean; data: Medicine }>('/pharmacy/medicine', data);
    return response.data.data;
  },

  // 3. Add Stock (Batch)
  addStock: async (data: AddStockData) => {
    const response = await api.post('/pharmacy/stock', data);
    return response.data;
  },

  // 4. Dispense Prescription
  dispense: async (prescriptionId: number, storeId: number) => {
    const response = await api.post('/pharmacy/dispense', { prescriptionId, storeId });
    return response.data;
  }
};