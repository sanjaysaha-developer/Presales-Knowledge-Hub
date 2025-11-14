import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { proposalsAPI } from '../services/api';

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Proposals</h1>

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
