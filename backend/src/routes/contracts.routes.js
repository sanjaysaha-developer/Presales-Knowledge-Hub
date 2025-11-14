import express from 'express';
import { Contract, Proposal, Template, ValidationResult, AuditLog } from '../models/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import ragService from '../services/ragService.js';
import validationService from '../services/validationService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/contracts
 * Get all contracts
 */
router.get('/', authenticate, (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let contracts;
    if (status) {
      contracts = Contract.findByStatus(status);
    } else {
      contracts = Contract.findAll({}, parseInt(limit), parseInt(offset));
    }

    res.json({
      contracts,
      total: Contract.count(),
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
router.get('/:id', authenticate, (req, res) => {
  try {
    const contract = Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
      });
    }

    // Get related data
    const template = Template.findById(contract.template_id);
    const proposal = contract.proposal_id ? Proposal.findById(contract.proposal_id) : null;
    const validationResults = ValidationResult.findByContract(contract.id);

    res.json({
      contract,
      template,
      proposal,
      validationResults,
    });
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
router.post('/generate', authenticate, authorize('admin', 'legal', 'business'), async (req, res) => {
  try {
    const { template_id, proposal_id, options } = req.body;

    if (!template_id || !proposal_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'template_id and proposal_id are required',
      });
    }

    // Get template and proposal
    const template = Template.findById(template_id);
    const proposal = Proposal.findById(proposal_id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Generate contract using RAG
    const result = await ragService.generateContract(proposal, template, options);

    // Create contract record
    const contract = Contract.create({
      id: uuidv4(),
      template_id,
      proposal_id,
      contract_number: Contract.generateContractNumber(),
      title: proposal.title,
      party_a: proposal.client_name,
      party_b: 'Service Provider', // TODO: Get from config
      content: result.contract,
      status: 'draft',
      generated_by: req.user.id,
      created_by: req.user.id,
    });

    // Log the action
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
router.put('/:id', authenticate, authorize('admin', 'legal', 'business'), (req, res) => {
  try {
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
router.put('/:id/status', authenticate, authorize('admin', 'legal'), (req, res) => {
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
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
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
