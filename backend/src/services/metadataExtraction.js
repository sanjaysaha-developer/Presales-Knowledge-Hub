import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Metadata Extraction Service
 * Uses AI to extract structured metadata from presales documents
 */
class MetadataExtractionService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set. Metadata extraction will use empty defaults.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  /**
   * Extract comprehensive metadata from document text
   * @param {string} text - Document text
   * @param {string} documentType - Type of document (case_study, deck, etc.)
   * @returns {Object} Extracted metadata
   */
  async extractMetadata(text, documentType = 'case_study') {
    try {
      const prompt = this.buildExtractionPrompt(text, documentType);

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 1200,
        },
      });

      const textOut = generation.response.text();
      const extractedData = this.parseExtractionResponse(textOut);
      return extractedData;
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return this.getDefaultMetadata();
    }
  }

  /**
   * Build prompt for metadata extraction
   */
  buildExtractionPrompt(text, documentType) {
    const sampleText = text.substring(0, 3000); // Limit to first 3000 chars for efficiency

    return `You are an expert at extracting structured metadata from business documents.

DOCUMENT TYPE: ${documentType}

DOCUMENT TEXT:
${sampleText}

TASK: Extract the following information and return ONLY a valid JSON object with these exact fields:

{
  "client_name": "Name of the client/company (if mentioned)",
  "industry": "Industry sector (e.g., Healthcare, Finance, Retail, Technology, Manufacturing)",
  "domain": "Business domain (e.g., E-commerce, Supply Chain, CRM, ERP, Analytics)",
  "service_line": "Service line (e.g., Cloud Migration, Application Development, Data Analytics, AI/ML, Consulting)",
  "project_value": "Estimated project value in USD (numeric only, or null)",
  "project_duration": "Project duration (e.g., '6 months', '1 year')",
  "technologies": ["Array of technologies mentioned (e.g., React, AWS, Python, Salesforce)"],
  "outcomes": "Brief summary of project outcomes/results",
  "challenges": "Brief summary of challenges faced",
  "solutions": "Brief summary of solutions provided",
  "key_metrics": ["Array of key success metrics (e.g., '50% cost reduction', '99.9% uptime')"],
  "region": "Geographic region (e.g., North America, Europe, Asia Pacific)",
  "confidence": 0.0-1.0
}

RULES:
- Return ONLY valid JSON, no other text
- If information is not found, use null or empty array
- For confidence, estimate how confident you are in the extraction (0.0 to 1.0)
- Extract exact values when possible
- Be concise in summaries (max 200 characters each)

JSON:`;
  }

  /**
   * Parse LLM response and extract JSON
   */
  parseExtractionResponse(response) {
    try {
      // Try to find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAndCleanMetadata(parsed);
      }
    } catch (error) {
      console.error('Error parsing extraction response:', error);
    }

    return this.getDefaultMetadata();
  }

  /**
   * Validate and clean extracted metadata
   */
  validateAndCleanMetadata(metadata) {
    const cleaned = {
      client_name: metadata.client_name || null,
      industry: this.normalizeIndustry(metadata.industry),
      domain: metadata.domain || null,
      service_line: this.normalizeServiceLine(metadata.service_line),
      project_value: this.parseProjectValue(metadata.project_value),
      project_duration: metadata.project_duration || null,
      technologies: Array.isArray(metadata.technologies) ? metadata.technologies : [],
      outcomes: metadata.outcomes || null,
      challenges: metadata.challenges || null,
      solutions: metadata.solutions || null,
      key_metrics: Array.isArray(metadata.key_metrics) ? metadata.key_metrics : [],
      region: metadata.region || null,
      confidence: this.normalizeConfidence(metadata.confidence)
    };

    return cleaned;
  }

  /**
   * Normalize industry to standard categories
   */
  normalizeIndustry(industry) {
    if (!industry) return null;

    const industries = {
      'healthcare': 'Healthcare',
      'health care': 'Healthcare',
      'medical': 'Healthcare',
      'pharma': 'Healthcare',
      'finance': 'Finance',
      'financial': 'Finance',
      'banking': 'Finance',
      'retail': 'Retail',
      'e-commerce': 'Retail',
      'ecommerce': 'Retail',
      'technology': 'Technology',
      'tech': 'Technology',
      'software': 'Technology',
      'manufacturing': 'Manufacturing',
      'automotive': 'Manufacturing',
      'energy': 'Energy',
      'utilities': 'Energy',
      'telecom': 'Telecommunications',
      'telecommunications': 'Telecommunications',
      'education': 'Education',
      'government': 'Government',
      'insurance': 'Insurance',
      'logistics': 'Logistics',
      'supply chain': 'Logistics'
    };

    const normalized = industry.toLowerCase();
    return industries[normalized] || industry;
  }

  /**
   * Normalize service line to standard categories
   */
  normalizeServiceLine(serviceLine) {
    if (!serviceLine) return null;

    const serviceLines = {
      'cloud': 'Cloud Migration',
      'cloud migration': 'Cloud Migration',
      'app dev': 'Application Development',
      'application development': 'Application Development',
      'software development': 'Application Development',
      'data': 'Data Analytics',
      'analytics': 'Data Analytics',
      'data analytics': 'Data Analytics',
      'bi': 'Data Analytics',
      'ai': 'AI/ML',
      'ml': 'AI/ML',
      'machine learning': 'AI/ML',
      'artificial intelligence': 'AI/ML',
      'consulting': 'Consulting',
      'advisory': 'Consulting',
      'devops': 'DevOps',
      'infrastructure': 'Infrastructure',
      'security': 'Security',
      'cybersecurity': 'Security',
      'qa': 'Quality Assurance',
      'testing': 'Quality Assurance'
    };

    const normalized = serviceLine.toLowerCase();
    return serviceLines[normalized] || serviceLine;
  }

  /**
   * Parse project value from various formats
   */
  parseProjectValue(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;

    const str = String(value).toLowerCase();

    // Extract numbers
    const match = str.match(/[\d,]+(?:\.\d+)?/);
    if (!match) return null;

    let num = parseFloat(match[0].replace(/,/g, ''));

    // Handle K, M, B suffixes
    if (str.includes('k')) num *= 1000;
    if (str.includes('m')) num *= 1000000;
    if (str.includes('b')) num *= 1000000000;

    return num;
  }

  /**
   * Normalize confidence score
   */
  normalizeConfidence(confidence) {
    if (!confidence) return 0.5;
    const num = parseFloat(confidence);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }

  /**
   * Get default metadata structure
   */
  getDefaultMetadata() {
    return {
      client_name: null,
      industry: null,
      domain: null,
      service_line: null,
      project_value: null,
      project_duration: null,
      technologies: [],
      outcomes: null,
      challenges: null,
      solutions: null,
      key_metrics: [],
      region: null,
      confidence: 0.3
    };
  }

  /**
   * Extract tags from text using keyword extraction
   */
  async extractTags(text) {
    try {
      const prompt = `Extract 5-10 relevant tags/keywords from the following text.
Return ONLY a JSON array of strings.

TEXT:
${text.substring(0, 2000)}

Return format: ["tag1", "tag2", "tag3", ...]

JSON:`;

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 400 },
      });

      const output = generation.response.text();
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tags = JSON.parse(jsonMatch[0]);
        return Array.isArray(tags) ? tags.slice(0, 10) : [];
      }
    } catch (error) {
      console.error('Error extracting tags:', error);
    }

    return [];
  }

  /**
   * Suggest categories based on metadata
   */
  suggestCategories(metadata) {
    const categories = [];

    // Add industry as domain category
    if (metadata.industry) {
      categories.push({
        name: metadata.industry,
        type: 'industry',
        confidence: metadata.confidence
      });
    }

    // Add service line category
    if (metadata.service_line) {
      categories.push({
        name: metadata.service_line,
        type: 'service_line',
        confidence: metadata.confidence
      });
    }

    // Add domain category
    if (metadata.domain) {
      categories.push({
        name: metadata.domain,
        type: 'domain',
        confidence: metadata.confidence
      });
    }

    // Add region category
    if (metadata.region) {
      categories.push({
        name: metadata.region,
        type: 'region',
        confidence: metadata.confidence
      });
    }

    return categories;
  }

  /**
   * Extract client context information
   */
  async extractClientContext(text) {
    try {
      const prompt = `Extract client context from this business document.

TEXT:
${text.substring(0, 2000)}

Return ONLY a JSON object:
{
  "client_size": "Enterprise|Mid-Market|SMB|Startup",
  "client_type": "B2B|B2C|B2G",
  "relationship_type": "New|Existing|Strategic Partner",
  "decision_makers": ["Names or roles of key decision makers"],
  "pain_points": ["Key pain points addressed"]
}

JSON:`;

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      });

      const output = generation.response.text();
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error extracting client context:', error);
    }

    return {
      client_size: null,
      client_type: null,
      relationship_type: null,
      decision_makers: [],
      pain_points: []
    };
  }
}

export default new MetadataExtractionService();
