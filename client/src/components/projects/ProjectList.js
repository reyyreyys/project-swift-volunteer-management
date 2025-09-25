import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../apiClient'; // Changed from 'axios' to 'apiClient'
import { Plus, Search, FolderOpen, Users, Calendar } from 'lucide-react';
import CreateProjectModal from './CreateProjectModal';

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await apiClient.get('/projects'); // Changed from axios to apiClient
      setProjects(response.data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProjectCreated = () => {
    setShowCreateModal(false);
    loadProjects();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button 
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:-translate-y-0.5 font-semibold shadow-lg"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white text-base focus:outline-none focus:ring-3 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 transform hover:-translate-y-1 block"
            >
              {/* Project Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0 p-3 bg-gray-100 rounded-lg group-hover:bg-indigo-50 transition-colors duration-200">
                  <FolderOpen size={24} className="text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors duration-200 truncate">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {project.description || 'No description'}
                  </p>
                </div>
              </div>

              {/* Project Meta */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users size={14} className="flex-shrink-0" />
                  <span>{project.collaboratorCount} collaborators</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar size={14} className="flex-shrink-0" />
                  <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Project Footer */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-400">
                  by {project.createdBy.username}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  project.permission.toLowerCase() === 'admin' 
                    ? 'bg-red-100 text-red-800' 
                    : project.permission.toLowerCase() === 'edit'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {project.permission}
                </span>
              </div>
            </Link>
          ))
        ) : (
          /* Empty State */
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <FolderOpen size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchTerm ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : 'Create your first project to get started with volunteer management'
              }
            </p>
            {!searchTerm && (
              <button 
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 transform hover:-translate-y-0.5 font-semibold shadow-lg"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} />
                Create Your First Project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}
    </div>
  );
};

export default ProjectList;
