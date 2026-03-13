import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../../services/appointment.service';
import type { Appointment } from '../../types/appointment.types';
import { AppointmentStatus } from '../../types/appointment.types';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await appointmentService.getDoctorSchedule(selectedDate);
      setAppointments(data);
    } catch (error) {
      console.error("Failed to load schedule:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleStatusChange = async (id: number, newStatus: AppointmentStatus) => {
    if (!window.confirm(`Mark appointment as ${newStatus}?`)) return;
    try {
      await appointmentService.updateStatus(id, newStatus);
      fetchSchedule(); 
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update status");
    }
  };

  const startConsultation = (apt: Appointment) => {
    navigate('/doctor/consultation', { state: { appointment: apt } });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Doctor's Portal</h1>
          <p className="text-gray-500 text-sm">Manage patient queue & consultations</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date:</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <h4 className="text-gray-500 text-xs font-bold uppercase">Total Patients</h4>
          <p className="text-2xl font-bold text-gray-800">{appointments.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
          <h4 className="text-gray-500 text-xs font-bold uppercase">Pending</h4>
          <p className="text-2xl font-bold text-gray-800">{appointments.filter(a => a.status === 'PENDING').length}</p>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Patient Queue</h3>
          <button onClick={fetchSchedule} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>

        {loading ? (
            <div className="p-10 text-center text-gray-500">Loading schedule...</div>
        ) : appointments.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No appointments for this date.</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                    <tr>
                    <th className="px-6 py-3">Queue</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Reason</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                            <span className="bg-gray-100 text-gray-800 font-bold px-2 py-1 rounded text-xs">#{apt.queueNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                            {new Date(apt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{apt.reason}</td>
                        <td className="px-6 py-4">
                             <span className={`px-2 py-1 text-xs font-bold rounded-full 
                                ${apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
                                  apt.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                                  apt.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                                  'bg-red-100 text-red-800'}`}>
                                {apt.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                            {apt.status === 'PENDING' && (
                                <button onClick={() => handleStatusChange(apt.id, AppointmentStatus.CONFIRMED)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Confirm</button>
                            )}
                            {apt.status === 'CONFIRMED' && (
                                <button onClick={() => startConsultation(apt)} className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">Start Consult</button>
                            )}
                            {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && (
                                <button onClick={() => handleStatusChange(apt.id, AppointmentStatus.CANCELLED)} className="text-xs border border-red-300 text-red-600 px-3 py-1 rounded hover:bg-red-50">Cancel</button>
                            )}
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