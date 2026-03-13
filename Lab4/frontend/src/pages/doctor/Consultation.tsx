import { useLocation, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { appointmentService } from '../../services/appointment.service';
import type { Appointment } from '../../types/appointment.types';

// 1. Define Form Type (Fixes 'data: any' error)
interface ConsultationFormValues {
  diagnosis: string;
  symptoms: string;
  vitals: {
    bp: string;
    temp: string;
    weight: string;
  };
  prescriptions: {
    medicineName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
  }[];
}

// 2. Extended Appointment Type to include patientId (Fixes 'appointment as any' error)
// Prisma returns patientId at runtime, even if our base frontend type strictly defines the relation.
interface AppointmentWithContext extends Appointment {
  patientId: number;
  patient?: {
    firstName: string;
    lastName: string;
  };
}

export default function Consultation() {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  // Safe Cast
  const appointment = state?.appointment as AppointmentWithContext | undefined;

  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<ConsultationFormValues>({
    defaultValues: {
      diagnosis: '',
      symptoms: '',
      vitals: { bp: '', temp: '', weight: '' },
      prescriptions: [{ medicineName: '', dosage: '', frequency: '', durationDays: 3 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "prescriptions"
  });

  // 3. Typed onSubmit Handler
  const onSubmit = async (data: ConsultationFormValues) => {
    if (!appointment) return;
    
    try {
      await appointmentService.submitConsultation({
        appointmentId: appointment.id,
        // Fallback safely if patientId is missing (though it shouldn't be for a valid appointment)
        patientId: appointment.patientId || 0, 
        ...data
      });
      alert('Consultation Completed Successfully!');
      navigate('/doctor/dashboard');
    } catch (error) {
      console.error("Consultation failed", error);
      alert('Failed to save record. Please try again.');
    }
  };

  if (!appointment) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-red-600">Invalid Session</h2>
        <button onClick={() => navigate('/doctor/dashboard')} className="mt-4 text-blue-600 underline">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Patient Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500 flex justify-between items-start">
        <div>
            <h2 className="text-xl font-bold text-gray-800">
              Consultation: {appointment.patient?.firstName || 'Patient'} {appointment.patient?.lastName || ''}
            </h2>
            <p className="text-gray-500 mt-1">Reason: <span className="font-medium text-gray-900">{appointment.reason}</span></p>
        </div>
        <div className="text-right">
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">Queue #{appointment.queueNumber}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Vitals */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Blood Pressure</label>
                <input {...register('vitals.bp')} placeholder="e.g., 120/80" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Temperature (F)</label>
                <input {...register('vitals.temp')} placeholder="e.g., 98.6" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                <input {...register('vitals.weight')} placeholder="e.g., 70" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Clinical Findings</h3>
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Symptoms</label>
                <textarea {...register('symptoms')} rows={2} placeholder="Patient complaints..." className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Diagnosis</label>
                <textarea {...register('diagnosis')} rows={3} placeholder="Doctor's diagnosis..." className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </div>

        {/* Prescriptions */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-semibold text-gray-800">Prescription</h3>
            <button type="button" onClick={() => append({ medicineName: '', dosage: '', frequency: '', durationDays: 3 })} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 font-bold">
                + Add Medicine
            </button>
          </div>
          
          <div className="space-y-3">
            {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col md:flex-row gap-2 bg-gray-50 p-3 rounded-md">
                <div className="flex-1">
                    <input {...register(`prescriptions.${index}.medicineName`)} placeholder="Medicine Name" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div className="w-full md:w-32">
                    <input {...register(`prescriptions.${index}.dosage`)} placeholder="Dose (500mg)" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div className="w-full md:w-32">
                    <input {...register(`prescriptions.${index}.frequency`)} placeholder="Freq (1-0-1)" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div className="w-full md:w-24">
                    <input type="number" {...register(`prescriptions.${index}.durationDays`)} placeholder="Days" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4">
            <button type="button" onClick={() => navigate('/doctor/dashboard')} className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-lg disabled:bg-blue-300">
                {isSubmitting ? 'Finalizing...' : 'Complete Consultation'}
            </button>
        </div>
      </form>
    </div>
  );
}