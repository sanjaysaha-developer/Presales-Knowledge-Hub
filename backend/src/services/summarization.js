import { GoogleGenerativeAI } from '@google/generative-ai';
import { PresalesDocument } from '../models/index.js';

/**
 * Summarization Service
 * Auto-summarizes case studies and presales documents for quick reference
 */
class SummarizationService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set. Summarization will fail until provided.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  /**
   * Generate executive summary for a case study
   * @param {string} text - Full case study text
   * @param {string} documentType - Type of document
   * @returns {Object} Summary data
   */
  async generateSummary(text, documentType = 'case_study') {
    try {
      const prompt = this.buildSummaryPrompt(text, documentType);

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 800,
        },
      });

      const textOut = generation.response.text();
      const summaryData = this.parseSummaryResponse(textOut);
      return summaryData;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Build prompt for summarization
   */
  buildSummaryPrompt(text, documentType) {
    const maxLength = 4000; // Limit input text to fit in context
    const limitedText = text.substring(0, maxLength);

    const prompts = {
      case_study: `Summarize this case study into a concise executive summary for sales/presales teams.

CASE STUDY:
${limitedText}

Create a summary with these sections (return as JSON):
{
  "title": "Catchy 10-word title",
  "executive_summary": "2-3 sentence overview highlighting key outcomes",
  "client": "Client name and industry",
  "challenge": "Main business challenge (1-2 sentences)",
  "solution": "Solution provided (2-3 sentences)",
  "impact": "Key results and metrics (2-3 bullet points as array)",
  "technologies": ["Key technologies used"],
  "duration": "Project timeline",
  "team_size": "Team size if mentioned"
}

Return ONLY valid JSON:`,

      success_story: `Summarize this success story for quick reference during client calls.

SUCCESS STORY:
${limitedText}

Create a brief summary (return as JSON):
{
  "headline": "Compelling one-liner (max 15 words)",
  "summary": "3-4 sentence summary of success",
  "key_achievements": ["3-5 key achievements as array"],
  "client_quote": "Notable client quote if available",
  "applicability": "Types of clients this applies to"
}

Return ONLY valid JSON:`,

      deck: `Summarize this presentation deck.

DECK CONTENT:
${limitedText}

Create a summary (return as JSON):
{
  "summary": "3-4 sentence overview of deck content",
  "key_slides": ["3-5 key topics covered"],
  "target_audience": "Intended audience",
  "use_cases": "When to use this deck"
}

Return ONLY valid JSON:`,

      default: `Summarize this business document for quick reference.

DOCUMENT:
${limitedText}

Create a summary (return as JSON):
{
  "summary": "3-4 sentence summary",
  "key_points": ["3-5 key points"],
  "relevance": "When this document is useful"
}

Return ONLY valid JSON:`
    };

    return prompts[documentType] || prompts.default;
  }

  /**
   * Parse LLM summary response
   */
  parseSummaryResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing summary:', error);
    }

    // Fallback: return raw response
    return {
      summary: response.substring(0, 500),
      key_points: []
    };
  }

  /**
   * Generate summary for a presales document
   * @param {string} documentId - Document ID
   */
  async summarizeDocument(documentId) {
    try {
      const doc = PresalesDocument.findById(documentId);
      if (!doc) {
        throw new Error('Document not found');
      }

      if (!doc.content || doc.content.trim().length === 0) {
        throw new Error('Document has no content to summarize');
      }

      console.log(`📝 Generating summary for: ${doc.title}`);

      const summaryData = await this.generateSummary(doc.content, doc.document_type);

      // Format summary text
      const summaryText = this.formatSummary(summaryData, doc.document_type);

      // Update document with summary
      PresalesDocument.updateSummary(documentId, summaryText);

      console.log(`✅ Summary generated for: ${doc.title}`);

      return {
        success: true,
        summary: summaryText,
        structured_data: summaryData
      };
    } catch (error) {
      console.error('Error summarizing document:', error);
      throw error;
    }
  }

  /**
   * Format summary data into readable text
   */
  formatSummary(data, documentType) {
    if (documentType === 'case_study') {
      let summary = `**${data.title || 'Case Study'}**\n\n`;
      summary += `${data.executive_summary || ''}\n\n`;

      if (data.client) {
        summary += `**Client:** ${data.client}\n\n`;
      }

      if (data.challenge) {
        summary += `**Challenge:** ${data.challenge}\n\n`;
      }

      if (data.solution) {
        summary += `**Solution:** ${data.solution}\n\n`;
      }

      if (data.impact && Array.isArray(data.impact)) {
        summary += `**Impact:**\n`;
        data.impact.forEach(item => {
          summary += `• ${item}\n`;
        });
        summary += '\n';
      }

      if (data.technologies && Array.isArray(data.technologies) && data.technologies.length > 0) {
        summary += `**Technologies:** ${data.technologies.join(', ')}\n`;
      }

      return summary.trim();
    }

    if (documentType === 'success_story') {
      let summary = `**${data.headline || 'Success Story'}**\n\n`;
      summary += `${data.summary || ''}\n\n`;

      if (data.key_achievements && Array.isArray(data.key_achievements)) {
        summary += `**Key Achievements:**\n`;
        data.key_achievements.forEach(item => {
          summary += `• ${item}\n`;
        });
      }

      return summary.trim();
    }

    // Default format
    return data.summary || JSON.stringify(data, null, 2);
  }

  /**
   * Generate quick highlights for RFP/client calls
   * @param {string} documentId - Document ID
   * @returns {Object} Quick reference data
   */
  async generateQuickHighlights(documentId) {
    try {
      const doc = PresalesDocument.findById(documentId);
      if (!doc) {
        throw new Error('Document not found');
      }

      const prompt = `Extract 3-5 quick talking points from this case study for use in client calls or RFP responses.

TEXT:
${doc.content.substring(0, 3000)}

Return as JSON array:
["Talking point 1 (max 20 words)", "Talking point 2", ...]

JSON:`;

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      });

      const output = generation.response.text();
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const highlights = JSON.parse(jsonMatch[0]);
        return {
          document_id: documentId,
          highlights: highlights.slice(0, 5),
          generated_at: new Date().toISOString()
        };
      }

      throw new Error('Could not extract highlights');
    } catch (error) {
      console.error('Error generating highlights:', error);
      throw error;
    }
  }

  /**
   * Batch summarize multiple documents
   */
  async bulkSummarize(documentIds) {
    const results = [];

    for (const docId of documentIds) {
      try {
        const result = await this.summarizeDocument(docId);
        results.push({
          document_id: docId,
          ...result
        });

        // Small delay to avoid overwhelming the LLM
        await this.sleep(1000);
      } catch (error) {
        results.push({
          document_id: docId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Extract key metrics/stats from case study
   */
  async extractKeyMetrics(text) {
    try {
      const prompt = `Extract quantifiable metrics and statistics from this case study.

TEXT:
${text.substring(0, 2000)}

Return as JSON array of objects:
[
  {"metric": "Metric description", "value": "Percentage or number", "category": "cost|time|performance|quality"},
  ...
]

Examples:
[
  {"metric": "Cost reduction", "value": "40%", "category": "cost"},
  {"metric": "Time to market", "value": "6 months faster", "category": "time"},
  {"metric": "System uptime", "value": "99.9%", "category": "performance"}
]

JSON:`;

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const generation = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      });

      const output = generation.response.text();
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('Error extracting metrics:', error);
      return [];
    }
  }

  /**
   * Helper: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new SummarizationService();
