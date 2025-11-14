import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { contractsAPI } from '../services/api';

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchContract = async () => {
    try {
      const response = await contractsAPI.getById(id);
      setData(response.data);
      setValidation(response.data.validationResults?.[0]);
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const response = await contractsAPI.validate(id);
      setValidation(response.data.validation);
      alert('Contract validated successfully!');
    } catch (error) {
      console.error('Validation failed:', error);
      alert('Validation failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setValidating(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await contractsAPI.updateStatus(id, newStatus);
      await fetchContract();
      alert(`Contract status updated to: ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading contract...</div>;
  }

  if (!data?.contract) {
    return <div className="text-center py-12">Contract not found</div>;
  }

  const { contract, proposal } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/contracts" className="text-sm text-primary-600 hover:underline mb-2 inline-block">
            ← Back to Contracts
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{contract.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{contract.contract_number}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleValidate}
            disabled={validating || !contract.proposal_id}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md"
          >
            {validating ? 'Validating...' : 'Validate Contract'}
          </button>
          <select
            value={contract.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="signed">Signed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {validation && (
        <div className={`p-4 rounded-lg ${
          validation.status === 'pass' ? 'bg-green-50 border border-green-200' :
          validation.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <h3 className="font-semibold mb-2">Validation Result</h3>
          <p>Score: {(validation.overall_score * 100).toFixed(1)}% • Severity: {validation.severity}</p>
          {validation.checks && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">View Details</summary>
              <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(JSON.parse(validation.checks), null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Contract Details</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-medium text-gray-700">Party A:</dt><dd>{contract.party_a}</dd></div>
            <div><dt className="font-medium text-gray-700">Party B:</dt><dd>{contract.party_b}</dd></div>
            <div><dt className="font-medium text-gray-700">Status:</dt><dd className="capitalize">{contract.status.replace('_', ' ')}</dd></div>
            <div><dt className="font-medium text-gray-700">Created:</dt><dd>{new Date(contract.created_at).toLocaleString()}</dd></div>
          </dl>
        </div>

        {proposal && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Associated Proposal</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="font-medium text-gray-700">Title:</dt><dd>{proposal.title}</dd></div>
              <div><dt className="font-medium text-gray-700">Client:</dt><dd>{proposal.client_name}</dd></div>
              <div><dt className="font-medium text-gray-700">Price:</dt><dd>{proposal.currency} {proposal.price}</dd></div>
              <div>
                <Link to={`/proposals/${proposal.id}`} className="text-primary-600 hover:underline text-sm">
                  View Full Proposal →
                </Link>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Contract Content</h3>
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border border-gray-200 max-h-96 overflow-auto">
          {contract.content}
        </pre>
      </div>
    </div>
  );
}
