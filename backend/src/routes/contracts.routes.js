import express from 'express';
import { Contract, Proposal, Template, ValidationResult, AuditLog } from '../models/index.js';
// import ragService from '../services/ragService.js'; // Temporarily disabled
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

    // Use SQLite database only (Supabase temporarily disabled)
    const allContracts = Contract.findAll();
    let contracts = allContracts;

    if (status) {
      contracts = allContracts.filter(c => c.status === status);
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    contracts = contracts.slice(startIndex, endIndex);

    return res.json({
      contracts,
      total: allContracts.length,
    });
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
    // Use SQLite database only (Supabase temporarily disabled)
    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
      });
    }

    // Get related template and proposal
    const template = contract.template_id ? Template.findById(contract.template_id) : null;
    const proposal = contract.proposal_id ? Proposal.findById(contract.proposal_id) : null;
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

    // Get template and proposal from database
    let template, proposal;

    console.log('Contract generation request:', { template_id, proposal_id });

    // Use SQLite database only (Supabase temporarily disabled)
    console.log('Looking for template with ID:', template_id);
    template = Template.findById(template_id);
    console.log('Template found:', template ? { id: template.id, name: template.name, is_active: template.is_active } : 'null');

    console.log('Looking for proposal with ID:', proposal_id);
    proposal = Proposal.findById(proposal_id);
    console.log('Proposal found:', proposal ? { id: proposal.id, title: proposal.title } : 'null');

    if (!template) {
      console.log('Template not found in SQLite');
      // Show all templates for debugging
      const allTemplates = Template.findAll();
      console.log('All templates in DB during contract gen:', allTemplates.length, allTemplates.map(t => ({ id: t.id, name: t.name, is_active: t.is_active })));
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!proposal) {
      console.log('Proposal not found in SQLite');
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Generate contract using mock RAG (service temporarily disabled)
    console.log('🤖 Generating contract (mock RAG - service disabled)');
    const result = {
      contract: template.content
        .replace(/{{PartyA}}/g, proposal.client_name)
        .replace(/{{PartyB}}/g, 'Service Provider')
        .replace(/{{StartDate}}/g, proposal.start_date || 'TBD')
        .replace(/{{EndDate}}/g, proposal.end_date || 'TBD')
        .replace(/{{Price}}/g, `${proposal.currency || 'USD'} ${proposal.price}`)
        .replace(/{{Scope}}/g, proposal.project_scope),
      citations: [
        {
          id: 'mock-citation-1',
          text: 'Mock citation from knowledge base',
          similarity: 0.85,
          metadata: { source: 'mock' }
        }
      ],
      metadata: {
        model: 'mock-rag',
        retrievalCount: 1,
        generatedAt: new Date().toISOString(),
      }
    };

    // Create contract record (SQLite only)
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
      generated_by: 'system-user-id',
      created_by: 'system-user-id',
    });

    // Log the action
    AuditLog.log('contract', contract.id, 'generate', {
      template_id,
      proposal_id,
      citations: result.citations.length,
    }, 'system-user-id');

    console.log('✅ Contract generated in SQLite:', contract.title);
    res.status(201).json({
      contract,
      citations: result.citations,
      metadata: result.metadata,
    });
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
router.post('/:id/validate', async (req, res) => {
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
      created_by: 'system',
    });

    // Log the action
    AuditLog.log('validation', result.id, 'validate', {
      contract_id: contract.id,
      status: validationResult.status,
      score: validationResult.overall_score,
    }, 'system');

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
router.put('/:id', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      const updates = { ...req.body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('contracts').update(updates).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      AuditLog.log('contract', req.params.id, 'update', updates, 'system');
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
    AuditLog.log('contract', contract.id, 'update', updates, 'system');

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
router.put('/:id/status', async (req, res) => {
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
      AuditLog.log('contract', req.params.id, 'status_change', { new_status: status }, 'system');
      return res.json(data);
    }

    const contract = Contract.updateStatus(req.params.id, status, 'system');

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Log the action
    AuditLog.log('contract', contract.id, 'status_change', {
      new_status: status,
    }, 'system');

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
router.delete('/:id', async (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      const { error } = await supabase.from('contracts').delete().eq('id', req.params.id);
      if (error) throw error;
      AuditLog.log('contract', req.params.id, 'delete', {}, 'system');
      return res.json({ message: 'Contract deleted successfully' });
    }

    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Log before deletion
    AuditLog.log('contract', contract.id, 'delete', { contract }, 'system');

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
