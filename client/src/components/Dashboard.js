import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient'; // Changed from 'axios' to 'apiClient'
import { FolderOpen, Users, UserCheck, Plus, Activity } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    projects: 0,
    volunteers: 0,
    clients: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [projectsRes, volunteersRes, clientsRes] = await Promise.all([
        apiClient.get('/projects'), // Changed from axios to apiClient
        apiClient.get('/volunteers'), // Changed from axios to apiClient
        apiClient.get('/clients') // Changed from axios to apiClient
      ]);

      setStats({
        projects: projectsRes.data.length,
        volunteers: volunteersRes.data.length,
        clients: clientsRes.data.length,
        recentActivity: projectsRes.data.slice(0, 5) // Recent projects as activity
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link 
          to="/projects" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold transition-transform hover:-translate-y-0.5"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Projects Card */}
        <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center gap-6">
          <div className="p-4 bg-indigo-100 rounded-xl">
            <FolderOpen size={32} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-gray-600 font-medium mb-2">Projects</h3>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.projects}</p>
            <Link 
              to="/projects" 
              className="text-indigo-600 hover:text-indigo-500 text-sm font-medium transition-colors"
            >
              View all projects
            </Link>
          </div>
        </div>

        {/* Volunteers Card */}
        <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center gap-6">
          <div className="p-4 bg-green-100 rounded-xl">
            <Users size={32} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-gray-600 font-medium mb-2">Volunteers</h3>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.volunteers}</p>
            <Link 
              to="/volunteers" 
              className="text-indigo-600 hover:text-indigo-500 text-sm font-medium transition-colors"
            >
              Manage volunteers
            </Link>
          </div>
        </div>

        {/* Clients Card */}
        <div className="bg-white rounded-xl p-8 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex items-center gap-6">
          <div className="p-4 bg-orange-100 rounded-xl">
            <UserCheck size={32} className="text-orange-600" />
          </div>
          <div>
            <h3 className="text-gray-600 font-medium mb-2">Clients</h3>
            <p className="text-3xl font-bold text-gray-900 mb-2">{stats.clients}</p>
            <Link 
              to="/clients" 
              className="text-indigo-600 hover:text-indigo-500 text-sm font-medium transition-colors"
            >
              Manage clients
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity - Takes 2/3 of the space */}
        <div className="lg:col-span-2 bg-white rounded-xl p-8 shadow-md">
          <div className="flex items-center gap-3 mb-6">
            <Activity size={20} className="text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Recent Projects</h2>
          </div>
          
          <div className="space-y-4">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map(project => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-gray-50 transition-all duration-200 block"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{project.name}</h4>
                    <p className="text-gray-600 text-sm mb-1">{project.description || 'No description'}</p>
                    <span className="text-gray-400 text-xs">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {project.permission && (
                    <div className="ml-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        project.permission === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : project.permission === 'edit'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {project.permission}
                      </span>
                    </div>
                  )}
                </Link>
              ))
            ) : (
              <div className="text-center py-12">
                <FolderOpen size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No projects yet</h3>
                <p className="text-gray-500 mb-4">Create your first project to get started</p>
                <Link 
                  to="/projects" 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold transition-transform hover:-translate-y-0.5"
                >
                  Create Project
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Takes 1/3 of the space */}
        <div className="bg-white rounded-xl p-8 shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          
          <div className="space-y-4">
            <Link 
              to="/projects" 
              className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
            >
              <FolderOpen size={20} className="text-gray-600" />
              <span className="font-medium text-gray-700">Create New Project</span>
            </Link>
            
            <Link 
              to="/volunteers" 
              className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
            >
              <Users size={20} className="text-gray-600" />
              <span className="font-medium text-gray-700">Import Volunteers</span>
            </Link>
            
            <Link 
              to="/clients" 
              className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200"
            >
              <UserCheck size={20} className="text-gray-600" />
              <span className="font-medium text-gray-700">Import Clients</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
