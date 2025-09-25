import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/axiosClient'; // Changed from 'axios' to 'apiClient'
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
  Target,
  CheckCircle  
} from 'lucide-react';

import VolunteerCSVImporter from '../volunteers/VolunteerCSVImporter';
import VolunteerSelectionTable from '../volunteers/VolunteerSelectionTable';
import VolunteerPairingTab from '../volunteers/VolunteerPairingTab';
import TrainingDayTab from '../volunteers/TrainingDayTab';
import ClientManagementTab from '../clients/ClientManagementTab';
import AssignmentsTab from '../assignments/AssignmentsTab';
import FinalGroupingsTab from '../final/FinalGroupingsTab';

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
        className={`border-b border-gray-100 hover:bg-gray-50 ${pairInfo ? 'bg-blue-50' : ''} ${isGroup ? 'bg-yellow-50' : ''} ${isPaired ? 'border-l-4 border-l-blue-500' : ''}`}
      >
        <td className="px-4 py-3 min-w-[150px]">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {isGroup ? '👥' : '👤'}
            </span>
            <div>
              <div className="font-medium text-gray-900">
                {volunteer.firstName && volunteer.lastName 
                  ? `${volunteer.firstName} ${volunteer.lastName}`
                  : volunteer.name || volunteer.firstName || volunteer.fullName || 'Unknown'}
                {(volunteer.hasExperience || volunteer.experience) && <span className="ml-1 text-yellow-500">⭐</span>}
              </div>
              {isGroup && (volunteer.groupName || volunteer.group) && (
                <div className="text-xs text-blue-600">(Group: {volunteer.groupName || volunteer.group})</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{volunteer.contact || volunteer.phone || volunteer.phoneNumber || 'N/A'}</td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{volunteer.email || 'N/A'}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {volunteer.shirtSize || volunteer.tshirtSize || 'N/A'}
          </span>
        </td>
        <td className="px-4 py-3">
          {pairInfo ? (
            <div className="text-sm">
              <div className="font-medium text-gray-900">With: {pairInfo.partnerName}</div>
              <div className="text-gray-500">{pairInfo.pairName}</div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No pairing</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full uppercase">
            {projectVolunteer.status || 'SELECTED'}
          </span>
        </td>
      </tr>
    );
  };

   return (
    <div className="w-full">
      {/* Paired Volunteers Section */}
      {pairedVolunteers.length > 0 && (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Link2 className="text-blue-600" />
              <span className="font-semibold text-gray-900">Paired Volunteers ({pairedVolunteers.length} pairs)</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Volunteers who have been paired together for the project.
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Shirt Size</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Pairing</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Status</th>
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
                        pairInfo
                      );
                    })}
                    {/* Add separator between pairs */}
                    {pairIndex < pairedVolunteers.length - 1 && (
                      <tr className="border-b-2 border-blue-200">
                        <td colSpan="6" className="h-1"></td>
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
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="text-gray-600" />
              <span className="font-semibold text-gray-900">Individual Volunteers ({singleVolunteers.length})</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Selected volunteers who are not currently paired.
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Shirt Size</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Pairing</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Status</th>
                </tr>
              </thead>
              <tbody>
                {singleVolunteers.map((projectVolunteer, index) => 
                  renderVolunteerRow(
                    projectVolunteer, 
                    `single-${index}`, 
                    false, 
                    null
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {pairedVolunteers.length === 0 && singleVolunteers.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AlertTriangle className="text-amber-500" />
            <span className="font-semibold text-gray-900 text-lg">No Selected Volunteers</span>
          </div>
          <div className="text-gray-600">
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
      const response = await apiClient.get(`/projects/${id}`); // Changed from axios to apiClient
      setProject(response.data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async () => {
    try {
      const [volunteersRes, clientsRes, pairsRes, groupsRes, assignmentsRes] = await Promise.all([
        apiClient.get(`/projects/${id}/volunteers-detailed`), // Changed from axios to apiClient
        apiClient.get(`/projects/${id}/clients`), // Changed from axios to apiClient
        apiClient.get(`/projects/${id}/pairs`), // Changed from axios to apiClient
        apiClient.get(`/projects/${id}/client-groups`), // Changed from axios to apiClient
        apiClient.get(`/projects/${id}/assignments`) // Changed from axios to apiClient
      ]);

      setProjectVolunteers(volunteersRes.data || []);
      setProjectClients(clientsRes.data || []);
      setVolunteerPairs(pairsRes.data || []);
      setClientGroups(groupsRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (error) {
      console.error('Error loading project data:', error);
      setProjectVolunteers([]);
      setProjectClients([]);
      setVolunteerPairs([]);
      setClientGroups([]);
      setAssignments([]);
    }
  };

  const handleImportComplete = (result) => {
    setShowVolunteerImporter(false);
    window.location.reload();
  };

  const handleImportVolunteers = () => {
    setShowVolunteerImporter(true);
    setActiveTab('volunteers');
  };

  const handleClearVolunteers = async () => {
    setClearingVolunteers(true);
    try {
      const response = await apiClient.delete(`/projects/${id}/volunteers`); // Changed from axios to apiClient
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-gray-600 mb-4">Project not found</p>
        <Link to="/projects" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-500">
          <ArrowLeft size={16} /> Back to Projects
        </Link>
      </div>
    );
  }

  // Calculate stats
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
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Volunteers</h3>
                <div className="text-3xl font-bold text-gray-800 mb-1">{projectVolunteers.length}</div>
                <div className="text-sm text-gray-600">
                  {selectedVolunteers} selected, {waitlistedVolunteers} waitlisted
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Training Status</h3>
                <div className="text-3xl font-bold text-gray-800 mb-1">{needTrainingCount}</div>
                <div className="text-sm text-gray-600">
                  {experiencedVolunteers} have experience
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clients</h3>
                <div className="text-3xl font-bold text-gray-800 mb-1">{projectClients.length}</div>
                <div className="text-sm text-gray-600">
                  {clientGroups.length} groups created
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignments</h3>
                <div className="text-3xl font-bold text-gray-800 mb-1">{assignments.length}</div>
                <div className="text-sm text-gray-600">
                  {volunteerPairs.length} pairs available
                </div>
              </div>
            </div>

            {/* Pairs Overview Table */}
            <PairsOverviewTable 
              volunteers={projectVolunteers} 
              pairs={volunteerPairs} 
            />

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button 
                  className="flex flex-col items-center p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
                  onClick={() => setActiveTab('volunteers')}
                >
                  <Users size={48} className="text-indigo-600 mb-3" />
                  <span className="font-medium text-gray-900">Manage Volunteers</span>
                </button>
                
                <button 
                  className={`flex flex-col items-center p-6 rounded-lg transition-colors text-center ${
                    selectedVolunteers === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                  }`}
                  onClick={() => selectedVolunteers > 0 && setActiveTab('pairing')}
                  disabled={selectedVolunteers === 0}
                >
                  <Link2 size={48} className={selectedVolunteers === 0 ? 'text-gray-400' : 'text-indigo-600'} />
                  <span className="font-medium mt-3">Create Pairs</span>
                </button>
                
                <button 
                  className={`flex flex-col items-center p-6 rounded-lg transition-colors text-center ${
                    selectedVolunteers === 0 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                  }`}
                  onClick={() => selectedVolunteers > 0 && setActiveTab('training')}
                  disabled={selectedVolunteers === 0}
                >
                  <BookOpen size={48} className={selectedVolunteers === 0 ? 'text-gray-400' : 'text-indigo-600'} />
                  <span className="font-medium mt-3">Training Day</span>
                </button>
                
                <button 
                  className="flex flex-col items-center p-6 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
                  onClick={() => setActiveTab('clients')}
                >
                  <UserCheck size={48} className="text-indigo-600 mb-3" />
                  <span className="font-medium text-gray-900">Manage Clients</span>
                </button>
                
                <button 
                  className={`flex flex-col items-center p-6 rounded-lg transition-colors text-center ${
                    (volunteerPairs.length === 0 || clientGroups.length === 0)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                  }`}
                  onClick={() => (volunteerPairs.length > 0 && clientGroups.length > 0) && setActiveTab('assignments')}
                  disabled={volunteerPairs.length === 0 || clientGroups.length === 0}
                >
                  <Target size={48} className={(volunteerPairs.length === 0 || clientGroups.length === 0) ? 'text-gray-400' : 'text-indigo-600'} />
                  <span className="font-medium mt-3">Create Assignments</span>
                </button>
              </div>
            </div>

            {/* Info messages */}
            {selectedVolunteers === 0 && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-amber-800">You need to select volunteers before you can create pairs or manage training.</span>
              </div>
            )}
            
            {(volunteerPairs.length === 0 || clientGroups.length === 0) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-amber-800 font-medium">Missing Requirements for Assignments</span>
                </div>
                <div className="text-amber-800 text-sm">
                  You need both volunteer pairs and client groups before creating assignments.
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {volunteerPairs.length === 0 && (
                      <li>Create volunteer pairs first ({volunteerPairs.length} pairs available)</li>
                    )}
                    {clientGroups.length === 0 && (
                      <li>Create client groups first ({clientGroups.length} groups available)</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
        
      case 'volunteers':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Project Volunteers ({projectVolunteers.length})</h3>
              <div className="flex gap-3">
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  onClick={() => setShowVolunteerImporter(true)}
                >
                  <Users size={16} />
                  Import More Volunteers
                </button>
                {projectVolunteers.length > 0 && (
                  <button 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 size={16} />
                    Clear All Volunteers
                  </button>
                )}
              </div>
            </div>

            {showVolunteerImporter && (
              <VolunteerCSVImporter 
                projectId={id}
                onImportComplete={handleImportComplete}
                onClose={() => setShowVolunteerImporter(false)}
              />
            )}
            <VolunteerSelectionTable 
              key={refreshKey}
              projectId={id} 
              onImport={handleImportVolunteers}
              onClear={() => setShowClearConfirm(true)}
            />
          </div>
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
        
      case 'final':
        return (
          <FinalGroupingsTab 
            key={refreshKey}
            projectId={id}
          />
        );

      default:
        return <div className="p-8 text-center text-gray-500">Tab not found</div>;
    }
  };

  return (
    <div className="w-full max-w-none">
      {/* Project Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <Link to="/projects" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-500 font-medium">
            <ArrowLeft size={16} /> Back to Projects
          </Link>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Share2 size={16} /> Share
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Settings size={16} /> Settings
            </button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
          <p className="text-gray-600">{project.description}</p>
        </div>
      </div>

      {/* Project Tabs - Fixed positioning */}
      <div className="sticky top-0 bg-white border-b border-gray-200 mb-8 z-10">
        <div className="overflow-x-auto">
          <nav className="flex space-x-0 min-w-max">
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'overview' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              <Settings size={16} />
              Overview
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'volunteers' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('volunteers')}
            >
              <Users size={16} />
              Volunteers ({projectVolunteers.length})
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'pairing' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('pairing')}
            >
              <Link2 size={16} />
              Pairing ({volunteerPairs.length})
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'clients' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('clients')}
            >
              <UserCheck size={16} />
              Clients ({projectClients.length})
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'assignments' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('assignments')}
            >
              <Target size={16} />
              Assignments ({assignments.length})
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'training' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('training')}
            >
              <BookOpen size={16} />
              Training Day
            </button>
            <button 
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'final' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('final')}
            >
              <CheckCircle size={16} />
              Final Groupings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {renderTabContent()}
      </div>

      {/* Clear Volunteers Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Clear All Volunteers?</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to clear all <span className="font-semibold">{projectVolunteers.length} volunteers</span> from this project?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                <p className="font-semibold text-amber-800 mb-2">Important:</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Volunteers will be removed from this project</li>
                  <li>• Volunteers only in this project will be completely deleted</li>
                  <li>• Volunteers in other projects will remain available</li>
                  <li>• All pairings and training data will be lost</li>
                  <li>• This action cannot be undone</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-end">
                <button 
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleClearVolunteers}
                  disabled={clearingVolunteers}
                >
                  {clearingVolunteers ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
