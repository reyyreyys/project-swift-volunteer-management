import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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
      const response = await axios.get('/projects');
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
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="page-header">
        <h1>Projects</h1>
        <button 
          className="create-btn primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      <div className="filters">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="projects-grid">
        {filteredProjects.length > 0 ? (
          filteredProjects.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="project-card"
            >
              <div className="project-header">
                <div className="project-icon">
                  <FolderOpen size={24} />
                </div>
                <div className="project-info">
                  <h3>{project.name}</h3>
                  <p>{project.description || 'No description'}</p>
                </div>
              </div>

              <div className="project-meta">
                <div className="meta-item">
                  <Users size={14} />
                  <span>{project.collaboratorCount} collaborators</span>
                </div>
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="project-footer">
                <span className="created-by">by {project.createdBy.username}</span>
                <span className={`permission-badge ${project.permission.toLowerCase()}`}>
                  {project.permission}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="empty-state">
            <FolderOpen size={64} />
            <h3>
              {searchTerm ? 'No projects found' : 'No projects yet'}
            </h3>
            <p>
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : 'Create your first project to get started with volunteer management'
              }
            </p>
            {!searchTerm && (
              <button 
                className="create-first-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Project
              </button>
            )}
          </div>
        )}
      </div>

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
