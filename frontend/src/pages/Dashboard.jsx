import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contractsAPI, proposalsAPI, templatesAPI } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    contracts: 0,
    proposals: 0,
    templates: 0,
  });
  const [recentContracts, setRecentContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [contractsRes, proposalsRes, templatesRes] = await Promise.all([
        contractsAPI.getAll({ limit: 5 }),
        proposalsAPI.getAll({ limit: 5 }),
        templatesAPI.getAll({ active_only: true }),
      ]);

      setStats({
        contracts: contractsRes.data.total,
        proposals: proposalsRes.data.total,
        templates: templatesRes.data.total,
      });

      setRecentContracts(contractsRes.data.contracts);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { name: 'Total Contracts', value: stats.contracts, link: '/contracts', color: 'bg-blue-500' },
    { name: 'Active Proposals', value: stats.proposals, link: '/proposals', color: 'bg-green-500' },
    { name: 'Templates', value: stats.templates, link: '/templates', color: 'bg-purple-500' },
  ];

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      signed: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/contracts/generate"
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md font-medium"
        >
          Generate Contract
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {statCards.map((card) => (
          <Link
            key={card.name}
            to={card.link}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${card.color} rounded-md p-3`}>
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{card.name}</dt>
                    <dd className="text-3xl font-semibold text-gray-900">{card.value}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Contracts</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {recentContracts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No contracts yet. <Link to="/contracts/generate" className="text-primary-600 hover:underline">Generate your first contract</Link>
            </p>
          ) : (
            <div className="space-y-4">
              {recentContracts.map((contract) => (
                <Link
                  key={contract.id}
                  to={`/contracts/${contract.id}`}
                  className="block hover:bg-gray-50 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{contract.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {contract.party_a} → {contract.party_b}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {contract.contract_number} • Created {new Date(contract.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        contract.status
                      )}`}
                    >
                      {contract.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Quick Actions</h4>
        <div className="space-y-2">
          <Link to="/proposals" className="block text-sm text-blue-700 hover:text-blue-900">
            → View all proposals and generate contracts
          </Link>
          <Link to="/templates" className="block text-sm text-blue-700 hover:text-blue-900">
            → Manage contract templates
          </Link>
          <Link to="/contracts" className="block text-sm text-blue-700 hover:text-blue-900">
            → View all contracts and validation results
          </Link>
        </div>
      </div>
    </div>
  );
}
