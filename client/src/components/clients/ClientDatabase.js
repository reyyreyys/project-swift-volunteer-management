import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, UserCheck, Plus } from 'lucide-react';

const ClientDatabase = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await axios.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.srcId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="client-database">
      <div className="page-header">
        <h1>Client Database</h1>
        <button className="create-btn primary">
          <Plus size={16} />
          Import Clients
        </button>
      </div>

      <div className="filters-section">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="clients-grid">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div key={client.id} className="client-card">
              <div className="client-header">
                <h3>{client.name}</h3>
                <span className="client-id">{client.srcId}</span>
              </div>

              <div className="client-details">
                <p><strong>Gender:</strong> {client.gender}</p>
                <p><strong>Race:</strong> {client.race}</p>
                <p><strong>Languages:</strong> {client.languages}</p>
                <p><strong>Location:</strong> {client.location}</p>
                <p><strong>Address:</strong> {client.address}</p>
              </div>

              <div className="client-footer">
                <span className="created-by">
                  Added by {client.createdBy.username}
                </span>
                <span className={`public-badge ${client.isPublic ? 'public' : 'private'}`}>
                  {client.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <UserCheck size={64} />
            <h3>No clients found</h3>
            <p>Import your first batch of clients to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDatabase;
