import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labService, type CatalogItem } from '../../services/lab.service'; // Import Type

export default function BookLabTest() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load catalog
    labService.getCatalog().then(setTests);
  }, []);

  const handleBook = async (testId: number, testName: string) => {
    if (!window.confirm(`Confirm booking for ${testName}?`)) return;
    
    setLoading(true);
    try {
      await labService.bookTest(testId);
      alert('Test Booked Successfully! A technician will be assigned.');
      navigate('/patient/lab-reports'); 
    } catch (error) {
      console.error("Booking Error:", error); // Fix: Use the error variable
      alert('Failed to book test.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Order Lab Test</h1>
        <button onClick={() => navigate('/patient/dashboard')} className="text-gray-600 hover:text-blue-600">Back to Dashboard</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tests.map((test) => (
          <div key={test.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{test.name}</h3>
                {test.requiresFasting && (
                  <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mt-1">
                    Fasting Required
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="block text-xl font-bold text-blue-600">Rs. {test.price}</span>
              </div>
            </div>
            
            <button 
              onClick={() => handleBook(test.id, test.name)}
              disabled={loading}
              className="mt-4 w-full bg-gray-50 text-blue-600 font-medium py-2 rounded-md hover:bg-blue-600 hover:text-white transition-colors"
            >
              {loading ? 'Processing...' : 'Book Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}