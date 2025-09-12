import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, FolderOpen, Users, UserCheck, LogOut, Menu, X } from 'lucide-react';

const Navigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/projects', icon: FolderOpen, label: 'Projects' },
    { path: '/volunteers', icon: Users, label: 'Volunteers' },
    { path: '/clients', icon: UserCheck, label: 'Clients' }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-indigo-600 text-white rounded-lg shadow-lg"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Navigation Sidebar */}
      <nav className={`
        fixed left-0 top-0 w-[280px] h-screen bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex flex-col py-8 z-50
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-8 pb-8 border-b border-white/10">
          <h1 className="text-2xl font-bold">VMS</h1>
          <p className="text-sm opacity-80">Volunteer Management</p>
        </div>

        <div className="flex-1 py-8">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            
            return (
              <Link
                key={path}
                to={path}
                onClick={closeMobileMenu}
                className={`
                  flex items-center gap-3 px-8 py-3 text-white/80 font-medium transition-all duration-200
                  hover:bg-white/10 hover:text-white
                  ${isActive ? 'bg-white/10 text-white border-r-4 border-white' : ''}
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-8 py-8 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{user.username}</span>
              <span className="text-xs opacity-70 capitalize">{user.role}</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-white/80 hover:bg-white/10 hover:text-white rounded transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
