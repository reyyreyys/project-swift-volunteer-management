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
      <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-gray-600">Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none w-full bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Client Database</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus size={16} />
          Import Clients
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search clients by name, SRC ID, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredClients.length > 0 ? (
          filteredClients.map(client => (
            <div key={client.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              {/* Client Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{client.name}</h3>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                  {client.srcId}
                </span>
              </div>

              {/* Client Details */}
              <div className="space-y-3 mb-4">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Gender:</span>
                  <span className="ml-2 text-gray-600">{client.gender || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Race:</span>
                  <span className="ml-2 text-gray-600">{client.race || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Languages:</span>
                  <span className="ml-2 text-gray-600">{client.languages || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Location:</span>
                  <span className="ml-2 text-gray-600">{client.location || 'N/A'}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Address:</span>
                  <span className="ml-2 text-gray-600 break-words">{client.address || 'N/A'}</span>
                </div>
              </div>

              {/* Client Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  Added by {client.createdBy?.username || 'Unknown'}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                  client.isPublic 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {client.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <UserCheck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
            <p className="text-gray-600 mb-4">
              {clients.length === 0 
                ? "Import your first batch of clients to get started"
                : "No clients match your search criteria"
              }
            </p>
            {clients.length === 0 && (
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                <Plus size={16} />
                Import Clients
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {filteredClients.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Showing {filteredClients.length} of {clients.length} clients
          </p>
        </div>
      )}
    </div>
  );
};

export default ClientDatabase;
