import { Navigate } from 'react-router-dom';

// Self-registration is disabled per domain model.
// Only managers can create accounts via /users.
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
