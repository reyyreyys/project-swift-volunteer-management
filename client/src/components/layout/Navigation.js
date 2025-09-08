import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, FolderOpen, Users, UserCheck, LogOut } from 'lucide-react';

const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/projects', icon: FolderOpen, label: 'Projects' },
    { path: '/volunteers', icon: Users, label: 'Volunteers' },
    { path: '/clients', icon: UserCheck, label: 'Clients' }
  ];

  return (
    <nav className="navigation">
      <div className="nav-header">
        <h1>VMS</h1>
        <span className="nav-subtitle">Volunteer Management</span>
      </div>

      <div className="nav-menu">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`nav-item ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      <div className="nav-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="username">{user.username}</span>
            <span className="user-role">{user.role}</span>
          </div>
        </div>
        <button onClick={logout} className="logout-btn">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
