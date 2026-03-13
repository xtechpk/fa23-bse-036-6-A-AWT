import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ambulanceService } from '../../services/ambulance.service';
import type { Trip } from '../../types/ambulance.types';

export default function RequestAmbulance() {
  const navigate = useNavigate(); // Now used in the 'Back' button
  const [loading, setLoading] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  
  // Simulation of "Live Tracking"
  useEffect(() => {
    if (activeTrip && activeTrip.status !== 'COMPLETED') {
      const interval = setInterval(async () => {
        try {
          const updated = await ambulanceService.getTripStatus(activeTrip.id);
          setActiveTrip(updated);
        } catch (e) {
          console.error("Tracking error", e);
        }
      }, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [activeTrip]);

  const handleRequest = async () => {
    setLoading(true);
    try {
      // Hardcoded coordinates for prototype (Lahore Center)
      const trip = await ambulanceService.requestDispatch({
        pickupAddress: "123 Main Blvd, City Center",
        pickupLat: 31.5204,
        pickupLng: 74.3587,
        severity: 'CRITICAL'
      });
      setActiveTrip(trip);
    } catch (error) {
      // Fix: Log the error to satisfy linter and help debugging
      console.error("Dispatch Error:", error);
      alert("Failed to dispatch ambulance. Please call 1122.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 text-center pt-10">
      
      {/* Fix: Added Back Button to use 'navigate' */}
      <div className="text-left">
        <button 
            onClick={() => navigate('/patient/dashboard')}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        >
            ← Back to Dashboard
        </button>
      </div>

      {!activeTrip ? (
        <>
          <div className="bg-red-50 p-8 rounded-full inline-block mb-6 animate-pulse">
            <span className="text-6xl">🚑</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Emergency Assistance</h1>
          <p className="text-gray-600">Click below to dispatch the nearest ambulance to your location.</p>
          
          <button 
            onClick={handleRequest}
            disabled={loading}
            className="w-full max-w-sm mx-auto py-4 bg-red-600 text-white text-xl font-bold rounded-lg shadow-lg hover:bg-red-700 disabled:bg-red-300 transition-all transform hover:scale-105"
          >
            {loading ? 'Dispatching...' : 'REQUEST AMBULANCE'}
          </button>
        </>
      ) : (
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-left">
          <div className="flex justify-between items-center border-b pb-4 mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Dispatch Status</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-bold 
              ${activeTrip.status === 'DISPATCHED' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {activeTrip.status}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Assigned Vehicle</p>
              <p className="text-lg font-medium">{activeTrip.ambulance?.plateNumber || 'Searching...'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Driver Contact</p>
              <p className="text-lg font-medium">{activeTrip.driver?.user?.phoneNumber || 'Pending...'}</p>
            </div>
            
            {/* Simulated Map Visual */}
            <div className="bg-gray-100 h-48 rounded-lg flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-blue-50 opacity-50"></div>
               <p className="relative z-10 text-gray-500 font-medium">
                 {activeTrip.ambulance ? 
                   `Live Location: ${activeTrip.ambulance.currentLat?.toFixed(4)}, ${activeTrip.ambulance.currentLng?.toFixed(4)}` 
                   : 'Locating Vehicle...'}
               </p>
            </div>
          </div>

          <button 
            onClick={() => setActiveTrip(null)}
            className="mt-6 w-full py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
          >
            Close Tracker
          </button>
        </div>
      )}
    </div>
  );
}