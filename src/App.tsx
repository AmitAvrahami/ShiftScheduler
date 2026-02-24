import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './pages/Dashboard';

import { Team } from './pages/Team';

function Shell() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-inter">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-6 p-safe relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'shifts',
        element: <div className="p-4">Shifts Management</div>,
      },
      {
        path: 'team',
        element: <Team />,
      },
      {
        path: 'settings',
        element: <div className="p-4">Settings</div>,
      },
    ],
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </>
  );
}

export default App;
