import axios from 'axios';

// Create axios instance with baseURL from environment variable
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Add request interceptor for auth token if needed
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
let isLoggingOut = false;

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.error || '';
    
    // Check for token expiration (401/403 status or specific error message)
    const isTokenExpired = 
      status === 401 || 
      status === 403 || 
      /invalid|expired token/i.test(errorMessage);
    
    if (isTokenExpired && !isLoggingOut) {
      isLoggingOut = true;
      
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Reset the flag after a brief delay
      setTimeout(() => {
        isLoggingOut = false;
      }, 1000);
      
      // Force redirect to login page
      window.location.assign('/login');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
