import api from '../config/api';
import { UserRole } from '../types/auth.types';
import type { AuthResponse } from '../types/auth.types'; // Fix: Added 'type'

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  phoneNumber?: string;
  cnic?: string;
  licenseNumber?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  register: async (data: RegisterData) => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData) => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};