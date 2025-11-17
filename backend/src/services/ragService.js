import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabaseClient.js';
import embeddingService from './embeddingService.js';

/**
 * RAG (Retrieval-Augmented Generation) Service
 * Combines retrieval from vector store with LLM generation
 */
class RAGService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set. Set it in .env to enable generation.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.topK = parseInt(process.env.TOP_K_RETRIEVAL || '5');
    this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7');
  }

  /**
   * Retrieve relevant context from knowledge base
   * @param {string} query - Search query
   * @param {object} filter - Optional metadata filters
   * @returns {Promise<Array>}
   */
  async retrieve(query, filter = null) {
    try {
      // Query Supabase pgvector via RPC
      const queryEmbedding = await embeddingService.generateEmbeddings(query);
      const { data, error } = await supabase.rpc('match_presales', {
        query_embedding: queryEmbedding,
        match_count: this.topK,
        filter: filter || null,
      });
      if (error) throw error;
      const results = (data || []).map(r => ({
        id: r.id,
        text: r.text,
        metadata: r.metadata,
        similarity: r.similarity ?? r.score ?? 0,
      }));

      // Filter by similarity threshold
      const relevantResults = results.filter(
        (result) => result.similarity >= this.similarityThreshold
      );

      console.log(`📚 Retrieved ${relevantResults.length} relevant chunks (threshold: ${this.similarityThreshold})`);

      return relevantResults;
    } catch (error) {
      console.error('Retrieval failed:', error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  /**
   * Generate contract using RAG
   * @param {object} proposal - Proposal data
   * @param {object} template - Template data
   * @param {object} options - Generation options
   * @returns {Promise<{contract: string, citations: Array, metadata: object}>}
   */
  async generateContract(proposal, template, options = {}) {
    try {
      // Build context query from proposal
      const contextQuery = this.buildContextQuery(proposal);

      // Retrieve relevant knowledge
      const retrievedDocs = await this.retrieve(contextQuery, {
        contract_type: template.contract_type,
      });

      // Build the generation prompt
      const prompt = this.buildContractGenerationPrompt(
        proposal,
        template,
        retrievedDocs
      );

      console.log('🤖 Generating contract with Gemini...');

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          topP: options.topP ?? 0.9,
          maxOutputTokens: options.maxTokens ?? 2000,
        },
      });
      const generatedText = generation.response.text();

      // Post-process: merge with template
      const finalContract = this.mergeWithTemplate(
        generatedText,
        template,
        proposal
      );

      // Extract citations
      const citations = retrievedDocs.map((doc) => ({
        id: doc.id,
        text: doc.text.substring(0, 200) + '...',
        similarity: doc.similarity,
        metadata: doc.metadata,
      }));

      console.log('✅ Contract generated successfully');

      return {
        contract: finalContract,
        citations,
        metadata: {
          model: this.modelName,
          retrievalCount: retrievedDocs.length,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Contract generation failed:', error);
      throw new Error(`Contract generation failed: ${error.message}`);
    }
  }

  /**
   * Build context query from proposal
   */
  buildContextQuery(proposal) {
    const parts = [
      `Contract for ${proposal.title}`,
      `Client: ${proposal.client_name}`,
      `Scope: ${proposal.project_scope}`,
      proposal.deliverables ? `Deliverables: ${proposal.deliverables}` : '',
      proposal.sla_terms ? `SLA: ${proposal.sla_terms}` : '',
    ].filter(Boolean);

    return parts.join('. ');
  }

  /**
   * Build the generation prompt
   */
  buildContractGenerationPrompt(proposal, template, retrievedDocs) {
    const evidenceText = retrievedDocs
      .map((doc, idx) => `[${idx + 1}] ${doc.text}`)
      .join('\n\n');

    return `You are a legal contract drafting assistant. Your task is to generate a contract based on the provided template, proposal information, and evidence from the knowledge base.

INSTRUCTIONS:
1. Use ONLY the approved template language provided below
2. Fill in placeholders with information from the proposal
3. Reference the evidence snippets to select appropriate clauses
4. Do NOT alter statutory or approved language
5. Maintain professional legal tone
6. Ensure all critical fields are filled

TEMPLATE:
${template.content}

PROPOSAL INFORMATION:
- Title: ${proposal.title}
- Client: ${proposal.client_name}
- Project Scope: ${proposal.project_scope}
- Price: ${proposal.currency || 'USD'} ${proposal.price}
- Payment Terms: ${proposal.payment_terms || 'Standard payment terms'}
- Start Date: ${proposal.start_date || 'TBD'}
- End Date: ${proposal.end_date || 'TBD'}
- Deliverables: ${proposal.deliverables || 'As specified in scope'}
- SLA Terms: ${proposal.sla_terms || 'Standard SLA'}

EVIDENCE FROM KNOWLEDGE BASE:
${evidenceText || 'No additional evidence available'}

TASK:
Generate a complete contract by filling the template with the proposal information. Replace all placeholders (e.g., {{ClientName}}, {{Price}}, {{Scope}}) with actual values. Select appropriate conditional clauses based on the proposal and evidence.

OUTPUT ONLY THE FILLED CONTRACT TEXT:`;
  }

  /**
   * Merge generated text with template structure
   */
  mergeWithTemplate(generatedText, template, proposal) {
    let result = template.content;

    // Replace common placeholders
    const replacements = {
      '{{ClientName}}': proposal.client_name,
      '{{PartyA}}': proposal.client_name,
      '{{PartyB}}': 'Service Provider', // This should come from config
      '{{ProjectTitle}}': proposal.title,
      '{{Scope}}': proposal.project_scope,
      '{{Price}}': `${proposal.currency || 'USD'} ${proposal.price}`,
      '{{PaymentTerms}}': proposal.payment_terms || 'Net 30',
      '{{StartDate}}': proposal.start_date || new Date().toISOString().split('T')[0],
      '{{EndDate}}': proposal.end_date || 'TBD',
      '{{Deliverables}}': proposal.deliverables || 'As defined in scope',
      '{{SLA}}': proposal.sla_terms || 'Standard service levels',
      '{{EffectiveDate}}': new Date().toISOString().split('T')[0],
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    // If template has conditional clauses, process them
    if (template.conditional_clauses) {
      try {
        const conditionals = JSON.parse(template.conditional_clauses);
        result = this.processConditionalClauses(result, conditionals, proposal);
      } catch (error) {
        console.warn('Failed to process conditional clauses:', error);
      }
    }

    return result;
  }

  /**
   * Process conditional clauses
   */
  processConditionalClauses(content, conditionals, proposal) {
    let result = content;

    for (const conditional of conditionals) {
      if (this.evaluateCondition(conditional.condition, proposal)) {
        // Include this clause
        result = result.replace(
          `{{CONDITIONAL:${conditional.id}}}`,
          conditional.text
        );
      } else {
        // Remove this clause
        result = result.replace(`{{CONDITIONAL:${conditional.id}}}`, '');
      }
    }

    return result;
  }

  /**
   * Evaluate a condition
   */
  evaluateCondition(condition, proposal) {
    // Simple condition evaluation
    // Format: "field operator value" e.g., "price > 10000"
    const [field, operator, value] = condition.split(' ');

    const proposalValue = proposal[field];
    if (proposalValue === undefined) return false;

    switch (operator) {
      case '>':
        return parseFloat(proposalValue) > parseFloat(value);
      case '<':
        return parseFloat(proposalValue) < parseFloat(value);
      case '==':
        return proposalValue.toString() === value;
      case '!=':
        return proposalValue.toString() !== value;
      case 'includes':
        return proposalValue.toString().toLowerCase().includes(value.toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Ask LLM a question with context
   * @param {string} question - Question to ask
   * @param {string} context - Optional context
   * @returns {Promise<string>}
   */
  async ask(question, context = '') {
    try {
      const prompt = context
        ? `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`
        : question;

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      });
      return generation.response.text();
    } catch (error) {
      console.error('LLM query failed:', error);
      throw new Error(`LLM query failed: ${error.message}`);
    }
  }

  /**
   * Explain a contract clause
   * @param {string} clauseText - The clause to explain
   * @returns {Promise<string>}
   */
  async explainClause(clauseText) {
    const prompt = `Explain the following contract clause in simple terms:

"${clauseText}"

Provide a clear, concise explanation of:
1. What this clause means
2. The obligations it creates
3. Any potential risks or important points to note`;

    return this.ask(prompt);
  }
}

export default new RAGService();
