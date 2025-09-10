import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  MapPin, Users, Upload, Search, Trash2, AlertTriangle, BarChart3, 
  Plus, Settings, Grid, List, ChevronDown, ChevronRight, Edit, Save, X,
  UserCheck, UserMinus, Building, Globe, ChevronUp
} from 'lucide-react';
import ClientCSVImporter from './ClientCSVImporter';

const ClientManagementTab = ({ projectId, refreshKey, onImportComplete }) => {
  const [projectClients, setProjectClients] = useState([]);
  const [groupedClients, setGroupedClients] = useState({});
  const [clientGroups, setClientGroups] = useState([]);
  const [locationStats, setLocationStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'
  const [sortBy, setSortBy] = useState('location'); // 'location', 'name', 'srcId'
  const [filterByLocation, setFilterByLocation] = useState('');
  
  // New state for inline group creation
  const [showGroupCreatorForLocation, setShowGroupCreatorForLocation] = useState(null);
  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    location: '',
    mandatoryClients: [],
    optionalClients: []
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [errors, setErrors] = useState({});

  // Load data with useCallback to prevent unnecessary re-renders
  const loadProjectClients = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/projects/${projectId}/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const clientsData = response.data;
      setProjectClients(clientsData);

      // Group clients by location
      const grouped = clientsData.reduce((acc, pc) => {
        const location = pc.client.location || 'Unknown Location';
        if (!acc[location]) acc[location] = [];
        acc[location].push(pc);
        return acc;
      }, {});
      setGroupedClients(grouped);

      // Calculate location statistics
      const stats = {};
      Object.entries(grouped).forEach(([location, clients]) => {
        const languages = [...new Set(clients.map(pc => pc.client.languages).filter(Boolean))];
        const races = [...new Set(clients.map(pc => pc.client.race).filter(Boolean))];
        const genders = [...new Set(clients.map(pc => pc.client.gender).filter(Boolean))];
        stats[location] = { 
          total: clients.length, 
          languages: languages.length, 
          races: races.length, 
          genders: genders.length,
          languageList: languages,
          raceList: races,
          genderList: genders
        };
      });
      setLocationStats(stats);

      // Auto-expand all locations initially (only on first load)
      if (Object.keys(expandedLocations).length === 0) {
        const initialExpanded = {};
        Object.keys(grouped).forEach(location => {
          initialExpanded[location] = true;
        });
        setExpandedLocations(initialExpanded);
      }
    } catch (error) {
      console.error('Error loading project clients:', error);
      setErrors(prev => ({ ...prev, loadClients: error.message }));
    } finally {
      setLoading(false);
    }
  }, [projectId, expandedLocations]);

  const loadClientGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/projects/${projectId}/client-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setClientGroups(response.data);

      // Auto-expand all groups initially (only on first load)
      if (Object.keys(expandedGroups).length === 0) {
        const initialExpanded = {};
        response.data.forEach(group => {
          initialExpanded[group.id] = true;
        });
        setExpandedGroups(initialExpanded);
      }
    } catch (error) {
      console.error('Error loading client groups:', error);
      setErrors(prev => ({ ...prev, loadGroups: error.message }));
    }
  }, [projectId, expandedGroups]);

  useEffect(() => {
    loadProjectClients();
    loadClientGroups();
  }, [projectId, refreshKey, loadProjectClients, loadClientGroups]);

  // Memoized filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = Object.entries(groupedClients);
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.map(([location, clients]) => {
        const filteredClients = clients.filter(pc =>
          pc.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pc.client.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pc.client.srcId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pc.client.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pc.client.languages?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return [location, filteredClients];
      }).filter(([, clients]) => clients.length > 0);
    }

    // Filter by location
    if (filterByLocation) {
      filtered = filtered.filter(([location]) => 
        location.toLowerCase().includes(filterByLocation.toLowerCase())
      );
    }

    // Sort locations
    filtered.sort(([locationA], [locationB]) => {
      switch (sortBy) {
        case 'name':
          return locationA.localeCompare(locationB);
        case 'count':
          return groupedClients[locationB]?.length - groupedClients[locationA]?.length;
        default:
          return locationA.localeCompare(locationB);
      }
    });

    return Object.fromEntries(filtered);
  }, [groupedClients, searchTerm, filterByLocation, sortBy]);

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    return Object.keys(groupedClients).sort();
  }, [groupedClients]);

