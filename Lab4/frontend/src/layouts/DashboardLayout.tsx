import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { UserRole } from '../types/auth.types';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Define Menu Items per Role
  const getMenuItems = () => {
    switch (user?.role) {
      case UserRole.PATIENT:
        return [
          { label: 'Dashboard', path: '/patient/dashboard' },
          { label: 'Book Appointment', path: '/patient/book-appointment' },
          { label: 'Lab Reports', path: '/patient/lab-reports' },
          { label: 'Order Lab Test', path: '/patient/book-lab-test' },
          { label: 'Emergency', path: '/patient/emergency', danger: true },
        ];
      case UserRole.DOCTOR:
        return [
          { label: 'My Schedule', path: '/doctor/dashboard' },
          // Consultation is accessed via Dashboard, so no direct link needed usually
        ];
      case UserRole.PHARMACIST:
        return [
          { label: 'Inventory & Dispense', path: '/pharmacy/dashboard' },
        ];
      case UserRole.LAB_TECHNICIAN:
        return [
          { label: 'Work Queue', path: '/lab/dashboard' },
        ];
      case UserRole.AMBULANCE_DRIVER:
        return [
          { label: 'Driver Console', path: '/driver/dashboard' },
        ];
      case UserRole.HOSPITAL_ADMIN:
        return [
          { label: 'Ministry Dashboard', path: '/admin/dashboard' },
          { label: 'Pharmacy View', path: '/pharmacy/dashboard' },
          { label: 'Lab View', path: '/lab/dashboard' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md hidden md:block flex-shrink-0">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600 tracking-wider">UHSP</h1>
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Unified Health</p>
        </div>
        
        <nav className="mt-6 px-4 space-y-2">
          {getMenuItems().map((item) => (
            <div 
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-3 rounded-lg cursor-pointer transition-colors font-medium text-sm
                ${location.pathname === item.path 
                  ? 'bg-blue-50 text-blue-700' 
                  : item.danger 
                    ? 'text-red-600 hover:bg-red-50' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {item.label}
            </div>
          ))}
        </nav>

        {/* User Info at Bottom */}
        <div className="absolute bottom-0 w-64 p-4 border-t bg-gray-50">
          <p className="text-sm font-bold text-gray-700 truncate">{ user?.email}</p>
          <p className="text-xs text-gray-500 uppercase">{user?.role}</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
          <h2 className="text-lg font-semibold text-gray-800">
            {/* Dynamic Header Title could go here */}
            Overview
          </h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}