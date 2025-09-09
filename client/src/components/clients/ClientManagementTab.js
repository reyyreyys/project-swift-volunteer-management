import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Users, Upload, Search, Trash2, AlertTriangle, BarChart3, Plus, Settings, Grid, List, ChevronDown, ChevronRight, Edit, Save, X } from 'lucide-react';
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

  useEffect(() => {
    loadProjectClients();
    loadClientGroups();
  }, [projectId, refreshKey]);

  const loadProjectClients = async () => {
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
        stats[location] = { total: clients.length, languages, races, genders };
      });
      setLocationStats(stats);

      // Auto-expand all locations initially
      const initialExpanded = {};
      Object.keys(grouped).forEach(location => {
        initialExpanded[location] = true;
      });
      setExpandedLocations(initialExpanded);
    } catch (error) {
      console.error('Error loading project clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/projects/${projectId}/client-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setClientGroups(response.data);

      // Auto-expand all groups initially
      const initialExpanded = {};
      response.data.forEach(group => {
        initialExpanded[group.id] = true;
      });
      setExpandedGroups(initialExpanded);
    } catch (error) {
      console.error('Error loading client groups:', error);
    }
  };

  const handleAutoGroupClients = async () => {
    if (!window.confirm('This will create new groups and may replace existing ones. Continue?')) {
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/projects/${projectId}/clients/auto-group`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        await loadClientGroups();
        alert(`Successfully created ${response.data.groups.length} client groups`);
      }
    } catch (error) {
      console.error('Error auto-grouping clients:', error);
      alert('Failed to create client groups');
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
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete client group');
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
      alert('Failed to delete all client groups');
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
  };

  const handleCreateOrUpdateGroup = async () => {
    if (!newGroupForm.name.trim()) {
      alert('Please provide a group name');
      return;
    }

    if (newGroupForm.mandatoryClients.length === 0) {
      alert('Please select at least one mandatory client');
      return;
    }

    if (newGroupForm.mandatoryClients.length > 3) {
      alert('Maximum 3 mandatory clients allowed');
      return;
    }

    if (newGroupForm.optionalClients.length > 2) {
      alert('Maximum 2 optional clients allowed');
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
      loadClientGroups();
    } catch (error) {
      console.error('Error creating/updating group:', error);
      alert(error.response?.data?.error || 'Failed to save group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const addClientToGroup = (client, type) => {
    if (type === 'mandatory') {
      if (newGroupForm.mandatoryClients.length >= 3) {
        alert('Maximum 3 mandatory clients allowed');
        return;
      }
      if (newGroupForm.mandatoryClients.find(c => c.id === client.id)) {
        alert('Client already added as mandatory');
        return;
      }
      // Remove from optional if exists
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
      if (newGroupForm.optionalClients.find(c => c.id === client.id)) {
        alert('Client already added as optional');
        return;
      }
      // Remove from mandatory if exists
      const updatedMandatory = newGroupForm.mandatoryClients.filter(c => c.id !== client.id);
      setNewGroupForm(prev => ({
        ...prev,
        optionalClients: [...prev.optionalClients, client],
        mandatoryClients: updatedMandatory
      }));
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
  const getAvailableClientsForLocation = (location) => {
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
      .filter(client => !groupedClientIds.has(client.id));
  };

  // Get groups for a specific location
  const getGroupsForLocation = (location) => {
    return clientGroups.filter(group => group.location === location);
  };

  // Get ungrouped clients for a location
  const getUngroupedClientsForLocation = (location) => {
    const locationClients = groupedClients[location] || [];
    const groupedClientIds = new Set();
    
    clientGroups
      .filter(group => group.location === location)
      .forEach(group => {
        group.groupClients.forEach(gc => {
          groupedClientIds.add(gc.client.id);
        });
      });
    
    return locationClients.filter(pc => !groupedClientIds.has(pc.client.id));
  };

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
    } catch (error) {
      console.error('Error removing client:', error);
      alert('Failed to remove client from project');
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

  // Filter clients based on search term
  const filteredGroupedClients = Object.entries(groupedClients).reduce((acc, [location, clients]) => {
    const filteredClients = clients.filter(pc =>
      pc.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pc.client.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pc.client.srcId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pc.client.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pc.client.languages?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filteredClients.length > 0) {
      acc[location] = filteredClients;
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <div>Loading project clients...</div>
      </div>
    );
  }

  return (
    <div className="clients-tab">
      {/* Header with Controls */}
      <div className="clients-header">
        <div>
          <h3>
            <Users />
            Client Management ({projectClients.length})
            {clientGroups.length > 0 && (
              <span className="stat-subtitle">{clientGroups.length} Groups</span>
            )}
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
          
          {projectClients.length > 0 && (
            <>
              <button
                onClick={handleAutoGroupClients}
                className="group-clients-btn"
              >
                <Settings />
                Auto Group All
              </button>
              
              {clientGroups.length > 0 && (
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

      {/* Search Bar */}
      <div className="search-bar">
        <Search />
        <input
          type="text"
          placeholder="Search clients by name, location, SRC ID, address, or language..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Location-based Client Display with Inline Groups */}
      <div className="client-management-container">
        {Object.keys(filteredGroupedClients).length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" />
            <h3 className="empty-title">
              {projectClients.length === 0 
                ? "Import clients from a CSV file to get started"
                : "No clients match your search criteria"
              }
            </h3>
            {projectClients.length === 0 && (
              <button
                onClick={() => setShowImporter(true)}
                className="create-first-btn"
              >
                <Upload />
                Import Clients
              </button>
            )}
          </div>
        ) : (
          Object.entries(filteredGroupedClients).map(([location, clients]) => {
            const locationGroups = getGroupsForLocation(location);
            const ungroupedClients = getUngroupedClientsForLocation(location);
            
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
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {locationStats[location] && (
                      <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                        Languages: {locationStats[location].languages.length} | 
                        Races: {locationStats[location].races.length} | 
                        Genders: {locationStats[location].genders.length}
                      </div>
                    )}
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
                              <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                                M: {group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3 | 
                                O: {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length}/2
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
                                <span style={{ width: '8px', height: '8px', backgroundColor: '#e53e3e', borderRadius: '50%', display: 'inline-block' }}></span>
                                Mandatory ({group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3)
                              </h6>
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
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            {/* Optional Clients */}
                            {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length > 0 && (
                              <div className="client-section">
                                <h6 className="section-title optional">
                                  <span style={{ width: '8px', height: '8px', backgroundColor: '#38a169', borderRadius: '50%', display: 'inline-block' }}></span>
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
                                    <span>{pc.client.gender}</span>
                                  </div>
                                )}
                                {pc.client.race && (
                                  <div className="client-detail-row">
                                    <Users />
                                    <span>{pc.client.race}</span>
                                  </div>
                                )}
                                <div className="client-detail-row">
                                  <MapPin />
                                  <span>{pc.client.address}</span>
                                </div>
                                {pc.client.languages && (
                                  <div className="client-detail-row">
                                    <span>Languages: {pc.client.languages}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Group Creator */}
                    {showGroupCreatorForLocation === location && (
                      <div style={{ border: '2px dashed #60a5fa', borderRadius: '0.5rem', padding: '1rem', backgroundColor: '#dbeafe', marginTop: '1rem' }}>
                        <h5 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '1rem' }}>
                          {editingGroup ? 'Edit Group' : 'Create New Group'} for {location}
                        </h5>
                        
                        {/* Group Name Input */}
                        <div className="form-group">
                          <label>Group Name *</label>
                          <input
                            type="text"
                            value={newGroupForm.name}
                            onChange={(e) => setNewGroupForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Group A, Morning Group, etc."
                          />
                        </div>

                        {/* Client Selection */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                          {/* Mandatory Clients */}
                          <div>
                            <h6 style={{ fontWeight: '500', color: '#1f2937', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ backgroundColor: '#ef4444', width: '12px', height: '12px', borderRadius: '50%' }}></span>
                              Mandatory Clients ({newGroupForm.mandatoryClients.length}/3)
                            </h6>
                            <div style={{ maxHeight: '8rem', overflowY: 'auto', marginBottom: '0.75rem' }}>
                              {newGroupForm.mandatoryClients.map((client) => (
                                <div key={client.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{client.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({client.srcId})</span>
                                    <button
                                      onClick={() => removeClientFromGroup(client.id, 'mandatory')}
                                      className="btn-icon"
                                      style={{ color: '#ef4444' }}
                                    >
                                      <X style={{ width: '12px', height: '12px' }} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Optional Clients */}
                          <div>
                            <h6 style={{ fontWeight: '500', color: '#1f2937', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ backgroundColor: '#3b82f6', width: '12px', height: '12px', borderRadius: '50%' }}></span>
                              Optional Clients ({newGroupForm.optionalClients.length}/2)
                            </h6>
                            <div style={{ maxHeight: '8rem', overflowY: 'auto', marginBottom: '0.75rem' }}>
                              {newGroupForm.optionalClients.map((client) => (
                                <div key={client.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{client.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({client.srcId})</span>
                                    <button
                                      onClick={() => removeClientFromGroup(client.id, 'optional')}
                                      className="btn-icon"
                                      style={{ color: '#3b82f6' }}
                                    >
                                      <X style={{ width: '12px', height: '12px' }} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Available Clients */}
                        <div style={{ marginBottom: '1rem' }}>
                          <h6 style={{ fontWeight: '500', color: '#1f2937', marginBottom: '0.5rem' }}>Available Clients</h6>
                          <div style={{ maxHeight: '10rem', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}>
                            {getAvailableClientsForLocation(location).length === 0 ? (
                              <div style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                                No available clients for this location
                              </div>
                            ) : (
                              getAvailableClientsForLocation(location).map((client) => (
                                <div key={client.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: '500' }}>{client.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                      {client.srcId} {client.gender && `• ${client.gender}`} {client.race && `• ${client.race}`}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => addClientToGroup(client, 'mandatory')}
                                      disabled={newGroupForm.mandatoryClients.length >= 3}
                                      style={{ 
                                        padding: '0.25rem 0.5rem', 
                                        backgroundColor: '#ef4444', 
                                        color: 'white', 
                                        fontSize: '0.75rem', 
                                        borderRadius: '0.25rem', 
                                        border: 'none',
                                        opacity: newGroupForm.mandatoryClients.length >= 3 ? 0.5 : 1,
                                        cursor: newGroupForm.mandatoryClients.length >= 3 ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      + Mandatory
                                    </button>
                                    <button
                                      onClick={() => addClientToGroup(client, 'optional')}
                                      disabled={newGroupForm.optionalClients.length >= 2}
                                      style={{ 
                                        padding: '0.25rem 0.5rem', 
                                        backgroundColor: '#3b82f6', 
                                        color: 'white', 
                                        fontSize: '0.75rem', 
                                        borderRadius: '0.25rem', 
                                        border: 'none',
                                        opacity: newGroupForm.optionalClients.length >= 2 ? 0.5 : 1,
                                        cursor: newGroupForm.optionalClients.length >= 2 ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      + Optional
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="modal-actions">
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
                Are you sure you want to remove all <strong>{projectClients.length} clients</strong> from this project?
              </p>
              <div className="warning-note">
                <p>
                  <strong>Warning:</strong> This action cannot be undone and will also remove all client groups.
                </p>
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
                      Remove All
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
