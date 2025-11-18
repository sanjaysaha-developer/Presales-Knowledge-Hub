import { create } from 'zustand';

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
