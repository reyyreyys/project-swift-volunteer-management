import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Users, Plus, Download } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading volunteers...</p>
      </div>
    );
  }

  return (
    <div className="volunteer-database">
      <div className="page-header">
        <h1>Volunteer Database</h1>
        <button 
          className="create-btn primary"
          onClick={() => setShowImporter(true)}
        >
          <Plus size={16} />
          Import Volunteers
        </button>
      </div>

      {showImporter && (
        <div className="importer-section">
          <VolunteerCSVImporter onImportComplete={handleImportComplete} />
          <button 
            className="close-importer-btn"
            onClick={() => setShowImporter(false)}
          >
            Cancel Import
          </button>
        </div>
      )}

      <div className="filters-section">
        <div className="search-bar">
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
            value={filters.region}
            onChange={(e) => setFilters({...filters, region: e.target.value})}
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
          >
            <option value="">All Experience</option>
            <option value="true">Experienced</option>
            <option value="false">No Experience</option>
          </select>
        </div>
      </div>

      <div className="volunteers-grid">
        {filteredVolunteers.length > 0 ? (
          filteredVolunteers.map(volunteer => (
            <div key={volunteer.id} className="volunteer-card">
              <div className="volunteer-header">
                <h3>{volunteer.firstName} {volunteer.lastName}</h3>
                <div className="volunteer-badges">
                  {volunteer.isJoiningAsGroup && (
                    <span className="badge group">Group</span>
                  )}
                  {volunteer.hasExperience && (
                    <span className="badge experience">Experienced</span>
                  )}
                </div>
              </div>

              <div className="volunteer-details">
                <p><strong>Age:</strong> {volunteer.age || 'N/A'}</p>
                <p><strong>Contact:</strong> {volunteer.contactNumber || 'N/A'}</p>
                <p><strong>Email:</strong> {volunteer.email || 'N/A'}</p>
                <p><strong>Languages:</strong> {volunteer.languages.join(', ')}</p>
                <p><strong>Regions:</strong> {volunteer.regions.join(', ')}</p>
                <p><strong>Available Days:</strong> {volunteer.availableDays.join(', ')}</p>
              </div>

              <div className="volunteer-footer">
                <span className="created-by">
                  Added by {volunteer.createdBy.username}
                </span>
                <span className={`public-badge ${volunteer.isPublic ? 'public' : 'private'}`}>
                  {volunteer.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Users size={64} />
            <h3>No volunteers found</h3>
            <p>Import your first batch of volunteers to get started</p>
            <button 
              className="create-first-btn"
              onClick={() => setShowImporter(true)}
            >
              Import Volunteers
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerDatabase;
