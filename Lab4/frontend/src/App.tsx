import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Auth
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Layout & Guards
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import { UserRole } from './types/auth.types';

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard';
import BookAppointment from './pages/patient/BookAppointment';
import BookLabTest from './pages/lab/BookLabTest';
import MyLabReports from './pages/lab/MyLabReports';
import RequestAmbulance from './pages/ambulance/RequestAmbulance';

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import Consultation from './pages/doctor/Consultation';

// Pharmacy Pages
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';

// Lab Pages
import TechnicianDashboard from './pages/lab/TechnicianDashboard';

// Ambulance Driver Pages
import DriverConsole from './pages/ambulance/DriverConsole';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* --- Protected Routes --- */}
        <Route element={<ProtectedRoute />}>
           <Route element={<DashboardLayout />}>
              
              {/* 1. Patient Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.PATIENT]} />}>
                <Route path="/patient/dashboard" element={<PatientDashboard />} />
                <Route path="/patient/book-appointment" element={<BookAppointment />} />
                <Route path="/patient/book-lab-test" element={<BookLabTest />} />
                <Route path="/patient/lab-reports" element={<MyLabReports />} />
                <Route path="/patient/emergency" element={<RequestAmbulance />} />
              </Route>

              {/* 2. Doctor Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.DOCTOR]} />}>
                <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                <Route path="/doctor/consultation" element={<Consultation />} />
              </Route>

              {/* 3. Pharmacy Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.PHARMACIST, UserRole.HOSPITAL_ADMIN]} />}>
                <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
              </Route>

              {/* 4. Lab Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.LAB_TECHNICIAN, UserRole.HOSPITAL_ADMIN]} />}>
                <Route path="/lab/dashboard" element={<TechnicianDashboard />} />
              </Route>

              {/* 5. Ambulance Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.AMBULANCE_DRIVER]} />}>
                <Route path="/driver/dashboard" element={<DriverConsole />} />
              </Route>

              {/* 6. Admin Module */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_ADMIN]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
              </Route>

           </Route>
        </Route>

        {/* --- Fallback --- */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;