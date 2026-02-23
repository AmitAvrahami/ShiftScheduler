import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';

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
        element: <div className="p-4">Team Directory</div>,
      },
      {
        path: 'settings',
        element: <div className="p-4">Settings</div>,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
