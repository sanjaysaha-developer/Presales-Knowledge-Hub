import express from 'express';
import { Contract, Proposal, Template, ValidationResult, AuditLog } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import ragService from '../services/ragService.js';
import validationService from '../services/validationService.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient.js';

const router = express.Router();

/**
 * GET /api/contracts
 * Get all contracts
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    // Return mock contract data when Supabase is disabled
    if (!process.env.SUPABASE_URL) {
      const mockContracts = [];

      let contracts = mockContracts;
      if (status) {
        contracts = mockContracts.filter(c => c.status === status);
      }

      // Apply pagination
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      contracts = contracts.slice(startIndex, endIndex);

      return res.json({
        contracts,
        total: mockContracts.length,
      });
    }

    // Supabase path
    let query = supabase.from('contracts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ contracts: data || [], total: count || (data ? data.length : 0) });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch contracts',
      message: error.message,
    });
  }
});

/**
 * GET /api/contracts/:id
 * Get a single contract
 */
router.get('/:id', async (req, res) => {
  try {
    // Return mock data when Supabase is disabled
    if (!process.env.SUPABASE_URL) {
      return res.status(404).json({
        error: 'Contract not found',
      });
    }

    // Supabase path
    const { data: contract, error } = await supabase.from('contracts').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const { data: template } = await supabase.from('templates').select('*').eq('id', contract.template_id).single();
    // Proposal could be migrated later; keep null if not in Supabase yet
    const proposal = contract.proposal_id ? await supabase.from('proposals').select('*').eq('id', contract.proposal_id).single().then(({ data }) => data) : null;
    const validationResults = [];

    return res.json({ contract, template, proposal, validationResults });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch contract',
      message: error.message,
    });
  }
});

/**
 * POST /api/contracts/generate
 * Generate a new contract from template and proposal
 */
router.post('/generate', async (req, res) => {
  try {
    const { template_id, proposal_id, options } = req.body;

    if (!template_id || !proposal_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'template_id and proposal_id are required',
      });
    }

    // Get template and proposal - using mock data since SQLite is disabled
    // const template = Template.findById(template_id);
    // const proposal = Proposal.findById(proposal_id);

    // Mock template data
    const mockTemplates = {
      'msa-template': {
        id: 'msa-template',
        name: 'Master Services Agreement',
        contract_type: 'MSA',
        content: `MASTER SERVICES AGREEMENT

This Master Services Agreement is entered into as of {{EffectiveDate}} between {{PartyA}} and {{PartyB}}.

SCOPE: {{Scope}}
DELIVERABLES: {{Deliverables}}
PRICE: {{Price}}
PAYMENT TERMS: {{PaymentTerms}}
TERM: {{StartDate}} to {{EndDate}}
SLA: {{SLA}}`,
        placeholders: [
          { name: 'PartyA', type: 'text', required: true },
          { name: 'PartyB', type: 'text', required: true },
          { name: 'EffectiveDate', type: 'date', required: true },
          { name: 'Scope', type: 'textarea', required: true },
          { name: 'Deliverables', type: 'textarea', required: true },
          { name: 'Price', type: 'number', required: true },
          { name: 'PaymentTerms', type: 'text', required: true },
          { name: 'StartDate', type: 'date', required: true },
          { name: 'EndDate', type: 'date', required: true },
          { name: 'SLA', type: 'textarea', required: false },
        ],
      },
    };

    // Mock proposal data (same as in proposals routes)
    const mockProposals = {
      'mock-1': {
        id: 'mock-1',
        title: 'Enterprise Software Development',
        client_name: 'Acme Corporation',
        project_scope: 'Development of a custom CRM system with integrations to existing ERP, including mobile applications for iOS and Android. The system will support up to 1000 concurrent users and include advanced reporting and analytics capabilities.',
        price: 125000,
        currency: 'USD',
        payment_terms: 'Net 30, with 50% upfront, 30% at milestone completion, 20% upon final delivery',
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      'mock-2': {
        id: 'mock-2',
        title: 'Cloud Infrastructure Migration',
        client_name: 'TechStart Inc.',
        project_scope: 'Migration of on-premise infrastructure to AWS cloud, including database migration, application containerization, and setup of CI/CD pipelines.',
        price: 85000,
        currency: 'USD',
        payment_terms: 'Net 30, quarterly payments',
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    const template = mockTemplates[template_id];
    const proposal = mockProposals[proposal_id];

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Generate contract using RAG
    const result = await ragService.generateContract(proposal, template, options);

    // Create contract record - disabled database operations, return mock response
    // if (process.env.SUPABASE_URL) {
    //   const contractId = uuidv4();
    //   const { data: countRes } = await supabase.rpc('next_contract_sequence', {});
    //   const contractNumber = countRes || `CNT-${new Date().getFullYear()}-0001`;
    //   const insert = {
    //     id: contractId,
    //     template_id,
    //     proposal_id,
    //     contract_number: contractNumber,
    //     title: proposal.title,
    //     party_a: proposal.client_name,
    //     party_b: 'Service Provider',
    //     content: result.contract,
    //     status: 'draft',
    //     generated_by: req.user.id,
    //     created_by: req.user.id,
    //   };
    //   const { data, error } = await supabase.from('contracts').insert(insert).select('*').single();
    //   if (error) throw error;
    //
    //   AuditLog.log('contract', contractId, 'generate', { template_id, proposal_id, citations: result.citations.length }, req.user.id);
    //   return res.status(201).json({ contract: data, citations: result.citations, metadata: result.metadata });
    // } else {
    //   const contract = Contract.create({
    //     id: uuidv4(),
    //     template_id,
    //     proposal_id,
    //     contract_number: Contract.generateContractNumber(),
    //     title: proposal.title,
    //     party_a: proposal.client_name,
    //     party_b: 'Service Provider', // TODO: Get from config
    //     content: result.contract,
    //     status: 'draft',
    //     generated_by: req.user.id,
    //     created_by: req.user.id,
    //   });
    //
    //   // Log the action
    //   AuditLog.log('contract', contract.id, 'generate', {
    //   //   template_id,
    //   //   proposal_id,
    //   //   citations: result.citations.length,
    //   // }, req.user.id);
    //
    //   res.status(201).json({
    //     contract,
    //     citations: result.citations,
    //     metadata: result.metadata,
    //   });
    // }

    // Create contract record
    if (process.env.SUPABASE_URL) {
      const contractId = uuidv4();
      const { data: countRes } = await supabase.rpc('next_contract_sequence', {});
      const contractNumber = countRes || `CNT-${new Date().getFullYear()}-0001`;
      const insert = {
        id: contractId,
        template_id,
        proposal_id,
        contract_number: contractNumber,
        title: proposal.title,
        party_a: proposal.client_name,
        party_b: 'Service Provider',
        content: result.contract,
        status: 'draft',
        generated_by: req.user.id,
        created_by: req.user.id,
      };
      const { data, error } = await supabase.from('contracts').insert(insert).select('*').single();
      if (error) throw error;

      AuditLog.log('contract', contractId, 'generate', { template_id, proposal_id, citations: result.citations.length }, req.user.id);
      return res.status(201).json({ contract: data, citations: result.citations, metadata: result.metadata });
    } else {
      const contract = Contract.create({
        id: uuidv4(),
        template_id,
        proposal_id,
        contract_number: Contract.generateContractNumber(),
        title: proposal.title,
        party_a: proposal.client_name,
        party_b: 'Service Provider',
        content: result.contract,
        status: 'draft',
        generated_by: req.user.id,
        created_by: req.user.id,
      });

      AuditLog.log('contract', contract.id, 'generate', {
        template_id,
        proposal_id,
        citations: result.citations.length,
      }, req.user.id);

      res.status(201).json({
        contract,
        citations: result.citations,
        metadata: result.metadata,
      });
    }
  } catch (error) {
    console.error('Contract generation error:', error);
    res.status(500).json({
      error: 'Failed to generate contract',
      message: error.message,
    });
  }
});

/**
 * POST /api/contracts/:id/validate
 * Validate a contract against its proposal
 */
router.post('/:id/validate', authenticate, async (req, res) => {
  try {
    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!contract.proposal_id) {
      return res.status(400).json({
        error: 'No proposal associated with this contract',
      });
    }

    const proposal = Proposal.findById(contract.proposal_id);

    // Perform validation
    const validationResult = await validationService.validateContract(
      contract.content,
      proposal
    );

    // Save validation result
    const result = ValidationResult.create({
      id: uuidv4(),
      contract_id: contract.id,
      proposal_id: proposal.id,
      overall_score: validationResult.overall_score,
      checks: JSON.stringify(validationResult.checks),
      mismatches: JSON.stringify(validationResult.mismatches),
      severity: validationResult.severity,
      status: validationResult.status,
      created_by: req.user.id,
    });

    // Log the action
    AuditLog.log('validation', result.id, 'validate', {
      contract_id: contract.id,
      status: validationResult.status,
      score: validationResult.overall_score,
    }, req.user.id);

    // Generate report
    const report = validationService.generateReport(validationResult);

    res.json({
      validation: result,
      details: validationResult,
      report,
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Failed to validate contract',
      message: error.message,
    });
  }
});

