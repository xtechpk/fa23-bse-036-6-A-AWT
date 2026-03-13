import { useState } from 'react';
import { ambulanceService } from '../../services/ambulance.service';

export default function DriverConsole() {
  const [tripId, setTripId] = useState('');
  const [status, setStatus] = useState('IDLE'); // Now used in UI
  const [location, setLocation] = useState({ lat: 31.5204, lng: 74.3587 });

  const handleUpdate = async (newStatus: string) => {
    if (!tripId) return alert("Enter Active Trip ID");
    try {
      // Simulate movement by adding random offset
      const newLat = location.lat + (Math.random() * 0.001);
      const newLng = location.lng + (Math.random() * 0.001);
      
      await ambulanceService.updateLocation(Number(tripId), newLat, newLng, newStatus);
      
      setLocation({ lat: newLat, lng: newLng });
      setStatus(newStatus);
      alert(`Status updated to: ${newStatus}`);
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-xl font-bold text-gray-800">Driver Console</h1>
                <p className="text-gray-500 text-sm">Vehicle: AMB-9922</p>
            </div>
            {/* Fix: Use the 'status' variable here */}
            <div className="text-right">
                <span className="block text-xs text-gray-500 uppercase">Current Status</span>
                <span className="font-mono font-bold text-blue-600">{status}</span>
            </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Current Trip ID</label>
          <input 
            type="number" 
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            placeholder="Enter ID assigned by dispatch"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleUpdate('DISPATCHED')}
            className="py-3 bg-yellow-100 text-yellow-800 font-bold rounded-md hover:bg-yellow-200"
          >
            Dispatched
          </button>
          <button 
            onClick={() => handleUpdate('ON_SITE')}
            className="py-3 bg-blue-100 text-blue-800 font-bold rounded-md hover:bg-blue-200"
          >
            Arrived
          </button>
          <button 
            onClick={() => handleUpdate('TRANSPORTING')}
            className="py-3 bg-purple-100 text-purple-800 font-bold rounded-md hover:bg-purple-200"
          >
            Transporting
          </button>
          <button 
            onClick={() => handleUpdate('COMPLETED')}
            className="py-3 bg-green-100 text-green-800 font-bold rounded-md hover:bg-green-200"
          >
            Completed
          </button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-gray-400">
            GPS Simulator: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}