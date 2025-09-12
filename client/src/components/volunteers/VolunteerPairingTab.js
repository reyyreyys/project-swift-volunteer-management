import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Link2, Trash2, Edit, Eye, ArrowUpDown, 
  ChevronDown, ChevronRight, UserPlus, UserMinus,
  Search, Filter, Clock
} from 'lucide-react';
import apiClient from '../../api/axiosClient';

const VolunteerPairingTable = ({ projectId, refreshKey = 0 }) => {
  const [pairs, setPairs] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'created', direction: 'desc' });
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForPairing, setSelectedForPairing] = useState(new Set());

  useEffect(() => {
    loadData();
  }, [projectId, refreshKey]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pairsRes, volunteersRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}/pairs`),
        apiClient.get(`/projects/${projectId}/volunteers-detailed`)
      ]);
      
      setPairs(pairsRes.data || []);
      setVolunteers(volunteersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create maps for quick lookups
  const pairMap = useMemo(() => {
    const map = {};
    pairs.forEach(pair => {
      if (pair.volunteer1 && pair.volunteer2) {
        // Use volunteer IDs, not pair IDs
        map[pair.volunteer1.id] = { pair, partner: pair.volunteer2 };
        map[pair.volunteer2.id] = { pair, partner: pair.volunteer1 };
      }
    });
    return map;
  }, [pairs]);

  // Get selected volunteers only
  const selectedVolunteers = volunteers.filter(pv => pv.status === 'SELECTED' || pv.isSelected);

  // Sort volunteers with paired first, then by sort config
  const sortedVolunteers = useMemo(() => {
    const sorted = [...selectedVolunteers];
    
    sorted.sort((a, b) => {
      // First, sort by pairing status (paired volunteers first)
      const aPaired = !!pairMap[a.volunteer.id];
      const bPaired = !!pairMap[b.volunteer.id];
      
      if (aPaired !== bPaired) {
        return aPaired ? -1 : 1; // paired first
      }
      
      // Then apply the current sort configuration
      const { key, direction } = sortConfig;
      const dirMultiplier = direction === 'asc' ? 1 : -1;
      
      let aVal, bVal;
      if (key === 'name') {
        aVal = a.volunteer.firstName || '';
        bVal = b.volunteer.firstName || '';
      } else if (key === 'age') {
        aVal = a.volunteer.age || 0;
        bVal = b.volunteer.age || 0;
      } else {
        aVal = a.volunteer[key] || '';
        bVal = b.volunteer[key] || '';
      }
      
      if (aVal < bVal) return -1 * dirMultiplier;
      if (aVal > bVal) return 1 * dirMultiplier;
      return 0;
    });
    
    return sorted;
  }, [selectedVolunteers, pairMap, sortConfig]);

  // Separate paired and unpaired volunteers from sorted list
  const unpairedVolunteers = sortedVolunteers.filter(pv => !pairMap[pv.volunteer.id]);

  const createPair = async (volunteer1, volunteer2) => {
    try {
      const languages1 = volunteer1.volunteer.languages || [];
      const languages2 = volunteer2.volunteer.languages || [];
      const languageMatch = languages1.some(lang => languages2.includes(lang));
      
      const regions1 = volunteer1.volunteer.regions || [];
      const regions2 = volunteer2.volunteer.regions || [];
      const regionMatch = regions1.some(region => regions2.includes(region));
      
      const compatibility = (languageMatch ? 0.5 : 0) + (regionMatch ? 0.5 : 0);
      
      const pairData = {
        projectId,
        volunteer1Id: volunteer1.volunteer.id,
        volunteer2Id: volunteer2.volunteer.id,
        pairName: `${volunteer1.volunteer.firstName} & ${volunteer2.volunteer.firstName}`,
        compatibility,
        isManual: true
      };
      
      const response = await apiClient.post(`/projects/${projectId}/pairs`, pairData);
      if (response.data.success) {
        await loadData();
        setSelectedForPairing(new Set());
      }
    } catch (error) {
      console.error('Error creating pair:', error);
      console.error('Response data:', error.response?.data);
      alert('Failed to create pair');
    }
  };

  const autoPairGroupMembers = async () => {
    try {
      const groups = {};
      unpairedVolunteers.forEach(pv => {
        if (pv.volunteer.isJoiningAsGroup && pv.volunteer.groupName) {
          if (!groups[pv.volunteer.groupName]) {
            groups[pv.volunteer.groupName] = [];
          }
          groups[pv.volunteer.groupName].push(pv);
        }
      });

      let pairsCreated = 0;
      for (const [groupName, members] of Object.entries(groups)) {
        for (let i = 0; i < members.length - 1; i += 2) {
          const volunteer1 = members[i];
          const volunteer2 = members[i + 1];
          await createPair(volunteer1, volunteer2);
          pairsCreated++;
        }
      }
      
      if (pairsCreated > 0) {
        alert(`Successfully created ${pairsCreated} pairs from group members!`);
      } else {
        alert('No group members found to auto-pair.');
      }
    } catch (error) {
      console.error('Error auto-pairing:', error);
      alert('Failed to auto-pair group members');
    }
  };

  const handleDeletePair = async (pairId) => {
    if (window.confirm('Are you sure you want to delete this pair?')) {
      try {
        await apiClient.delete(`/projects/${projectId}/pairs/${pairId}`);
        await loadData(); // Reload data to refresh the table
        alert('Pair deleted successfully!');
      } catch (error) {
        console.error('Error deleting pair:', error);
        alert('Failed to delete pair');
      }
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };
  
  const toggleVolunteerForPairing = (volunteerId) => {
    const newSelected = new Set(selectedForPairing);
    if (newSelected.has(volunteerId)) {
      newSelected.delete(volunteerId);
    } else if (newSelected.size < 2) {
      newSelected.add(volunteerId);
    }
    setSelectedForPairing(newSelected);
  };

  const pairSelectedVolunteers = () => {
    const selected = Array.from(selectedForPairing);
    if (selected.length === 2) {
      const volunteer1 = unpairedVolunteers.find(pv => pv.volunteer.id === selected[0]);
      const volunteer2 = unpairedVolunteers.find(pv => pv.volunteer.id === selected[1]);
      createPair(volunteer1, volunteer2);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading pairing data...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            Volunteer Pairing ({sortedVolunteers.length} volunteers)
          </h3>
          <div className="flex gap-3">
            <button 
              onClick={autoPairGroupMembers} 
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <UserPlus size={16} />
              Auto-Pair Group Members
            </button>
            {selectedForPairing.size === 2 && (
              <button 
                onClick={pairSelectedVolunteers} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                <Link2 size={16} />
                Pair Selected (2)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-gray-50 border-b border-gray-200">
        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{pairs.length}</div>
          <div className="text-sm text-gray-600 font-medium">Total Pairs</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{pairs.length * 2}</div>
          <div className="text-sm text-gray-600 font-medium">Volunteers Paired</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
          <div className="text-3xl font-bold text-amber-600 mb-2">{unpairedVolunteers.length}</div>
          <div className="text-sm text-gray-600 font-medium">Volunteers Unpaired</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Select
              </th>
              <th 
                onClick={() => handleSort('name')} 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  Name
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th 
                onClick={() => handleSort('age')} 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  Age
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Languages
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Regions
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available Days
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Group Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Group Members
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paired With
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedVolunteers.length === 0 ? (
              <tr>
                <td colSpan="13" className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Users size={48} className="text-gray-300 mb-4" />
                    <div className="text-gray-900 font-medium mb-2">No selected volunteers found</div>
                    <div className="text-gray-500 text-sm">
                      Go to the Volunteers tab to select volunteers first
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sortedVolunteers.map(pv => {
                const v = pv.volunteer;
                const isPaired = !!pairMap[v.id];
                const pairedInfo = pairMap[v.id];
                const isSelectedForPairing = selectedForPairing.has(v.id);

                return (
                  <tr 
                    key={pv.id} 
                    className={`
                      hover:bg-gray-50 transition-colors duration-150
                      ${isPaired ? 'bg-green-50 border-l-4 border-green-400' : 'bg-amber-50 border-l-4 border-amber-400'} 
                      ${isSelectedForPairing ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}
                    `}
                  >
                    <td className="px-4 py-3">
                      {!isPaired && (
                        <input
                          type="checkbox"
                          checked={isSelectedForPairing}
                          onChange={() => toggleVolunteerForPairing(v.id)}
                          disabled={selectedForPairing.size >= 2 && !isSelectedForPairing}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">
                          {v.firstName} {v.lastName}
                        </div>
                        {v.hasExperience && (
                          <span className="text-yellow-500 font-bold text-lg" title="Has experience">★</span>
                        )}
                        {isPaired && (
                          <span className="text-green-600" title="Paired">👥</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.age || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.contactNumber || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {v.email || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.languages?.join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.regions?.join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.availableDays?.join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.availableTime?.join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {v.isJoiningAsGroup ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users size={12} />
                          {v.groupName || 'Group'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Individual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {v.groupMembers && v.groupMembers.length > 0 ? (
                        <div className="text-sm" title={v.groupMembers.join(', ')}>
                          {v.groupMembers.length} other{v.groupMembers.length !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isPaired ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link2 size={14} className="text-green-600" />
                            <span className="font-medium text-gray-900">
                              {pairedInfo.partner.firstName} {pairedInfo.partner.lastName}
                            </span>
                          </div>
                          {pairedInfo.pair.compatibility && (
                            <div className="text-xs text-green-600 font-medium">
                              {Math.round(pairedInfo.pair.compatibility * 100)}% match
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Not paired</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isPaired ? (
                          <>
                            <button 
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                              title="View pair details"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeletePair(pairedInfo.pair.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200"
                              title="Delete pair"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500">Available for pairing</span>
                            <div className="flex gap-1">
                              {unpairedVolunteers.filter(other => other.id !== pv.id).slice(0, 2).map(other => (
                                <button
                                  key={other.id}
                                  onClick={() => createPair(pv, other)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200"
                                  title={`Pair with ${other.volunteer.firstName} ${other.volunteer.lastName}`}
                                >
                                  + {other.volunteer.firstName}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VolunteerPairingTable;




