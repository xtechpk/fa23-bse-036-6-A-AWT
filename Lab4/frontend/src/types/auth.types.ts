// Fix: Use 'as const' instead of enum to satisfy 'erasableSyntaxOnly'
export const UserRole = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  PHARMACIST: 'PHARMACIST',
  LAB_TECHNICIAN: 'LAB_TECHNICIAN',
  AMBULANCE_DRIVER: 'AMBULANCE_DRIVER',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN'
} as const;

// Create a Type from the Object
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: number;
  email: string;
  role: UserRole;
  patientId?: number;
  staffId?: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}