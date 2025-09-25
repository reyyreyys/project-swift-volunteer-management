import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CheckCircle, AlertCircle, Calendar, 
  Clock, BookOpen, UserCheck, UserX,
  Check, X
} from 'lucide-react';
import apiClient from '../../api/axiosClient';

const TrainingDayTab = ({ projectId, refreshKey = 0 }) => {
  const [volunteers, setVolunteers] = useState([]);
  const [volunteerPairs, setVolunteerPairs] = useState([]);
  const [trainingAttendance, setTrainingAttendance] = useState({});
  const [waitlistedSelection, setWaitlistedSelection] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load volunteers with detailed info
      const volunteersRes = await apiClient.get(`/projects/${projectId}/volunteers-detailed`);
      setVolunteers(volunteersRes.data || []);
      
      // Load volunteer pairs for this project
      try {
        const pairsRes = await apiClient.get(`/projects/${projectId}/pairs`);
        setVolunteerPairs(pairsRes.data || []);
      } catch (error) {
        console.warn('Could not load volunteer pairs:', error);
        setVolunteerPairs([]);
      }
      
      // Initialize attendance state for volunteers without experience
      const attendanceState = {};
      const waitlistedSelectionState = {};
      
      volunteersRes.data.forEach(pv => {
        if (!pv.volunteer.hasExperience && (pv.status === 'SELECTED' || pv.status === 'WAITLISTED')) {
          attendanceState[pv.id] = pv.trainingAttended || false;
          
          // For waitlisted volunteers, track selection for attendance
          if (pv.status === 'WAITLISTED') {
            waitlistedSelectionState[pv.id] = pv.selectedForTraining || false;
          }
        }
      });
      
      setTrainingAttendance(attendanceState);
      setWaitlistedSelection(waitlistedSelectionState);
    } catch (error) {
      console.error('Error loading training data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find volunteer pairs
  const getVolunteerPairInfo = (volunteerId) => {
    const pair = volunteerPairs.find(pair => 
      (pair.volunteer1 && pair.volunteer1.id === volunteerId) || 
      (pair.volunteer2 && pair.volunteer2.id === volunteerId)
    );
    
    if (!pair) return null;
    
    // Find the partner
    const partnerId = pair.volunteer1?.id === volunteerId ? pair.volunteer2?.id : pair.volunteer1?.id;
    const partner = volunteers.find(pv => pv.volunteer.id === partnerId);
    
    return {
      pairId: pair.id,
      partnerId,
      partnerName: partner ? `${partner.volunteer.firstName} ${partner.volunteer.lastName}` : 'Unknown',
      isConfirmed: pair.isConfirmed
    };
  };

  // Filter and sort volunteers for training selection
  const trainingCandidates = useMemo(() => {
    const selected = volunteers.filter(pv => pv.status === 'SELECTED');
    const waitlisted = volunteers.filter(pv => pv.status === 'WAITLISTED');
    
    return [...selected, ...waitlisted];
  }, [volunteers]);

  // Filter and group volunteers who need training based on selection
  const volunteersNeedingTraining = useMemo(() => {
    const filtered = trainingCandidates.filter(pv => {
      if (!pv.volunteer.hasExperience) {
        if (pv.status === 'SELECTED') {
          return true;
        }
        if (pv.status === 'WAITLISTED') {
          return waitlistedSelection[pv.id] === true;
        }
      }
      return false;
    });

    // Create a map of volunteer pairs for easy lookup (same as overview)
    const pairMap = {};
    volunteerPairs.forEach(pair => {
      if (pair.volunteer1 && pair.volunteer2) {
        pairMap[pair.volunteer1.id] = { 
          partnerId: pair.volunteer2.id, 
          pairId: pair.id
        };
        pairMap[pair.volunteer2.id] = { 
          partnerId: pair.volunteer1.id, 
          pairId: pair.id
        };
      }
    });

    // Group volunteers by pairs and singles (same logic as overview)
    const pairedVolunteers = [];
    const singleVolunteers = [];
    const processedVolunteers = new Set();

    filtered.forEach(projectVolunteer => {
      const volunteerId = projectVolunteer.volunteer.id;
      
      if (processedVolunteers.has(volunteerId)) {
        return;
      }
      
      const pairInfo = pairMap[volunteerId];
      
      if (pairInfo) {
        const partnerVolunteer = filtered.find(pv => 
          pv.volunteer.id === pairInfo.partnerId
        );
        
        if (partnerVolunteer) {
          pairedVolunteers.push(projectVolunteer, partnerVolunteer);
          processedVolunteers.add(volunteerId);
          processedVolunteers.add(pairInfo.partnerId);
        } else {
          singleVolunteers.push(projectVolunteer);
          processedVolunteers.add(volunteerId);
        }
      } else {
        singleVolunteers.push(projectVolunteer);
        processedVolunteers.add(volunteerId);
      }
    });

    // Sort single volunteers alphabetically
    singleVolunteers.sort((a, b) => 
      `${a.volunteer.firstName} ${a.volunteer.lastName}`.localeCompare(
        `${b.volunteer.firstName} ${b.volunteer.lastName}`
      )
    );

    return [...pairedVolunteers, ...singleVolunteers];
  }, [trainingCandidates, waitlistedSelection, volunteerPairs, volunteers]);

  const handleAttendanceChange = async (projectVolunteerId, attended) => {
    setTrainingAttendance(prev => ({
      ...prev,
      [projectVolunteerId]: attended
    }));

    try {
      await apiClient.patch(`/projects/${projectId}/volunteers/${projectVolunteerId}/training`, {
        trainingAttended: attended
      });
    } catch (error) {
      console.error('Error saving training attendance:', error);
      setTrainingAttendance(prev => ({
        ...prev,
        [projectVolunteerId]: !attended
      }));
      alert('Failed to save attendance. Please try again.');
    }
  };

  const handleWaitlistedSelectionChange = async (projectVolunteerId, selected) => {
    setWaitlistedSelection(prev => ({
      ...prev,
      [projectVolunteerId]: selected
    }));

    try {
      await apiClient.patch(`/projects/${projectId}/volunteers/${projectVolunteerId}/training-selection`, {
        selectedForTraining: selected
      });
    } catch (error) {
      console.error('Error saving waitlisted selection:', error);
      setWaitlistedSelection(prev => ({
        ...prev,
        [projectVolunteerId]: !selected
      }));
      alert('Failed to save training selection. Please try again.');
    }
  };

  const saveAllAttendance = async () => {
    setSavingAttendance(true);
    try {
      await apiClient.post(`/projects/${projectId}/training-attendance`, {
        attendance: trainingAttendance,
        waitlistedSelection: waitlistedSelection
      });
      alert('Training data saved successfully!');
    } catch (error) {
      console.error('Error saving all training data:', error);
      alert('Failed to save training data. Please try again.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Helper function to render a volunteer row (similar to overview)
  const renderVolunteerRow = (projectVolunteer, index, pairInfo) => {
    const volunteer = projectVolunteer.volunteer;
    const hasAttended = trainingAttendance[projectVolunteer.id] || false;
    
    return (
      <tr 
        key={projectVolunteer.id}
        className={`border-b border-gray-100 hover:bg-gray-50 ${pairInfo ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
      >
        <td className="px-4 py-3 min-w-[150px]">
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <div>
              <div className="font-medium text-gray-900">
                {volunteer.firstName} {volunteer.lastName}
                {volunteer.hasExperience && <span className="ml-1 text-yellow-500">⭐</span>}
              </div>
              {projectVolunteer.status === 'WAITLISTED' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                  WAITLISTED
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{volunteer.contactNumber || 'N/A'}</td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{volunteer.email || 'N/A'}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {volunteer.shirtSize || 'N/A'}
          </span>
        </td>
        <td className="px-4 py-3">
          {pairInfo ? (
            <div className="text-sm">
              <div className="font-medium text-gray-900">With: {pairInfo.partnerName}</div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No pairing</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full uppercase ${
            projectVolunteer.status === 'SELECTED' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {projectVolunteer.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`attendance-${projectVolunteer.id}`}
              checked={hasAttended}
              onChange={(e) => handleAttendanceChange(projectVolunteer.id, e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor={`attendance-${projectVolunteer.id}`} className="cursor-pointer">
              {hasAttended ? (
                <div className="flex items-center text-green-600">
                  <Check className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Attended</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <X className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">Not Attended</span>
                </div>
              )}
            </label>
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => handleAttendanceChange(projectVolunteer.id, !hasAttended)}
            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              hasAttended 
                ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500' 
                : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
            }`}
          >
            {hasAttended ? (
              <>
                <UserX className="w-3 h-3 mr-1" />
                Mark Absent
              </>
            ) : (
              <>
                <UserCheck className="w-3 h-3 mr-1" />
                Mark Present
              </>
            )}
          </button>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-600">Loading training data...</div>
      </div>
    );
  }

  const experiencedCount = trainingCandidates.filter(pv => pv.volunteer.hasExperience).length;
  const needTrainingCount = volunteersNeedingTraining.length;
  const attendedCount = Object.values(trainingAttendance).filter(Boolean).length;
  
  const selectedCount = volunteers.filter(pv => pv.status === 'SELECTED').length;
  const waitlistedCount = volunteers.filter(pv => pv.status === 'WAITLISTED').length;
  const waitlistedSelectedCount = Object.values(waitlistedSelection).filter(Boolean).length;

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">Training Day Management</h3>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{experiencedCount}</div>
            <div className="text-sm font-medium text-gray-500">With Experience</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{needTrainingCount}</div>
            <div className="text-sm font-medium text-gray-500">Need Training</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{attendedCount}</div>
            <div className="text-sm font-medium text-gray-500">Attended</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{waitlistedSelectedCount}</div>
            <div className="text-sm font-medium text-gray-500">Waitlisted Selected</div>
          </div>
        </div>
      </div>

      {/* Table 1: Training Candidates Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="w-4 h-4 text-gray-600" />
            <h4 className="text-lg font-semibold text-gray-900">
              Training Candidates ({trainingCandidates.length} volunteers)
            </h4>
          </div>
          <p className="text-sm text-gray-600">
            All selected volunteers ({selectedCount}) and waitlisted volunteers ({waitlistedCount}). 
            Check which waitlisted volunteers should attend training.
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Languages</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Training Required</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select for Training</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trainingCandidates.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <div className="text-gray-900 font-medium">No volunteers selected yet</div>
                    <div className="text-sm text-gray-500 mt-2">
                      Go to the Volunteers tab to select volunteers first
                    </div>
                  </td>
                </tr>
              ) : (
                trainingCandidates.map((pv, index) => {
                  const v = pv.volunteer;
                  const hasExperience = v.hasExperience;
                  const isWaitlisted = pv.status === 'WAITLISTED';
                  const isSelectedForTraining = isWaitlisted ? waitlistedSelection[pv.id] : true;
                  
                  return (
                    <tr 
                      key={pv.id} 
                      className={`
                        ${hasExperience ? 'bg-gray-50' : 'bg-yellow-50'}
                        ${isWaitlisted ? 'border-l-4 border-yellow-400' : ''}
                        ${isSelectedForTraining ? 'bg-blue-50' : ''}
                        hover:bg-gray-100 transition-colors duration-150
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {v.firstName} {v.lastName}
                          </span>
                          {hasExperience && (
                            <span className="text-yellow-500 text-sm">★</span>
                          )}
                          {isWaitlisted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              W
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {v.age || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {v.contactNumber || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {v.languages?.join(', ') || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {v.regions?.join(', ') || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`
                          inline-flex px-2 py-1 text-xs font-semibold rounded-full
                          ${pv.status === 'SELECTED' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'}
                        `}>
                          {pv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          {hasExperience ? (
                            <div className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              <span className="text-sm font-medium">Yes</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-yellow-600">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              <span className="text-sm font-medium">No</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`
                          text-sm font-medium
                          ${hasExperience ? 'text-gray-600' : 'text-red-600'}
                        `}>
                          {hasExperience ? 'Optional' : 'Required'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isWaitlisted ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`training-select-${pv.id}`}
                              checked={waitlistedSelection[pv.id] || false}
                              onChange={(e) => handleWaitlistedSelectionChange(pv.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label 
                              htmlFor={`training-select-${pv.id}`} 
                              className="text-sm text-gray-700 cursor-pointer"
                            >
                              {waitlistedSelection[pv.id] ? 'Selected' : 'Not Selected'}
                            </label>
                          </div>
                        ) : (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Auto-Selected</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Training Attendance - Using same layout as Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-600" />
            <span className="font-semibold text-gray-900">Training Attendance ({volunteersNeedingTraining.length} must attend)</span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Volunteers who will attend training (paired volunteers shown together). Check the box when they've completed training.
          </div>
          
          {volunteersNeedingTraining.length > 0 && (
            <div className="mt-4">
              <button 
                onClick={saveAllAttendance}
                disabled={savingAttendance}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {savingAttendance ? 'Saving...' : 'Save All Training Data'}
              </button>
            </div>
          )}
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
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Attended Training</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {volunteersNeedingTraining.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <div className="text-gray-900 font-medium">No volunteers selected for training</div>
                    <div className="text-sm text-gray-500 mt-2">
                      Select volunteers in the table above or go to Volunteers tab
                    </div>
                  </td>
                </tr>
              ) : (
                volunteersNeedingTraining.map((pv, index) => {
                  const pairInfo = getVolunteerPairInfo(pv.volunteer.id);
                  
                  // Group paired volunteers together (same logic as overview)
                  let shouldAddSeparator = false;
                  if (index < volunteersNeedingTraining.length - 1) {
                    const currentPairInfo = getVolunteerPairInfo(pv.volunteer.id);
                    const nextPairInfo = getVolunteerPairInfo(volunteersNeedingTraining[index + 1].volunteer.id);
                    
                    // Add separator if current has pair but next doesn't, or if they have different pairs
                    shouldAddSeparator = currentPairInfo && (
                      !nextPairInfo || 
                      (nextPairInfo && currentPairInfo.pairId !== nextPairInfo.pairId)
                    );
                  }
                  
                  return (
                    <React.Fragment key={pv.id}>
                      {renderVolunteerRow(pv, index, pairInfo)}
                      {/* Add separator between pairs */}
                      {shouldAddSeparator && (
                        <tr className="border-b-2 border-blue-200">
                          <td colSpan="8" className="h-1"></td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainingDayTab;
