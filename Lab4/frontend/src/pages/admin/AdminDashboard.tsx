import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService } from '../../services/admin.service';
import type { SystemStats } from '../../types/admin.types';

const broadcastSchema = z.object({
  title: z.string().min(3, "Title required"),
  message: z.string().min(10, "Message too short"),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  region: z.string().optional()
});

type BroadcastFormInputs = z.infer<typeof broadcastSchema>;

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<BroadcastFormInputs>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: { severity: 'LOW', region: 'NATIONAL' }
  });

  useEffect(() => {
    adminService.getStats().then(setStats).catch(console.error);
  }, []);

  const onBroadcast = async (data: BroadcastFormInputs) => {
    if (!window.confirm("Are you sure you want to broadcast this alert to all users?")) return;
    try {
      await adminService.sendBroadcast(data);
      alert("Emergency Alert Sent Successfully");
      reset();
    } catch (error) {
      alert("Failed to send alert", );
      console.error(error);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Ministry of Health Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Patients" value={stats?.totalPatients} color="bg-blue-500" />
        <StatCard label="Active Doctors" value={stats?.activeDoctors} color="bg-green-500" />
        <StatCard label="Ambulances Ready" value={stats?.availableAmbulances} color="bg-yellow-500" />
        <StatCard label="Active Alerts" value={stats?.activeAlerts} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Emergency Broadcast Panel */}
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-600">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📢</span>
            <h2 className="text-xl font-bold text-red-700">Emergency Broadcast System</h2>
          </div>
          
          <form onSubmit={handleSubmit(onBroadcast)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Alert Title</label>
              <input {...register('title')} placeholder="e.g., Heatwave Warning" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Severity</label>
                <select {...register('severity')} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                  <option value="LOW">Low (Info)</option>
                  <option value="MEDIUM">Medium (Advisory)</option>
                  <option value="HIGH">High (Warning)</option>
                  <option value="CRITICAL">Critical (Danger)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Region</label>
                <input {...register('region')} placeholder="e.g. NATIONAL" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Message</label>
              <textarea {...register('message')} rows={3} placeholder="Enter detailed instructions..." className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 disabled:opacity-50">
              {isSubmitting ? 'Broadcasting...' : 'SEND ALERT'}
            </button>
          </form>
        </div>

        {/* System Health (Placeholder for future monitoring) */}
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-gray-600">
          <h2 className="text-xl font-bold text-gray-800 mb-4">System Health</h2>
          <div className="space-y-4">
            <HealthIndicator label="Database Service" status="Operational" />
            <HealthIndicator label="Kafka Message Broker" status="Operational" />
            <HealthIndicator label="SMS Gateway" status="Operational" />
            <HealthIndicator label="External Lab API" status="Maintenance" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Helper Components
const StatCard = ({ label, value, color }: { label: string, value?: number, color: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium uppercase">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '-'}</p>
    </div>
    <div className={`h-3 w-3 rounded-full ${color}`}></div>
  </div>
);

const HealthIndicator = ({ label, status }: { label: string, status: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
    <span className="text-gray-700">{label}</span>
    <span className={`px-2 py-1 rounded text-xs font-bold ${status === 'Operational' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
      {status}
    </span>
  </div>
);