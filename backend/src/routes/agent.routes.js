import express from 'express';
import langGraphAgent from '../services/langGraphAgent.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

/**
 * @route POST /query
 * @desc Process a query through the LangGraph agent
 * @access Public
 */
router.post('/query', [
  body('query')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Query must be between 1 and 2000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be a valid object'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be a valid object'),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { query, context = {}, options = {} } = req.body;

    console.log(`🤖 Processing agent query: "${query.substring(0, 100)}..."`);

    // Process query through LangGraph agent
    const result = await langGraphAgent.processQuery(query, {
      context,
      ...options,
    });

    console.log(`✅ Agent query processed. Type: ${result.type}, Sources: ${result.sources?.length || 0}`);

    res.json({
      success: result.success,
      response: result.response,
      type: result.type,
      sources: result.sources,
      metadata: result.metadata,
      analysis: result.analysis,
      ...(result.error && { error: result.error }),
    });

  } catch (error) {
    console.error('Agent query error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * @route POST /analyze-contract
 * @desc Specialized endpoint for contract analysis
 * @access Public
 */
router.post('/analyze-contract', [
  body('contractText')
    .isLength({ min: 10, max: 50000 })
    .withMessage('Contract text must be between 10 and 50,000 characters'),
  body('analysisType')
    .optional()
    .isIn(['risks', 'compliance', 'terms', 'full'])
    .withMessage('Analysis type must be one of: risks, compliance, terms, full'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { contractText, analysisType = 'full' } = req.body;

    // Craft specialized query for contract analysis
    const query = `Please analyze this contract${analysisType !== 'full' ? ` focusing on ${analysisType}` : ''}:

${contractText}

${analysisType === 'risks' ? 'Identify all potential risks and concerns.' :
  analysisType === 'compliance' ? 'Check for compliance issues and regulatory concerns.' :
  analysisType === 'terms' ? 'Analyze key terms and conditions.' :
  'Provide a comprehensive analysis including risks, terms, and recommendations.'}`;

    console.log(`📄 Analyzing contract (${analysisType}) - ${contractText.length} characters`);

    const result = await langGraphAgent.processQuery(query, {
      context: { analysisType, documentType: 'contract' },
    });

    res.json({
      success: result.success,
      analysis: result.response,
      type: 'contract_analysis',
      analysisType,
      sources: result.sources,
      metadata: result.metadata,
      ...(result.error && { error: result.error }),
    });

  } catch (error) {
    console.error('Contract analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Contract analysis failed',
      message: error.message,
    });
  }
});

/**
 * @route POST /presales-advice
 * @desc Get presales strategic advice
 * @access Public
 */
router.post('/presales-advice', [
  body('scenario')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Scenario description must be between 10 and 2000 characters'),
  body('industry')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Industry must be between 2 and 100 characters'),
  body('companySize')
    .optional()
    .isIn(['startup', 'small', 'medium', 'large', 'enterprise'])
    .withMessage('Company size must be one of: startup, small, medium, large, enterprise'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { scenario, industry, companySize } = req.body;

    // Craft presales query
    const query = `As a presales consultant, provide strategic advice for this scenario:

${scenario}

${industry ? `Industry: ${industry}` : ''}
${companySize ? `Company Size: ${companySize}` : ''}

Please provide:
1. Strategic positioning recommendations
2. Value proposition suggestions
3. Competitive advantages to highlight
4. Potential objections and responses
5. Recommended next steps
6. Pricing strategy considerations`;

    console.log(`🎯 Generating presales advice for scenario: "${scenario.substring(0, 100)}..."`);

    const result = await langGraphAgent.processQuery(query, {
      context: {
        queryType: 'presales',
        industry,
        companySize,
        scenario: scenario.substring(0, 500), // Truncate for context
      },
    });

    res.json({
      success: result.success,
      advice: result.response,
      type: 'presales_advice',
      context: { industry, companySize },
      sources: result.sources,
      metadata: result.metadata,
      ...(result.error && { error: result.error }),
    });

  } catch (error) {
    console.error('Presales advice error:', error);
    res.status(500).json({
      success: false,
      error: 'Presales advice generation failed',
      message: error.message,
    });
  }
});

/**
 * @route GET /health
 * @desc Check agent service health
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    // Basic health check
    const isHealthy = !!langGraphAgent.llm;

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'langgraph-agent',
      timestamp: new Date().toISOString(),
      model: langGraphAgent.llm?.modelName || 'unknown',
    });
  } catch (error) {
    console.error('Agent health check error:', error);
    res.status(500).json({
      status: 'error',
      service: 'langgraph-agent',
      error: error.message,
    });
  }
});

/**
 * @route POST /explain-clause
 * @desc Explain a contract clause in simple terms
 * @access Public
 */
router.post('/explain-clause', [
  body('clause')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Clause text must be between 10 and 5000 characters'),
  body('context')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Context must be less than 1000 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { clause, context } = req.body;

    const query = `Please explain this contract clause in simple, clear terms:

"${clause}"

${context ? `Additional context: ${context}` : ''}

Provide:
1. What this clause means in plain English
2. The practical implications
3. Any potential risks or important considerations
4. Whether this is favorable to the client or service provider`;

    console.log(`📖 Explaining contract clause: "${clause.substring(0, 100)}..."`);

    const result = await langGraphAgent.processQuery(query, {
      context: { queryType: 'clause_explanation', originalClause: clause },
    });

    res.json({
      success: result.success,
      explanation: result.response,
      type: 'clause_explanation',
      originalClause: clause.substring(0, 200) + (clause.length > 200 ? '...' : ''),
      sources: result.sources,
      metadata: result.metadata,
      ...(result.error && { error: result.error }),
    });

  } catch (error) {
    console.error('Clause explanation error:', error);
    res.status(500).json({
      success: false,
      error: 'Clause explanation failed',
      message: error.message,
    });
  }
});

export default router;
