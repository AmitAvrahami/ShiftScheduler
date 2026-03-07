import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './app/auth/LoginPage';
import ManagerDashboard from './app/manager/DashboardPage';
import EmployeeDashboard from './app/employee/DashboardPage';
import ConstraintFormPage from './pages/ConstraintFormPage';
import ManagerConstraintsPage from './pages/ManagerConstraintsPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';

function App() {
    const { isAuthenticated, user } = useAuthStore();

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={
                    isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
                } />

                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        {user?.role === 'manager' ? <ManagerDashboard /> : <EmployeeDashboard />}
                    </ProtectedRoute>
                } />

                <Route path="/constraints" element={
                    <ProtectedRoute>
                        <ConstraintFormPage />
                    </ProtectedRoute>
                } />

                <Route path="/manager/constraints" element={
                    <ProtectedRoute>
                        {user?.role === 'manager' ? <ManagerConstraintsPage /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } />

                <Route path="/" element={
                    <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
