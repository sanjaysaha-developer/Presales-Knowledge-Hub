import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import ContractDetail from './pages/ContractDetail';
import Proposals from './pages/Proposals';
import ProposalDetail from './pages/ProposalDetail';
import Templates from './pages/Templates';
import GenerateContract from './pages/GenerateContract';

// Layout
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="contracts/generate" element={<GenerateContract />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="proposals/:id" element={<ProposalDetail />} />
        <Route path="templates" element={<Templates />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
