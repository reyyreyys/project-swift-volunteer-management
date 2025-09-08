// ClientManagementTab.js - Complete Version
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, Download, Users, MapPin, Search, Filter, Trash2 } from 'lucide-react';

const ClientManagementTab = ({ projectId, refreshKey, onImportComplete }) => {
  const [projectClients, setProjectClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [sortBy, setSortBy] = useState('location');

  // Get unique locations from clients (fixed)
  const locations = [...new Set(projectClients.map(pc => pc.client.location).filter(Boolean))];

  useEffect(() => {
    loadClients();
  }, [projectId, refreshKey]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/projects/${projectId}/clients`);
      
      // Sort by location then by name by default
      const sortedProjectClients = response.data.sort((a, b) => {
        const locationCompare = (a.client.location || 'Unknown').localeCompare(b.client.location || 'Unknown');
        if (locationCompare !== 0) return locationCompare;
        return a.client.name.localeCompare(b.client.name);
      });

      setProjectClients(sortedProjectClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fixed location stats function
  const getLocationStats = () => {
    const stats = {};
    projectClients.forEach(pc => {
      // Use the actual location field, not address
      const loc = pc.client.location || 'Unknown';
      stats[loc] = (stats[loc] || 0) + 1;
    });
    return stats;
  };

  const locationStats = getLocationStats();

  const handleImportCSV = async (csvData) => {
    try {
      const response = await axios.post('/clients/import-csv', {
        clients: csvData,
        projectId: projectId
      });
      
      if (response.data.success) {
        await loadClients();
        setShowImporter(false);
        onImportComplete?.(response.data);
        alert(`Successfully imported ${response.data.imported} clients`);
      }
    } catch (error) {
      alert('Failed to import clients: ' + (error.response?.data?.error || error.message));
    }
  };

  const filteredAndSortedClients = projectClients
    .filter(pc => {
      const matchesSearch = !searchTerm || 
        pc.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pc.client.srcId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pc.client.address.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesLocation = selectedLocation === 'all' || pc.client.location === selectedLocation;
      
      return matchesSearch && matchesLocation;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'location':
          const locationCompare = (a.client.location || 'Unknown').localeCompare(b.client.location || 'Unknown');
          if (locationCompare !== 0) return locationCompare;
          return a.client.name.localeCompare(b.client.name);
        case 'name':
          return a.client.name.localeCompare(b.client.name);
        case 'srcId':
          return a.client.srcId.localeCompare(b.client.srcId);
        default:
          return 0;
      }
    });

  // Helper function for location colors
  const getLocationColor = (location) => {
    const colors = {
      'Central': 'bg-blue-100 text-blue-800',
      'East': 'bg-green-100 text-green-800',
      'West': 'bg-purple-100 text-purple-800',
      'North': 'bg-yellow-100 text-yellow-800',
      'Northeast': 'bg-pink-100 text-pink-800',
      'South': 'bg-indigo-100 text-indigo-800',
      'North East': 'bg-pink-100 text-pink-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[location] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Client Management</h3>
          <p className="text-sm text-gray-600">
            {projectClients.length} clients across {locations.length} locations
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Location Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Clients by Location
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(locationStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([location, count]) => (
            <div key={location} className="text-center p-2 bg-white rounded border">
              <div className="font-semibold text-blue-600 text-lg">{count}</div>
              <div className="text-xs text-gray-600">{location}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients by name, SRC ID, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Locations</option>
          {locations.sort().map(location => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="location">Sort by Location</option>
          <option value="name">Sort by Name</option>
          <option value="srcId">Sort by SRC ID</option>
        </select>
      </div>

      {/* THE ACTUAL TABLE - This was missing! */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SRC ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Languages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedClients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || selectedLocation !== 'all' 
                      ? 'No clients match your filters' 
                      : 'No clients imported yet'
                    }
                  </td>
                </tr>
              ) : (
                filteredAndSortedClients.map((projectClient, index) => (
                  <tr key={projectClient.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {projectClient.client.srcId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {projectClient.client.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {projectClient.client.gender} • {projectClient.client.race}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLocationColor(projectClient.client.location)}`}>
                        <MapPin className="w-3 h-3 mr-1" />
                        {projectClient.client.location}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {projectClient.client.languages}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {projectClient.client.address}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Importer Modal */}
      {showImporter && (
        <ClientCSVImporter
          projectId={projectId}
          onImport={handleImportCSV}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
};

// CSV Importer Component (add this too)
const ClientCSVImporter = ({ projectId, onImport, onClose }) => {
  const [csvFile, setCsvFile] = useState(null);
  const [parsing, setParsing] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const parseCSV = async () => {
    if (!csvFile) return;

    setParsing(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const clients = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const client = {};
        
        headers.forEach((header, index) => {
          switch (header) {
            case 'SRC #':
              client.srcId = values[index] || '';
              break;
            case 'Name':
              client.name = values[index] || '';
              break;
            case 'Gender':
              client.gender = values[index] || '';
              break;
            case 'Race':
              client.race = values[index] || '';
              break;
            case 'Language Spoken':
              client.languages = values[index] || '';
              break;
            case 'Full Address':
              client.address = values[index] || '';
              break;
            case 'Location':
              client.location = values[index] || 'Unknown';
              break;
          }
        });
        
        return client;
      }).filter(client => client.name && client.srcId);

      onImport(clients);
    } catch (error) {
      alert('Error parsing CSV: ' + error.message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Import Client CSV</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={parseCSV}
              disabled={!csvFile || parsing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {parsing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientManagementTab;
