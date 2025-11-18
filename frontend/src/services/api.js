import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

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
