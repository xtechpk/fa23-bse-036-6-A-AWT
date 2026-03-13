import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form'; // Import useWatch
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { UserRole } from '../../types/auth.types';
import { AxiosError } from 'axios'; // Import AxiosError

const registerSchema = z.object({
  fullName: z.string().min(3, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ chars"),
  role: z.nativeEnum(UserRole),
  phoneNumber: z.string().min(10, "Invalid phone"),
  cnic: z.string().optional(),
  licenseNumber: z.string().optional(),
}).refine((data) => {
  if (data.role === UserRole.DOCTOR && !data.licenseNumber) {
    return false;
  }
  return true;
}, { message: "License Number is required for Doctors", path: ["licenseNumber"] });

type RegisterFormInputs = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  
  // Destructure 'control' to use with useWatch
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: UserRole.PATIENT }
  });

  // Fix: Use useWatch hook instead of watch method to satisfy React Compiler
  const selectedRole = useWatch({ control, name: 'role' });

  const onSubmit = async (data: RegisterFormInputs) => {
    try {
      await authService.register(data);
      navigate('/login');
    } catch (err) {
      // Fix: Safely cast error to AxiosError
      const error = err as AxiosError<{ message: string }>;
      setError(error.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create an Account</h2>
        </div>
        
        {error && <div className="bg-red-50 text-red-500 p-3 rounded">{error}</div>}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input {...register('fullName')} className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input type="email" {...register('email')} className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input type="password" {...register('password')} className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700">I am a...</label>
              <select {...register('role')} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                <option value={UserRole.PATIENT}>Patient</option>
                <option value={UserRole.DOCTOR}>Doctor</option>
                <option value={UserRole.PHARMACIST}>Pharmacist</option>
                <option value={UserRole.LAB_TECHNICIAN}>Lab Technician</option>
                <option value={UserRole.AMBULANCE_DRIVER}>Ambulance Driver</option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input {...register('phoneNumber')} className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

            {/* Dynamic Fields */}
            {selectedRole === UserRole.DOCTOR && (
              <div>
                 <label className="block text-sm font-medium text-gray-700">Medical License Number</label>
                 <input {...register('licenseNumber')} className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
                 {errors.licenseNumber && <p className="text-red-500 text-xs mt-1">{errors.licenseNumber.message}</p>}
              </div>
            )}
            
          </div>

          <div>
            <button type="submit" disabled={isSubmitting} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300">
              {isSubmitting ? 'Registering...' : 'Sign Up'}
            </button>
          </div>
          
          <div className="text-center">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Already have an account? Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}