const handleAutoGroupClients = async () => {
  if (!window.confirm('This will create optimized client groups (3 mandatory + 2 optional per group) based on location. Any existing groups will be cleared first. Continue?')) {
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    
    // The API endpoint already handles clearing existing groups and creating new ones
    const response = await axios.post(`/projects/${projectId}/clients/auto-group-enhanced`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data.success) {
      // Reload both client data and groups
      await Promise.all([
        loadClientGroups(),
        loadProjectClients()
      ]);
      
      // Show success message with details
      const { groupsCreated, clientsGrouped, locations } = response.data;
      alert(
        `Auto-grouping completed successfully!\n\n` +
        `• Created ${groupsCreated} groups\n` +
        `• Grouped ${clientsGrouped} clients\n` +
        `• Across ${locations} locations\n\n` +
        `Groups follow the 3 mandatory + 2 optional structure.`
      );
    }
  } catch (error) {
    console.error('Error auto-grouping clients:', error);
    const errorMessage = error.response?.data?.error || 'Failed to create client groups';
    alert(`Auto-grouping failed: ${errorMessage}`);
  }
};


  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this client group?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/projects/${projectId}/client-groups/${groupId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadClientGroups();
      alert('Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert(error.response?.data?.error || 'Failed to delete client group');
    }
  };

  const handleDeleteAllGroups = async () => {
    if (!window.confirm('Are you sure you want to delete ALL client groups? This cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/projects/${projectId}/client-groups/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        loadClientGroups();
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Error deleting all groups:', error);
      alert(error.response?.data?.error || 'Failed to delete all client groups');
    }
  };

  const openGroupCreatorForLocation = (location) => {
    setNewGroupForm({
      name: '',
      location: location,
      mandatoryClients: [],
      optionalClients: []
    });
    setEditingGroup(null);
    setShowGroupCreatorForLocation(location);
    setErrors({});
  };

  const openGroupEditor = (group) => {
    const mandatoryClients = group.groupClients
      .filter(gc => gc.type === 'MANDATORY')
      .map(gc => gc.client);
    const optionalClients = group.groupClients
      .filter(gc => gc.type === 'OPTIONAL')
      .map(gc => gc.client);

    setNewGroupForm({
      name: group.name,
      location: group.location,
      mandatoryClients,
      optionalClients
    });
    setEditingGroup(group);
    setShowGroupCreatorForLocation(group.location);
    setErrors({});
  };

  const validateGroupForm = () => {
    const newErrors = {};
    
    if (!newGroupForm.name.trim()) {
      newErrors.name = 'Group name is required';
    }
    
    if (newGroupForm.mandatoryClients.length === 0) {
      newErrors.mandatory = 'At least one mandatory client is required';
    }
    
    if (newGroupForm.mandatoryClients.length > 3) {
      newErrors.mandatory = 'Maximum 3 mandatory clients allowed';
    }
    
    if (newGroupForm.optionalClients.length > 2) {
      newErrors.optional = 'Maximum 2 optional clients allowed';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateOrUpdateGroup = async () => {
    if (!validateGroupForm()) {
      return;
    }

    setCreatingGroup(true);
    try {
      const token = localStorage.getItem('token');
      
      if (editingGroup) {
        // Update existing group
        await axios.put(`/projects/${projectId}/client-groups/${editingGroup.id}`, {
          name: newGroupForm.name,
          location: newGroupForm.location,
          mandatoryClients: newGroupForm.mandatoryClients,
          optionalClients: newGroupForm.optionalClients
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        alert('Group updated successfully');
      } else {
        // Create new group
        await axios.post(`/projects/${projectId}/client-groups`, {
          groups: [{
            name: newGroupForm.name,
            location: newGroupForm.location,
            mandatoryClients: newGroupForm.mandatoryClients,
            optionalClients: newGroupForm.optionalClients
          }]
        }, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        alert('Group created successfully');
      }

      setShowGroupCreatorForLocation(null);
      setNewGroupForm({
        name: '',
        location: '',
        mandatoryClients: [],
        optionalClients: []
      });
      loadClientGroups();
    } catch (error) {
      console.error('Error creating/updating group:', error);
      alert(error.response?.data?.error || 'Failed to save group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const addClientToGroup = (client, type) => {
    const isInMandatory = newGroupForm.mandatoryClients.find(c => c.id === client.id);
    const isInOptional = newGroupForm.optionalClients.find(c => c.id === client.id);

    if (type === 'mandatory') {
      if (newGroupForm.mandatoryClients.length >= 3) {
        alert('Maximum 3 mandatory clients allowed');
        return;
      }
      if (isInMandatory) {
        alert('Client already added as mandatory');
        return;
      }
      
      // Remove from optional if exists and add to mandatory
      const updatedOptional = newGroupForm.optionalClients.filter(c => c.id !== client.id);
      setNewGroupForm(prev => ({
        ...prev,
        mandatoryClients: [...prev.mandatoryClients, client],
        optionalClients: updatedOptional
      }));
    } else {
      if (newGroupForm.optionalClients.length >= 2) {
        alert('Maximum 2 optional clients allowed');
        return;
      }
      if (isInOptional) {
        alert('Client already added as optional');
        return;
      }
      
      // Remove from mandatory if exists and add to optional
      const updatedMandatory = newGroupForm.mandatoryClients.filter(c => c.id !== client.id);
      setNewGroupForm(prev => ({
        ...prev,
        optionalClients: [...prev.optionalClients, client],
        mandatoryClients: updatedMandatory
      }));
    }
    
    // Clear validation errors when adding clients
    if (errors.mandatory || errors.optional) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.mandatory;
        delete newErrors.optional;
        return newErrors;
      });
    }
  };

  const removeClientFromGroup = (clientId, type) => {
    if (type === 'mandatory') {
      setNewGroupForm(prev => ({
        ...prev,
        mandatoryClients: prev.mandatoryClients.filter(c => c.id !== clientId)
      }));
    } else {
      setNewGroupForm(prev => ({
        ...prev,
        optionalClients: prev.optionalClients.filter(c => c.id !== clientId)
      }));
    }
  };

  // Get clients available for grouping (not already in a group for this location)
  const getAvailableClientsForLocation = useCallback((location) => {
    const locationClients = groupedClients[location] || [];
    const groupedClientIds = new Set();
    
    // Get clients already in groups for this location
    clientGroups
      .filter(group => group.location === location)
      .forEach(group => {
        group.groupClients.forEach(gc => {
          groupedClientIds.add(gc.client.id);
        });
      });
    
    // If editing, include clients that are in the group being edited
    if (editingGroup) {
      editingGroup.groupClients.forEach(gc => {
        groupedClientIds.delete(gc.client.id);
      });
    }
    
    return locationClients
      .map(pc => pc.client)
      .filter(client => !groupedClientIds.has(client.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groupedClients, clientGroups, editingGroup]);

  // Get groups for a specific location
  const getGroupsForLocation = useCallback((location) => {
    return clientGroups
      .filter(group => group.location === location)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientGroups]);

  // Get ungrouped clients for a location
  const getUngroupedClientsForLocation = useCallback((location) => {
    const locationClients = groupedClients[location] || [];
    const groupedClientIds = new Set();
    
    clientGroups
      .filter(group => group.location === location)
      .forEach(group => {
        group.groupClients.forEach(gc => {
          groupedClientIds.add(gc.client.id);
        });
      });
    
    return locationClients
      .filter(pc => !groupedClientIds.has(pc.client.id))
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [groupedClients, clientGroups]);

  const toggleLocationExpansion = (location) => {
    setExpandedLocations(prev => ({
      ...prev,
      [location]: !prev[location]
    }));
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const toggleAllLocations = () => {
    const allExpanded = Object.values(expandedLocations).every(Boolean);
    const newState = {};
    Object.keys(filteredAndSortedClients).forEach(location => {
      newState[location] = !allExpanded;
    });
    setExpandedLocations(newState);
  };

  const handleImportComplete = (result) => {
    loadProjectClients();
    setShowImporter(false);
    if (onImportComplete) {
      onImportComplete(result);
    }
  };

  const handleRemoveClient = async (projectClientId) => {
    if (!window.confirm('Are you sure you want to remove this client from the project?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/project-clients/${projectClientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      loadProjectClients();
      loadClientGroups();
      alert('Client removed successfully');
    } catch (error) {
      console.error('Error removing client:', error);
      alert(error.response?.data?.error || 'Failed to remove client from project');
    }
  };

  const handleRemoveAllClients = async () => {
    setRemovingAll(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/projects/${projectId}/clients`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        loadProjectClients();
        loadClientGroups();
        setShowRemoveAllModal(false);
        alert(response.data.message || 'All clients removed successfully');
      }
    } catch (error) {
      console.error('Error removing all clients:', error);
      alert(error.response?.data?.error || 'Failed to remove all clients');
    } finally {
      setRemovingAll(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilterByLocation('');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div>Loading project clients...</div>
      </div>
    );
  }

  const totalClients = projectClients.length;
  const totalGroups = clientGroups.length;
  const totalLocations = Object.keys(groupedClients).length;

  return (
    <div className="clients-tab">
      {/* Enhanced Header with Statistics */}
      <div className="clients-header">
        <div>
          <h3>
            <Users />
            Client Management ({totalClients})
            <span className="stat-subtitle">
              {totalLocations} Locations • {totalGroups} Groups
            </span>
          </h3>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setShowImporter(true)}
            className="import-clients-btn"
          >
            <Upload />
            Import CSV
          </button>
          
          {totalClients > 0 && (
            <>
              <button
                onClick={handleAutoGroupClients}
                className="group-clients-btn"
                disabled={loading}
              >
                <Settings />
                Auto Group All
              </button>
              
              {totalGroups > 0 && (
                <button
                  onClick={handleDeleteAllGroups}
                  className="group-clients-btn"
                  style={{ backgroundColor: '#f59e0b' }}
                >
                  <Grid />
                  Clear All Groups
                </button>
              )}
              
              <button
                onClick={() => setShowRemoveAllModal(true)}
                className="clear-btn danger"
              >
                <Trash2 />
                Remove All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="filters-section">
        <div className="search-filter">
          <Search />
          <input
            type="text"
            placeholder="Search clients by name, location, SRC ID, address, or language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {(searchTerm || filterByLocation) && (
            <button
              onClick={clearSearch}
              className="btn-icon"
              style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none' }}
            >
              <X />
            </button>
          )}
        </div>

        <div className="filter-controls">
          <select
            value={filterByLocation}
            onChange={(e) => setFilterByLocation(e.target.value)}
          >
            <option value="">All Locations</option>
            {uniqueLocations.map(location => (
              <option key={location} value={location}>
                {location} ({groupedClients[location]?.length || 0})
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="location">Sort by Location</option>
            <option value="count">Sort by Client Count</option>
            <option value="name">Sort by Name</option>
          </select>

          <button
            onClick={toggleAllLocations}
            className="btn-icon"
            title={Object.values(expandedLocations).every(Boolean) ? "Collapse All" : "Expand All"}
          >
            {Object.values(expandedLocations).every(Boolean) ? <ChevronUp /> : <ChevronDown />}
          </button>

          {Object.keys(filteredAndSortedClients).length > 0 && (
            <div className="results-info">
              Showing {Object.keys(filteredAndSortedClients).length} of {totalLocations} locations
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="error-banner">
          {Object.entries(errors).map(([key, error]) => (
            <div key={key} className="error-message">
              <AlertTriangle />
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Location-based Client Display with Enhanced Groups */}
      <div className="client-management-container">
        {Object.keys(filteredAndSortedClients).length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" />
            <h3 className="empty-title">
              {totalClients === 0 
                ? "Import clients from a CSV file to get started"
                : "No clients match your search criteria"
              }
            </h3>
            {totalClients === 0 && (
              <button
                onClick={() => setShowImporter(true)}
                className="create-first-btn"
              >
                <Upload />
                Import Clients
              </button>
            )}
            {totalClients > 0 && (
              <button
                onClick={clearSearch}
                className="btn"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          Object.entries(filteredAndSortedClients).map(([location, clients]) => {
            const locationGroups = getGroupsForLocation(location);
            const ungroupedClients = getUngroupedClientsForLocation(location);
            const stats = locationStats[location] || {};
            
            return (
              <div key={location} className="location-group">
                <div 
                  className="location-header"
                  onClick={() => toggleLocationExpansion(location)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="location-title">
                    {expandedLocations[location] ? (
                      <ChevronDown />
                    ) : (
                      <ChevronRight />
                    )}
                    <MapPin />
                    <span>{location}</span>
                    <span className="client-count">{clients.length} clients</span>
                    {locationGroups.length > 0 && (
                      <span className="client-count" style={{ backgroundColor: '#38a169' }}>
                        {locationGroups.length} groups
                      </span>
                    )}
                    {ungroupedClients.length > 0 && (
                      <span className="client-count" style={{ backgroundColor: '#f59e0b' }}>
                        {ungroupedClients.length} ungrouped
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="location-stats-mini">
                      <div style={{ fontSize: '0.875rem', color: '#718096', display: 'flex', gap: '1rem' }}>
                        <span title="Languages">🗣️ {stats.languages || 0}</span>
                        <span title="Races">👥 {stats.races || 0}</span>
                        <span title="Genders">⚧ {stats.genders || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openGroupCreatorForLocation(location);
                      }}
                      className="btn-icon"
                      style={{ color: '#38a169' }}
                      title="Create group for this location"
                    >
                      <Plus />
                    </button>
                  </div>
                </div>
                
                {expandedLocations[location] && (
                  <div style={{ padding: '1rem', background: 'white' }}>
                    {/* Enhanced Location Statistics */}
                    {stats && (
                      <div className="location-stats">
                        <div className="location-stat">
                          <div className="location-stat-number">{stats.total}</div>
                          <div className="location-stat-label">Total Clients</div>
                        </div>
                        <div className="location-stat">
                          <div className="location-stat-number">{locationGroups.length}</div>
                          <div className="location-stat-label">Groups</div>
                        </div>
                        <div className="location-stat">
                          <div className="location-stat-number">{ungroupedClients.length}</div>
                          <div className="location-stat-label">Ungrouped</div>
                        </div>
                        <div className="location-stat">
                          <div className="location-stat-number">{stats.languages}</div>
                          <div className="location-stat-label">Languages</div>
                        </div>
                      </div>
                    )}

                    {/* Existing Groups for this Location */}
                    {locationGroups.map((group) => (
                      <div key={group.id} className="group-container">
                        <div 
                          className="group-header"
                          onClick={() => toggleGroupExpansion(group.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="group-title">
                            {expandedGroups[group.id] ? (
                              <ChevronDown />
                            ) : (
                              <ChevronRight />
                            )}
                            <Grid />
                            <div className="group-info">
                              <div className="group-name">{group.name}</div>
                              <div style={{ fontSize: '0.875rem', color: '#718096', display: 'flex', gap: '1rem' }}>
                                <span className="mandatory-count">
                                  M: {group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3
                                </span>
                                <span className="optional-count">
                                  O: {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length}/2
                                </span>
                                <span className="total-count">
                                  Total: {group.groupClients.length}/5
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="group-actions">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openGroupEditor(group);
                              }}
                              className="btn-icon"
                              style={{ color: '#4299e1' }}
                              title="Edit group"
                            >
                              <Edit />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGroup(group.id);
                              }}
                              className="delete-group-btn"
                              title="Delete group"
                            >
                              <Trash2 />
                            </button>
                          </div>
                        </div>
                        
                        {expandedGroups[group.id] && (
                          <div className="group-clients">
                            {/* Mandatory Clients */}
                            <div className="client-section">
                              <h6 className="section-title mandatory">
                                <UserCheck />
                                Mandatory ({group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3)
                              </h6>
                              {group.groupClients.filter(gc => gc.type === 'MANDATORY').length > 0 ? (
                                <div className="clients-grid">
                                  {group.groupClients
                                    .filter(gc => gc.type === 'MANDATORY')
                                    .sort((a, b) => a.priority - b.priority)
                                    .map((gc) => (
                                      <div key={gc.id} className="client-card mandatory">
                                        <div className="client-card-header">
                                          <div className="client-name-section">
                                            <h4>{gc.client.name}</h4>
                                            <div className="client-src-id">({gc.client.srcId})</div>
                                          </div>
                                          <div className="client-type-badge mandatory">Mandatory</div>
                                        </div>
                                        <div className="client-details-section">
                                          {gc.client.gender && (
                                            <div className="client-detail-row">
                                              <Users />
                                              <span>{gc.client.gender}</span>
                                            </div>
                                          )}
                                          <div className="client-detail-row">
                                            <MapPin />
                                            <span>{gc.client.address}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="empty-section">
                                  <span>No mandatory clients assigned</span>
                                </div>
                              )}
                            </div>

                            {/* Optional Clients */}
                            {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length > 0 && (
                              <div className="client-section">
                                <h6 className="section-title optional">
                                  <UserMinus />
                                  Optional ({group.groupClients.filter(gc => gc.type === 'OPTIONAL').length}/2)
                                </h6>
                                <div className="clients-grid">
                                  {group.groupClients
                                    .filter(gc => gc.type === 'OPTIONAL')
                                    .sort((a, b) => a.priority - b.priority)
                                    .map((gc) => (
                                      <div key={gc.id} className="client-card optional">
                                        <div className="client-card-header">
                                          <div className="client-name-section">
                                            <h4>{gc.client.name}</h4>
                                            <div className="client-src-id">({gc.client.srcId})</div>
                                          </div>
                                          <div className="client-type-badge optional">Optional</div>
                                        </div>
                                        <div className="client-details-section">
                                          {gc.client.gender && (
                                            <div className="client-detail-row">
                                              <Users />
                                              <span>{gc.client.gender}</span>
                                            </div>
                                          )}
                                          <div className="client-detail-row">
                                            <MapPin />
                                            <span>{gc.client.address}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Ungrouped Clients */}
                    {ungroupedClients.length > 0 && (
                      <div className="client-section">
                        <h5 style={{ fontWeight: '500', color: '#2d3748', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Users style={{ width: '1rem', height: '1rem', color: '#718096' }} />
                          Ungrouped Clients ({ungroupedClients.length})
                          <button
                            onClick={() => openGroupCreatorForLocation(location)}
                            className="btn-small"
                            style={{ background: '#38a169', color: 'white', marginLeft: '0.5rem' }}
                          >
                            <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                            Group These
                          </button>
                        </h5>
                        <div className="location-clients-grid">
                          {ungroupedClients.map((pc) => (
                            <div key={pc.id} className="client-card">
                              <div className="client-card-header">
                                <div className="client-name-section">
                                  <h4>{pc.client.name}</h4>
                                  <div className="client-src-id">{pc.client.srcId}</div>
                                </div>
                                <div className="client-actions">
                                  <button
                                    onClick={() => handleRemoveClient(pc.id)}
                                    className="remove-client-btn"
                                    title="Remove from project"
                                  >
                                    <Trash2 />
                                  </button>
                                </div>
                              </div>
                              <div className="client-details-section">
                                {pc.client.gender && (
                                  <div className="client-detail-row">
                                    <Users />
                                    <span>{pc.client.gender} {pc.client.race && `• ${pc.client.race}`}</span>
                                  </div>
                                )}
                                <div className="client-detail-row">
                                  <MapPin />
                                  <span>{pc.client.address}</span>
                                </div>
                                {pc.client.languages && (
                                  <div className="client-detail-row">
                                    <Globe />
                                    <span>Languages: {pc.client.languages}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enhanced Inline Group Creator */}
                    {showGroupCreatorForLocation === location && (
                      <div className="group-creator-panel">
                        <div className="group-creator-header">
                          <h5>
                            {editingGroup ? 'Edit Group' : 'Create New Group'} for {location}
                          </h5>
                          <button
                            onClick={() => setShowGroupCreatorForLocation(null)}
                            className="btn-icon"
                          >
                            <X />
                          </button>
                        </div>
                        
                        {/* Group Name Input */}
                        <div className="form-group">
                          <label>
                            Group Name *
                            {errors.name && <span className="error-text">{errors.name}</span>}
                          </label>
                          <input
                            type="text"
                            value={newGroupForm.name}
                            onChange={(e) => {
                              setNewGroupForm(prev => ({ ...prev, name: e.target.value }));
                              if (errors.name) {
                                setErrors(prev => ({ ...prev, name: undefined }));
                              }
                            }}
                            placeholder="e.g., Group A, Morning Group, etc."
                            className={errors.name ? 'error' : ''}
                          />
                        </div>

                        {/* Client Selection Grid */}
                        <div className="client-selection-grid">
                          {/* Mandatory Clients */}
                          <div className="selection-column">
                            <h6 className="selection-title mandatory">
                              <UserCheck />
                              Mandatory Clients ({newGroupForm.mandatoryClients.length}/3)
                              {errors.mandatory && <span className="error-text">{errors.mandatory}</span>}
                            </h6>
                            <div className="selected-clients-list">
                              {newGroupForm.mandatoryClients.length === 0 ? (
                                <div className="empty-selection">
                                  Select mandatory clients from the list below
                                </div>
                              ) : (
                                newGroupForm.mandatoryClients.map((client) => (
                                  <div key={client.id} className="selected-client mandatory">
                                    <div className="client-info">
                                      <span className="client-name">{client.name}</span>
                                      <span className="client-id">({client.srcId})</span>
                                    </div>
                                    <button
                                      onClick={() => removeClientFromGroup(client.id, 'mandatory')}
                                      className="remove-btn"
                                    >
                                      <X />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Optional Clients */}
                          <div className="selection-column">
                            <h6 className="selection-title optional">
                              <UserMinus />
                              Optional Clients ({newGroupForm.optionalClients.length}/2)
                              {errors.optional && <span className="error-text">{errors.optional}</span>}
                            </h6>
                            <div className="selected-clients-list">
                              {newGroupForm.optionalClients.length === 0 ? (
                                <div className="empty-selection">
                                  Optionally select additional clients
                                </div>
                              ) : (
                                newGroupForm.optionalClients.map((client) => (
                                  <div key={client.id} className="selected-client optional">
                                    <div className="client-info">
                                      <span className="client-name">{client.name}</span>
                                      <span className="client-id">({client.srcId})</span>
                                    </div>
                                    <button
                                      onClick={() => removeClientFromGroup(client.id, 'optional')}
                                      className="remove-btn"
                                    >
                                      <X />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Available Clients */}
                        <div className="available-clients-section">
                          <h6>Available Clients for {location}</h6>
                          <div className="available-clients-list">
                            {getAvailableClientsForLocation(location).length === 0 ? (
                              <div className="no-clients-available">
                                No available clients for this location
                              </div>
                            ) : (
                              getAvailableClientsForLocation(location).map((client) => (
                                <div key={client.id} className="available-client">
                                  <div className="client-info">
                                    <div className="client-name">{client.name}</div>
                                    <div className="client-details">
                                      {client.srcId} {client.gender && `• ${client.gender}`} {client.race && `• ${client.race}`}
                                    </div>
                                  </div>
                                  <div className="client-actions">
                                    <button
                                      onClick={() => addClientToGroup(client, 'mandatory')}
                                      disabled={newGroupForm.mandatoryClients.length >= 3}
                                      className="add-btn mandatory"
                                      title="Add as mandatory"
                                    >
                                      + M
                                    </button>
                                    <button
                                      onClick={() => addClientToGroup(client, 'optional')}
                                      disabled={newGroupForm.optionalClients.length >= 2}
                                      className="add-btn optional"
                                      title="Add as optional"
                                    >
                                      + O
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="group-creator-actions">
                          <button
                            onClick={() => setShowGroupCreatorForLocation(null)}
                            disabled={creatingGroup}
                            className="cancel-btn"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateOrUpdateGroup}
                            disabled={creatingGroup || !newGroupForm.name.trim() || newGroupForm.mandatoryClients.length === 0}
                            className="submit-btn"
                          >
                            {creatingGroup ? (
                              <>
                                <div className="spinner-small"></div>
                                {editingGroup ? 'Updating...' : 'Creating...'}
                              </>
                            ) : (
                              <>
                                <Save />
                                {editingGroup ? 'Update Group' : 'Create Group'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Remove All Clients Modal */}
      {showRemoveAllModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                <AlertTriangle />
                Remove All Clients
              </h2>
              <button
                className="close-btn"
                onClick={() => setShowRemoveAllModal(false)}
              >
                <X />
              </button>
            </div>
            <div className="modal-form">
              <p>
                Are you sure you want to remove all <strong>{totalClients} clients</strong> from this project?
              </p>
              <div className="warning-note">
                <p>
                  <strong>Warning:</strong> This action cannot be undone and will:
                </p>
                <ul>
                  <li>Remove all clients from this project</li>
                  <li>Delete all client groups</li>
                  <li>Remove any assignments involving these clients</li>
                </ul>
              </div>
              <div className="modal-actions">
                <button
                  onClick={() => setShowRemoveAllModal(false)}
                  disabled={removingAll}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveAllClients}
                  disabled={removingAll}
                  className="confirm-btn danger"
                >
                  {removingAll ? (
                    <>
                      <div className="spinner-small"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 />
                      Remove All Clients
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Importer Modal */}
      {showImporter && (
        <ClientCSVImporter
          projectId={projectId}
          onComplete={handleImportComplete}
          onCancel={() => setShowImporter(false)}
        />
      )}
    </div>
  );
};

export default ClientManagementTab;
