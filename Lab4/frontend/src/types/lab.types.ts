export interface LabTest {
  id: number;
  testCode: string;
  name: string;
  basePrice: string;
  requiresFasting: boolean;
}

export interface LabOrder {
  id: number;
  status: 'ORDERED' | 'PROCESSING' | 'COMPLETED';
  resultValue?: string;
  orderedAt: string;
  patient: {
    firstName: string;
    lastName: string;
    gender: string;
  };
  test: {
    name: string;
    requiresFasting: boolean;
  };
}

export interface AddResultData {
  resultValue: string;
  technicianNotes?: string;
  resultDocument?: string; // URL
}