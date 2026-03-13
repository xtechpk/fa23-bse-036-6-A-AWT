import api from '../config/api';
import type { Appointment, AppointmentStatus } from '../types/appointment.types';

export interface BookAppointmentData {
  doctorId: number;
  hospitalId: number;
  appointmentDate: string;
  reason: string;
  type?: 'IN_PERSON' | 'VIDEO';
}

export interface ConsultationData {
  appointmentId: number;
  patientId: number;
  diagnosis: string;
  symptoms: string;
  vitals: {
    bp: string;
    temp: string;
    weight: string;
  };
  prescriptions: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
  }>;
}

export const appointmentService = {
  // 1. Patient: Book
  book: async (data: BookAppointmentData) => {
    const response = await api.post<{ success: boolean; data: Appointment }>('/appointments/book', data);
    return response.data;
  },

  // 2. Patient: My History
  getMyList: async () => {
    const response = await api.get<{ success: boolean; data: Appointment[] }>('/appointments/my-appointments');
    return response.data.data;
  },

  // 3. Doctor: Get Schedule
  getDoctorSchedule: async (date?: string) => {
    const query = date ? `?date=${date}` : '';
    const response = await api.get<{ success: boolean; data: Appointment[] }>(`/appointments/doctor/schedule${query}`);
    return response.data.data;
  },

  // 4. Doctor: Update Status
  updateStatus: async (id: number, status: AppointmentStatus) => {
    const response = await api.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/status`, { status });
    return response.data.data;
  },

  // 5. Doctor: Submit Consultation (Medical Record)
  submitConsultation: async (data: ConsultationData) => {
    const response = await api.post('/patients/medical-record', data);
    return response.data;
  }
};