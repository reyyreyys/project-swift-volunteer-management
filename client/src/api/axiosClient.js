import axios from 'axios';

// Create axios instance with baseURL from environment variable
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
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
    console.log('Request interceptor - config:', config); // Debug log
    return config;
  },
  (error) => {
    console.log('Request interceptor - error:', error); // Debug log
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
let isLoggingOut = false;

apiClient.interceptors.response.use(
  (response) => {
    console.log('Response interceptor - success:', response); // Debug log
    return response;
  },
  (error) => {
    console.log('Response interceptor - error triggered:', error); // Debug log
    console.log('Error response:', error.response); // Debug log
    console.log('Error status:', error?.response?.status); // Debug log
    
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.error || '';
    
    console.log('Checking conditions - status:', status, 'errorMessage:', errorMessage); // Debug log
    
    // Check for token expiration (401/403 status or specific error message)
    const isTokenExpired = 
      status === 401 || 
      status === 403 || 
      /invalid|expired token/i.test(errorMessage);
    
    console.log('Is token expired:', isTokenExpired, 'Is logging out:', isLoggingOut); // Debug log
    
    if (isTokenExpired && !isLoggingOut) {
      console.log('LOGGING OUT - clearing token and redirecting'); // Debug log
      isLoggingOut = true;
      
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Reset the flag after a brief delay
      setTimeout(() => {
        isLoggingOut = false;
      }, 1000);
      
      // Try multiple redirect methods
      try {
        // Method 1: window.location.assign
        window.location.assign('/login');
      } catch (e) {
        console.log('assign failed, trying href:', e);
        // Method 2: window.location.href
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
