// utils/nominatimService.js
const axios = require('axios');

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// User-Agent is required for Nominatim API
const headers = {
  'User-Agent': 'YourAppName/1.0 (reyes_ng1260@yahoo.com)'
};

const geocodeAddress = async (address) => {
  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      headers,
      params: {
        q: address,
        format: 'json',
        limit: 1,
        addressdetails: 1
      }
    });
    
    if (response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        display_name: result.display_name,
        address: result.address
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

const reverseGeocode = async (lat, lon) => {
  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
      headers,
      params: {
        lat,
        lon,
        format: 'json',
        addressdetails: 1
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Group clients by proximity
const groupClientsByProximity = (clients, maxDistanceKm = 2) => {
  const groups = [];
  const processed = new Set();
  
  for (const client of clients) {
    if (processed.has(client.id) || !client.coordinates) continue;
    
    const group = [client];
    processed.add(client.id);
    
    // Find nearby clients
    for (const otherClient of clients) {
      if (processed.has(otherClient.id) || !otherClient.coordinates) continue;
      
      const distance = calculateDistance(
        client.coordinates.lat,
        client.coordinates.lon,
        otherClient.coordinates.lat,
        otherClient.coordinates.lon
      );
      
      if (distance <= maxDistanceKm) {
        group.push(otherClient);
        processed.add(otherClient.id);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
};

// Export all functions using CommonJS syntax
module.exports = {
  geocodeAddress,
  reverseGeocode,
  calculateDistance,
  groupClientsByProximity
};
