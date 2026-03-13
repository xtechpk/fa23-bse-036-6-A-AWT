export interface SystemStats {
  totalPatients: number;
  activeDoctors: number;
  pendingAppointments: number;
  availableAmbulances: number;
  activeAlerts: number;
}

export interface BroadcastData {
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  region?: string;
}