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
        'Available Time': pv.volunteer.availableTime?.join(', '),
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
        'Available Time': pv.volunteer.availableTime?.join(', '),
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
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p>Loading volunteers...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header with stats */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500">Total Volunteers</span>
              <span className="text-2xl font-bold text-gray-900">{filteredAndSortedVolunteers.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500">Selected</span>
              <span className="text-2xl font-bold text-green-600">{selectedVolunteers.length}/50</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-500">Waitlisted</span>
              <span className="text-2xl font-bold text-orange-600">{waitlistedVolunteers.length}/10</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={autoSelect} 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Shuffle size={16} />
              Auto Select Top 60
            </button>
            <button 
              onClick={exportSelections} 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
            >
              <Download size={16} />
              Export Selections
            </button>
            <button 
              onClick={saveSelections} 
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
            >
              Save Selections
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search volunteers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            <select
              value={filters.hasGroup}
              onChange={(e) => setFilters({...filters, hasGroup: e.target.value})}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Groups</option>
              <option value="yes">Has Group</option>
              <option value="no">Individual</option>
            </select>

            <select
              value={filters.region}
              onChange={(e) => setFilters({...filters, region: e.target.value})}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-20"
            />

            <input
              type="number"
              placeholder="Max Age"
              value={filters.maxAge}
              onChange={(e) => setFilters({...filters, maxAge: e.target.value})}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-20"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">
                Actions
              </th>
              <th 
                onClick={() => handleSort('priority')} 
                className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none min-w-[80px]"
              >
                <div className="flex items-center gap-1">
                  Priority Score
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th 
                onClick={() => handleSort('name')} 
                className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none min-w-[150px]"
              >
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th 
                onClick={() => handleSort('age')} 
                className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none min-w-[60px]"
              >
                <div className="flex items-center gap-1">
                  Age
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[120px]">Contact</th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[150px]">Email</th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[120px]">Languages</th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">Regions</th>
              <th 
                onClick={() => handleSort('availableDays')} 
                className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none min-w-[120px]"
              >
                <div className="flex items-center gap-1">
                  Available Days
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[120px]">Available Time</th>
              <th className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 min-w-[100px]">Group Status</th>
              <th 
                onClick={() => handleSort('submissionDate')} 
                className="px-3 py-4 text-left font-semibold text-gray-700 border-b-2 border-gray-200 cursor-pointer hover:bg-gray-100 select-none min-w-[100px]"
              >
                <div className="flex items-center gap-1">
                  Submitted
                  <ArrowUpDown size={12} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedVolunteers.map(pv => {
              const v = pv.volunteer;
              const isSelected = selectedVolunteers.includes(pv.id);
              const isWaitlisted = waitlistedVolunteers.includes(pv.id);
              
              return (
                <tr 
                  key={pv.id} 
                  className={`
                    border-b border-gray-100 hover:bg-gray-50 transition-colors
                    ${isSelected ? 'bg-green-50 border-l-4 border-l-green-500' : ''}
                    ${isWaitlisted ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}
                  `}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleSelectVolunteer(pv.id)}
                        disabled={selectedVolunteers.length >= 50 && !isSelected}
                        className={`
                          flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer transition-all
                          ${isSelected 
                            ? 'bg-green-600 text-white hover:bg-green-700' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={isSelected ? 'Remove from selected' : 'Add to selected'}
                      >
                        {isSelected ? <UserMinus size={16} /> : <UserPlus size={16} />}
                      </button>
                      <button 
                        onClick={() => handleWaitlistVolunteer(pv.id)}
                        disabled={waitlistedVolunteers.length >= 10 && !isWaitlisted}
                        className={`
                          flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer transition-all
                          ${isWaitlisted 
                            ? 'bg-orange-600 text-white hover:bg-orange-700' 
                            : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={isWaitlisted ? 'Remove from waitlist' : 'Add to waitlist'}
                      >
                        <Clock size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-green-600">{pv.priority}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{v.firstName} {v.lastName}</span>
                      {v.hasExperience && (
                        <span className="text-yellow-500 font-bold" title="Has experience">★</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{v.age || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">{v.contactNumber || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[150px] truncate">{v.email || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">{v.languages?.join(', ') || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[100px] truncate">{v.regions?.join(', ') || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">{v.availableDays?.join(', ') || 'N/A'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-[120px] truncate">{v.availableTime?.join(', ') || 'N/A'}</td>
                  <td className="px-3 py-3">
                    {v.isJoiningAsGroup ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                        <Users size={12} />
                        {v.groupName || 'Group'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                        Individual
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {pv.volunteer.timestamp ? new Date(pv.volunteer.timestamp).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedVolunteers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Users size={48} className="mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No volunteers match your filters</h3>
          <p className="text-sm">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};

export default VolunteerSelectionTable;
