import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

/**
 * Document Processing Service
 * Handles extraction of text from PDF, DOCX, and image files
 */
class DocumentProcessor {
  constructor() {
    this.supportedFormats = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg'];
  }

  /**
   * Process a document and extract text
   * @param {string} filePath - Path to the document
   * @returns {Promise<{text: string, metadata: object}>}
   */
  async processDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    let text = '';
    let metadata = {};

    try {
      switch (ext) {
        case '.pdf':
          ({ text, metadata } = await this.processPDF(filePath));
          break;
        case '.docx':
        case '.doc':
          ({ text, metadata } = await this.processDOCX(filePath));
          break;
        case '.txt':
          text = await fs.readFile(filePath, 'utf-8');
          metadata = { pages: 1 };
          break;
        case '.png':
        case '.jpg':
        case '.jpeg':
          ({ text, metadata } = await this.processImage(filePath));
          break;
        default:
          throw new Error(`Unsupported format: ${ext}`);
      }

      return {
        text: this.cleanText(text),
        metadata: {
          ...metadata,
          fileType: ext,
          processedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  /**
   * Extract text from PDF
   */
  async processPDF(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info,
      },
    };
  }

  /**
   * Extract text from DOCX
   */
  async processDOCX(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      metadata: {
        messages: result.messages,
      },
    };
  }

  /**
   * Extract text from image using OCR
   */
  async processImage(filePath) {
    const worker = await createWorker('eng');

    try {
      const { data } = await worker.recognize(filePath);
      return {
        text: data.text,
        metadata: {
          confidence: data.confidence,
        },
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Clean and normalize extracted text
   */
  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Extract key metadata from contract text using regex patterns
   */
  extractContractMetadata(text) {
    const metadata = {};

    // Extract parties
    const partiesPattern = /between\s+([^,]+),?\s+(?:and|&)\s+([^,\n]+)/i;
    const partiesMatch = text.match(partiesPattern);
    if (partiesMatch) {
      metadata.partyA = partiesMatch[1].trim();
      metadata.partyB = partiesMatch[2].trim();
    }

    // Extract dates
    const datePattern = /(?:effective|dated?|signed)\s+(?:on|as of)?\s*:?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i;
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      metadata.effectiveDate = dateMatch[1];
    }

    // Extract amounts/prices
    const amountPattern = /(?:total|amount|price|fee)\s*:?\s*\$?([\d,]+(?:\.\d{2})?)/i;
    const amountMatch = text.match(amountPattern);
    if (amountMatch) {
      metadata.amount = amountMatch[1].replace(/,/g, '');
    }

    // Extract contract type
    const typePattern = /(service agreement|master service agreement|sow|statement of work|nda|non-disclosure agreement|contract)/i;
    const typeMatch = text.match(typePattern);
    if (typeMatch) {
      metadata.contractType = typeMatch[1];
    }

    return metadata;
  }

  /**
   * Chunk text into smaller pieces for embedding
   * @param {string} text - Text to chunk
   * @param {number} chunkSize - Size of each chunk in characters
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<{text: string, index: number}>}
   */
  chunkText(text, chunkSize = 800, overlap = 200) {
    const chunks = [];
    let start = 0;
    let index = 0;

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length < chunkSize) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.trim(),
            index: index++,
          });
        }
        currentChunk = paragraph + '\n\n';
      }
    }

    // Add the last chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: index++,
      });
    }

    return chunks;
  }

  /**
   * Extract specific clauses from contract text
   * @param {string} text - Contract text
   * @returns {Array<{type: string, text: string}>}
   */
  extractClauses(text) {
    const clauses = [];

    // Common clause patterns
    const clausePatterns = [
      { type: 'payment_terms', pattern: /payment terms?:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'termination', pattern: /termination:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'confidentiality', pattern: /confidentiality:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'liability', pattern: /liability:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'indemnification', pattern: /indemnification:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'warranty', pattern: /warrant(?:y|ies):?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
      { type: 'sla', pattern: /service level agreement|sla:?\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i },
    ];

    for (const { type, pattern } of clausePatterns) {
      const match = text.match(pattern);
      if (match) {
        clauses.push({
          type,
          text: match[1].trim(),
        });
      }
    }

    return clauses;
  }
}

export default new DocumentProcessor();
