import api from '../config/api';
import type { RequestData, Trip } from '../types/ambulance.types';

export const ambulanceService = {
  // 1. Patient: Request Help
  requestDispatch: async (data: RequestData) => {
    const response = await api.post<{ success: boolean; data: Trip }>('/ambulance/dispatch', data);
    return response.data.data;
  },

  // 2. Patient/Driver: Get Trip Status
  getTripStatus: async (tripId: number) => {
    const response = await api.get<{ success: boolean; data: Trip }>(`/ambulance/trip/${tripId}`);
    return response.data.data;
  },

  // 3. Driver: Update Location (Simulating GPS)
  updateLocation: async (tripId: number, lat: number, lng: number, status?: string) => {
    const response = await api.patch('/ambulance/location', {
      tripId,
      currentLat: lat,
      currentLng: lng,
      status
    });
    return response.data;
  }
};

export default ambulanceService;

//