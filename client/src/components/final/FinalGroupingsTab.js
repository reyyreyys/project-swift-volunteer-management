import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Users, MapPin, Phone, Globe, Target, Star, Info } from 'lucide-react';
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

  useEffect(() => {
    loadData();
  }, [projectId, refreshKey]);

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
    const baseClasses = "inline-flex items-center px-2 py-1 rounded text-xs font-medium";
    if (!region) return `${baseClasses} bg-gray-100 text-gray-800`;
    
    const regionClasses = {
      north: "bg-blue-100 text-blue-800",
      south: "bg-yellow-100 text-yellow-800", 
      east: "bg-green-100 text-green-800",
      west: "bg-pink-100 text-pink-800",
      central: "bg-purple-100 text-purple-800"
    };
    
    return `${baseClasses} ${regionClasses[region.toLowerCase()] || 'bg-gray-100 text-gray-800'}`;
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
          // Get all clients in this group with their assignment details
// Get all clients in this group with their assignment details
      const assignedClients = clientGroup.groupClients?.map(gc => {
        const client = clients.find(c => c.client?.id === gc.clientId || c.id === gc.clientId);
        const clientData = client?.client || client;
        
        return {
          ...clientData,
          isOptional: gc.type === 'OPTIONAL' // ← Change this line: use gc.type instead of gc.isOptional
        };
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
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading final groupings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Final Project Assignments</h3>
            <p className="text-sm text-gray-600 mt-1">
              Review pair attendance and make replacements, then finalise project assignments.
            </p>
          </div>
          {finalAssignments.length > 0 && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              onClick={() => setShowFinaliseModal(true)}
            >
              <Target className="w-4 h-4 mr-2" />
              Finalise Project
            </button>
          )}
        </div>
      </div>

      {/* Legend for Client Indicators */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <div className="flex items-start space-x-4">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-2">Client Assignment Legend</h4>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-blue-800">Required Client - Must be visited</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="w-3 h-3 text-orange-500" />
                <span className="text-blue-800">Optional Client - Visit if time permits</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance & Replacement Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Training Attendance & Replacements</h4>
          <p className="text-sm text-gray-600">
            Pairs with absent members are highlighted. Select replacements from the{' '}
            <strong className="text-gray-900">{availableReplacements.length}</strong> available waitlisted volunteers who attended training.
          </p>
        </div>

        {pairsWithIssues.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Volunteer Pairs</h3>
            <p className="text-gray-600">Create volunteer pairs first to see attendance status.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pair Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteer 1</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replacement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteer 2</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replacement</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pairsWithIssues.map(pair => (
                  <tr 
                    key={pair.id} 
                    className={`${pair.hasAbsence ? 'bg-red-50 border-l-4 border-red-400' : 'hover:bg-gray-50'} transition-colors duration-150`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {pair.name || `${pair.volunteer1?.volunteer?.firstName || 'Unknown'} & ${pair.volunteer2?.volunteer?.firstName || 'Unknown'}`}
                    </td>
                    
                    {/* Volunteer 1 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {pair.volunteer1Present ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-sm text-gray-900">
                          {pair.volunteer1?.volunteer?.firstName} {pair.volunteer1?.volunteer?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pair.volunteer1Present 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {pair.volunteer1Present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getRegionBadgeClass(pair.volunteer1?.volunteer?.regions?.[0])}>
                        {pair.volunteer1?.volunteer?.regions?.[0] || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pair.volunteer1?.volunteer?.age || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!pair.volunteer1Present ? (
                        <select 
                          value={replacements[`${pair.id}-${pair.volunteer1Id}`] || ''} 
                          onChange={(e) => handleReplacementSelect(pair.id, pair.volunteer1Id, e.target.value)}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select replacement</option>
                          {availableReplacements.map(replacement => (
                            <option key={replacement.id} value={replacement.id}>
                              {replacement.volunteer.firstName} {replacement.volunteer.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-500">No replacement needed</span>
                      )}
                    </td>

                    {/* Volunteer 2 */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {pair.volunteer2Present ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-sm text-gray-900">
                          {pair.volunteer2?.volunteer?.firstName} {pair.volunteer2?.volunteer?.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pair.volunteer2Present 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {pair.volunteer2Present ? 'Present' : 'Absent'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getRegionBadgeClass(pair.volunteer2?.volunteer?.regions?.[0])}>
                        {pair.volunteer2?.volunteer?.regions?.[0] || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pair.volunteer2?.volunteer?.age || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!pair.volunteer2Present ? (
                        <select 
                          value={replacements[`${pair.id}-${pair.volunteer2Id}`] || ''} 
                          onChange={(e) => handleReplacementSelect(pair.id, pair.volunteer2Id, e.target.value)}
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select replacement</option>
                          {availableReplacements.map(replacement => (
                            <option key={replacement.id} value={replacement.id}>
                              {replacement.volunteer.firstName} {replacement.volunteer.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-500">No replacement needed</span>
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Final Assignments</h4>
          <p className="text-sm text-gray-600">
            Final volunteer pairs and their assigned client groups. Optional clients are marked with a <Star className="w-3 h-3 text-orange-500 inline" /> star icon.
          </p>
        </div>

        {finalAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Final Assignments</h3>
            <p className="text-gray-600">Create assignments between volunteer pairs and client groups first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteer Pair</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Clients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {finalAssignments.map((assignment, index) => (
                  <tr key={assignment.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {assignment.pair.volunteer1?.volunteer?.firstName || assignment.pair.volunteer1?.firstName || 'Unknown'} {assignment.pair.volunteer1?.volunteer?.lastName || assignment.pair.volunteer1?.lastName || ''}
                        </div>
                        <div className="font-medium text-gray-900">
                          {assignment.pair.volunteer2?.volunteer?.firstName || assignment.pair.volunteer2?.firstName || 'Unknown'} {assignment.pair.volunteer2?.volunteer?.lastName || assignment.pair.volunteer2?.lastName || ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{assignment.pair.volunteer1?.volunteer?.contactNumber || assignment.pair.volunteer1?.contactNumber || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Globe className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{assignment.pair.volunteer1?.volunteer?.email || assignment.pair.volunteer1?.email || 'N/A'}</span>
                        </div>
                        <div className="border-t border-gray-200 pt-2">
                          <div className="flex items-center space-x-2">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>{assignment.pair.volunteer2?.volunteer?.contactNumber || assignment.pair.volunteer2?.contactNumber || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Globe className="w-3 h-3 text-gray-400" />
                            <span className="truncate">{assignment.pair.volunteer2?.volunteer?.email || assignment.pair.volunteer2?.email || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className={getRegionBadgeClass(assignment.pair.volunteer1?.volunteer?.regions?.[0])}>
                          {assignment.pair.volunteer1?.volunteer?.regions?.[0] || assignment.pair.volunteer1?.regions?.[0] || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{assignment.clientGroup?.name || 'Unnamed Group'}</div>
                        <div className="text-sm text-gray-500">
                          ({assignment.clients?.filter(c => !c.isOptional).length || 0} required, {assignment.clients?.filter(c => c.isOptional).length || 0} optional)
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-3">
                        {assignment.clients?.map((client, clientIndex) => (
                          <div key={client?.id || clientIndex} className={`rounded-lg p-3 border ${
                            client.isOptional ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                              {client.isOptional ? (
                                <Star className="w-4 h-4 text-orange-500 flex-shrink-0" />
                              ) : (
                                <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                              )}
                              <span>#{client?.srcId || client?.id} {client?.name}</span>
                              {client.isOptional && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                  Optional
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center space-x-2 text-gray-600">
                                <MapPin className="w-3 h-3" />
                                <span>{client?.address || 'No address provided'}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-gray-600">
                                <Globe className="w-3 h-3" />
                                <span>{client?.languages || 'No languages specified'}</span>
                              </div>
                            </div>
                          </div>
                        )) || <span className="text-gray-500 text-sm">No clients assigned</span>}
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
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Finalise Project
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        Are you sure you want to finalise this project? This action will:
                      </p>
                      
                      <ul className="text-sm text-gray-700 space-y-1 mb-4">
                        <li>• Lock in all current volunteer pair assignments</li>
                        <li>• Apply any selected replacements for absent volunteers</li>
                        <li>• Remove unselected and absent volunteers from the project</li>
                        <li>• Cannot be undone</li>
                      </ul>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <p className="text-sm text-yellow-800">
                          <strong>Summary:</strong> {finalAssignments.length} final assignments will be locked in, and volunteers not in these assignments will be removed from the project.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button"
                  className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={handleFinaliseProject}
                  disabled={finalising}
                >
                  {finalising ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Finalising...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      Finalise Project
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowFinaliseModal(false)}
                  disabled={finalising}
                >
                  Cancel
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