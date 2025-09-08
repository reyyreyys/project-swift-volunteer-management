import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, CheckCircle, AlertCircle, Calendar, 
  Clock, BookOpen, UserCheck, UserX,
  Check, X
} from 'lucide-react';
import apiClient from '../../api/axiosClient';

const TrainingDayTab = ({ projectId, refreshKey = 0 }) => {
  const [volunteers, setVolunteers] = useState([]);
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
      const volunteersRes = await apiClient.get(`/projects/${projectId}/volunteers-detailed`);
      setVolunteers(volunteersRes.data || []);
      
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

  // Filter and sort volunteers for training selection
const trainingCandidates = useMemo(() => {
  const selected = volunteers.filter(pv => pv.status === 'SELECTED');
  const waitlisted = volunteers.filter(pv => pv.status === 'WAITLISTED');
  
  // Show ALL waitlisted volunteers instead of limiting to 5
  return [...selected, ...waitlisted]; // Remove the slice(0, 5)
}, [volunteers]);


  // Filter volunteers who need training based on selection
  const volunteersNeedingTraining = useMemo(() => {
    return trainingCandidates.filter(pv => {
      if (!pv.volunteer.hasExperience) {
        // Selected volunteers always need training if no experience
        if (pv.status === 'SELECTED') {
          return true;
        }
        // Waitlisted volunteers only need training if manually selected
        if (pv.status === 'WAITLISTED') {
          return waitlistedSelection[pv.id] === true;
        }
      }
      return false;
    });
  }, [trainingCandidates, waitlistedSelection]);

  const handleAttendanceChange = async (projectVolunteerId, attended) => {
    setTrainingAttendance(prev => ({
      ...prev,
      [projectVolunteerId]: attended
    }));

    // Save to backend immediately
    try {
      await apiClient.patch(`/projects/${projectId}/volunteers/${projectVolunteerId}/training`, {
        trainingAttended: attended
      });
    } catch (error) {
      console.error('Error saving training attendance:', error);
      // Revert on error
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

    // Save to backend
    try {
      await apiClient.patch(`/projects/${projectId}/volunteers/${projectVolunteerId}/training-selection`, {
        selectedForTraining: selected
      });
    } catch (error) {
      console.error('Error saving waitlisted selection:', error);
      // Revert on error
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

  if (loading) {
    return <div className="loading-container">Loading training data...</div>;
  }

  const experiencedCount = trainingCandidates.filter(pv => pv.volunteer.hasExperience).length;
  const needTrainingCount = volunteersNeedingTraining.length;
  const attendedCount = Object.values(trainingAttendance).filter(Boolean).length;
  
  // Get counts for display
  const selectedCount = volunteers.filter(pv => pv.status === 'SELECTED').length;
  const waitlistedCount = volunteers.filter(pv => pv.status === 'WAITLISTED').length;
  const waitlistedInTraining = Math.min(waitlistedCount, 5);
  const waitlistedSelectedCount = Object.values(waitlistedSelection).filter(Boolean).length;

  return (
    <div className="training-day-container">
      {/* Header */}
      <div className="training-header">
        <h3>
          <BookOpen size={20} />
          Training Day Management
        </h3>
        <div className="training-stats">
          <div className="stat-card">
            <div className="stat-number">{experiencedCount}</div>
            <div className="stat-label">With Experience</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{needTrainingCount}</div>
            <div className="stat-label">Need Training</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{attendedCount}</div>
            <div className="stat-label">Attended</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{waitlistedSelectedCount}</div>
            <div className="stat-label">Waitlisted Selected</div>
          </div>
        </div>
      </div>

      {/* Table 1: Training Candidates Selection */}
      <div className="training-section">
        <h4>
          <Users size={18} />
          Training Candidates ({trainingCandidates.length} volunteers)
        </h4>
        <p className="section-description">
          All selected volunteers ({selectedCount}) and first 5 waitlisted volunteers ({waitlistedInTraining}). 
          Check which waitlisted volunteers should attend training.
        </p>
        
        <div className="table-container">
          <table className="training-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Contact</th>
                <th>Languages</th>
                <th>Regions</th>
                <th>Status</th>
                <th>Experience</th>
                <th>Training Required</th>
                <th>Select for Training</th>
              </tr>
            </thead>
            <tbody>
              {trainingCandidates.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <div>No volunteers selected yet</div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                      Go to the Volunteers tab to select volunteers first
                    </div>
                  </td>
                </tr>
              ) : (
                trainingCandidates.map((pv, index) => {
                  const v = pv.volunteer;
                  const hasExperience = v.hasExperience;
                  const isWaitlisted = pv.status === 'WAITLISTED';
                  const isSelectedForTraining = isWaitlisted ? waitlistedSelection[pv.id] : true; // Selected volunteers always included
                  
                  return (
                    <tr 
                      key={pv.id} 
                      className={`
                        ${hasExperience ? 'experienced-volunteer' : 'needs-training'}
                        ${isWaitlisted ? 'waitlisted-volunteer' : 'selected-volunteer'}
                        ${isSelectedForTraining ? 'selected-for-training' : ''}
                      `}
                    >
                      <td>
                        <div className="volunteer-name">
                          <strong>{v.firstName} {v.lastName}</strong>
                          {hasExperience && <span className="experience-star">★</span>}
                          {isWaitlisted && <span className="waitlist-indicator">W</span>}
                        </div>
                      </td>
                      <td>{v.age || 'N/A'}</td>
                      <td>{v.contactNumber || 'N/A'}</td>
                      <td>{v.languages?.join(', ') || 'N/A'}</td>
                      <td>{v.regions?.join(', ') || 'N/A'}</td>
                      <td>
                        <span className={`status-badge status-${pv.status.toLowerCase()}`}>
                          {pv.status}
                        </span>
                      </td>
                      <td>
                        <div className="experience-indicator">
                          {hasExperience ? (
                            <span className="has-experience">
                              <CheckCircle size={16} />
                              Yes
                            </span>
                          ) : (
                            <span className="no-experience">
                              <AlertCircle size={16} />
                              No
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`training-requirement ${hasExperience ? 'optional' : 'required'}`}>
                          {hasExperience ? 'Optional' : 'Required'}
                        </span>
                      </td>
                      <td>
                        {isWaitlisted ? (
                          // Checkbox for waitlisted volunteers
                          <div className="training-selection">
                            <input
                              type="checkbox"
                              id={`training-select-${pv.id}`}
                              checked={waitlistedSelection[pv.id] || false}
                              onChange={(e) => handleWaitlistedSelectionChange(pv.id, e.target.checked)}
                              className="training-selection-checkbox"
                            />
                            <label htmlFor={`training-select-${pv.id}`} className="training-selection-label">
                              {waitlistedSelection[pv.id] ? 'Selected' : 'Not Selected'}
                            </label>
                          </div>
                        ) : (
                          // Auto-selected for regular volunteers
                          <span className="auto-selected">
                            <CheckCircle size={16} />
                            Auto-Selected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Show info about waitlist limitation */}
        {waitlistedCount > 5 && (
          <div className="waitlist-notice">
            <AlertCircle size={16} />
            <span>
              Note: Only the first 5 waitlisted volunteers are shown. 
              {waitlistedCount - 5} waitlisted volunteers are not included.
            </span>
          </div>
        )}
      </div>

      {/* Table 2: Training Attendance */}
      <div className="training-section">
        <h4>
          <UserCheck size={18} />
          Training Attendance ({volunteersNeedingTraining.length} must attend)
        </h4>
        <p className="section-description">
          Volunteers who will attend training. Check the box when they've completed training.
        </p>

        {volunteersNeedingTraining.length > 0 && (
          <div className="attendance-actions">
            <button 
              onClick={saveAllAttendance}
              disabled={savingAttendance}
              className="btn btn-primary"
            >
              <Calendar size={16} />
              {savingAttendance ? 'Saving...' : 'Save All Training Data'}
            </button>
          </div>
        )}
        
        <div className="table-container">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Status</th>
                <th>Attended Training</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {volunteersNeedingTraining.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <div>No volunteers selected for training</div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                      Select volunteers in the table above or go to Volunteers tab
                    </div>
                  </td>
                </tr>
              ) : (
                volunteersNeedingTraining.map(pv => {
                  const v = pv.volunteer;
                  const hasAttended = trainingAttendance[pv.id] || false;
                  
                  return (
                    <tr key={pv.id} className={hasAttended ? 'attended' : 'not-attended'}>
                      <td>
                        <div className="volunteer-name">
                          <strong>{v.firstName} {v.lastName}</strong>
                          {pv.status === 'WAITLISTED' && <span className="waitlist-indicator">W</span>}
                        </div>
                      </td>
                      <td>{v.contactNumber || 'N/A'}</td>
                      <td>{v.email || 'N/A'}</td>
                      <td>
                        <span className={`status-badge status-${pv.status.toLowerCase()}`}>
                          {pv.status}
                        </span>
                      </td>
                      <td>
                        <div className="attendance-status">
                          <input
                            type="checkbox"
                            id={`attendance-${pv.id}`}
                            checked={hasAttended}
                            onChange={(e) => handleAttendanceChange(pv.id, e.target.checked)}
                            className="attendance-checkbox"
                          />
                          <label htmlFor={`attendance-${pv.id}`}>
                            {hasAttended ? (
                              <span className="attended-label">
                                <Check size={16} />
                                Attended
                              </span>
                            ) : (
                              <span className="not-attended-label">
                                <X size={16} />
                                Not Attended
                              </span>
                            )}
                          </label>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleAttendanceChange(pv.id, !hasAttended)}
                          className={`btn-attendance ${hasAttended ? 'btn-mark-absent' : 'btn-mark-present'}`}
                          title={hasAttended ? 'Mark as not attended' : 'Mark as attended'}
                        >
                          {hasAttended ? <UserX size={14} /> : <UserCheck size={14} />}
                          {hasAttended ? 'Mark Absent' : 'Mark Present'}
                        </button>
                      </td>
                    </tr>
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
