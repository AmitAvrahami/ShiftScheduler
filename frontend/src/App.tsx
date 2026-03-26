import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/auth/LoginPage';
import ManagerDashboard from './app/manager/DashboardPage';
import EmployeeDashboard from './app/employee/DashboardPage';
import ConstraintFormPage from './pages/ConstraintFormPage';
import ManagerConstraintsPage from './pages/ManagerConstraintsPage';
import ScheduleManagerPage from './pages/ScheduleManagerPage';
import MySchedulePage from './pages/MySchedulePage';
import ScheduleViewPage from './pages/ScheduleViewPage';
import EmployeeManagementPage from './pages/EmployeeManagementPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AutomatedSchedulerPage from './pages/AutomatedSchedulerPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';

function App() {
    const { isAuthenticated, user } = useAuthStore();
    const isManager = user?.role === 'manager' || user?.role === 'admin';
    const isAdmin = user?.role === 'admin';

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
                <Route path="/manager/schedule/auto" element={
                    <ProtectedRoute>
                        {isManager ? <AutomatedSchedulerPage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />

                {/* Manager-only employee management */}
                <Route path="/manager/employees" element={
                    <ProtectedRoute>
                        {isManager ? <EmployeeManagementPage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />
                <Route path="/manager/employees/:id" element={
                    <ProtectedRoute>
                        {isManager ? <EmployeeProfilePage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />

                {/* Admin-only control panel */}
                <Route path="/admin" element={
                    <ProtectedRoute>
                        {isAdmin ? <AdminDashboardPage /> : <Navigate to="/dashboard" replace />}
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
