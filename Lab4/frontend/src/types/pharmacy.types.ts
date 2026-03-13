export interface Medicine {
  id: number;
  name: string;
  formula?: string;
  manufacturer: string;
  isControlled: boolean;
}

export interface StoreInventory {
  id: number;
  medicine: Medicine;
  totalQuantity: number;
  reorderLevel: number;
  sellingPrice: string; // Decimal comes as string from API usually
}

export interface AddMedicineData {
  name: string;
  formula: string;
  manufacturer: string;
  isControlled: boolean;
  variations: { potency: string; packaging: string }[];
}

export interface AddStockData {
  variationId: number;
  storeId: number;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  sellingPrice: number;
}