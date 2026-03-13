import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { pharmacyService } from '../../services/pharmacy.service';

// Validation Schema
const stockSchema = z.object({
  variationId: z.coerce.number().min(1, "Variation ID is required"),
  batchNumber: z.string().min(3, "Batch No. required"),
  quantity: z.coerce.number().min(1, "Qty must be > 0"),
  expiryDate: z.string().refine((date) => new Date(date) > new Date(), "Must be in future"),
  sellingPrice: z.coerce.number().min(0),
});

type StockFormInputs = z.infer<typeof stockSchema>;

export default function InventoryManager() {
  const [message, setMessage] = useState('');
  
  // Fix: Removed explicit generic <StockFormInputs> to let TS infer types correctly from Zod resolver
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(stockSchema)
  });

  const onSubmit = async (data: StockFormInputs) => {
    try {
      // Hardcoded storeId for prototype (In real app, get from user profile)
      await pharmacyService.addStock({ ...data, storeId: 1, mfgDate: new Date().toISOString() });
      setMessage('Stock Added Successfully!');
      reset();
    } catch (error) {
      console.error(error);
      setMessage('Failed to add stock');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Add Incoming Stock</h2>
      
      {message && <div className={`p-3 rounded mb-4 ${message.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Variation ID</label>
            <input type="number" {...register('variationId')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" placeholder="e.g. 101" />
            {errors.variationId && <span className="text-xs text-red-500">{errors.variationId.message as string}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Batch Number</label>
            <input type="text" {...register('batchNumber')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" placeholder="B-2024-X" />
            {errors.batchNumber && <span className="text-xs text-red-500">{errors.batchNumber.message as string}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Quantity</label>
            <input type="number" {...register('quantity')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
            {errors.quantity && <span className="text-xs text-red-500">{errors.quantity.message as string}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Price (Unit)</label>
            <input type="number" {...register('sellingPrice')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
            {errors.sellingPrice && <span className="text-xs text-red-500">{errors.sellingPrice.message as string}</span>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
            <input type="date" {...register('expiryDate')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
            {errors.expiryDate && <span className="text-xs text-red-500">{errors.expiryDate.message as string}</span>}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
          {isSubmitting ? 'Processing...' : 'Add to Inventory'}
        </button>
      </form>
    </div>
  );
}