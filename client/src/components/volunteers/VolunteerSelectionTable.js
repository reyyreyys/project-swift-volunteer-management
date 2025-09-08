import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Users, Clock, MapPin, CheckCircle, AlertCircle,
  UserPlus, UserMinus, Shuffle, Download, ArrowUpDown
} from 'lucide-react';
import apiClient from '../../api/axiosClient';

const VolunteerSelectionTable = ({ projectId, refreshKey = 0 }) => {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteers, setSelectedVolunteers] = useState([]);
  const [waitlistedVolunteers, setWaitlistedVolunteers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'priority', direction: 'desc' });
  
  // Filters
  const [filters, setFilters] = useState({
    hasGroup: 'all',
    region: 'all',
    availableDays: 'all',
    experience: 'all',
    minAge: '',
    maxAge: ''
  });

  // Add refreshKey to dependency array to trigger reload on CSV import/removal
  useEffect(() => {
    loadVolunteers();
  }, [projectId, refreshKey]);

  const loadVolunteers = async () => {
    try {
      const response = await apiClient.get(`/projects/${projectId}/volunteers-detailed`);
      setVolunteers(response.data);
      
      // Initialize selected and waitlisted states from database
      const selectedIds = response.data
        .filter(pv => pv.status === 'SELECTED' || pv.isSelected)
        .map(pv => pv.id);
      
      const waitlistedIds = response.data
        .filter(pv => pv.status === 'WAITLISTED' || pv.isWaitlist)
        .map(pv => pv.id);
      
      setSelectedVolunteers(selectedIds);
      setWaitlistedVolunteers(waitlistedIds);
      
    } catch (error) {
      console.error('Error loading volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate priority score for sorting
  const calculatePriority = (volunteer) => {
    let score = 0;
    
    // Higher priority for existing groups
    if (volunteer.volunteer.isJoiningAsGroup) score += 100;
    
    // Higher priority for more available days
    score += volunteer.volunteer.availableDays?.length * 10 || 0;
    
    // Higher priority for earlier submission
    const daysAgo = Math.floor((new Date() - new Date(volunteer.addedAt)) / (1000 * 60 * 60 * 24));
    score += Math.max(0, 30 - daysAgo);
    
    // Higher priority for experienced volunteers
    if (volunteer.volunteer.hasExperience) score += 15;
    
    return score;
  };

  // Enhanced filtering logic
  const filteredAndSortedVolunteers = useMemo(() => {
    let filtered = volunteers.filter(pv => {
      const v = pv.volunteer;
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!(
          `${v.firstName} ${v.lastName}`.toLowerCase().includes(searchLower) ||
          v.email?.toLowerCase().includes(searchLower) ||
          v.languages?.some(lang => lang.toLowerCase().includes(searchLower))
        )) {
          return false;
        }
      }

      // Group filter
      if (filters.hasGroup !== 'all') {
        const hasGroup = filters.hasGroup === 'yes';
        if (v.isJoiningAsGroup !== hasGroup) return false;
      }

      // Region filter
      if (filters.region !== 'all') {
        if (!v.regions?.includes(filters.region)) return false;
      }

      // Available days filter
      if (filters.availableDays !== 'all') {
        if (!v.availableDays?.includes(filters.availableDays)) return false;
      }

      // Experience filter
      if (filters.experience !== 'all') {
        const hasExp = filters.experience === 'yes';
        if (v.hasExperience !== hasExp) return false;
      }

      // Age filters
      if (filters.minAge && v.age < parseInt(filters.minAge)) return false;
      if (filters.maxAge && v.age > parseInt(filters.maxAge)) return false;

      return true;
    });

    // Add priority scores and sort
    filtered = filtered.map(pv => ({
      ...pv,
      priority: calculatePriority(pv)
    }));

    // Sort logic
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'name':
          aVal = `${a.volunteer.firstName} ${a.volunteer.lastName}`;
          bVal = `${b.volunteer.firstName} ${b.volunteer.lastName}`;
          break;
        case 'age':
          aVal = a.volunteer.age || 0;
          bVal = b.volunteer.age || 0;
          break;
        case 'submissionDate':
          aVal = new Date(a.addedAt);
          bVal = new Date(b.addedAt);
          break;
        case 'availableDays':
          aVal = a.volunteer.availableDays?.length || 0;
          bVal = b.volunteer.availableDays?.length || 0;
          break;
        default:
          return 0;
      }

      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [volunteers, searchTerm, filters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectVolunteer = (volunteerId) => {
    if (selectedVolunteers.includes(volunteerId)) {
      setSelectedVolunteers(prev => prev.filter(id => id !== volunteerId));
    } else if (selectedVolunteers.length < 50) {
      setSelectedVolunteers(prev => [...prev, volunteerId]);
      // Remove from waitlist if adding to selected
      setWaitlistedVolunteers(prev => prev.filter(id => id !== volunteerId));
    }
  };

  const handleWaitlistVolunteer = (volunteerId) => {
    if (waitlistedVolunteers.includes(volunteerId)) {
      setWaitlistedVolunteers(prev => prev.filter(id => id !== volunteerId));
    } else if (waitlistedVolunteers.length < 10) {
      setWaitlistedVolunteers(prev => [...prev, volunteerId]);
      // Remove from selected if adding to waitlist
      setSelectedVolunteers(prev => prev.filter(id => id !== volunteerId));
    }
  };

  const autoSelect = () => {
    // Auto-select top 50 volunteers based on priority
    const topVolunteers = filteredAndSortedVolunteers
      .slice(0, 50)
      .map(pv => pv.id);
    
    const waitlistVolunteers = filteredAndSortedVolunteers
      .slice(50, 60)
      .map(pv => pv.id);

    setSelectedVolunteers(topVolunteers);
    setWaitlistedVolunteers(waitlistVolunteers);
  };

  const saveSelections = async () => {
    try {
      const response = await apiClient.post(`/projects/${projectId}/volunteer-selections`, {
        selected: selectedVolunteers,
        waitlisted: waitlistedVolunteers
      });

      if (response.data.success) {
        // Update the volunteers array to reflect the new status
        setVolunteers(prevVolunteers => 
          prevVolunteers.map(pv => {
            if (selectedVolunteers.includes(pv.id)) {
              return {
                ...pv,
                status: 'SELECTED',
                isSelected: true,
                isWaitlist: false
              };
            }
            if (waitlistedVolunteers.includes(pv.id)) {
              return {
                ...pv,
                status: 'WAITLISTED',
                isSelected: false,
                isWaitlist: true
              };
            }
            return {
              ...pv,
              status: 'PENDING',
              isSelected: false,
              isWaitlist: false
            };
          })
        );
        
        alert('Selections saved successfully!');
      }
    } catch (error) {
      console.error('Save selections error:', error);
      
      if (error.response) {
        console.error('Server error:', error.response.data);
        alert(`Failed to save selections: ${error.response.status} - ${error.response.data.error || error.response.data.message || 'Server error'}`);
      } else if (error.request) {
        console.error('Network error:', error.request);
        alert('Network error - check if server is running on the correct port');
      } else {
        console.error('Error:', error.message);
        alert('Error saving selections: ' + error.message);
      }
    }
  };

  const exportSelections = () => {
    const selectedData = volunteers
      .filter(pv => selectedVolunteers.includes(pv.id))
      .map(pv => ({
        Name: `${pv.volunteer.firstName} ${pv.volunteer.lastName}`,
        Email: pv.volunteer.email,
        Contact: pv.volunteer.contactNumber,
        Age: pv.volunteer.age,
        Languages: pv.volunteer.languages?.join(', '),
        Regions: pv.volunteer.regions?.join(', '),
        'Available Days': pv.volunteer.availableDays?.join(', '),
        'Available Time': pv.volunteer.availableTime?.join(', '), // Added this line
        'Has Group': pv.volunteer.isJoiningAsGroup ? 'Yes' : 'No',
        Status: 'Selected'
      }));

    const waitlistData = volunteers
      .filter(pv => waitlistedVolunteers.includes(pv.id))
      .map(pv => ({
        Name: `${pv.volunteer.firstName} ${pv.volunteer.lastName}`,
        Email: pv.volunteer.email,
        Contact: pv.volunteer.contactNumber,
        Age: pv.volunteer.age,
        Languages: pv.volunteer.languages?.join(', '),
        Regions: pv.volunteer.regions?.join(', '),
        'Available Days': pv.volunteer.availableDays?.join(', '),
        'Available Time': pv.volunteer.availableTime?.join(', '), // Added this line
        'Has Group': pv.volunteer.isJoiningAsGroup ? 'Yes' : 'No',
        Status: 'Waitlisted'
      }));

    const csvContent = "data:text/csv;charset=utf-8," + 
      [selectedData, waitlistData].flat()
        .map(row => Object.values(row).join(','))
        .join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = 'volunteer-selections.csv';
    link.click();
  };

  if (loading) {
    return <div className="loading-container">Loading volunteers...</div>;
  }

  return (
    <div className="volunteer-selection-table">
      {/* Header with stats */}
      <div className="selection-header">
        <div className="selection-stats">
          <div className="stat-item">
            <span className="stat-label">Total Volunteers:</span>
            <span className="stat-value">{filteredAndSortedVolunteers.length}</span>
          </div>
          <div className="stat-item selected">
            <span className="stat-label">Selected:</span>
            <span className="stat-value">{selectedVolunteers.length}/50</span>
          </div>
          <div className="stat-item waitlisted">
            <span className="stat-label">Waitlisted:</span>
            <span className="stat-value">{waitlistedVolunteers.length}/10</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button onClick={autoSelect} className="auto-select-btn">
            <Shuffle size={16} />
            Auto Select Top 60
          </button>
          <button onClick={exportSelections} className="export-btn">
            <Download size={16} />
            Export Selections
          </button>
          <button onClick={saveSelections} className="save-btn primary">
            Save Selections
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-filter">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search volunteers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filters.hasGroup}
            onChange={(e) => setFilters({...filters, hasGroup: e.target.value})}
          >
            <option value="all">All Groups</option>
            <option value="yes">Has Group</option>
            <option value="no">Individual</option>
          </select>

          <select
            value={filters.region}
            onChange={(e) => setFilters({...filters, region: e.target.value})}
          >
            <option value="all">All Regions</option>
            <option value="Central">Central</option>
            <option value="East">East</option>
            <option value="West">West</option>
            <option value="North">North</option>
            <option value="South">South</option>
          </select>

          <select
            value={filters.availableDays}
            onChange={(e) => setFilters({...filters, availableDays: e.target.value})}
          >
            <option value="all">All Days</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Sunday">Sunday</option>
          </select>

          <select
            value={filters.experience}
            onChange={(e) => setFilters({...filters, experience: e.target.value})}
          >
            <option value="all">All Experience</option>
            <option value="yes">Experienced</option>
            <option value="no">New</option>
          </select>

          <input
            type="number"
            placeholder="Min Age"
            value={filters.minAge}
            onChange={(e) => setFilters({...filters, minAge: e.target.value})}
            style={{ width: '80px' }}
          />

          <input
            type="number"
            placeholder="Max Age"
            value={filters.maxAge}
            onChange={(e) => setFilters({...filters, maxAge: e.target.value})}
            style={{ width: '80px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="volunteers-table">
          <thead>
            <tr>
              <th>Actions</th>
              <th onClick={() => handleSort('priority')} className="sortable">
                Priority Score
                <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('name')} className="sortable">
                Name
                <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('age')} className="sortable">
                Age
                <ArrowUpDown size={12} />
              </th>
              <th>Contact</th>
              <th>Email</th>
              <th>Languages</th>
              <th>Regions</th>
              <th onClick={() => handleSort('availableDays')} className="sortable">
                Available Days
                <ArrowUpDown size={12} />
              </th>
              <th>Available Time</th> {/* Added this column */}
              <th>Group Status</th>
              <th onClick={() => handleSort('submissionDate')} className="sortable">
                Submitted
                <ArrowUpDown size={12} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedVolunteers.map(pv => {
              const v = pv.volunteer;
              const isSelected = selectedVolunteers.includes(pv.id);
              const isWaitlisted = waitlistedVolunteers.includes(pv.id);
              
              return (
                <tr key={pv.id} className={`volunteer-row ${isSelected ? 'selected' : ''} ${isWaitlisted ? 'waitlisted' : ''}`}>
                  <td>
                    <div className="volunteer-actions">
                      <button 
                        onClick={() => handleSelectVolunteer(pv.id)}
                        disabled={selectedVolunteers.length >= 50 && !isSelected}
                        className={`select-btn ${isSelected ? 'selected' : ''}`}
                        title={isSelected ? 'Remove from selected' : 'Add to selected'}
                      >
                        {isSelected ? <UserMinus size={16} /> : <UserPlus size={16} />}
                      </button>
                      <button 
                        onClick={() => handleWaitlistVolunteer(pv.id)}
                        disabled={waitlistedVolunteers.length >= 10 && !isWaitlisted}
                        className={`waitlist-btn ${isWaitlisted ? 'waitlisted' : ''}`}
                        title={isWaitlisted ? 'Remove from waitlist' : 'Add to waitlist'}
                      >
                        <Clock size={16} />
                      </button>
                    </div>
                  </td>
                  <td>{pv.priority}</td>
                  <td>
                    {v.firstName} {v.lastName}
                    {v.hasExperience && <span className="experience-star" title="Has experience">★</span>}
                  </td>
                  <td>{v.age || 'N/A'}</td>
                  <td>{v.contactNumber || 'N/A'}</td>
                  <td>{v.email || 'N/A'}</td>
                  <td>{v.languages?.join(', ') || 'N/A'}</td>
                  <td>{v.regions?.join(', ') || 'N/A'}</td>
                  <td>{v.availableDays?.join(', ') || 'N/A'}</td>
                  <td>{v.availableTime?.join(', ') || 'N/A'}</td> {/* Added this cell */}
                  <td>
                    {v.isJoiningAsGroup ? (
                      <span className="group-status group">
                        <Users size={14} />
                        {v.groupName || 'Group'}
                      </span>
                    ) : (
                      <span className="group-status individual">Individual</span>
                    )}
                  </td>
                  <td>
                    {pv.volunteer.timestamp ? new Date(pv.volunteer.timestamp).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedVolunteers.length === 0 && (
        <div className="empty-state">
          <Users size={48} />
          <h3>No volunteers match your filters</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};

export default VolunteerSelectionTable;
