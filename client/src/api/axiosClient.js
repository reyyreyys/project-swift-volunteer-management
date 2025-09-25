import axios from 'axios';

// Debug log to confirm file is loading
console.log('🔧 apiClient.js loaded - setting up axios instance and interceptors');

// Create axios instance with baseURL from environment variable
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

console.log('📦 Axios instance created with baseURL:', apiClient.defaults.baseURL);

// Add request interceptor for auth token if needed
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Request interceptor - Token added to request:', config.url);
    } else {
      console.log('❌ Request interceptor - No token found for request:', config.url);
    }
    console.log('📤 Request interceptor - config:', config);
    return config;
  },
  (error) => {
    console.log('❌ Request interceptor - error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
let isLoggingOut = false;

apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ Response interceptor - success response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.log('🚨 Response interceptor - ERROR TRIGGERED!');
    console.log('Error object:', error);
    console.log('Error response:', error.response);
    console.log('Error status:', error?.response?.status);
    console.log('Error config URL:', error?.config?.url);
    
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.error || '';
    
    console.log('🔍 Checking conditions:', {
      status: status,
      errorMessage: errorMessage,
      isLoggingOut: isLoggingOut
    });
    
    // Check for token expiration (401/403 status or specific error message)
    const isTokenExpired = 
      status === 401 || 
      status === 403 || 
      /invalid|expired token/i.test(errorMessage);
    
    console.log('🔥 Token expiration check:', {
      isTokenExpired: isTokenExpired,
      status401: status === 401,
      status403: status === 403,
      messageMatch: /invalid|expired token/i.test(errorMessage),
      currentlyLoggingOut: isLoggingOut
    });
    
    if (isTokenExpired && !isLoggingOut) {
      console.log('🚨🚨 LOGOUT TRIGGERED - Token expired, starting logout process!');
      isLoggingOut = true;
      
      // Log current storage before clearing
      console.log('📦 Before clearing - Token:', localStorage.getItem('token'));
      console.log('📦 Before clearing - User:', localStorage.getItem('user'));
      
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      console.log('🗑️ Auth data cleared from localStorage');
      
      // Show alert for debugging
      alert('🚨 Token expired! Redirecting to login page...');
      
      // Reset the flag after a brief delay
      setTimeout(() => {
        isLoggingOut = false;
        console.log('🔄 Reset isLoggingOut flag');
      }, 1000);
      
      // Try multiple redirect methods
      console.log('🔄 Attempting to redirect to /login...');
      try {
        console.log('Method 1: Using window.location.assign("/login")');
        window.location.assign('/login');
      } catch (e) {
        console.log('❌ assign failed, trying href:', e);
        try {
          console.log('Method 2: Using window.location.href = "/login"');
          window.location.href = '/login';
        } catch (e2) {
          console.log('❌ href also failed:', e2);
          // Last resort
          console.log('Method 3: Using window.location.replace("/login")');
          window.location.replace('/login');
        }
      }
    } else {
      if (!isTokenExpired) {
        console.log('ℹ️ Not a token expiration error, continuing normally');
      }
      if (isLoggingOut) {
        console.log('ℹ️ Already in logout process, skipping duplicate logout');
      }
    }
    
    return Promise.reject(error);
  }
);

// Verify interceptors were added successfully
console.log('🔧 Interceptors setup complete. Count check:', {
  requestInterceptors: apiClient.interceptors.request.handlers.length,
  responseInterceptors: apiClient.interceptors.response.handlers.length
});

// Log export
console.log('📤 Exporting apiClient instance');

export default apiClient;
