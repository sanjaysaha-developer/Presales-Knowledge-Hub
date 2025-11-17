import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token (disabled for now)
api.interceptors.request.use(
  (config) => {
    // Temporarily disabled authentication - remove when backend auth is enabled
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Avoid redirect loops: surface the error and let views decide.
      // Do not clear token automatically; some endpoints may be public or fail transiently.
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Contracts API
export const contractsAPI = {
  getAll: (params) => api.get('/contracts', { params }),
  getById: (id) => api.get(`/contracts/${id}`),
  generate: (data) => api.post('/contracts/generate', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  updateStatus: (id, status) => api.put(`/contracts/${id}/status`, { status }),
  validate: (id) => api.post(`/contracts/${id}/validate`),
  delete: (id) => api.delete(`/contracts/${id}`),
};

// Proposals API
export const proposalsAPI = {
  getAll: (params) => api.get('/proposals', { params }),
  getById: (id) => api.get(`/proposals/${id}`),
  create: (data) => api.post('/proposals', data),
  update: (id, data) => api.put(`/proposals/${id}`, data),
  delete: (id) => api.delete(`/proposals/${id}`),
};

// Templates API
export const templatesAPI = {
  getAll: (params) => api.get('/templates', { params }),
  getById: (id) => api.get(`/templates/${id}`),
  preview: (id) => api.get(`/templates/${id}/preview`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  approve: (id) => api.put(`/templates/${id}/approve`),
  delete: (id) => api.delete(`/templates/${id}`),
};

export default api;
