import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { labService } from '../../services/lab.service';
import type { LabOrder } from '../../types/lab.types';

export default function MyLabReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    labService.getMyOrders()
      .then(setReports)
      .catch((err: unknown) => console.error("Failed to fetch reports:", err)) // Fix: Typed err
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">My Lab Reports</h1>
        <button 
          onClick={() => navigate('/patient/book-lab-test')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + Order New Test
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No lab history found.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Test Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(report.orderedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {report.test.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full 
                      ${report.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {report.status === 'COMPLETED' ? (
                      <div className="text-gray-900 font-mono bg-gray-50 p-2 rounded border border-gray-200 inline-block">
                        {report.resultValue}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Pending analysis...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}