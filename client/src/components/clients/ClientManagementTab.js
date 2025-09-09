import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Users, Upload, Search, Trash2, AlertTriangle } from 'lucide-react';
import ClientCSVImporter from './ClientCSVImporter';

const ClientManagementTab = ({ projectId, refreshKey, onImportComplete }) => {
  const [projectClients, setProjectClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedClients, setGroupedClients] = useState({});
  const [showImporter, setShowImporter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);

  useEffect(() => {
    loadProjectClients();
  }, [projectId, refreshKey]);

  const loadProjectClients = async () => {
    try {
      // Add authentication headers
      const token = localStorage.getItem('token');
      const response = await axios.get(`/projects/${projectId}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setProjectClients(response.data);
      
      // Group clients by location
      const grouped = response.data.reduce((acc, pc) => {
        const location = pc.client.location || 'Unknown Location';
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push({
          ...pc.client,
          projectClientId: pc.id // Store the project-client relationship ID
        });
        return acc;
      }, {});
      
      setGroupedClients(grouped);
    } catch (error) {
      console.error('Error loading project clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportComplete = (result) => {
    loadProjectClients();
    setShowImporter(false);
    if (onImportComplete) {
      onImportComplete(result);
    }
  };

  const handleRemoveClient = async (clientId, projectClientId) => {
    if (!window.confirm('Are you sure you want to remove this client from the project?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      // Delete the project-client relationship
      await axios.delete(`/projects/${projectId}/project-clients/${projectClientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Reload the clients
      loadProjectClients();
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
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Reload the clients
        loadProjectClients();
        setShowRemoveAllModal(false);
        
        // Show success message
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
  const filteredClients = projectClients.filter(pc =>
    pc.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.client.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.client.srcId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.client.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.client.languages?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group filtered clients by location
  const filteredGroupedClients = filteredClients.reduce((acc, pc) => {
    const location = pc.client.location || 'Unknown Location';
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push({
      ...pc.client,
      projectClientId: pc.id
    });
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="clients-tab">
        <div className="clients-loading-container">
          <div className="clients-empty-state">
            <div className="spinner"></div>
            <h3>Loading clients...</h3>
            <p>Please wait while we load your project clients</p>
            <button 
              onClick={() => setShowImporter(true)}
              className="import-clients-btn"
            >
              <Upload size={16} />
              Import clients from a CSV file to get started
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clients-tab">
      {showImporter && (
        <ClientCSVImporter
          projectId={projectId}
          onImportComplete={handleImportComplete}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Remove All Clients Confirmation Modal */}
      {showRemoveAllModal && (
        <div className="modal-overlay">
          <div className="modal confirm-modal">
            <div className="modal-content">
              <div className="warning-icon">
                <AlertTriangle size={48} color="#e53e3e" />
              </div>
              <h2>Remove All Clients?</h2>
              <p>
                Are you sure you want to remove all <strong>{projectClients.length} clients</strong> from this project?
              </p>
              <div className="warning-note">
                <p><strong>Warning:</strong> This action cannot be undone. All client-project relationships will be permanently removed.</p>
              </div>
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowRemoveAllModal(false)}
                  disabled={removingAll}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn danger"
                  onClick={handleRemoveAllClients}
                  disabled={removingAll}
                >
                  {removingAll ? (
                    <>
                      <div className="spinner-small"></div>
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Remove All Clients
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="clients-header">
        <h3>Project Clients ({projectClients.length})</h3>
        
        <div className="header-actions">
          <div className="search-bar">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {projectClients.length > 0 && (
            <button 
              className="clear-btn danger"
              onClick={() => setShowRemoveAllModal(true)}
              title="Remove all clients from project"
            >
              <Trash2 size={16} />
              Remove All
            </button>
          )}
          
          <button 
            className="import-clients-btn"
            onClick={() => setShowImporter(true)}
          >
            <Upload size={18} />
            Import Clients
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Please wait while we load your project clients</p>
        </div>
      ) : Object.keys(filteredGroupedClients).length === 0 ? (
        <div className="clients-empty-state">
          <Users size={48} />
          <h3>No Clients Found</h3>
          <p>
            {projectClients.length === 0 
              ? "Import clients from a CSV file to get started"
              : "No clients match your search criteria"
            }
          </p>
          {projectClients.length === 0 && (
            <button 
              className="import-clients-btn"
              onClick={() => setShowImporter(true)}
            >
              <Upload size={18} />
              Import Clients
            </button>
          )}
        </div>
      ) : (
        <div className="clients-list">
          {Object.entries(filteredGroupedClients)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([location, clients]) => (
              <div key={location} className="location-group">
                <div className="location-header">
                  <MapPin size={20} />
                  {location}
                  <span className="client-count">{clients.length}</span>
                </div>
                
                <div className="location-clients-grid">
                  {clients.map((client) => (
                    <div key={client.id} className="client-card">
                      <div className="client-card-header">
                        <div className="client-name-section">
                          <h4>{client.name}</h4>
                          <div className="client-src-id">{client.srcId}</div>
                        </div>
                        <div className="client-actions">
                          <button
                            className="remove-client-btn"
                            onClick={() => handleRemoveClient(client.id, client.projectClientId)}
                            title="Remove from project"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="client-details-section">
                        {client.gender && (
                          <div className="client-detail-row">
                            <Users size={16} />
                            <span>{client.gender} • {client.race}</span>
                          </div>
                        )}
                        
                        {client.languages && (
                          <div className="client-detail-row">
                            <span>🗣️</span>
                            <span>{client.languages}</span>
                          </div>
                        )}
                        
                        {client.address && (
                          <div className="client-detail-row">
                            <MapPin size={16} />
                            <span>{client.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default ClientManagementTab;
