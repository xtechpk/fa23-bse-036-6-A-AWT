import { useEffect, useState } from 'react';
import { pharmacyService } from '../../services/pharmacy.service';
import InventoryManager from './InventoryManager';
import type { StoreInventory } from '../../types/pharmacy.types';

export default function PharmacyDashboard() {
  const [lowStockItems, setLowStockItems] = useState<StoreInventory[]>([]);
  
  useEffect(() => {
    // Fetch alerts for Store #1 (Prototype ID)
    pharmacyService.getLowStock(1).then(setLowStockItems).catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      {/* Alert Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-800 mb-3">⚠️ Low Stock Alerts</h3>
          {lowStockItems.length === 0 ? (
            <p className="text-gray-600">Inventory levels are healthy.</p>
          ) : (
            <ul className="space-y-2">
              {lowStockItems.map(item => (
                <li key={item.id} className="flex justify-between bg-white p-2 rounded shadow-sm">
                  <span className="font-medium">{item.medicine.name}</span>
                  <span className="text-red-600 font-bold">{item.totalQuantity} units left</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex flex-col justify-center items-center">
          <h3 className="text-lg font-bold text-blue-800">Dispense Counter</h3>
          <p className="text-gray-600 mb-4">Process pending prescriptions</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
            Open Dispenser Tool
          </button>
        </div>
      </div>

      {/* Embedded Inventory Manager */}
      <InventoryManager />
    </div>
  );
}