import express from 'express';
import { Proposal, AuditLog } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient.js';

const router = express.Router();

/**
 * GET /api/proposals
 * Get all proposals
 */
router.get('/', async (req, res) => {
  try {
    const { client, limit = 50, offset = 0 } = req.query;

    // Use SQLite database only (Supabase temporarily disabled)
    const allProposals = Proposal.findAll();
    let proposals = allProposals;

    if (client) {
      proposals = allProposals.filter(p =>
        p.client_name.toLowerCase().includes(client.toLowerCase())
      );
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    proposals = proposals.slice(startIndex, endIndex);

    res.json({
      proposals,
      total: allProposals.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch proposals',
      message: error.message,
    });
  }
});

/**
 * GET /api/proposals/:id
 * Get a single proposal
 */
router.get('/:id', (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const proposal = Proposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        error: 'Proposal not found',
      });
    }

    res.json(proposal);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch proposal',
      message: error.message,
    });
  }
});

/**
 * POST /api/proposals
 * Create a new proposal
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      client_name,
      project_scope,
      price,
      currency,
      payment_terms,
      milestones,
      start_date,
      end_date,
      deliverables,
      sla_terms,
      metadata,
    } = req.body;

    // Validation
    if (!title || !client_name || !project_scope || !price) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'title, client_name, project_scope, and price are required',
      });
    }

    // Use SQLite database only (Supabase temporarily disabled)
    const proposal = Proposal.create({
      id: uuidv4(),
      title,
      client_name,
      project_scope,
      price: parseFloat(price),
      currency: currency || 'USD',
      payment_terms,
      milestones: typeof milestones === 'object' ? JSON.stringify(milestones) : milestones,
      start_date,
      end_date,
      deliverables,
      sla_terms,
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
      created_by: 'system-user-id', // Use system user ID
    });

    // Log the action
    AuditLog.log('proposal', proposal.id, 'create', {
      title,
      client_name,
      project_scope,
    }, 'system-user-id');

    console.log('✅ Proposal created in SQLite:', proposal.title);
    res.status(201).json(proposal);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create proposal',
      message: error.message,
    });
  }
});

/**
 * PUT /api/proposals/:id
 * Update a proposal
 */
router.put('/:id', (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const proposal = Proposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.created_by;
    delete updates.created_at;

    // Stringify objects if needed
    if (updates.milestones && typeof updates.milestones === 'object') {
      updates.milestones = JSON.stringify(updates.milestones);
    }
    if (updates.metadata && typeof updates.metadata === 'object') {
      updates.metadata = JSON.stringify(updates.metadata);
    }

    const updatedProposal = Proposal.update(req.params.id, updates);

    // Log the action
    AuditLog.log('proposal', proposal.id, 'update', updates, 'system-user-id');

    res.json(updatedProposal);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update proposal',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/proposals/:id
 * Delete a proposal
 */
router.delete('/:id', (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const proposal = Proposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Log before deletion
    AuditLog.log('proposal', proposal.id, 'delete', { proposal }, 'system-user-id');

    Proposal.delete(req.params.id);

    res.json({
      message: 'Proposal deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete proposal',
      message: error.message,
    });
  }
});

export default router;
