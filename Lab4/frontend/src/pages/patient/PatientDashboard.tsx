import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../../services/appointment.service';
import type { Appointment } from '../../types/appointment.types'; // Fix: Added 'type'

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const data = await appointmentService.getMyList();
        setAppointments(data);
      } catch (error) {
        console.error("Failed to fetch appointments", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>
        <button 
          onClick={() => navigate('/patient/book-appointment')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
        >
          + Book Appointment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm font-medium uppercase">Total Appointments</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{appointments.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
          <h3 className="text-gray-500 text-sm font-medium uppercase">Active Prescriptions</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">Upcoming Appointments</h3>
        </div>
        
        {loading ? (
            <div className="p-8 text-center text-gray-500">Loading appointments...</div>
        ) : appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                You have no upcoming appointments.
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                    <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Doctor</th>
                    <th className="px-6 py-3">Hospital</th>
                    <th className="px-6 py-3">Queue No</th>
                    <th className="px-6 py-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {new Date(apt.appointmentDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                            {apt.doctor.specialization}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                            {apt.hospital?.name || 'Main Hospital'}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">
                            #{apt.queueNumber}
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full 
                                ${apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                                  apt.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {apt.status}
                            </span>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
}