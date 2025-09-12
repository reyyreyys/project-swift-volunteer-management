import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import Dashboard from './components/Dashboard';
import ProjectList from './components/projects/ProjectList';
import ProjectDetail from './components/projects/ProjectDetail';
import VolunteerDatabase from './components/volunteers/VolunteerDatabase';
import ClientDatabase from './components/clients/ClientDatabase';
import Navigation from './components/layout/Navigation';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Navigation Sidebar */}
      <Navigation />
      
      {/* Main Content Area with proper spacing for sidebar */}
      <main className="flex-1 md:ml-[280px] ml-0 p-4 md:p-8 overflow-y-auto min-h-screen">
        <div className="w-full max-w-none">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/volunteers" element={<VolunteerDatabase />} />
            <Route path="/clients" element={<ClientDatabase />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
