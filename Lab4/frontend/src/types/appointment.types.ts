// Fix: Removed unused 'User' import
// Fix: Replaced enum with const assertion for 'erasableSyntaxOnly' compatibility

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export interface Doctor {
  id: number;
  specialization: string;
  designation: string;
  user: {
    email: string;
  };
}

export interface Hospital {
  name: string;
  city: string;
}

export interface Appointment {
  id: number;
  referenceCode: string;
  appointmentDate: string;
  reason: string;
  status: AppointmentStatus;
  queueNumber: number;
  doctor: Doctor;
  hospital: Hospital;
}