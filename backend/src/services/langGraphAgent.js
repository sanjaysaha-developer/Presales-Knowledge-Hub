import { StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
// import ragService from './ragService.js'; // Temporarily disabled
// import embeddingService from './embeddingService.js'; // Temporarily disabled
import { supabase } from './supabaseClient.js';

/**
 * LangGraph Agent Service
 * Advanced agent system using LangGraph for complex reasoning and tool use
 */
class LangGraphAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.graph = null;
    this.initializeTools();
    this.initializeGraph();
  }

  /**
   * Initialize the tools available to the agent
   */
  initializeTools() {
    // Tool for searching the knowledge base
    this.searchKnowledgeBaseTool = {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base using vector similarity for general queries about contracts, legal matters, and business processes',
      execute: async (query) => {
        try {
          // Mock knowledge base search (ragService disabled)
          console.log('🔍 Mock knowledge base search for:', query);
          return {
            success: true,
            results: [
              {
                text: 'Mock knowledge base result related to contracts and legal terms.',
                similarity: 0.85,
                metadata: { source: 'mock', type: 'contract' },
              },
            ],
            count: 1,
          };
        } catch (error) {
          console.error('Knowledge base search failed:', error);
          return {
            success: false,
            error: error.message,
            results: [],
            count: 0,
          };
        }
      },
    };

    // Tool for getting specific contract details
    this.getContractDetailsTool = {
      name: 'get_contract_details',
      description: 'Fetch specific contract data from the database by contract ID',
      execute: async (contractId) => {
        try {
          if (!process.env.SUPABASE_URL) {
            return {
              success: false,
              error: 'Supabase not configured',
              contract: null,
            };
          }

          const { data: contract, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', contractId)
            .single();

          if (error || !contract) {
            return {
              success: false,
              error: 'Contract not found',
              contract: null,
            };
          }

          // Also fetch related proposal and template if available
          const { data: proposal } = contract.proposal_id ?
            await supabase.from('proposals').select('*').eq('id', contract.proposal_id).single() : { data: null };

          const { data: template } = contract.template_id ?
            await supabase.from('templates').select('*').eq('id', contract.template_id).single() : { data: null };

          return {
            success: true,
            contract,
            proposal,
            template,
          };
        } catch (error) {
          console.error('Contract details fetch failed:', error);
          return {
            success: false,
            error: error.message,
            contract: null,
          };
        }
      },
    };

    // Tool for listing contracts
    this.listContractsTool = {
      name: 'list_contracts',
      description: 'List contracts with optional filtering by status',
      execute: async (filters = {}) => {
        try {
          if (!process.env.SUPABASE_URL) {
            return {
              success: false,
              error: 'Supabase not configured',
              contracts: [],
              count: 0,
            };
          }

          let query = supabase.from('contracts').select('*', { count: 'exact' }).order('created_at', { ascending: false });

          if (filters.status) query = query.eq('status', filters.status);
          if (filters.limit) query = query.limit(parseInt(filters.limit));
          if (filters.offset) query = query.range(parseInt(filters.offset), parseInt(filters.offset) + parseInt(filters.limit || 50) - 1);

          const { data, error, count } = await query;

          if (error) throw error;

          return {
            success: true,
            contracts: data || [],
            count: count || 0,
          };
        } catch (error) {
          console.error('Contract listing failed:', error);
          return {
            success: false,
            error: error.message,
            contracts: [],
            count: 0,
          };
        }
      },
    };
  }

  /**
   * Initialize the LangGraph with nodes and edges
   */
  initializeGraph() {
    // Define the state schema
    const stateSchema = {
      messages: [],
      context: {},
      currentTask: '',
      tools: [],
      result: null,
      error: null,
    };

    // Create the graph
    this.graph = new StateGraph({ channels: stateSchema });

    // Add nodes
    this.graph.addNode('analyze_query', this.analyzeQuery.bind(this));
    this.graph.addNode('route_query', this.routeQuery.bind(this));
    this.graph.addNode('handle_rag_query', this.handleRAGQuery.bind(this));
    this.graph.addNode('handle_contract_analysis', this.handleContractAnalysis.bind(this));
    this.graph.addNode('handle_presales_query', this.handlePresalesQuery.bind(this));
    this.graph.addNode('handle_contract_query', this.handleContractQuery.bind(this));
    this.graph.addNode('use_tools', this.useTools.bind(this));
    this.graph.addNode('generate_response', this.generateResponse.bind(this));
    this.graph.addNode('handle_error', this.handleError.bind(this));

    // Add edges
    this.graph.addEdge(START, 'analyze_query');
    this.graph.addConditionalEdges('analyze_query', this.routeQuery.bind(this));
    this.graph.addEdge('handle_rag_query', 'generate_response');
    this.graph.addEdge('handle_contract_analysis', 'generate_response');
    this.graph.addEdge('handle_presales_query', 'generate_response');
    this.graph.addEdge('handle_contract_query', 'use_tools');
    this.graph.addEdge('use_tools', 'generate_response');
    this.graph.addEdge('generate_response', END);
    this.graph.addEdge('handle_error', END);

    // Compile the graph
    this.compiledGraph = this.graph.compile();
  }

  /**
   * Analyze the user query and determine intent
   */
  async analyzeQuery(state) {
    const { messages } = state;
    const userMessage = messages[messages.length - 1];

    const analysisPrompt = `Analyze the following user query and determine:
1. The primary intent (rag_query, contract_analysis, presales_query, contract_query, general_question)
2. Key topics or entities mentioned (including contract IDs if mentioned)
3. Required tools or capabilities
4. Complexity level (simple, moderate, complex)

Query: "${userMessage.content}"

Return your analysis as JSON with keys: intent, topics, tools, complexity, contractId (if applicable)`;

    try {
      const analysis = await this.llm.invoke([new SystemMessage(analysisPrompt)]);
      const analysisData = JSON.parse(analysis.content);

      return {
        ...state,
        context: {
          ...state.context,
          analysis: analysisData,
        },
        currentTask: analysisData.intent,
      };
    } catch (error) {
      console.error('Query analysis failed:', error);
      return {
        ...state,
        error: `Analysis failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Route to appropriate handler based on query analysis
   */
  routeQuery(state) {
    const { currentTask, error } = state;

    if (error) {
      return 'handle_error';
    }

    switch (currentTask) {
      case 'rag_query':
        return 'handle_rag_query';
      case 'contract_analysis':
        return 'handle_contract_analysis';
      case 'presales_query':
        return 'handle_presales_query';
      case 'contract_query':
        return 'handle_contract_query';
      default:
        return 'handle_rag_query'; // Default fallback
    }
  }

  /**
   * Handle general RAG queries
   */
  async handleRAGQuery(state) {
    const { messages, context } = state;
    const userMessage = messages[messages.length - 1];

    try {
      // Use the existing RAG service
      const results = await ragService.retrieve(userMessage.content);

      // Generate response with context
      const contextText = results.map(r => r.text).join('\n\n');
      const responsePrompt = `Based on the following context, answer the user's question:

Context:
${contextText}

Question: ${userMessage.content}

Provide a comprehensive answer based on the context provided.`;

      const response = await this.llm.invoke([new SystemMessage(responsePrompt)]);

      return {
        ...state,
        result: {
          answer: response.content,
          sources: results,
          type: 'rag_query',
        },
      };
    } catch (error) {
      console.error('RAG query handling failed:', error);
      return {
        ...state,
        error: `RAG query failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Handle contract analysis queries
   */
  async handleContractAnalysis(state) {
    const { messages, context } = state;
    const userMessage = messages[messages.length - 1];

    try {
      // Specialized contract analysis logic
      const analysisPrompt = `You are a contract analysis expert. Analyze the following contract-related query and provide detailed insights:

Query: "${userMessage.content}"

Provide:
1. Key contract elements identified
2. Potential risks or concerns
3. Recommendations for improvement
4. Relevant legal considerations

Be thorough and professional in your analysis.`;

      const analysis = await this.llm.invoke([new SystemMessage(analysisPrompt)]);

      // Also retrieve relevant contract knowledge
      const relevantDocs = await ragService.retrieve(userMessage.content, {
        document_type: 'contract',
      });

      return {
        ...state,
        result: {
          answer: analysis.content,
          sources: relevantDocs,
          type: 'contract_analysis',
          analysis: {
            risks: this.extractRisks(analysis.content),
            recommendations: this.extractRecommendations(analysis.content),
          },
        },
      };
    } catch (error) {
      console.error('Contract analysis failed:', error);
      return {
        ...state,
        error: `Contract analysis failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Handle presales queries
   */
  async handlePresalesQuery(state) {
    const { messages, context } = state;
    const userMessage = messages[messages.length - 1];

    try {
      // Use presales-specific search
      const presalesSearch = await import('./presalesSearch.js');

      const results = await presalesSearch.default.search(userMessage.content);

      // Generate presales-focused response
      const contextText = results.map(r => r.content || r.text).join('\n\n');
      const responsePrompt = `You are a presales consultant. Based on the following presales knowledge, provide strategic advice:

Knowledge Base:
${contextText}

Customer Query: ${userMessage.content}

Provide:
1. Strategic recommendations
2. Competitive positioning
3. Value propositions
4. Potential objections and responses
5. Next steps for the sales process`;

      const response = await this.llm.invoke([new SystemMessage(responsePrompt)]);

      return {
        ...state,
        result: {
          answer: response.content,
          sources: results,
          type: 'presales_query',
          recommendations: this.extractPresalesRecommendations(response.content),
        },
      };
    } catch (error) {
      console.error('Presales query handling failed:', error);
      return {
        ...state,
        error: `Presales query failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Handle contract-specific queries (uses tools)
   */
  async handleContractQuery(state) {
    const { messages, context } = state;
    const userMessage = messages[messages.length - 1];

    try {
      const analysis = context.analysis || {};

      // Extract contract ID if available
      let contractId = analysis.contractId;
      if (!contractId) {
        // Try to extract from query using regex
        const contractIdMatch = userMessage.content.match(/(?:contract|agreement)\s+(?:id|number|#)?\s*([a-f0-9-]{36}|[A-Z]{3}-\d{4}-[A-Z0-9]{4})/i);
        if (contractIdMatch) {
          contractId = contractIdMatch[1];
        }
      }

      // Prepare tools to use
      const toolsToUse = [];

      if (contractId) {
        toolsToUse.push({
          name: 'get_contract_details',
          input: contractId,
        });
      } else {
        // If no specific contract ID, list contracts or search knowledge base
        toolsToUse.push({
          name: 'list_contracts',
          input: { status: null, limit: 5 },
        });
      }

      // Add knowledge base search for additional context
      toolsToUse.push({
        name: 'search_knowledge_base',
        input: userMessage.content,
      });

      return {
        ...state,
        tools: toolsToUse,
      };
    } catch (error) {
      console.error('Contract query handling failed:', error);
      return {
        ...state,
        error: `Contract query failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Execute tools and collect results
   */
  async useTools(state) {
    const { tools } = state;

    try {
      const toolResults = [];

      for (const tool of tools) {
        let result;
        switch (tool.name) {
          case 'get_contract_details':
            result = await this.getContractDetailsTool.execute(tool.input);
            toolResults.push({ tool: 'get_contract_details', result });
            break;
          case 'list_contracts':
            result = await this.listContractsTool.execute(tool.input);
            toolResults.push({ tool: 'list_contracts', result });
            break;
          case 'search_knowledge_base':
            result = await this.searchKnowledgeBaseTool.execute(tool.input);
            toolResults.push({ tool: 'search_knowledge_base', result });
            break;
          default:
            console.warn(`Unknown tool: ${tool.name}`);
        }
      }

      return {
        ...state,
        toolResults,
      };
    } catch (error) {
      console.error('Tool execution failed:', error);
      return {
        ...state,
        error: `Tool execution failed: ${error.message}`,
        currentTask: 'error',
      };
    }
  }

  /**
   * Generate final response
   */
  async generateResponse(state) {
    const { result, context, toolResults, messages } = state;
    const userMessage = messages[messages.length - 1];

    // If we have tool results, synthesize them into a response
    if (toolResults && toolResults.length > 0) {
      try {
        // Prepare tool results for LLM
        const toolData = toolResults.map(tr => {
          switch (tr.tool) {
            case 'get_contract_details':
              if (tr.result.success && tr.result.contract) {
                return `Contract Details:\n- ID: ${tr.result.contract.id}\n- Title: ${tr.result.contract.title}\n- Status: ${tr.result.contract.status}\n- Party A: ${tr.result.contract.party_a}\n- Party B: ${tr.result.contract.party_b}\n- Created: ${tr.result.contract.created_at}`;
              } else {
                return `Contract Details: ${tr.result.error || 'Not found'}`;
              }
            case 'list_contracts':
              if (tr.result.success && tr.result.contracts.length > 0) {
                const contracts = tr.result.contracts.slice(0, 5).map(c =>
                  `- ${c.title} (${c.status}) - ID: ${c.id}`
                ).join('\n');
                return `Available Contracts:\n${contracts}`;
              } else {
                return `Available Contracts: ${tr.result.error || 'None found'}`;
              }
            case 'search_knowledge_base':
              if (tr.result.success && tr.result.results.length > 0) {
                const knowledge = tr.result.results.slice(0, 3).map(r =>
                  `- ${r.text.substring(0, 200)}...`
                ).join('\n');
                return `Knowledge Base Results:\n${knowledge}`;
              } else {
                return `Knowledge Base Results: ${tr.result.error || 'None found'}`;
              }
            default:
              return `${tr.tool}: ${JSON.stringify(tr.result)}`;
          }
        }).join('\n\n');

        // Generate synthesized response
        const synthesisPrompt = `Based on the following tool results and the user's query, provide a helpful, coherent response:

User Query: "${userMessage.content}"

Tool Results:
${toolData}

Please synthesize this information into a natural, helpful response that directly addresses the user's query.`;

        const synthesis = await this.llm.invoke([new SystemMessage(synthesisPrompt)]);

        return {
          ...state,
          result: {
            answer: synthesis.content,
            type: 'contract_query',
            toolResults: toolResults,
            metadata: {
              processedAt: new Date().toISOString(),
              model: this.llm.modelName,
              toolsUsed: toolResults.length,
              analysis: context.analysis,
            },
          },
        };
      } catch (error) {
        console.error('Response synthesis failed:', error);
        return {
          ...state,
          result: {
            answer: 'I found some relevant information but had trouble synthesizing it. Please try rephrasing your question.',
            type: 'error',
            error: error.message,
          },
        };
      }
    }

    // Handle regular responses
    if (!result) {
      return {
        ...state,
        result: {
          answer: 'I apologize, but I was unable to process your query. Please try rephrasing your question.',
          type: 'error',
        },
      };
    }

    // Enhance response with metadata
    const enhancedResult = {
      ...result,
      metadata: {
        processedAt: new Date().toISOString(),
        model: this.llm.modelName,
        sourceCount: result.sources?.length || 0,
        analysis: context.analysis,
      },
    };

    return {
      ...state,
      result: enhancedResult,
    };
  }

  /**
   * Handle errors
   */
  handleError(state) {
    return {
      ...state,
      result: {
        answer: `I encountered an error while processing your request: ${state.error}`,
        type: 'error',
        error: state.error,
      },
    };
  }

  /**
   * Extract risks from contract analysis
   */
  extractRisks(text) {
    const riskPatterns = [
      /risks?:?\s*([^.!?]+[.!?])/gi,
      /concerns?:?\s*([^.!?]+[.!?])/gi,
      /potential issues?:?\s*([^.!?]+[.!?])/gi,
    ];

    const risks = [];
    riskPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        risks.push(match[1].trim());
      }
    });

    return [...new Set(risks)]; // Remove duplicates
  }

  /**
   * Extract recommendations from analysis
   */
  extractRecommendations(text) {
    const recPatterns = [
      /recommend(?:s|ed|ation)?:?\s*([^.!?]+[.!?])/gi,
      /suggest(?:s|ed|ion)?:?\s*([^.!?]+[.!?])/gi,
      /should\s+([^.!?]+[.!?])/gi,
    ];

    const recommendations = [];
    recPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        recommendations.push(match[1].trim());
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Extract presales recommendations
   */
  extractPresalesRecommendations(text) {
    const sections = text.split(/\d+\./).filter(s => s.trim());
    return sections.map(section => section.trim()).filter(s => s.length > 0);
  }

  /**
   * Process a user query through the agent
   * @param {string} query - User query
   * @param {object} options - Additional options
   * @returns {Promise<object>} Agent response
   */
  async processQuery(query, options = {}) {
    try {
      const initialState = {
        messages: [new HumanMessage(query)],
        context: options.context || {},
        currentTask: '',
        tools: [],
        result: null,
        error: null,
      };

      const finalState = await this.compiledGraph.invoke(initialState);

      return {
        success: !finalState.error,
        response: finalState.result?.answer || 'No response generated',
        type: finalState.result?.type || 'unknown',
        sources: finalState.result?.sources || [],
        metadata: finalState.result?.metadata || {},
        analysis: finalState.context?.analysis || {},
        ...(finalState.error && { error: finalState.error }),
      };
    } catch (error) {
      console.error('Agent processing failed:', error);
      return {
        success: false,
        response: 'I apologize, but I encountered an error processing your request.',
        error: error.message,
        type: 'error',
      };
    }
  }
}

export default new LangGraphAgent();
