import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Users, MapPin, Phone, Globe, Target, Trash2 } from 'lucide-react';
import apiClient from '../../api/axiosClient';

const FinalGroupingsTab = ({ projectId, refreshKey = 0 }) => {
  const [volunteers, setVolunteers] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [trainingAttendance, setTrainingAttendance] = useState({});
  const [replacements, setReplacements] = useState({});
  const [showFinaliseModal, setShowFinaliseModal] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [projectId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load all required data
      const [volunteersRes, pairsRes, clientsRes, groupsRes, assignmentsRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}/volunteers-detailed`),
        apiClient.get(`/projects/${projectId}/pairs`),
        apiClient.get(`/projects/${projectId}/clients`),
        apiClient.get(`/projects/${projectId}/client-groups`),
        apiClient.get(`/projects/${projectId}/assignments`)
      ]);

      setVolunteers(volunteersRes.data || []);
      setPairs(pairsRes.data || []);
      setClients(clientsRes.data || []);
      setClientGroups(groupsRes.data || []);
      setAssignments(assignmentsRes.data || []);

      // Extract training attendance data
      const attendance = {};
      volunteersRes.data.forEach(pv => {
        attendance[pv.id] = pv.trainingAttended || false;
      });
      setTrainingAttendance(attendance);
    } catch (error) {
      console.error('Error loading final groupings data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get waitlisted volunteers who attended training (available for replacement)
  const availableReplacements = useMemo(() => {
    return volunteers.filter(pv => 
      pv.status === 'WAITLISTED' && 
      pv.selectedForTraining === true && 
      trainingAttendance[pv.id] === true
    );
  }, [volunteers, trainingAttendance]);

  // Get pairs with absence issues
  const pairsWithIssues = useMemo(() => {
    return pairs.map(pair => {
      const volunteer1 = volunteers.find(pv => pv.volunteer.id === pair.volunteer1Id);
      const volunteer2 = volunteers.find(pv => pv.volunteer.id === pair.volunteer2Id);
      
      const volunteer1Present = volunteer1 && trainingAttendance[volunteer1.id] === true;
      const volunteer2Present = volunteer2 && trainingAttendance[volunteer2.id] === true;
      
      const hasAbsence = !volunteer1Present || !volunteer2Present;
      
      return {
        ...pair,
        volunteer1,
        volunteer2,
        volunteer1Present,
        volunteer2Present,
        hasAbsence,
        needsReplacement: hasAbsence
      };
    });
  }, [pairs, volunteers, trainingAttendance]);

  // Get region badge class
  const getRegionBadgeClass = (region) => {
    if (!region) return 'region-badge';
    return `region-badge ${region.toLowerCase()}`;
  };

  // Handle replacement selection
  const handleReplacementSelect = (pairId, volunteerId, replacementVolunteerId) => {
    setReplacements(prev => ({
      ...prev,
      [`${pairId}-${volunteerId}`]: replacementVolunteerId
    }));
  };

// Get final assignments with replacements - FIXED to prevent duplicates
const finalAssignments = useMemo(() => {
  // Group assignments by client group to avoid duplicates
  const groupedAssignments = new Map();
  
  assignments.forEach(assignment => {
    const pair = pairsWithIssues.find(p => p.id === assignment.volunteerPairId);
    if (!pair) return;

    // Apply replacements
    let finalVolunteer1 = pair.volunteer1;
    let finalVolunteer2 = pair.volunteer2;

    // Check for replacements
    const replacement1Id = replacements[`${pair.id}-${pair.volunteer1Id}`];
    const replacement2Id = replacements[`${pair.id}-${pair.volunteer2Id}`];

    if (replacement1Id) {
      const replacement = volunteers.find(pv => pv.id === replacement1Id);
      if (replacement) finalVolunteer1 = replacement;
    }

    if (replacement2Id) {
      const replacement = volunteers.find(pv => pv.id === replacement2Id);
      if (replacement) finalVolunteer2 = replacement;
    }

    // Find the client group that contains this client
    const clientGroup = clientGroups.find(cg => 
      cg.groupClients?.some(gc => gc.clientId === assignment.clientId)
    );

    if (clientGroup) {
      const groupKey = `${assignment.volunteerPairId}-${clientGroup.id}`;
      
      // If we haven't processed this pair-group combination yet
      if (!groupedAssignments.has(groupKey)) {
        // Get all clients in this group
        const assignedClients = clientGroup.groupClients?.map(gc => {
          const client = clients.find(c => c.client?.id === gc.clientId || c.id === gc.clientId);
          return client?.client || client;
        }).filter(Boolean) || [];

        groupedAssignments.set(groupKey, {
          id: groupKey, // Use a composite key as ID
          volunteerPairId: assignment.volunteerPairId,
          clientId: assignment.clientId, // Keep the first client ID for reference
          pair: {
            ...pair,
            volunteer1: finalVolunteer1,
            volunteer2: finalVolunteer2
          },
          clientGroup: clientGroup,
          clients: assignedClients
        });
      }
    }
  });

  return Array.from(groupedAssignments.values());
}, [assignments, pairsWithIssues, replacements, volunteers, clientGroups, clients]);


  // Handle project finalisation
  const handleFinaliseProject = async () => {
    setFinalising(true);
    try {
      // Apply all replacements and remove unselected/absent volunteers
      await apiClient.post(`/projects/${projectId}/finalise`, {
        replacements,
        finalAssignments: finalAssignments.map(a => ({
          pairId: a.volunteerPairId,
          clientId: a.clientId,
          volunteer1Id: a.pair.volunteer1?.volunteer?.id || a.pair.volunteer1?.id,
          volunteer2Id: a.pair.volunteer2?.volunteer?.id || a.pair.volunteer2?.id
        }))
      });

      alert('Project finalised successfully! Unselected and absent volunteers have been removed.');
      setShowFinaliseModal(false);
      loadData();
    } catch (error) {
      console.error('Error finalising project:', error);
      alert('Failed to finalise project. Please try again.');
    } finally {
      setFinalising(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading final groupings...</p>
      </div>
    );
  }

  return (
    <div className="final-groupings-tab">
      <div className="groupings-header">
        <div>
          <h3>Final Project Assignments</h3>
          <p>Review pair attendance and make replacements, then finalise project assignments.</p>
        </div>
        {finalAssignments.length > 0 && (
          <button 
            className="btn btn-success"
            onClick={() => setShowFinaliseModal(true)}
          >
            <Target size={16} />
            Finalise Project
          </button>
        )}
      </div>

      {/* Attendance & Replacement Section */}
      <div className="attendance-section">
        <h4>Training Attendance & Replacements</h4>
        <p className="section-description">
          Pairs with absent members are highlighted. Select replacements from the{' '}
          <strong>{availableReplacements.length}</strong> available waitlisted volunteers who attended training.
        </p>

        {pairsWithIssues.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>No Volunteer Pairs</h3>
            <p>Create volunteer pairs first to see attendance status.</p>
          </div>
        ) : (
          <div className="attendance-table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Pair Name</th>
                  <th>Volunteer 1</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Age</th>
                  <th>Replacement</th>
                  <th>Volunteer 2</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Age</th>
                  <th>Replacement</th>
                </tr>
              </thead>
              <tbody>
                {pairsWithIssues.map(pair => (
                  <tr key={pair.id} className={pair.hasAbsence ? 'needs-attention' : ''}>
                    <td>
                      {pair.name || `${pair.volunteer1?.volunteer?.firstName || 'Unknown'} & ${pair.volunteer2?.volunteer?.firstName || 'Unknown'}`}
                    </td>
                    
                    {/* Volunteer 1 */}
                    <td>
                      {pair.volunteer1Present ? (
                        <CheckCircle size={16} className="text-success" />
                      ) : (
                        <AlertTriangle size={16} className="text-warning" />
                      )}
                      {pair.volunteer1?.volunteer?.firstName} {pair.volunteer1?.volunteer?.lastName}
                    </td>
                    <td className={pair.volunteer1Present ? 'status-present' : 'status-absent'}>
                      {pair.volunteer1Present ? 'Present' : 'Absent'}
                    </td>
                    <td>
                      <span className={getRegionBadgeClass(pair.volunteer1?.volunteer?.regions?.[0])}>
                        {pair.volunteer1?.volunteer?.regions?.[0] || 'N/A'}
                      </span>
                    </td>
                    <td>{pair.volunteer1?.volunteer?.age || 'N/A'}</td>
                    <td>
                      {!pair.volunteer1Present ? (
                        <select 
                          value={replacements[`${pair.id}-${pair.volunteer1Id}`] || ''} 
                          onChange={(e) => handleReplacementSelect(pair.id, pair.volunteer1Id, e.target.value)}
                          className="replacement-select"
                        >
                          <option value="">Select replacement</option>
                          {availableReplacements.map(replacement => (
                            <option key={replacement.id} value={replacement.id}>
                              {replacement.volunteer.firstName} {replacement.volunteer.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted">No replacement needed</span>
                      )}
                    </td>

                    {/* Volunteer 2 */}
                    <td>
                      {pair.volunteer2Present ? (
                        <CheckCircle size={16} className="text-success" />
                      ) : (
                        <AlertTriangle size={16} className="text-warning" />
                      )}
                      {pair.volunteer2?.volunteer?.firstName} {pair.volunteer2?.volunteer?.lastName}
                    </td>
                    <td className={pair.volunteer2Present ? 'status-present' : 'status-absent'}>
                      {pair.volunteer2Present ? 'Present' : 'Absent'}
                    </td>
                    <td>
                      <span className={getRegionBadgeClass(pair.volunteer2?.volunteer?.regions?.[0])}>
                        {pair.volunteer2?.volunteer?.regions?.[0] || 'N/A'}
                      </span>
                    </td>
                    <td>{pair.volunteer2?.volunteer?.age || 'N/A'}</td>
                    <td>
                      {!pair.volunteer2Present ? (
                        <select 
                          value={replacements[`${pair.id}-${pair.volunteer2Id}`] || ''} 
                          onChange={(e) => handleReplacementSelect(pair.id, pair.volunteer2Id, e.target.value)}
                          className="replacement-select"
                        >
                          <option value="">Select replacement</option>
                          {availableReplacements.map(replacement => (
                            <option key={replacement.id} value={replacement.id}>
                              {replacement.volunteer.firstName} {replacement.volunteer.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted">No replacement needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Final Assignments Section */}
      <div className="final-assignments-section">
        <h4>Final Assignments</h4>
        <p className="section-description">
          Final volunteer pairs and their assigned client groups. Review before finalising the project.
        </p>

        {finalAssignments.length === 0 ? (
          <div className="empty-state">
            <Target size={48} />
            <h3>No Final Assignments</h3>
            <p>Create assignments between volunteer pairs and client groups first.</p>
          </div>
        ) : (
          <div className="assignments-table-container">
            <table className="assignments-table">
              <thead>
                <tr>
                  <th>Volunteer Pair</th>
                  <th>Contact Details</th>
                  <th>Area</th>
                  <th>Assigned Clients</th>
                  <th>Client Details</th>
                </tr>
              </thead>
              <tbody>
                {finalAssignments.map((assignment, index) => (
                  <tr key={assignment.id || index}>
                    <td>
                      <div className="volunteer-pair-info">
                        <strong>
                          {assignment.pair.volunteer1?.volunteer?.firstName || assignment.pair.volunteer1?.firstName || 'Unknown'} {assignment.pair.volunteer1?.volunteer?.lastName || assignment.pair.volunteer1?.lastName || ''}
                          <br />
                          {assignment.pair.volunteer2?.volunteer?.firstName || assignment.pair.volunteer2?.firstName || 'Unknown'} {assignment.pair.volunteer2?.volunteer?.lastName || assignment.pair.volunteer2?.lastName || ''}
                        </strong>
                      </div>
                    </td>
                    <td>
                      <div className="contact-details">
                        <div className="contact-item">
                          <Phone size={14} />
                          {assignment.pair.volunteer1?.volunteer?.contactNumber || assignment.pair.volunteer1?.contactNumber || 'N/A'}
                        </div>
                        <div className="contact-item">
                          <Globe size={14} />
                          {assignment.pair.volunteer1?.volunteer?.email || assignment.pair.volunteer1?.email || 'N/A'}
                        </div>
                        <hr />
                        <div className="contact-item">
                          <Phone size={14} />
                          {assignment.pair.volunteer2?.volunteer?.contactNumber || assignment.pair.volunteer2?.contactNumber || 'N/A'}
                        </div>
                        <div className="contact-item">
                          <Globe size={14} />
                          {assignment.pair.volunteer2?.volunteer?.email || assignment.pair.volunteer2?.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="area-info">
                        <MapPin size={14} />
                        <span className={getRegionBadgeClass(assignment.pair.volunteer1?.volunteer?.regions?.[0])}>
                          {assignment.pair.volunteer1?.volunteer?.regions?.[0] || assignment.pair.volunteer1?.regions?.[0] || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="client-group-info">
                        <strong>{assignment.clientGroup?.name || 'Unnamed Group'}</strong>
                        <br />
                        <span className="client-count">({assignment.clients?.length || 0} clients)</span>
                      </div>
                    </td>
                    <td>
                    <div className="client-details">
                        {assignment.clients?.map((client, clientIndex) => (
                        <div key={client?.id || clientIndex} className="client-item">
                            <div className="client-basic">
                            <strong>#{client?.srcId || client?.id} {client?.name}</strong>
                            </div>
                            <div className="client-meta">
                            <div className="client-address">
                                <MapPin size={12} />
                                <span>{client?.address || 'No address provided'}</span>
                            </div>
                            <div className="client-languages">
                                <Globe size={12} />
                                <span>{client?.languages || 'No languages specified'}</span>
                            </div>
                            </div>
                        </div>
                        )) || <span className="text-muted">No clients assigned</span>}
                    </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finalisation Modal */}
      {showFinaliseModal && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-header">
              <h2>Finalise Project</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowFinaliseModal(false)}
                disabled={finalising}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="warning-icon">
                <AlertTriangle size={48} color="#f59e0b" />
              </div>
              
              <p>
                Are you sure you want to finalise this project? This action will:
              </p>
              
              <ul>
                <li>Lock in all current volunteer pair assignments</li>
                <li>Apply any selected replacements for absent volunteers</li>
                <li>Remove unselected and absent volunteers from the project</li>
                <li>Cannot be undone</li>
              </ul>
              
              <div className="warning-note">
                <p>
                  <strong>Summary:</strong> {finalAssignments.length} final assignments will be locked in, and volunteers not in these assignments will be removed from the project.
                </p>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowFinaliseModal(false)}
                  disabled={finalising}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn danger" 
                  onClick={handleFinaliseProject}
                  disabled={finalising}
                >
                  {finalising ? (
                    <>
                      <div className="spinner-small"></div>
                      Finalising...
                    </>
                  ) : (
                    <>
                      <Target size={16} />
                      Finalise Project
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

export default FinalGroupingsTab;
