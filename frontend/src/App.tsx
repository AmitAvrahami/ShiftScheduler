import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/auth/LoginPage';
import ManagerDashboard from './app/manager/DashboardPage';
import EmployeeDashboard from './app/employee/DashboardPage';
import ConstraintFormPage from './pages/ConstraintFormPage';
import ManagerConstraintsPage from './pages/ManagerConstraintsPage';
import ScheduleManagerPage from './pages/ScheduleManagerPage';
import MySchedulePage from './pages/MySchedulePage';
import ScheduleViewPage from './pages/ScheduleViewPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';

function App() {
    const { isAuthenticated, user } = useAuthStore();
    const isManager = user?.role === 'manager';

    return (
        <BrowserRouter>
            <Routes>
                {/* Auth */}
                <Route path="/login" element={
                    isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
                } />

                {/* Dashboard — role-aware */}
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        {isManager ? <ManagerDashboard /> : <EmployeeDashboard />}
                    </ProtectedRoute>
                } />

                {/* Constraints */}
                <Route path="/constraints" element={
                    <ProtectedRoute>
                        <ConstraintFormPage />
                    </ProtectedRoute>
                } />
                <Route path="/manager/constraints" element={
                    <ProtectedRoute>
                        {isManager ? <ManagerConstraintsPage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />

                {/* Schedules — all authenticated */}
                <Route path="/schedule" element={
                    <ProtectedRoute>
                        <ScheduleViewPage />
                    </ProtectedRoute>
                } />
                <Route path="/schedule/my" element={
                    <ProtectedRoute>
                        <MySchedulePage />
                    </ProtectedRoute>
                } />

                {/* Manager-only schedule management */}
                <Route path="/manager/schedule" element={
                    <ProtectedRoute>
                        {isManager ? <ScheduleManagerPage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />

                {/* Default redirect */}
                <Route path="/" element={
                    <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
