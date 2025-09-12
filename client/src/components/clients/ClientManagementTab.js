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
  const [autoGroupingInProgress, setAutoGroupingInProgress] = useState(false);
  const [useGeolocationGrouping, setUseGeolocationGrouping] = useState(false);
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
  if (!window.confirm(`This will create optimized client groups using ${useGeolocationGrouping ? 'geolocation proximity' : 'location names'}. Any existing groups will be cleared first. Continue?`)) {
    return;
  }
  
  setAutoGroupingInProgress(true);
  
  try {
    const token = localStorage.getItem('token');
    
    const response = await axios.post(`/projects/${projectId}/clients/auto-group-enhanced`, {
      useGeocoding: useGeolocationGrouping, // Pass the toggle state
      maxDistance: 2 // You can also make this configurable
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data.success) {
      await Promise.all([
        loadClientGroups(),
        loadProjectClients()
      ]);
      
      const { groupsCreated, clientsGrouped, locations } = response.data;
      const method = useGeolocationGrouping ? 'geolocation proximity' : 'location names';
      alert(
        `Auto-grouping completed successfully using ${method}!\n\n` +
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
  } finally {
    setAutoGroupingInProgress(false);
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
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <div className="text-gray-600">Loading project clients...</div>
      </div>
    );
  }

  const totalClients = projectClients.length;
  const totalGroups = clientGroups.length;
  const totalLocations = Object.keys(groupedClients).length;

return (
    <div className="p-6 max-w-none w-full bg-gray-50 min-h-screen">
      
      {/* Auto-grouping Loading Modal */}
      {autoGroupingInProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
              <Settings className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Auto-Generating Groups</h2>
            </div>
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-800 mb-2">
                Creating optimized client groups based on location...
              </p>
              <p className="text-sm text-gray-600">
                This may take a few moments depending on the number of clients.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced Header with Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center text-xl font-semibold text-gray-900 mb-2">
              <Users className="h-5 w-5 mr-2" />
              Client Management ({totalClients})
            </h3>
            <div className="text-sm text-gray-600">
              {totalLocations} Locations • {totalGroups} Groups
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0">
            <button
              onClick={() => setShowImporter(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </button>
            
            {totalClients > 0 && (
              <>
                {/* Grouping Method Selector */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Grouping Method</h4>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGeolocationGrouping}
                      onChange={(e) => setUseGeolocationGrouping(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Use GPS/Geolocation-based grouping</span>
                  </label>
                  <div className="text-xs text-gray-500 mt-1">
                    {useGeolocationGrouping 
                      ? "Groups clients based on geographic proximity using address coordinates" 
                      : "Groups clients based on their assigned location names (Central, East, West, etc.)"
                    }
                  </div>
                </div>

                <button
                  onClick={handleAutoGroupClients}
                  disabled={loading || autoGroupingInProgress}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {autoGroupingInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Auto Group All ({useGeolocationGrouping ? 'GPS' : 'Location'})
                    </>
                  )}
                </button>

                {totalGroups > 0 && (
                  <button
                    onClick={handleDeleteAllGroups}
                    className="inline-flex items-center px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    <Grid className="h-4 w-4 mr-2" />
                    Clear All Groups
                  </button>
                )}
                
                <button
                  onClick={() => setShowRemoveAllModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove All
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search clients by name, location, SRC ID, address, or language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {(searchTerm || filterByLocation) && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={filterByLocation}
            onChange={(e) => setFilterByLocation(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="location">Sort by Location</option>
            <option value="count">Sort by Client Count</option>
            <option value="name">Sort by Name</option>
          </select>

          <button
            onClick={toggleAllLocations}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={Object.values(expandedLocations).every(Boolean) ? "Collapse All" : "Expand All"}
          >
            {Object.values(expandedLocations).every(Boolean) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {Object.keys(filteredAndSortedClients).length > 0 && (
            <div className="text-sm text-gray-600">
              Showing {Object.keys(filteredAndSortedClients).length} of {totalLocations} locations
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-6">
          {Object.entries(errors).map(([key, error]) => (
            <div key={key} className="flex items-center p-4 mb-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          ))}
        </div>
      )}

      {/* Location-based Client Display with Enhanced Groups */}
      <div className="space-y-6">
        {Object.keys(filteredAndSortedClients).length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {totalClients === 0 
                ? "Import clients from a CSV file to get started"
                : "No clients match your search criteria"
              }
            </h3>
            {totalClients === 0 && (
              <button
                onClick={() => setShowImporter(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors mt-4"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Clients
              </button>
            )}
            {totalClients > 0 && (
              <button
                onClick={clearSearch}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors mt-4"
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
              <div key={location} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div 
                  className="p-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleLocationExpansion(location)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {expandedLocations[location] ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-gray-900">{location}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                        {clients.length} clients
                      </span>
                      {locationGroups.length > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                          {locationGroups.length} groups
                        </span>
                      )}
                      {ungroupedClients.length > 0 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                          {ungroupedClients.length} ungrouped
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span title="Languages">🗣️ {stats.languages || 0}</span>
                        <span title="Races">👥 {stats.races || 0}</span>
                        <span title="Genders">⚧ {stats.genders || 0}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openGroupCreatorForLocation(location);
                        }}
                        className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                        title="Create group for this location"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {expandedLocations[location] && (
                  <div className="p-6">
                    {/* Enhanced Location Statistics */}
                    {stats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Total Clients</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{locationGroups.length}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Groups</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{ungroupedClients.length}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Ungrouped</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{stats.languages}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">Languages</div>
                        </div>
                      </div>
                    )}

                    {/* Existing Groups for this Location */}
                    {locationGroups.map((group) => (
                      <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div 
                          className="p-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleGroupExpansion(group.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {expandedGroups[group.id] ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                              <Grid className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="font-medium text-gray-900">{group.name}</div>
                                <div className="flex items-center space-x-4 text-sm text-gray-600">
                                  <span>M: {group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3</span>
                                  <span>O: {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length}/2</span>
                                  <span>Total: {group.groupClients.length}/5</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openGroupEditor(group);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="Edit group"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(group.id);
                                }}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Delete group"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {expandedGroups[group.id] && (
                          <div className="p-4">
                            {/* Mandatory Clients */}
                            <div className="mb-6">
                              <h6 className="flex items-center text-sm font-medium text-red-700 mb-3">
                                <UserCheck className="h-4 w-4 mr-2" />
                                Mandatory ({group.groupClients.filter(gc => gc.type === 'MANDATORY').length}/3)
                              </h6>
                              {group.groupClients.filter(gc => gc.type === 'MANDATORY').length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {group.groupClients
                                    .filter(gc => gc.type === 'MANDATORY')
                                    .sort((a, b) => a.priority - b.priority)
                                    .map((gc) => (
                                      <div key={gc.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="font-medium text-gray-900">{gc.client.name}</h4>
                                          <span className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-medium">
                                            Mandatory
                                          </span>
                                        </div>
                                        <div className="text-xs text-blue-600 font-medium mb-2">({gc.client.srcId})</div>
                                        <div className="space-y-1 text-sm text-gray-600">
                                          {gc.client.gender && (
                                            <div className="flex items-center">
                                              <Users className="h-3 w-3 mr-1" />
                                              <span>{gc.client.gender}</span>
                                            </div>
                                          )}
                                          <div className="flex items-start">
                                            <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                            <span className="break-words">{gc.client.address}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="text-gray-500 italic text-sm">
                                  No mandatory clients assigned
                                </div>
                              )}
                            </div>

                            {/* Optional Clients */}
                            {group.groupClients.filter(gc => gc.type === 'OPTIONAL').length > 0 && (
                              <div>
                                <h6 className="flex items-center text-sm font-medium text-blue-700 mb-3">
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Optional ({group.groupClients.filter(gc => gc.type === 'OPTIONAL').length}/2)
                                </h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {group.groupClients
                                    .filter(gc => gc.type === 'OPTIONAL')
                                    .sort((a, b) => a.priority - b.priority)
                                    .map((gc) => (
                                      <div key={gc.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <h4 className="font-medium text-gray-900">{gc.client.name}</h4>
                                          <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full font-medium">
                                            Optional
                                          </span>
                                        </div>
                                        <div className="text-xs text-blue-600 font-medium mb-2">({gc.client.srcId})</div>
                                        <div className="space-y-1 text-sm text-gray-600">
                                          {gc.client.gender && (
                                            <div className="flex items-center">
                                              <Users className="h-3 w-3 mr-1" />
                                              <span>{gc.client.gender}</span>
                                            </div>
                                          )}
                                          <div className="flex items-start">
                                            <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                            <span className="break-words">{gc.client.address}</span>
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
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="flex items-center font-medium text-gray-900">
                            <Users className="h-4 w-4 mr-2 text-gray-500" />
                            Ungrouped Clients ({ungroupedClients.length})
                          </h5>
                          <button
                            onClick={() => openGroupCreatorForLocation(location)}
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Group These
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ungroupedClients.map((pc) => (
                            <div key={pc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900">{pc.client.name}</h4>
                                <button
                                  onClick={() => handleRemoveClient(pc.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                  title="Remove from project"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="text-sm text-blue-600 font-medium mb-2">{pc.client.srcId}</div>
                              <div className="space-y-1 text-sm text-gray-600">
                                {pc.client.gender && (
                                  <div className="flex items-center">
                                    <Users className="h-3 w-3 mr-1" />
                                    <span>
                                      {pc.client.gender} 
                                      {pc.client.race && ` • ${pc.client.race}`}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-start">
                                  <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                                  <span className="break-words">{pc.client.address}</span>
                                </div>
                                {pc.client.languages && (
                                  <div className="flex items-center">
                                    <Globe className="h-3 w-3 mr-1" />
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
                      <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-lg font-medium text-gray-900">
                            {editingGroup ? 'Edit Group' : 'Create New Group'} for {location}
                          </h5>
                          <button
                            onClick={() => setShowGroupCreatorForLocation(null)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        
                        {/* Group Name Input */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group Name *
                            {errors.name && <span className="text-red-600 ml-2">{errors.name}</span>}
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
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                              errors.name ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                        </div>

                        {/* Client Selection Grid */}
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                          {/* Mandatory Clients */}
                          <div>
                            <h6 className="flex items-center text-sm font-medium text-red-700 mb-3">
                              <UserCheck className="h-4 w-4 mr-2" />
                              Mandatory Clients ({newGroupForm.mandatoryClients.length}/3)
                              {errors.mandatory && <span className="text-red-600 ml-2">{errors.mandatory}</span>}
                            </h6>
                            <div className="min-h-32 border-2 border-dashed border-red-300 rounded-lg p-3 bg-red-50">
                              {newGroupForm.mandatoryClients.length === 0 ? (
                                <div className="text-sm text-gray-500 italic text-center py-8">
                                  Select mandatory clients from the list below
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {newGroupForm.mandatoryClients.map((client) => (
                                    <div key={client.id} className="flex items-center justify-between p-2 bg-white rounded border border-red-200">
                                      <div>
                                        <span className="font-medium text-gray-900">{client.name}</span>
                                        <span className="text-sm text-gray-500 ml-2">({client.srcId})</span>
                                      </div>
                                      <button
                                        onClick={() => removeClientFromGroup(client.id, 'mandatory')}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Optional Clients */}
                          <div>
                            <h6 className="flex items-center text-sm font-medium text-blue-700 mb-3">
                              <UserMinus className="h-4 w-4 mr-2" />
                              Optional Clients ({newGroupForm.optionalClients.length}/2)
                              {errors.optional && <span className="text-red-600 ml-2">{errors.optional}</span>}
                            </h6>
                            <div className="min-h-32 border-2 border-dashed border-blue-300 rounded-lg p-3 bg-blue-50">
                              {newGroupForm.optionalClients.length === 0 ? (
                                <div className="text-sm text-gray-500 italic text-center py-8">
                                  Optionally select additional clients
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {newGroupForm.optionalClients.map((client) => (
                                    <div key={client.id} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                                      <div>
                                        <span className="font-medium text-gray-900">{client.name}</span>
                                        <span className="text-sm text-gray-500 ml-2">({client.srcId})</span>
                                      </div>
                                      <button
                                        onClick={() => removeClientFromGroup(client.id, 'optional')}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Available Clients */}
                        <div className="mb-6">
                          <h6 className="text-sm font-medium text-gray-900 mb-3">Available Clients for {location}</h6>
                          <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                            {getAvailableClientsForLocation(location).length === 0 ? (
                              <div className="p-4 text-center text-gray-500">
                                No available clients for this location
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-200">
                                {getAvailableClientsForLocation(location).map((client) => (
                                  <div key={client.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{client.name}</div>
                                      <div className="text-sm text-gray-500">
                                        {client.srcId} 
                                        {client.gender && ` • ${client.gender}`} 
                                        {client.race && ` • ${client.race}`}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => addClientToGroup(client, 'mandatory')}
                                        disabled={newGroupForm.mandatoryClients.length >= 3}
                                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Add as mandatory"
                                      >
                                        + M
                                      </button>
                                      <button
                                        onClick={() => addClientToGroup(client, 'optional')}
                                        disabled={newGroupForm.optionalClients.length >= 2}
                                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Add as optional"
                                      >
                                        + O
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => setShowGroupCreatorForLocation(null)}
                            disabled={creatingGroup}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateOrUpdateGroup}
                            disabled={creatingGroup || !newGroupForm.name.trim() || newGroupForm.mandatoryClients.length === 0}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {creatingGroup ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                {editingGroup ? 'Updating...' : 'Creating...'}
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Remove All Clients</h2>
              <button
                className="ml-auto p-1 text-gray-400 hover:text-gray-600"
                onClick={() => setShowRemoveAllModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to remove all <strong>{totalClients} clients</strong> from this project?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 font-medium mb-2">
                  <strong>Warning:</strong> This action cannot be undone and will:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 ml-4">
                  <li>• Remove all clients from this project</li>
                  <li>• Delete all client groups</li>
                  <li>• Remove any assignments involving these clients</li>
                </ul>
              </div>
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowRemoveAllModal(false)}
                  disabled={removingAll}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveAllClients}
                  disabled={removingAll}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {removingAll ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
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
