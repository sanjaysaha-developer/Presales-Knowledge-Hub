import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { proposalsAPI, templatesAPI } from '../services/api';

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    client_name: '',
    project_scope: '',
    price: '',
    currency: 'USD',
    payment_terms: '',
  });

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const response = await proposalsAPI.getAll();
      setProposals(response.data.proposals);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result || '';
      try {
        // Try to parse as JSON first (proposal data)
        const proposalData = JSON.parse(text);
        setForm((prev) => ({
          ...prev,
          title: proposalData.title || '',
          client_name: proposalData.client_name || '',
          project_scope: proposalData.project_scope || '',
          price: proposalData.price || '',
          currency: proposalData.currency || 'USD',
          payment_terms: proposalData.payment_terms || '',
        }));
      } catch {
        // If not JSON, treat as plain text for project_scope
        setForm((prev) => ({
          ...prev,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
          project_scope: typeof text === 'string' ? text : '',
        }));
      }
    };
    reader.readAsText(file);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      title: '',
      client_name: '',
      project_scope: '',
      price: '',
      currency: 'USD',
      payment_terms: '',
    });
    setShowUploader(false);
  };

  const submitProposal = async () => {
    if (!form.title || !form.client_name || !form.project_scope || !form.price) {
      alert('Please fill in title, client name, project scope, and price.');
      return;
    }
    setIsSubmitting(true);
    try {
      await proposalsAPI.create({
        title: form.title,
        client_name: form.client_name,
        project_scope: form.project_scope,
        price: parseFloat(form.price),
        currency: form.currency || 'USD',
        payment_terms: form.payment_terms || undefined,
      });
      resetForm();
      setLoading(true);
      await fetchProposals();
    } catch (error) {
      console.error('Failed to create proposal:', error);
      alert(error?.response?.data?.message || 'Failed to create proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Proposals</h1>
        <button
          type="button"
          onClick={() => setShowUploader((v) => !v)}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none"
        >
          {showUploader ? 'Close' : 'Upload Proposal'}
        </button>
      </div>


      {showUploader && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Website redesign proposal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Client Name</label>
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => updateField('client_name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Project Scope</label>
                <textarea
                  rows={3}
                  value={form.project_scope}
                  onChange={(e) => updateField('project_scope', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Brief description of scope, assumptions, and timeline"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="USD"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Payment Terms (optional)</label>
                <input
                  type="text"
                  value={form.payment_terms}
                  onChange={(e) => updateField('payment_terms', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="50% upfront, 50% on delivery"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Proposal File (.json, .txt)</label>
              <input
                type="file"
                accept=".json,.txt"
                onChange={onFileChange}
                className="mt-1 block w-full text-sm text-gray-700"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submitProposal}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Proposal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading proposals...</div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No proposals found.</div>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="block hover:bg-gray-50 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{proposal.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">Client: {proposal.client_name}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {proposal.currency} {proposal.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Created {new Date(proposal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        to={`/proposals/${proposal.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/contracts/generate?proposal=${proposal.id}`}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Generate Contract
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
