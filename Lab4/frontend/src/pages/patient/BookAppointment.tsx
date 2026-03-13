import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { appointmentService } from '../../services/appointment.service';
import { AxiosError } from 'axios'; // Import AxiosError

const bookingSchema = z.object({
  doctorId: z.coerce.number().min(1, "Doctor ID is required"),
  hospitalId: z.coerce.number().min(1, "Hospital ID is required"),
  appointmentDate: z.string().refine((date) => new Date(date) > new Date(), {
    message: "Appointment date must be in the future",
  }),
  reason: z.string().min(5, "Please provide a reason"),
  type: z.enum(["IN_PERSON", "VIDEO"]),
});

type BookingFormInputs = z.infer<typeof bookingSchema>;

export default function BookAppointment() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  
  // Fix: Removed explicit generic <BookingFormInputs> to let TS infer types from resolver correctly
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { type: 'IN_PERSON' }
  });

  // Explicitly type the data in onSubmit based on the inferred schema type
  const onSubmit = async (data: BookingFormInputs) => {
    try {
      await appointmentService.book(data);
      navigate('/patient/dashboard');
    } catch (err) {
      // Fix: Use AxiosError type instead of any
      const error = err as AxiosError<{ message: string }>;
      setError(error.response?.data?.message || 'Booking failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md mt-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Book an Appointment</h2>
      
      {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doctor ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Doctor ID</label>
            <input 
              type="number" 
              {...register('doctorId')} 
              placeholder="e.g., 1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
            />
            {errors.doctorId && <p className="text-red-500 text-xs mt-1">{errors.doctorId.message as string}</p>}
          </div>

          {/* Hospital ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Hospital ID</label>
            <input 
              type="number" 
              {...register('hospitalId')} 
              placeholder="e.g., 1"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
            />
            {errors.hospitalId && <p className="text-red-500 text-xs mt-1">{errors.hospitalId.message as string}</p>}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Preferred Date</label>
          <input 
            type="date" 
            {...register('appointmentDate')} 
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
          />
          {errors.appointmentDate && <p className="text-red-500 text-xs mt-1">{errors.appointmentDate.message as string}</p>}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Reason for Visit</label>
          <textarea 
            {...register('reason')} 
            rows={3}
            placeholder="Describe your symptoms..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
          />
          {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message as string}</p>}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Appointment Type</label>
          <select {...register('type')} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="IN_PERSON">In-Person Visit</option>
            <option value="VIDEO">Video Consultation</option>
          </select>
        </div>

        <div className="flex justify-end gap-3">
            <button 
                type="button" 
                onClick={() => navigate('/patient/dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
                Cancel
            </button>
            <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
                {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </button>
        </div>
      </form>
    </div>
  );
}