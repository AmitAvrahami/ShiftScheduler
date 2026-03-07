import { useAuthStore } from '../../store/authStore';
import { Link, useNavigate } from 'react-router-dom';

export default function ManagerDashboard() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800">
                        מערכת סידור משמרות
                    </h1>
                    <div className="flex items-center gap-4">
                        <Link to="/manager/constraints" className="text-blue-600 hover:text-blue-800 font-medium">
                            ניהול אילוצים
                        </Link>
                        <span className="text-gray-700">שלום, {user?.name}</span>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
                        >
                            התנתק
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">לוח בקרה - מנהל</h2>
                    <p className="text-gray-600">ברוך הבא למערכת!</p>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <p className="font-semibold">פרטי משתמש:</p>
                        <p>שם: {user?.name}</p>
                        <p>אימייל: {user?.email}</p>
                        <p>תפקיד: מנהל</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
