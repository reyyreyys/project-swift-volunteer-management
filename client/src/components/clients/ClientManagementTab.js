import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Users, Upload, Search } from 'lucide-react';

const ClientManagementTab = ({ projectId, refreshKey, onImportComplete }) => {
  const [projectClients, setProjectClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedClients, setGroupedClients] = useState({});

  useEffect(() => {
    loadProjectClients();
  }, [projectId, refreshKey]);

  const loadProjectClients = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}/clients`);
      setProjectClients(response.data);
      
      // Group clients by location
      const grouped = response.data.reduce((acc, pc) => {
        const location = pc.client.location || 'Unknown Location';
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(pc.client);
        return acc;
      }, {});
      
      setGroupedClients(grouped);
    } catch (error) {
      console.error('Error loading project clients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="clients-tab">
      <div className="clients-header">
        <h3>Project Clients ({projectClients.length})</h3>
        <div className="header-actions">
          <button className="import-clients-btn">
            <Upload size={16} />
            Import Clients
          </button>
        </div>
      </div>

      {projectClients.length === 0 ? (
        <div className="clients-empty-state">
          <Users size={64} />
          <h3>No clients assigned to this project</h3>
          <p>Import clients from a CSV file to get started</p>
          <button className="import-clients-btn">
            <Upload size={16} />
            Import Clients
          </button>
        </div>
      ) : (
        <div className="clients-list">
          <div className="clients-summary">
            <div className="summary-header">
              <MapPin size={20} />
              <h3>Clients by Location</h3>
            </div>
          </div>

          {Object.entries(groupedClients).map(([location, clients]) => (
            <div key={location} className="location-group">
              <div className="location-header">
                <span>{location}</span>
                <span className="client-count">{clients.length}</span>
              </div>
              
              <div className="clients-in-location">
                {clients.map((client) => (
                  <div key={client.id} className="client-item">
                    <div className="client-info">
                      <div className="client-name">{client.name}</div>
                      <div className="client-details">
                        <span>ID: {client.srcId}</span>
                        {client.gender && <span>• {client.gender}</span>}
                        {client.race && <span>• {client.race}</span>}
                      </div>
                      <div className="client-details">
                        <span>Languages: {client.languages}</span>
                      </div>
                      <div className="client-address">{client.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientManagementTab;
