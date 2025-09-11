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
  BookOpen,
  Target
} from 'lucide-react';

import VolunteerCSVImporter from '../volunteers/VolunteerCSVImporter';
import VolunteerSelectionTable from '../volunteers/VolunteerSelectionTable';
import VolunteerPairingTab from '../volunteers/VolunteerPairingTab';
import TrainingDayTab from '../volunteers/TrainingDayTab';
import ClientManagementTab from '../clients/ClientManagementTab';
import AssignmentsTab from '../assignments/AssignmentsTab';

// Add the PairsOverviewTable component
const PairsOverviewTable = ({ volunteers, pairs }) => {
  // Create a map of volunteer pairs for easy lookup
  const pairMap = {};
  
  pairs.forEach(pair => {
    if (pair.volunteer1 && pair.volunteer2) {
      // Get names from the included volunteer objects
      const volunteer1Name = pair.volunteer1.firstName && pair.volunteer1.lastName 
        ? `${pair.volunteer1.firstName} ${pair.volunteer1.lastName}` 
        : 'Unknown';
      const volunteer2Name = pair.volunteer2.firstName && pair.volunteer2.lastName 
        ? `${pair.volunteer2.firstName} ${pair.volunteer2.lastName}` 
        : 'Unknown';
      
      // Map using the volunteer IDs from the pair
      pairMap[pair.volunteer1.id] = { 
        partnerId: pair.volunteer2.id, 
        pairName: pair.name || `${volunteer1Name} & ${volunteer2Name}`,
        partnerName: volunteer2Name,
        pairId: pair.id || `${pair.volunteer1.id}-${pair.volunteer2.id}`
      };
      pairMap[pair.volunteer2.id] = { 
        partnerId: pair.volunteer1.id, 
        pairName: pair.name || `${volunteer1Name} & ${volunteer2Name}`,
        partnerName: volunteer1Name,
        pairId: pair.id || `${pair.volunteer1.id}-${pair.volunteer2.id}`
      };
    }
  });

  // Filter for selected volunteers
  const selectedVolunteers = volunteers.filter(pv => 
    pv.status && (pv.status.toLowerCase() === 'selected' || pv.status.toUpperCase() === 'SELECTED')
  );

  // Group volunteers by pairs and singles
  const pairedVolunteers = [];
  const singleVolunteers = [];
  const processedVolunteers = new Set();

  selectedVolunteers.forEach(projectVolunteer => {
    const volunteerId = projectVolunteer.volunteer.id;
    
    if (processedVolunteers.has(volunteerId)) {
      return; // Skip if already processed as part of a pair
    }
    
    const pairInfo = pairMap[volunteerId];
    
    if (pairInfo) {
      // Find the partner volunteer
      const partnerVolunteer = selectedVolunteers.find(pv => 
        pv.volunteer.id === pairInfo.partnerId
      );
      
      if (partnerVolunteer) {
        // Add both volunteers as a pair
        pairedVolunteers.push({
          type: 'pair',
          pairId: pairInfo.pairId,
          volunteers: [projectVolunteer, partnerVolunteer],
          pairName: pairInfo.pairName
        });
        
        // Mark both as processed
        processedVolunteers.add(volunteerId);
        processedVolunteers.add(pairInfo.partnerId);
      } else {
        // Partner not found in selected volunteers, treat as single
        singleVolunteers.push(projectVolunteer);
        processedVolunteers.add(volunteerId);
      }
    } else {
      // No pair info, treat as single
      singleVolunteers.push(projectVolunteer);
      processedVolunteers.add(volunteerId);
    }
  });

  // Sort pairs by group status (groups first), then by name
  pairedVolunteers.sort((a, b) => {
    const aHasGroup = a.volunteers.some(v => 
      v.volunteer.groupType === 'group' || v.volunteer.type === 'group' ||
      v.volunteer.groupName || v.volunteer.group
    );
    const bHasGroup = b.volunteers.some(v => 
      v.volunteer.groupType === 'group' || v.volunteer.type === 'group' ||
      v.volunteer.groupName || v.volunteer.group
    );
    
    if (aHasGroup && !bHasGroup) return -1;
    if (!aHasGroup && bHasGroup) return 1;
    
    return a.pairName.localeCompare(b.pairName);
  });

  // Sort single volunteers (groups first)
  singleVolunteers.sort((a, b) => {
    const aIsGroup = a.volunteer && (
      a.volunteer.groupType === 'group' || a.volunteer.type === 'group' ||
      a.volunteer.groupName || a.volunteer.group
    );
    const bIsGroup = b.volunteer && (
      b.volunteer.groupType === 'group' || b.volunteer.type === 'group' ||
      b.volunteer.groupName || b.volunteer.group
    );
    
    if (aIsGroup && !bIsGroup) return -1;
    if (!aIsGroup && bIsGroup) return 1;
    
    const aName = a.volunteer.firstName || a.volunteer.name || '';
    const bName = b.volunteer.firstName || b.volunteer.name || '';
    return aName.localeCompare(bName);
  });

  // Helper function to render a volunteer row
  const renderVolunteerRow = (projectVolunteer, index, isPaired = false, pairInfo = null) => {
    const volunteer = projectVolunteer.volunteer;
    const volunteerId = volunteer.id;
    
    const isGroup = volunteer.groupType === 'group' || 
                   volunteer.type === 'group' ||
                   volunteer.groupName || 
                   volunteer.group;
    
    return (
      <tr 
        key={`${volunteerId}-${index}`}
        className={`${pairInfo ? 'has-pair' : ''} ${isGroup ? 'is-group' : ''} ${isPaired ? 'is-paired' : ''}`}
      >
        <td className="name-cell">
          <div className="volunteer-name">
            <span className="volunteer-type-icon">
              {isGroup ? '👥' : '👤'}
            </span>
            {volunteer.firstName && volunteer.lastName 
              ? `${volunteer.firstName} ${volunteer.lastName}`
              : volunteer.name || volunteer.firstName || volunteer.fullName || 'Unknown'}
            {(volunteer.hasExperience || volunteer.experience) && <span className="experience-star">⭐</span>}
            {isGroup && (volunteer.groupName || volunteer.group) && (
              <span className="group-indicator"> (Group: {volunteer.groupName || volunteer.group})</span>
            )}
          </div>
        </td>
        <td>{volunteer.contact || volunteer.phone || volunteer.phoneNumber || 'N/A'}</td>
        <td className="email-cell">{volunteer.email || 'N/A'}</td>
        <td className="shirt-size-cell">
          <span className="shirt-size-badge">
            {volunteer.shirtSize || volunteer.tshirtSize || 'N/A'}
          </span>
        </td>
        <td className="pairing-cell">
          {pairInfo ? (
            <div className="pair-info">
              <div className="partner-name">With: {pairInfo.partnerName}</div>
              <div className="pair-name">{pairInfo.pairName}</div>
            </div>
          ) : (
            <span className="no-pair">No pairing</span>
          )}
        </td>
        <td>
          <span className="status-badge status-selected">
            {projectVolunteer.status || 'SELECTED'}
          </span>
        </td>
      </tr>
    );
  };

   return (
    <div className="pairs-overview-container">
      {/* Paired Volunteers Section */}
      {pairedVolunteers.length > 0 && (
        <div className="pairs-section">
          <div className="pairs-section-header">
            <Link2 />
            <span>Paired Volunteers ({pairedVolunteers.length} pairs)</span>
          </div>
          <div className="section-description">
            Volunteers who have been paired together for the project.
          </div>
          <div className="pairs-section-content">
            <table className="pairs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Shirt Size</th>
                  <th>Pairing</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pairedVolunteers.map((pairGroup, pairIndex) => (
                  <React.Fragment key={`pair-${pairIndex}`}>
                    {pairGroup.volunteers.map((projectVolunteer, volIndex) => {
                      const pairInfo = pairMap[projectVolunteer.volunteer.id];
                      return renderVolunteerRow(
                        projectVolunteer, 
                        `${pairIndex}-${volIndex}`, 
                        true, 
                        pairInfo,
                        'paired-volunteer'
                      );
                    })}
                    {/* Add separator between pairs */}
                    {pairIndex < pairedVolunteers.length - 1 && (
                      <tr className="pair-separator">
                        <td colSpan="6"></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Volunteers Section */}
      {singleVolunteers.length > 0 && (
        <div className="pairs-section">
          <div className="pairs-section-header">
            <Users />
            <span>Individual Volunteers ({singleVolunteers.length})</span>
          </div>
          <div className="section-description">
            Selected volunteers who are not currently paired.
          </div>
          <div className="pairs-section-content">
            <table className="pairs-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Shirt Size</th>
                  <th>Pairing</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {singleVolunteers.map((projectVolunteer, index) => 
                  renderVolunteerRow(
                    projectVolunteer, 
                    `single-${index}`, 
                    false, 
                    null,
                    'single-volunteer'
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {pairedVolunteers.length === 0 && singleVolunteers.length === 0 && (
        <div className="pairs-section">
          <div className="pairs-section-header">
            <AlertTriangle />
            <span>No Selected Volunteers</span>
          </div>
          <div className="section-description">
            No volunteers have been selected for this project yet.
          </div>
        </div>
      )}
    </div>
  );

};



const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [projectVolunteers, setProjectVolunteers] = useState([]);
  const [projectClients, setProjectClients] = useState([]);
  const [volunteerPairs, setVolunteerPairs] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showVolunteerImporter, setShowVolunteerImporter] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingVolunteers, setClearingVolunteers] = useState(false);
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

// In the loadProjectData function, change the pairs API call:
const loadProjectData = async () => {
  try {
    const [volunteersRes, clientsRes, pairsRes, groupsRes, assignmentsRes] = await Promise.all([
      axios.get(`/projects/${id}/volunteers-detailed`).catch(() => ({ data: [] })),
      axios.get(`/projects/${id}/clients`).catch(() => ({ data: [] })),
      // Use the correct API endpoint that includes volunteer details:
      axios.get(`/api/projects/${id}/volunteer-pairs`).catch(() => ({ data: [] })),
      axios.get(`/projects/${id}/client-groups`).catch(() => ({ data: [] })),
      axios.get(`/projects/${id}/assignments`).catch(() => ({ data: [] }))
    ]);

    setProjectVolunteers(volunteersRes.data);
    setProjectClients(clientsRes.data);
    setVolunteerPairs(pairsRes.data);
    setClientGroups(groupsRes.data);
    setAssignments(assignmentsRes.data);
  } catch (error) {
    console.error('Error loading project data:', error);
  }
};


  const handleImportComplete = (result) => {
    console.log('Import completed:', result);
    setShowVolunteerImporter(false);
    loadProjectData();
    setRefreshKey(prev => prev + 1);
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
        loadProjectData();
        setRefreshKey(prev => prev + 1);
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
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail">
        <p>Project not found</p>
        <Link to="/projects" className="back-link">
          <ArrowLeft size={16} /> Back to Projects
        </Link>
      </div>
    );
  }

  // Calculate stats with improved status checking
  const selectedVolunteers = projectVolunteers.filter(v => 
    v.status && (v.status.toLowerCase() === 'selected' || v.status.toUpperCase() === 'SELECTED')
  ).length;
  
  const waitlistedVolunteers = projectVolunteers.filter(v => 
    v.status && (v.status.toLowerCase() === 'waitlisted' || v.status.toUpperCase() === 'WAITLISTED')
  ).length;
  
  const experiencedVolunteers = projectVolunteers.filter(v => 
    v.hasExperience === true || v.experience === true
  ).length;
  
  const needTrainingCount = projectVolunteers.filter(v => 
    (v.status && (v.status.toLowerCase() === 'selected' || v.status.toUpperCase() === 'SELECTED')) &&
    !(v.hasExperience === true || v.experience === true)
  ).length;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-tab">
            {/* Overview Stats */}
            <div className="overview-stats">
              <div className="stat-card">
                <h3>Volunteers</h3>
                <div className="stat-number">{projectVolunteers.length}</div>
                <div className="stat-subtitle">
                  {selectedVolunteers} selected, {waitlistedVolunteers} waitlisted
                </div>
              </div>
              <div className="stat-card">
                <h3>Training Status</h3>
                <div className="stat-number">{needTrainingCount}</div>
                <div className="stat-subtitle">
                  {experiencedVolunteers} have experience
                </div>
              </div>
              <div className="stat-card">
                <h3>Clients</h3>
                <div className="stat-number">{projectClients.length}</div>
                <div className="stat-subtitle">
                  {clientGroups.length} groups created
                </div>
              </div>
            </div>

            <div className="overview-stats">
              <div className="stat-card">
                <h3>Assignments</h3>
                <div className="stat-number">{assignments.length}</div>
                <div className="stat-subtitle">
                  {volunteerPairs.length} pairs available
                </div>
              </div>
            </div>

            {/* Add the pairs overview table - show regardless of selected count for debugging */}
            <PairsOverviewTable 
              volunteers={projectVolunteers} 
              pairs={volunteerPairs} 
            />

            {/* Quick Actions */}
            <div className="quick-actions-section">
              <h3>Quick Actions</h3>
              <div className="action-grid">
                <Link 
                  to="#" 
                  className="action-card"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('volunteers');
                  }}
                >
                  <Users size={48} />
                  Manage Volunteers
                </Link>
                
                <Link 
                  to="#" 
                  className={`action-card ${selectedVolunteers === 0 ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedVolunteers > 0) {
                      setActiveTab('pairing');
                    }
                  }}
                >
                  <Link2 size={48} />
                  Create Pairs
                </Link>
                
                <Link 
                  to="#" 
                  className={`action-card ${selectedVolunteers === 0 ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (selectedVolunteers > 0) {
                      setActiveTab('training');
                    }
                  }}
                >
                  <BookOpen size={48} />
                  Training Day
                </Link>
                
                <Link 
                  to="#" 
                  className="action-card"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('clients');
                  }}
                >
                  <UserCheck size={48} />
                  Manage Clients
                </Link>
                
                <Link 
                  to="#" 
                  className={`action-card ${(volunteerPairs.length === 0 || clientGroups.length === 0) ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (volunteerPairs.length > 0 && clientGroups.length > 0) {
                      setActiveTab('assignments');
                    }
                  }}
                >
                  <Target size={48} />
                  Create Assignments
                </Link>
              </div>
            </div>

            {/* Info messages for disabled actions */}
            {selectedVolunteers === 0 && (
              <div className="info-message">
                <AlertTriangle size={16} />
                You need to select volunteers before you can create pairs.
              </div>
            )}
            
            {selectedVolunteers === 0 && (
              <div className="info-message">
                <AlertTriangle size={16} />
                You need to select volunteers before you can manage their training.
              </div>
            )}
            
            {(volunteerPairs.length === 0 || clientGroups.length === 0) && (
              <div className="info-message">
                <AlertTriangle size={16} />
                You need both volunteer pairs and client groups before creating assignments.
                {volunteerPairs.length === 0 && (
                  <ul>
                    <li>Create volunteer pairs first ({volunteerPairs.length} pairs available)</li>
                  </ul>
                )}
                {clientGroups.length === 0 && (
                  <ul>
                    <li>Create client groups first ({clientGroups.length} groups available)</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        );
        
      case 'volunteers':
        return (
          <>
            {showVolunteerImporter && (
              <VolunteerCSVImporter 
                projectId={id}
                onComplete={handleImportComplete}
                onCancel={() => setShowVolunteerImporter(false)}
              />
            )}
            <VolunteerSelectionTable 
              key={refreshKey}
              projectId={id} 
              onImport={handleImportVolunteers}
              onClear={() => setShowClearConfirm(true)}
            />
          </>
        );
        
      case 'pairing':
        return (
          <VolunteerPairingTab 
            key={refreshKey}
            projectId={id} 
            volunteers={projectVolunteers}
            pairs={volunteerPairs}
            onPairsUpdate={loadProjectData}
          />
        );
        
      case 'training':
        return (
          <TrainingDayTab 
            key={refreshKey}
            projectId={id}
            volunteers={projectVolunteers}
          />
        );
        
      case 'clients':
        return (
          <ClientManagementTab 
            key={refreshKey}
            projectId={id}
            clients={projectClients}
            onClientsUpdate={loadProjectData}
          />
        );
        
      case 'assignments':
        return (
          <AssignmentsTab 
            key={refreshKey}
            projectId={id}
            volunteerPairs={volunteerPairs}
            clientGroups={clientGroups}
            assignments={assignments}
            onAssignmentsUpdate={loadProjectData}
          />
        );
        
      default:
        return <div>Tab not found</div>;
    }
  };

  return (
    <div className="project-content">
      {/* Project Header */}
      <div className="project-header">
        <div className="header-top">
          <Link to="/projects" className="back-link">
            <ArrowLeft size={16} /> Back to Projects
          </Link>
          <div className="project-actions">
            <button className="action-btn secondary">
              <Share2 size={16} /> Share
            </button>
            <button className="action-btn secondary">
              <Settings size={16} /> Settings
            </button>
          </div>
        </div>
        <div className="project-title-section">
          <h1>{project.name}</h1>
          <p className="project-description">{project.description}</p>
        </div>
      </div>

      {/* Project Tabs */}
      <div className="project-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Settings size={16} />
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
          Pairing ({volunteerPairs.length})
        </button>
        <button 
          className={`tab ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          <BookOpen size={16} />
          Training Day
        </button>
        <button 
          className={`tab ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          <UserCheck size={16} />
          Clients ({projectClients.length})
        </button>
        <button 
          className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          <Target size={16} />
          Assignments ({assignments.length})
        </button>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Clear Volunteers Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-content">
              <div className="warning-icon">
                <AlertTriangle size={48} color="#e53e3e" />
              </div>
              <h2>Clear All Volunteers?</h2>
              <p>
                Are you sure you want to clear all <strong>{projectVolunteers.length} volunteers</strong> from this project?
              </p>
              <div className="warning-note">
                <p><strong>Important:</strong></p>
                <ul>
                  <li>Volunteers will be removed from this project</li>
                  <li>Volunteers only in this project will be completely deleted</li>
                  <li>Volunteers in other projects will remain available</li>
                  <li>All pairings and training data will be lost</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowClearConfirm(false)}
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
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
