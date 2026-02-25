import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Shell() {
    return (
        <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
            <Sidebar />
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 overflow-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
