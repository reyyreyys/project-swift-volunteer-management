import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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
        axios.get('/projects'),
        axios.get('/volunteers'),
        axios.get('/clients')
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
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <Link to="/projects" className="create-project-btn">
          <Plus size={16} />
          New Project
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card projects">
          <div className="stat-icon">
            <FolderOpen size={32} />
          </div>
          <div className="stat-content">
            <h3>Projects</h3>
            <p className="stat-number">{stats.projects}</p>
            <Link to="/projects" className="stat-link">View all projects</Link>
          </div>
        </div>

        <div className="stat-card volunteers">
          <div className="stat-icon">
            <Users size={32} />
          </div>
          <div className="stat-content">
            <h3>Volunteers</h3>
            <p className="stat-number">{stats.volunteers}</p>
            <Link to="/volunteers" className="stat-link">Manage volunteers</Link>
          </div>
        </div>

        <div className="stat-card clients">
          <div className="stat-icon">
            <UserCheck size={32} />
          </div>
          <div className="stat-content">
            <h3>Clients</h3>
            <p className="stat-number">{stats.clients}</p>
            <Link to="/clients" className="stat-link">Manage clients</Link>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="recent-activity">
          <div className="section-header">
            <h2>
              <Activity size={20} />
              Recent Projects
            </h2>
          </div>
          <div className="activity-list">
            {stats.recentActivity.length > 0 ? (
              stats.recentActivity.map(project => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="activity-item"
                >
                  <div className="activity-info">
                    <h4>{project.name}</h4>
                    <p>{project.description || 'No description'}</p>
                    <span className="activity-date">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="activity-meta">
                    <span className="permission-badge">{project.permission}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <FolderOpen size={48} />
                <h3>No projects yet</h3>
                <p>Create your first project to get started</p>
                <Link to="/projects" className="create-first-project-btn">
                  Create Project
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <Link to="/projects" className="action-btn">
              <FolderOpen size={20} />
              <span>Create New Project</span>
            </Link>
            <Link to="/volunteers" className="action-btn">
              <Users size={20} />
              <span>Import Volunteers</span>
            </Link>
            <Link to="/clients" className="action-btn">
              <UserCheck size={20} />
              <span>Import Clients</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
