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
    return <div className="loading-container">Loading pairing data...</div>;
  }

  return (
    <div className="volunteer-pairing-container">
      {/* Header */}
      <div className="pairing-header">
        <h3>Volunteer Pairing ({sortedVolunteers.length} volunteers)</h3>
        <div className="pairing-actions">
          <button onClick={autoPairGroupMembers} className="btn btn-success">
            <UserPlus size={16} />
            Auto-Pair Group Members
          </button>
          {selectedForPairing.size === 2 && (
            <button onClick={pairSelectedVolunteers} className="btn btn-primary">
              <Link2 size={16} />
              Pair Selected (2)
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="pairing-stats">
        <div className="stat-card">
          <div className="stat-number">{pairs.length}</div>
          <div className="stat-label">Total Pairs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{pairs.length * 2}</div>
          <div className="stat-label">Volunteers Paired</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{unpairedVolunteers.length}</div>
          <div className="stat-label">Volunteers Unpaired</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="pairing-table-container">
        <table className="pairing-table">
          <thead>
            <tr>
              <th>Select</th>
              <th onClick={() => handleSort('name')} className="sortable">
                Name <ArrowUpDown size={12} />
              </th>
              <th onClick={() => handleSort('age')} className="sortable">
                Age <ArrowUpDown size={12} />
              </th>
              <th>Contact</th>
              <th>Email</th>
              <th>Languages</th>
              <th>Regions</th>
              <th>Available Days</th>
              <th>Available Time</th>
              <th>Group Status</th>
              <th>Group Members</th>
              <th>Paired With</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedVolunteers.length === 0 ? (
              <tr>
                <td colSpan="13" style={{textAlign: 'center', padding: '40px'}}>
                  <Users size={48} style={{opacity: 0.3, marginBottom: '10px'}} />
                  <div>No selected volunteers found</div>
                  <div style={{fontSize: '0.9em', color: '#666', marginTop: '5px'}}>
                    Go to the Volunteers tab to select volunteers first
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
                  <tr key={pv.id} className={`
                    volunteer-row 
                    ${isPaired ? 'paired' : 'unpaired'} 
                    ${isSelectedForPairing ? 'selected-for-pairing' : ''}
                  `}>
                    <td>
                      {!isPaired && (
                        <input
                          type="checkbox"
                          checked={isSelectedForPairing}
                          onChange={() => toggleVolunteerForPairing(v.id)}
                          disabled={selectedForPairing.size >= 2 && !isSelectedForPairing}
                        />
                      )}
                    </td>
                    <td>
                      <div className="volunteer-name">
                        <strong>{v.firstName} {v.lastName}</strong>
                        {v.hasExperience && <span className="experience-star">★</span>}
                        {isPaired && <span className="paired-indicator">👥</span>}
                      </div>
                    </td>
                    <td>{v.age || 'N/A'}</td>
                    <td>{v.contactNumber || 'N/A'}</td>
                    <td>{v.email || 'N/A'}</td>
                    <td>{v.languages?.join(', ') || 'N/A'}</td>
                    <td>{v.regions?.join(', ') || 'N/A'}</td>
                    <td>{v.availableDays?.join(', ') || 'N/A'}</td>
                    <td>{v.availableTime?.join(', ') || 'N/A'}</td>
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
                      {v.groupMembers && v.groupMembers.length > 0 ? (
                        <div className="group-members" title={v.groupMembers.join(', ')}>
                          {v.groupMembers.length} other{v.groupMembers.length !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {isPaired ? (
                        <div className="paired-with">
                          <Link2 size={14} />
                          <strong>{pairedInfo.partner.firstName} {pairedInfo.partner.lastName}</strong>
                          {pairedInfo.pair.compatibility && (
                            <div className="compatibility">
                              {Math.round(pairedInfo.pair.compatibility * 100)}% match
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="not-paired">Not paired</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {isPaired ? (
                          <>
                            <button 
                              className="btn-icon btn-view"
                              title="View pair details"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeletePair(pairedInfo.pair.id)}
                              className="btn-icon btn-danger"
                              title="Delete pair"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="unpaired-actions">
                            <span className="available-label">Available for pairing</span>
                            {unpairedVolunteers.filter(other => other.id !== pv.id).slice(0, 2).map(other => (
                              <button
                                key={other.id}
                                onClick={() => createPair(pv, other)}
                                className="btn-quick-pair"
                                title={`Pair with ${other.volunteer.firstName} ${other.volunteer.lastName}`}
                              >
                                + {other.volunteer.firstName}
                              </button>
                            ))}
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
