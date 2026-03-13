import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { labService } from '../../services/lab.service';
import type { LabOrder } from '../../types/lab.types';

// Validation for Result Form
const resultSchema = z.object({
  resultValue: z.string().min(1, "Result value is required"),
  technicianNotes: z.string().optional()
});

type ResultFormInputs = z.infer<typeof resultSchema>;

export default function TechnicianDashboard() {
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ResultFormInputs>({
    resolver: zodResolver(resultSchema)
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await labService.getPendingOrders();
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

 const onSubmit = async (data: ResultFormInputs) => {
    if (!selectedOrder) return;
    try {
      await labService.addResult(selectedOrder.id, data);
      alert('Results Published Successfully!');
      setSelectedOrder(null);
      reset();
      fetchOrders(); 
    } catch (error) {
      console.error("Submission failed:", error); // Fix: Log the error
      alert('Failed to submit results');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lab Technician Portal</h1>
          <p className="text-gray-500">Pending Samples: <span className="font-bold text-blue-600">{orders.length}</span></p>
        </div>
        <button onClick={fetchOrders} className="text-blue-600 hover:underline">Refresh List</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">Work Queue</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No pending lab orders.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Patient</th>
                <th className="px-6 py-3">Test Name</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs">#{order.id}</td>
                  <td className="px-6 py-4 font-medium">{order.patient.firstName} {order.patient.lastName}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{order.test.name}</span>
                    {order.test.requiresFasting && <span className="ml-2 text-xs text-red-500">(Fasting)</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.orderedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                    >
                      Enter Result
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Result Entry Modal (Simple Conditional Rendering) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Enter Results: {selectedOrder.test.name}</h3>
            <p className="text-sm text-gray-600 mb-4">Patient: {selectedOrder.patient.firstName} {selectedOrder.patient.lastName}</p>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Result Value</label>
                <input 
                  {...register('resultValue')} 
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" 
                  placeholder="e.g. Positive / 12.5 g/dL"
                />
                {errors.resultValue && <p className="text-red-500 text-xs">{errors.resultValue.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Technician Notes</label>
                <textarea 
                  {...register('technicianNotes')} 
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" 
                  rows={3} 
                  placeholder="Any observations..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}