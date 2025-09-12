import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Users, Plus, Download, X, Settings, Filter } from 'lucide-react';
import VolunteerCSVImporter from './VolunteerCSVImporter';

const VolunteerDatabase = () => {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    language: '',
    experience: '',
    hasGroup: ''
  });

  useEffect(() => {
    loadVolunteers();
  }, []);

  const loadVolunteers = async () => {
    try {
      const response = await axios.get('/volunteers', { params: filters });
      setVolunteers(response.data);
    } catch (error) {
      console.error('Error loading volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVolunteers = volunteers.filter(volunteer =>
    `${volunteer.firstName} ${volunteer.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (volunteer.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImportComplete = () => {
    setShowImporter(false);
    loadVolunteers();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      region: '',
      language: '',
      experience: '',
      hasGroup: ''
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div className="text-gray-600">Loading volunteers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none w-full bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center text-2xl font-semibold text-gray-900 mb-2">
              <Users className="h-6 w-6 mr-3 text-blue-600" />
              Volunteer Database
            </h1>
            <p className="text-sm text-gray-600">
              Manage and view all volunteers • {volunteers.length} total volunteers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0">
            <button 
              onClick={() => setShowImporter(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Import Volunteers
            </button>
            
            <button className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* CSV Importer Section */}
      {showImporter && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Import Volunteers</h3>
            <button 
              onClick={() => setShowImporter(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <VolunteerCSVImporter onImportComplete={handleImportComplete} />
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search volunteers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {(searchTerm || Object.values(filters).some(Boolean)) && (
            <button
              onClick={clearFilters}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select 
            value={filters.region}
            onChange={(e) => setFilters({...filters, region: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Regions</option>
            <option value="Central">Central</option>
            <option value="East">East</option>
            <option value="West">West</option>
            <option value="North">North</option>
            <option value="South">South</option>
          </select>

          <select 
            value={filters.experience}
            onChange={(e) => setFilters({...filters, experience: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Experience</option>
            <option value="true">Experienced</option>
            <option value="false">No Experience</option>
          </select>

          <select 
            value={filters.hasGroup}
            onChange={(e) => setFilters({...filters, hasGroup: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Volunteers</option>
            <option value="true">Group Members</option>
            <option value="false">Individual</option>
          </select>

          {filteredVolunteers.length > 0 && (
            <div className="text-sm text-gray-600 ml-auto">
              Showing {filteredVolunteers.length} of {volunteers.length} volunteers
            </div>
          )}
        </div>
      </div>

      {/* Volunteers Grid */}
      <div className="space-y-6">
        {filteredVolunteers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVolunteers.map(volunteer => (
              <div 
                key={volunteer.id} 
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                {/* Volunteer Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {volunteer.firstName} {volunteer.lastName}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      {volunteer.isJoiningAsGroup && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users className="h-3 w-3 mr-1" />
                          Group
                        </span>
                      )}
                      {volunteer.hasExperience && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Settings className="h-3 w-3 mr-1" />
                          Experienced
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Volunteer Details */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Age:</span>
                      <p className="text-gray-900">{volunteer.age || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Contact:</span>
                      <p className="text-gray-900 truncate">{volunteer.contactNumber || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-500 text-sm">Email:</span>
                    <p className="text-gray-900 text-sm truncate">{volunteer.email || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-500 text-sm">Languages:</span>
                    <p className="text-gray-900 text-sm">
                      {volunteer.languages && volunteer.languages.length > 0 
                        ? volunteer.languages.join(', ') 
                        : 'Not specified'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-500 text-sm">Regions:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {volunteer.regions && volunteer.regions.length > 0 ? (
                        volunteer.regions.map((region, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {region}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-900 text-sm">Not specified</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium text-gray-500 text-sm">Available Days:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {volunteer.availableDays && volunteer.availableDays.length > 0 ? (
                        volunteer.availableDays.map((day, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-900 text-sm">Not specified</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Volunteer Footer */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Added by {volunteer.createdBy?.username || 'Unknown'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      volunteer.isPublic 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {volunteer.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {volunteers.length === 0 
                ? "No volunteers in database"
                : "No volunteers match your search criteria"
              }
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {volunteers.length === 0 
                ? "Import your first batch of volunteers to get started with managing your volunteer database."
                : "Try adjusting your search terms or filters to find the volunteers you're looking for."
              }
            </p>
            {volunteers.length === 0 ? (
              <button 
                onClick={() => setShowImporter(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <Plus className="h-5 w-5 mr-2" />
                Import Your First Volunteers
              </button>
            ) : (
              <button 
                onClick={clearFilters}
                className="inline-flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                <X className="h-5 w-5 mr-2" />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerDatabase;
