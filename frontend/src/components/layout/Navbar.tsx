import { Link } from 'react-router-dom';

export default function Navbar() {
    return (
        <nav className="bg-blue-600 text-white p-4 shadow-md">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="text-xl font-bold">Shift Scheduler</div>
                <div className="flex gap-4">
                    <Link to="/login" className="hover:text-blue-200">התחברות</Link>
                    <Link to="/manager/dashboard" className="hover:text-blue-200">מנהל</Link>
                    <Link to="/employee/dashboard" className="hover:text-blue-200">עובד</Link>
                </div>
            </div>
        </nav>
    );
}
