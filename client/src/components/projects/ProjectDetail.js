import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Users, UserCheck, Share2, Settings, AlertTriangle, Trash2 } from 'lucide-react';
import VolunteerCSVImporter from '../volunteers/VolunteerCSVImporter';

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [projectVolunteers, setProjectVolunteers] = useState([]);
  const [projectClients, setProjectClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showVolunteerImporter, setShowVolunteerImporter] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingVolunteers, setClearingVolunteers] = useState(false);

  useEffect(() => {
    loadProject();
    loadProjectData();
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await axios.get(`/projects/${id}`);
      setProject(response.data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

const loadProjectData = async () => {
  try {
    // Use the new endpoint that calculates experience dynamically
    const [volunteersRes, clientsRes] = await Promise.all([
      axios.get(`/projects/${id}/volunteers-with-experience`).catch(() => ({ data: [] })),
      axios.get(`/projects/${id}/clients`).catch(() => ({ data: [] }))
    ]);
    
    setProjectVolunteers(volunteersRes.data);
    setProjectClients(clientsRes.data);
  } catch (error) {
    console.error('Error loading project data:', error);
  }
};


  const handleImportComplete = (result) => {
    console.log('Import completed:', result);
    setShowVolunteerImporter(false);
    
    // Refresh the project data to show new volunteers
    loadProjectData();
  };

  const handleImportVolunteers = () => {
    setShowVolunteerImporter(true);
    setActiveTab('volunteers');
  };

const handleClearVolunteers = async () => {
  setClearingVolunteers(true);
  try {
    const response = await axios.delete(`/projects/${id}/volunteers`);
    if (response.data.success) {
      const { removedFromProject, completelyDeleted } = response.data;
      let message = `Successfully removed ${removedFromProject} volunteers from project.`;
      
      if (completelyDeleted > 0) {
        message += ` ${completelyDeleted} volunteers were completely deleted as they were only in this project.`;
      } else {
        message += ` All volunteers remain available for other projects.`;
      }
      
      alert(message);
      loadProjectData(); // Refresh the data
      setShowClearConfirm(false);
    }
  } catch (error) {
    alert('Failed to clear volunteers: ' + (error.response?.data?.error || error.message));
  } finally {
    setClearingVolunteers(false);
  }
};


  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="error-container">
        <h2>Project not found</h2>
        <Link to="/projects">← Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="project-detail">
      <div className="project-header">
        <div className="header-main">
          <Link to="/projects" className="back-link">
            <ArrowLeft size={20} />
            Back to Projects
          </Link>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
        </div>
        
        <div className="header-actions">
          <button className="action-btn">
            <Share2 size={16} />
            Share Project
          </button>
          <button className="action-btn">
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'volunteers' ? 'active' : ''}`}
          onClick={() => setActiveTab('volunteers')}
        >
          <Users size={16} />
          Volunteers ({projectVolunteers.length})
        </button>
        <button 
          className={`tab ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          <UserCheck size={16} />
          Clients ({projectClients.length})
        </button>
      </div>

      <div className="project-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-stats">
              <div className="stat-card">
                <h3>Volunteers</h3>
                <p className="stat-number">{projectVolunteers.length}</p>
                <p className="stat-subtitle">
                  {projectVolunteers.filter(pv => pv.volunteer?.totalProjects > 1).length} in multiple projects
                </p>
              </div>
              <div className="stat-card">
                <h3>Clients</h3>
                <p className="stat-number">{projectClients.length}</p>
              </div>
              <div className="stat-card">
                <h3>Assignments</h3>
                <p className="stat-number">0</p>
              </div>
            </div>

            <div className="quick-actions-section">
              <h3>Quick Actions</h3>
              <div className="action-grid">
                <button 
                  className="action-card"
                  onClick={handleImportVolunteers}
                >
                  <Users size={24} />
                  <span>Import Volunteers</span>
                </button>
                <button 
                  className="action-card"
                  onClick={() => setActiveTab('clients')}
                >
                  <UserCheck size={24} />
                  <span>Import Clients</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'volunteers' && (
          <div className="volunteers-tab">
            <div className="volunteers-header">
              <h3>Project Volunteers ({projectVolunteers.length})</h3>
              <div className="header-actions">
                <button 
                  className="import-btn primary"
                  onClick={() => setShowVolunteerImporter(true)}
                >
                  <Users size={16} />
                  Import More Volunteers
                </button>
                {projectVolunteers.length > 0 && (
                  <button 
                    className="clear-btn danger"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 size={16} />
                    Clear All Volunteers
                  </button>
                )}
              </div>
            </div>

            {projectVolunteers.length > 0 ? (
              <div className="volunteers-grid">
                {projectVolunteers.map(pv => (
                  <div key={pv.id} className="volunteer-card">
                    <div className="volunteer-header">
                      <div>
                        <h4>{pv.volunteer.firstName} {pv.volunteer.lastName}</h4>
                        {pv.volunteer.totalProjects > 1 && (
                          <div className="multi-project-indicator">
                            <AlertTriangle size={14} />
                            <span>In {pv.volunteer.totalProjects} projects</span>
                          </div>
                        )}
                      </div>
                      <div className="volunteer-badges">
                        {pv.volunteer.isJoiningAsGroup && (
                          <span className="badge group">Group</span>
                        )}
                        {pv.volunteer.hasExperience && (
                          <span className="badge experience" title={`Experienced (${pv.volunteer.totalProjects} total projects)`}>
                            Experienced ({pv.volunteer.totalProjects} projects)
                          </span>
                        )}
                        <span className={`badge status-${pv.status.toLowerCase()}`}>
                          {pv.status}
                        </span>
                      </div>

                    </div>

                    <div className="volunteer-details">
                      <p><strong>Age:</strong> {pv.volunteer.age || 'N/A'}</p>
                      <p><strong>Contact:</strong> {pv.volunteer.contactNumber || 'N/A'}</p>
                      <p><strong>Email:</strong> {pv.volunteer.email || 'N/A'}</p>
                      <p><strong>Languages:</strong> {pv.volunteer.languages?.join(', ') || 'N/A'}</p>
                      <p><strong>Regions:</strong> {pv.volunteer.regions?.join(', ') || 'N/A'}</p>
                      <p><strong>Available Days:</strong> {pv.volunteer.availableDays?.join(', ') || 'N/A'}</p>
                    </div>

                    {pv.volunteer.otherProjects && pv.volunteer.otherProjects.length > 0 && (
                      <div className="other-projects">
                        <h5>Also in:</h5>
                        <div className="project-list">
                          {pv.volunteer.otherProjects.map(op => (
                            <Link 
                              key={op.id} 
                              to={`/projects/${op.id}`}
                              className="project-link"
                            >
                              {op.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="volunteer-footer">
                      <span className="added-at">
                        Added {new Date(pv.addedAt).toLocaleDateString()}
                      </span>
                      <span className="created-by">
                        by {pv.volunteer.createdBy?.username || 'Unknown'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Users size={64} />
                <h3>No volunteers imported yet</h3>
                <p>Import your first batch of volunteers to get started</p>
                <button 
                  className="create-first-btn"
                  onClick={() => setShowVolunteerImporter(true)}
                >
                  Import Volunteers
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="clients-tab">
            <div className="clients-header">
              <h3>Project Clients ({projectClients.length})</h3>
            </div>
            <div className="coming-soon">
              <h3>Client Management</h3>
              <p>Client import and management features coming soon...</p>
            </div>
          </div>
        )}
      </div>

      {/* Volunteer CSV Importer Modal */}
      {showVolunteerImporter && (
        <VolunteerCSVImporter 
          projectId={project.id}
          onImportComplete={handleImportComplete}
          onClose={() => setShowVolunteerImporter(false)}
        />
      )}

      {/* Clear Volunteers Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h3>Clear All Volunteers</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingVolunteers}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="warning-icon">
                <AlertTriangle size={48} color="#f56565" />
              </div>
              <p>Are you sure you want to clear all <strong>{projectVolunteers.length} volunteers</strong> from this project?</p>
              <div className="warning-note">
                <p><strong>Important:</strong></p>
                <ul>
                  <li>Volunteers who are <strong>only in this project</strong> will be <strong>completely deleted</strong></li>
                  <li>Volunteers who are in <strong>other projects</strong> will only be <strong>removed from this project</strong></li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingVolunteers}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn danger"
                onClick={handleClearVolunteers}
                disabled={clearingVolunteers}
              >
                {clearingVolunteers ? (
                  <>
                    <div className="spinner-small"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Clear All Volunteers
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