/**
 * PUT /api/contracts/:id
 * Update a contract
 */
router.put('/:id', authenticate, authorize('admin', 'legal', 'business'), async (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      const updates = { ...req.body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('contracts').update(updates).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      AuditLog.log('contract', req.params.id, 'update', updates, req.user.id);
      return res.json(data);
    }

    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { content, status, party_a, party_b } = req.body;

    const updates = {};
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (party_a !== undefined) updates.party_a = party_a;
    if (party_b !== undefined) updates.party_b = party_b;

    const updatedContract = Contract.update(req.params.id, updates);

    // Log the action
    AuditLog.log('contract', contract.id, 'update', updates, req.user.id);

    res.json(updatedContract);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update contract',
      message: error.message,
    });
  }
});

/**
 * PUT /api/contracts/:id/status
 * Update contract status
 */
router.put('/:id/status', authenticate, authorize('admin', 'legal'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
      });
    }

    const validStatuses = ['draft', 'pending_review', 'approved', 'signed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    if (process.env.SUPABASE_URL) {
      const updates = { status, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('contracts').update(updates).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      AuditLog.log('contract', req.params.id, 'status_change', { new_status: status }, req.user.id);
      return res.json(data);
    }

    const contract = Contract.updateStatus(req.params.id, status, req.user.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Log the action
    AuditLog.log('contract', contract.id, 'status_change', {
      new_status: status,
    }, req.user.id);

    res.json(contract);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update status',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/contracts/:id
 * Delete a contract
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      const { error } = await supabase.from('contracts').delete().eq('id', req.params.id);
      if (error) throw error;
      AuditLog.log('contract', req.params.id, 'delete', {}, req.user.id);
      return res.json({ message: 'Contract deleted successfully' });
    }

    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Log before deletion
    AuditLog.log('contract', contract.id, 'delete', { contract }, req.user.id);

    Contract.delete(req.params.id);

    res.json({
      message: 'Contract deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete contract',
      message: error.message,
    });
  }
});

export default router;
