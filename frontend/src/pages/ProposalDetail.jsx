import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { proposalsAPI } from '../services/api';

export default function ProposalDetail() {
  const { id } = useParams();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    try {
      const response = await proposalsAPI.getById(id);
      setProposal(response.data);
    } catch (error) {
      console.error('Failed to fetch proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (!proposal) return <div className="text-center py-12">Proposal not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/proposals" className="text-sm text-primary-600 hover:underline mb-2 inline-block">
            ← Back to Proposals
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{proposal.title}</h1>
        </div>
        <Link
          to={`/contracts/generate?proposal=${proposal.id}`}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
        >
          Generate Contract
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><dt className="font-medium text-gray-700">Client:</dt><dd className="mt-1">{proposal.client_name}</dd></div>
          <div><dt className="font-medium text-gray-700">Price:</dt><dd className="mt-1">{proposal.currency} {proposal.price.toLocaleString()}</dd></div>
          <div className="col-span-2"><dt className="font-medium text-gray-700">Scope:</dt><dd className="mt-1">{proposal.project_scope}</dd></div>
          <div><dt className="font-medium text-gray-700">Start Date:</dt><dd className="mt-1">{proposal.start_date || 'TBD'}</dd></div>
          <div><dt className="font-medium text-gray-700">End Date:</dt><dd className="mt-1">{proposal.end_date || 'TBD'}</dd></div>
          {proposal.deliverables && <div className="col-span-2"><dt className="font-medium text-gray-700">Deliverables:</dt><dd className="mt-1">{proposal.deliverables}</dd></div>}
          {proposal.sla_terms && <div className="col-span-2"><dt className="font-medium text-gray-700">SLA Terms:</dt><dd className="mt-1">{proposal.sla_terms}</dd></div>}
        </dl>
      </div>
    </div>
  );
}
