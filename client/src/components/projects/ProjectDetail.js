import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  Users, 
  UserCheck, 
  Share2, 
  Settings, 
  AlertTriangle, 
  Trash2,
  Link2,
  BookOpen  // Add this import for the training tab icon
} from 'lucide-react';
import VolunteerCSVImporter from '../volunteers/VolunteerCSVImporter';
import VolunteerSelectionTable from '../volunteers/VolunteerSelectionTable';
import VolunteerPairingTab from '../volunteers/VolunteerPairingTab';
import TrainingDayTab from '../volunteers/TrainingDayTab';  // Add this import
import ClientManagementTab from '../clients/ClientManagementTab'; 

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
  
  // Add refresh key state for triggering component refreshes
  const [refreshKey, setRefreshKey] = useState(0);

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
      const [volunteersRes, clientsRes] = await Promise.all([
        axios.get(`/projects/${id}/volunteers-detailed`).catch(() => ({ data: [] })),
        axios.get(`/projects/${id}/clients`).catch(() => ({ data: [] }))
      ]);
      
      setProjectVolunteers(volunteersRes.data);
      setProjectClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading project data:', error);
    }
  };

  // Update this function to trigger refresh
  const handleImportComplete = (result) => {
    console.log('Import completed:', result);
    setShowVolunteerImporter(false);
    loadProjectData();
    setRefreshKey(prev => prev + 1); // Trigger refresh for other tabs
  };

  const handleImportVolunteers = () => {
    setShowVolunteerImporter(true);
    setActiveTab('volunteers');
  };

  // Update this function to trigger refresh
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
        loadProjectData();
        setRefreshKey(prev => prev + 1); // Trigger refresh for other tabs
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

  // Calculate statistics for better tab labels
  const selectedVolunteers = projectVolunteers.filter(pv => pv.status === 'SELECTED').length;
  const waitlistedVolunteers = projectVolunteers.filter(pv => pv.status === 'WAITLISTED').length;
  const experiencedVolunteers = projectVolunteers.filter(pv => 
    (pv.status === 'SELECTED' || pv.status === 'WAITLISTED') && pv.volunteer.hasExperience
  ).length;
  const needTrainingCount = projectVolunteers.filter(pv => 
    (pv.status === 'SELECTED' || pv.status === 'WAITLISTED') && !pv.volunteer.hasExperience
  ).length;

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

      {/* Updated tabs with Training tab */}
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
          className={`tab ${activeTab === 'pairing' ? 'active' : ''}`}
          onClick={() => setActiveTab('pairing')}
        >
          <Link2 size={16} />
          Pairing ({selectedVolunteers + waitlistedVolunteers})
        </button>
        {/* Add the Training tab */}
        <button 
          className={`tab ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          <BookOpen size={16} />
          Training ({needTrainingCount})
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
                  {selectedVolunteers} selected, {waitlistedVolunteers} waitlisted
                </p>
              </div>
              <div className="stat-card">
                <h3>Training Needed</h3>
                <p className="stat-number">{needTrainingCount}</p>
                <p className="stat-subtitle">
                  {experiencedVolunteers} have experience
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
                  onClick={() => setActiveTab('training')}
                >
                  <BookOpen size={24} />
                  <span>Manage Training</span>
                </button>
                <button 
                  className="action-card"
                  onClick={() => setActiveTab('pairing')}
                >
                  <Link2 size={24} />
                  <span>Create Pairs</span>
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

            {/* Pass refreshKey to VolunteerSelectionTable */}
            <VolunteerSelectionTable projectId={project.id} refreshKey={refreshKey} />
          </div>
        )}

        {/* Add the Pairing tab content */}
        {activeTab === 'pairing' && (
          <div className="pairing-tab">
            <div className="pairing-header">
              <h3>Volunteer Pairing ({selectedVolunteers + waitlistedVolunteers} volunteers)</h3>
              <div className="header-actions">
                {selectedVolunteers === 0 && waitlistedVolunteers === 0 && (
                  <button 
                    className="import-btn primary"
                    onClick={() => setActiveTab('volunteers')}
                  >
                    <Users size={16} />
                    Select Volunteers First
                  </button>
                )}
              </div>
            </div>

            {selectedVolunteers > 0 || waitlistedVolunteers > 0 ? (
              <VolunteerPairingTab projectId={project.id} refreshKey={refreshKey} />
            ) : (
              <div className="empty-pairing">
                <Link2 size={64} className="empty-icon" />
                <h3>No volunteers selected for pairing</h3>
                <p>You need to select volunteers before you can create pairs.</p>
                <button 
                  className="btn-primary"
                  onClick={() => setActiveTab('volunteers')}
                >
                  <Users size={16} />
                  Go to Volunteers Tab
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add the Training tab content */}
        {activeTab === 'training' && (
          <div className="training-tab">
            <div className="training-header">
              <h3>Training Day Management</h3>
              <div className="header-actions">
                {selectedVolunteers === 0 && waitlistedVolunteers === 0 && (
                  <button 
                    className="import-btn primary"
                    onClick={() => setActiveTab('volunteers')}
                  >
                    <Users size={16} />
                    Select Volunteers First
                  </button>
                )}
              </div>
            </div>

            {selectedVolunteers > 0 || waitlistedVolunteers > 0 ? (
              <TrainingDayTab projectId={project.id} refreshKey={refreshKey} />
            ) : (
              <div className="empty-training">
                <BookOpen size={64} className="empty-icon" />
                <h3>No volunteers selected for training</h3>
                <p>You need to select volunteers before you can manage their training.</p>
                <button 
                  className="btn-primary"
                  onClick={() => setActiveTab('volunteers')}
                >
                  <Users size={16} />
                  Go to Volunteers Tab
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clients' && (
          <ClientManagementTab 
            projectId={id} 
            refreshKey={refreshKey}
            onImportComplete={handleImportComplete}
          />
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
