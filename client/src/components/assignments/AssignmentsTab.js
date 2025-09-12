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

  // Remove assignment functionality for a group
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

  // Check if group has existing (saved) assignment
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
      <div className="flex items-center justify-center min-h-96 space-y-4">
        <div className="flex items-center space-x-3 text-gray-600">
          <RefreshCw className="animate-spin h-6 w-6" />
          <span className="text-lg">Loading assignments...</span>
        </div>
      </div>
    );
  }

  const hasChanges = Object.keys(stagedAssignments).length > 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Volunteer Pair Assignments</h3>
            <p className="text-sm text-gray-600 mt-1">Assign volunteer pairs to client groups</p>
          </div>
          
          {hasChanges && (
            <button
              onClick={saveAssignments}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              <span>
                {saving ? 'Saving...' : `Save ${Object.keys(stagedAssignments).length} Assignment${Object.keys(stagedAssignments).length !== 1 ? 's' : ''}`}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Client Groups - Left Side */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h4 className="text-lg font-semibold text-gray-900">Client Groups</h4>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {clientGroups.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h5 className="text-lg font-medium text-gray-900 mb-2">No Client Groups</h5>
                  <p className="text-gray-600">No client groups found. Please create client groups first.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {clientGroups.map(group => {
                    const assignment = getGroupAssignment(group.id);
                    const isAssigned = isGroupAssigned(group.id);
                    const hasExisting = hasExistingAssignment(group.id);
                    const isRemoving = removing[group.id];
                    const currentPairId = stagedAssignments[group.id] || 
                      (assignment?.volunteerPair?.id) || '';
                    
                    return (
                      <div key={group.id} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <MapPin className="h-5 w-5 text-gray-500" />
                              <h5 className="font-semibold text-gray-900">{group.name}</h5>
                              <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                                {group.groupClients?.length || 0} clients
                              </span>
                              {isAssigned && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                            {assignment && (
                              <span className="text-sm text-green-600 font-medium">
                                {assignment.volunteerPair 
                                  ? `${assignment.volunteerPair.volunteer1?.firstName} & ${assignment.volunteerPair.volunteer2?.firstName}`
                                  : 'Loading...'
                                }
                              </span>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <select
                                value={currentPairId}
                                onChange={(e) => handleGroupAssignment(group.id, e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0 flex-1 sm:min-w-36"
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

                              {/* Remove Assignment Button */}
                              {hasExisting && (
                                <button
                                  onClick={() => removeGroupAssignment(group.id)}
                                  disabled={isRemoving}
                                  className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title="Remove assignment for this group"
                                >
                                  {isRemoving ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Client List */}
                          <div className="space-y-2">
                            {group.groupClients?.map(gc => (
                              <div key={gc.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center space-x-3">
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                                    gc.type.toLowerCase() === 'mandatory' 
                                      ? 'bg-red-100 text-red-800 border border-red-200' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {gc.type}
                                  </span>
                                  <span className="font-medium text-gray-900">{gc.client.name}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Volunteer Pairs - Right Side */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Available Pairs</h4>
              <input
                type="text"
                placeholder="Search pairs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {filteredPairs.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h5 className="text-lg font-medium text-gray-900 mb-2">No Volunteer Pairs</h5>
                  <p className="text-gray-600">No volunteer pairs found. Please create pairs first.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPairs.map(pair => {
                    const usageCount = getPairUsageCount(pair.id);
                    
                    // Get combined regions from both volunteers
                    const volunteer1Regions = pair.volunteer1?.regions || [];
                    const volunteer2Regions = pair.volunteer2?.regions || [];
                    const combinedRegions = [...new Set([...volunteer1Regions, ...volunteer2Regions])];
                    
                    return (
                      <div key={pair.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm mb-1">
                              {pair.pairName || `${pair.volunteer1?.firstName} & ${pair.volunteer2?.firstName}`}
                            </div>
                            <div className="text-xs text-gray-600 mb-2">
                              {pair.volunteer1?.firstName} {pair.volunteer1?.lastName} & {pair.volunteer2?.firstName} {pair.volunteer2?.lastName}
                            </div>
                            
                            {/* Display location/regions */}
                            {combinedRegions.length > 0 && (
                              <div className="flex items-center space-x-1 mb-2">
                                <MapPin className="h-3 w-3 text-blue-600" />
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                  {combinedRegions.join(', ')}
                                </span>
                              </div>
                            )}
                            
                            {usageCount > 0 && (
                              <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full inline-block">
                                {usageCount} group assignment{usageCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center justify-end space-x-1 mb-2">
                              {pair.volunteer1?.hasExperience && (
                                <span className="w-2 h-2 bg-green-500 rounded-full" title="Experienced"></span>
                              )}
                              {pair.volunteer2?.hasExperience && (
                                <span className="w-2 h-2 bg-green-500 rounded-full" title="Experienced"></span>
                              )}
                            </div>
                            {pair.compatibility && (
                              <div className="text-xs text-gray-600 font-medium">
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
        <div className="mx-6 mb-6 max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 rounded-lg shadow-sm">
            <p className="text-sm font-medium">
              <strong>{Object.keys(stagedAssignments).length} group assignment{Object.keys(stagedAssignments).length !== 1 ? 's' : ''}</strong> ready to save.
              This will assign volunteer pairs to entire client groups.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsTab;
