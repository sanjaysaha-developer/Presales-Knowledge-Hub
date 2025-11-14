import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { contractsAPI, proposalsAPI, templatesAPI } from '../services/api';

export default function GenerateContract() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposalIdFromUrl = searchParams.get('proposal');

  const [proposals, setProposals] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(proposalIdFromUrl || '');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [proposalsRes, templatesRes] = await Promise.all([
        proposalsAPI.getAll(),
        templatesAPI.getAll({ active_only: true }),
      ]);
      setProposals(proposalsRes.data.proposals);
      setTemplates(templatesRes.data.templates);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedProposal || !selectedTemplate) {
      setError('Please select both a proposal and a template');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await contractsAPI.generate({
        proposal_id: selectedProposal,
        template_id: selectedTemplate,
        options: { temperature: 0.3 },
      });

      const contractId = response.data.contract.id;
      alert('Contract generated successfully!');
      navigate(`/contracts/${contractId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate contract. Make sure Ollama is running.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Generate Contract</h1>

      <form onSubmit={handleGenerate} className="bg-white shadow rounded-lg p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Proposal
          </label>
          <select
            value={selectedProposal}
            onChange={(e) => setSelectedProposal(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            required
          >
            <option value="">-- Choose a proposal --</option>
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.client_name}) - {p.currency} {p.price.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            required
          >
            <option value="">-- Choose a template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.contract_type}) - v{t.version}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Contract generation uses RAG (Retrieval-Augmented Generation) to create
            a draft based on the selected proposal and template. The system will retrieve relevant clauses
            from the knowledge base and use the Ollama LLM to generate the contract.
          </p>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={generating}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            {generating ? 'Generating Contract...' : 'Generate Contract'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
