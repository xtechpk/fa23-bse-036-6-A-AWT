
export type TripStatus = 'SEARCHING' | 'DISPATCHED' | 'ON_SITE' | 'TRANSPORTING' | 'COMPLETED';

export interface Ambulance {
  id: number;
  plateNumber: string;
  isAvailable: boolean;
  currentLat: number | null;
  currentLng: number | null;
}

export interface Trip {
  id: number;
  status: TripStatus;
  pickupAddress: string;
  driver?: {
    user: {
      fullName: string;
      phoneNumber: string;
    };
  };
  ambulance?: {
    plateNumber: string;
    currentLat: number;
    currentLng: number;
  };
}

export interface RequestData {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  severity: 'CRITICAL' | 'STABLE' | 'TRANSFER';
}