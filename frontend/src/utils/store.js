import { create } from 'zustand';

// Auth store
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

// Contracts store
export const useContractsStore = create((set) => ({
  contracts: [],
  selectedContract: null,
  loading: false,
  error: null,

  setContracts: (contracts) => set({ contracts }),
  setSelectedContract: (contract) => set({ selectedContract: contract }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// Proposals store
export const useProposalsStore = create((set) => ({
  proposals: [],
  selectedProposal: null,
  loading: false,
  error: null,

  setProposals: (proposals) => set({ proposals }),
  setSelectedProposal: (proposal) => set({ selectedProposal: proposal }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

// Templates store
export const useTemplatesStore = create((set) => ({
  templates: [],
  selectedTemplate: null,
  loading: false,
  error: null,

  setTemplates: (templates) => set({ templates }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
