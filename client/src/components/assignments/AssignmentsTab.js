import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, MapPin, CheckCircle, AlertCircle, Save, RefreshCw, Trash2 } from 'lucide-react';

const AssignmentsTab = ({ projectId, refreshKey, onRefresh }) => {
  const [pairs, setPairs] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [stagedAssignments, setStagedAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pairsRes, groupsRes, assignmentsRes] = await Promise.all([
        axios.get(`/projects/${projectId}/pairs`),
        axios.get(`/projects/${projectId}/client-groups`),
        axios.get(`/projects/${projectId}/assignments`)
      ]);

      setPairs(pairsRes.data);
      setClientGroups(groupsRes.data);
      setAssignments(assignmentsRes.data);
    } catch (error) {
      console.error('Error loading assignments data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupAssignment = (groupId, pairId) => {
    if (!pairId) {
      // Remove assignment
      const newStaged = { ...stagedAssignments };
      delete newStaged[groupId];
      setStagedAssignments(newStaged);
    } else {
      // Add/update assignment
      setStagedAssignments(prev => ({
        ...prev,
        [groupId]: pairId
      }));
    }
  };

  // NEW: Remove assignment functionality for a group
  const removeGroupAssignment = async (groupId) => {
    const group = clientGroups.find(g => g.id === groupId);
    if (!group || !group.groupClients) return;

    const clientCount = group.groupClients.length;
    const confirmMessage = `Are you sure you want to remove the assignment for "${group.name}"? This will remove assignments for ${clientCount} client${clientCount !== 1 ? 's' : ''}.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRemoving(prev => ({ ...prev, [groupId]: true }));

    try {
      // Get all assignment IDs for clients in this group
      const assignmentIds = assignments
        .filter(assignment => 
          group.groupClients.some(gc => gc.client.id === assignment.clientId)
        )
        .map(assignment => assignment.id);

      if (assignmentIds.length === 0) {
        alert('No assignments found for this group.');
        return;
      }

      // Remove each assignment
      await Promise.all(
        assignmentIds.map(assignmentId => 
          axios.delete(`/projects/${projectId}/assignments/${assignmentId}`)
        )
      );

      // Also remove from staged assignments if it exists
      const newStaged = { ...stagedAssignments };
      delete newStaged[groupId];
      setStagedAssignments(newStaged);

      // Reload data
      await loadData();
      onRefresh();
      
      alert(`Successfully removed assignments for ${group.name} (${assignmentIds.length} assignments removed)`);
    } catch (error) {
      console.error('Error removing group assignment:', error);
      alert('Failed to remove assignment: ' + (error.response?.data?.error || error.message));
    } finally {
      setRemoving(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const calculateGroupMatches = (group, pair) => {
    const groupClients = group.groupClients || [];
    let totalLanguageMatches = 0;
    let totalRegionMatches = 0;
    
    const volunteerLanguages = [
      ...(pair.volunteer1?.languages || []),
      ...(pair.volunteer2?.languages || [])
    ].map(lang => lang.toLowerCase());
    
    const volunteerRegions = [
      ...(pair.volunteer1?.regions || []),
      ...(pair.volunteer2?.regions || [])
    ].map(region => region.toLowerCase());

    groupClients.forEach(gc => {
      const client = gc.client;
      const clientLanguages = client.languages?.toLowerCase() || '';
      const clientLocation = client.location?.toLowerCase() || '';

      const languageMatch = volunteerLanguages.some(lang => 
        clientLanguages.includes(lang) || lang.includes(clientLanguages)
      );
      
      const regionMatch = volunteerRegions.some(region => 
        clientLocation.includes(region) || region.includes(clientLocation)
      );

      if (languageMatch) totalLanguageMatches++;
      if (regionMatch) totalRegionMatches++;
    });

    const clientCount = groupClients.length || 1;
    return {
      languageMatch: totalLanguageMatches > 0,
      regionMatch: totalRegionMatches > 0,
      languageMatchPercentage: (totalLanguageMatches / clientCount) * 100,
      regionMatchPercentage: (totalRegionMatches / clientCount) * 100
    };
  };

  const saveAssignments = async () => {
    setSaving(true);
    try {
      const assignmentsToCreate = [];
      
      // Create assignments for all clients in assigned groups
      Object.entries(stagedAssignments).forEach(([groupId, pairId]) => {
        const group = clientGroups.find(g => g.id === groupId);
        const pair = pairs.find(p => p.id === pairId);
        
        if (group && pair && group.groupClients) {
          const { languageMatch, regionMatch } = calculateGroupMatches(group, pair);
          
          group.groupClients.forEach(gc => {
            assignmentsToCreate.push({
              clientId: gc.client.id,
              volunteerPairId: pairId,
              languageMatch,
              regionMatch,
              confidenceScore: (languageMatch ? 0.5 : 0) + (regionMatch ? 0.5 : 0),
              notes: `Assigned to group: ${group.name}`
            });
          });
        }
      });

      await axios.post(`/projects/${projectId}/assignments`, {
        assignments: assignmentsToCreate
      });

      setStagedAssignments({});
      await loadData();
      onRefresh();
      
      alert(`Successfully created assignments for ${Object.keys(stagedAssignments).length} groups (${assignmentsToCreate.length} total client assignments)!`);
    } catch (error) {
      console.error('Error saving assignments:', error);
      alert('Failed to save assignments: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const isGroupAssigned = (groupId) => {
    const group = clientGroups.find(g => g.id === groupId);
    if (!group || !group.groupClients) return false;
    
    // Check if any client in the group already has an assignment
    const hasExistingAssignment = group.groupClients.some(gc => 
      assignments.some(a => a.clientId === gc.client.id)
    );
    
    return hasExistingAssignment || stagedAssignments[groupId];
  };

  const getGroupAssignment = (groupId) => {
    // Check existing assignments first
    const group = clientGroups.find(g => g.id === groupId);
    if (group && group.groupClients) {
      const existingAssignment = assignments.find(a => 
        group.groupClients.some(gc => gc.client.id === a.clientId)
      );
      if (existingAssignment) return existingAssignment;
    }
    
    // Check staged assignments
    const pairId = stagedAssignments[groupId];
    if (pairId) {
      return { volunteerPair: pairs.find(p => p.id === pairId) };
    }
    
    return null;
  };

  const getPairUsageCount = (pairId) => {
    // Count how many groups this pair is assigned to (existing + staged)
    const existingGroupsCount = clientGroups.filter(group => {
      return group.groupClients && group.groupClients.some(gc => 
        assignments.some(a => a.clientId === gc.client.id && a.volunteerPairId === pairId)
      );
    }).length;
    
    const stagedGroupsCount = Object.values(stagedAssignments).filter(id => id === pairId).length;
    return existingGroupsCount + stagedGroupsCount;
  };

  // NEW: Check if group has existing (saved) assignment
  const hasExistingAssignment = (groupId) => {
    const group = clientGroups.find(g => g.id === groupId);
    if (!group || !group.groupClients) return false;
    
    return group.groupClients.some(gc => 
      assignments.some(a => a.clientId === gc.client.id)
    );
  };

  const filteredPairs = pairs.filter(pair => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      pair.volunteer1?.firstName?.toLowerCase().includes(searchLower) ||
      pair.volunteer1?.lastName?.toLowerCase().includes(searchLower) ||
      pair.volunteer2?.firstName?.toLowerCase().includes(searchLower) ||
      pair.volunteer2?.lastName?.toLowerCase().includes(searchLower) ||
      pair.pairName?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="loading-state">
        <RefreshCw className="spinner" />
        <span>Loading assignments...</span>
      </div>
    );
  }

  const hasChanges = Object.keys(stagedAssignments).length > 0;

  return (
    <div className="assignments-tab">
      {/* Header */}
      <div className="assignments-header">
        <div>
          <h3>Volunteer Pair Assignments</h3>
          <p>Assign volunteer pairs to client groups</p>
        </div>
        
        {hasChanges && (
          <button
            onClick={saveAssignments}
            disabled={saving}
            className="save-assignments-btn"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving ? 'Saving...' : `Save ${Object.keys(stagedAssignments).length} Assignment${Object.keys(stagedAssignments).length !== 1 ? 's' : ''}`}
            </span>
          </button>
        )}
      </div>

      <div className="assignments-content">
        <div className="assignments-grid">
          {/* Client Groups - Left Side */}
          <div className="client-groups-section">
            <div className="client-groups-header">
              <h4>Client Groups</h4>
            </div>
            
            <div className="client-groups-content">
              {clientGroups.length === 0 ? (
                <div className="empty-state">
                  <AlertCircle />
                  <h5>No Client Groups</h5>
                  <p>No client groups found. Please create client groups first.</p>
                </div>
              ) : (
                clientGroups.map(group => {
                  const assignment = getGroupAssignment(group.id);
                  const isAssigned = isGroupAssigned(group.id);
                  const hasExisting = hasExistingAssignment(group.id);
                  const isRemoving = removing[group.id];
                  const currentPairId = stagedAssignments[group.id] || 
                    (assignment?.volunteerPair?.id) || '';
                  
                  return (
                    <div key={group.id} className="client-group-card">
                      <div className="client-group-header">
                        <div className="client-group-title">
                          <MapPin className="client-stat-icon" />
                          <h5>{group.name}</h5>
                          <span className="client-group-count">
                            {group.groupClients?.length || 0} clients
                          </span>
                          {isAssigned && (
                            <CheckCircle className="assigned-indicator" />
                          )}
                        </div>

                        <div className="client-assignment-controls">
                          {assignment && (
                            <span className="assignment-status">
                              {assignment.volunteerPair 
                                ? `${assignment.volunteerPair.volunteer1?.firstName} & ${assignment.volunteerPair.volunteer2?.firstName}`
                                : 'Loading...'
                              }
                            </span>
                          )}
                          
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                              value={currentPairId}
                              onChange={(e) => handleGroupAssignment(group.id, e.target.value)}
                              className="pair-select"
                              disabled={assignment && !stagedAssignments[group.id]}
                            >
                              <option value="">Select Pair...</option>
                              {pairs.map(pair => (
                                <option key={pair.id} value={pair.id}>
                                  {pair.pairName || `${pair.volunteer1?.firstName} & ${pair.volunteer2?.firstName}`}
                                  {getPairUsageCount(pair.id) > 0 && ` (${getPairUsageCount(pair.id)} groups)`}
                                </option>
                              ))}
                            </select>

                            {/* NEW: Remove Assignment Button */}
                            {hasExisting && (
                              <button
                                onClick={() => removeGroupAssignment(group.id)}
                                disabled={isRemoving}
                                className="btn-icon btn-danger"
                                title="Remove assignment for this group"
                                style={{
                                  minWidth: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: isRemoving ? 'not-allowed' : 'pointer',
                                  opacity: isRemoving ? 0.5 : 1
                                }}
                              >
                                {isRemoving ? (
                                  <RefreshCw className="w-4 h-4 spinner" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Client List */}
                      <div className="client-list">
                        {group.groupClients?.map(gc => (
                          <div key={gc.id} className="client-item">
                            <div className="client-info">
                              <span className={`client-type-badge ${gc.type.toLowerCase()}`}>
                                {gc.type}
                              </span>
                              <span className="client-name">{gc.client.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Volunteer Pairs - Right Side */}
          <div className="volunteer-pairs-section">
            <div className="volunteer-pairs-header">
              <h4>Available Pairs</h4>
              <input
                type="text"
                placeholder="Search pairs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pairs-search"
              />
            </div>

            <div className="volunteer-pairs-content">
              {filteredPairs.length === 0 ? (
                <div className="empty-state">
                  <Users />
                  <h5>No Volunteer Pairs</h5>
                  <p>No volunteer pairs found. Please create pairs first.</p>
                </div>
              ) : (
                <div className="pairs-list">
                  {filteredPairs.map(pair => {
                    const usageCount = getPairUsageCount(pair.id);
                    
                    // NEW: Get combined regions from both volunteers
                    const volunteer1Regions = pair.volunteer1?.regions || [];
                    const volunteer2Regions = pair.volunteer2?.regions || [];
                    const combinedRegions = [...new Set([...volunteer1Regions, ...volunteer2Regions])];
                    
                    return (
                      <div key={pair.id} className="pair-card">
                        <div className="pair-card-content">
                          <div className="pair-info">
                            <div className="pair-name">
                              {pair.pairName || `${pair.volunteer1?.firstName} & ${pair.volunteer2?.firstName}`}
                            </div>
                            <div className="pair-details">
                              {pair.volunteer1?.firstName} {pair.volunteer1?.lastName} & {pair.volunteer2?.firstName} {pair.volunteer2?.lastName}
                            </div>
                            
                            {/* NEW: Display location/regions */}
                            {combinedRegions.length > 0 && (
                              <div className="pair-locations">
                                <MapPin className="w-3 h-3" />
                                <span className="pair-regions">
                                  {combinedRegions.join(', ')}
                                </span>
                              </div>
                            )}
                            
                            {usageCount > 0 && (
                              <div className="pair-usage">
                                {usageCount} group assignment{usageCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          
                          <div className="pair-meta">
                            <div className="experience-indicators">
                              {pair.volunteer1?.hasExperience && (
                                <span className="experience-dot" title="Experienced"></span>
                              )}
                              {pair.volunteer2?.hasExperience && (
                                <span className="experience-dot" title="Experienced"></span>
                              )}
                            </div>
                            {pair.compatibility && (
                              <div className="compatibility-score">
                                {(pair.compatibility * 100).toFixed(0)}% match
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Summary */}
      {hasChanges && (
        <div className="assignment-summary">
          <p>
            <strong>{Object.keys(stagedAssignments).length} group assignment{Object.keys(stagedAssignments).length !== 1 ? 's' : ''}</strong> ready to save.
            This will assign volunteer pairs to entire client groups.
          </p>
        </div>
      )}
    </div>
  );
};

export default AssignmentsTab;
