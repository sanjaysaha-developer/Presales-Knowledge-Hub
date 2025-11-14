import embeddingService from './embeddingService.js';
import ragService from './ragService.js';

/**
 * Contract Validation Service
 * Validates contracts against proposals using rule-based and semantic checks
 */
class ValidationService {
  constructor() {
    this.priceTolerance = parseFloat(process.env.PRICE_TOLERANCE_PERCENT || '5') / 100;
    this.confidenceThreshold = parseFloat(process.env.VALIDATION_CONFIDENCE_THRESHOLD || '0.8');
  }

  /**
   * Validate a contract against a proposal
   * @param {string} contractText - The contract text
   * @param {object} proposal - The proposal object
   * @returns {Promise<{overall_score, checks, mismatches, severity, status}>}
   */
  async validateContract(contractText, proposal) {
    console.log('🔍 Starting contract validation...');

    const checks = [];
    const mismatches = [];

    // Rule-based checks
    const ruleChecks = await this.performRuleBasedChecks(contractText, proposal);
    checks.push(...ruleChecks.checks);
    mismatches.push(...ruleChecks.mismatches);

    // Semantic checks
    const semanticChecks = await this.performSemanticChecks(contractText, proposal);
    checks.push(...semanticChecks.checks);
    mismatches.push(...semanticChecks.mismatches);

    // Calculate overall score
    const passedChecks = checks.filter(c => c.status === 'pass').length;
    const overall_score = checks.length > 0 ? passedChecks / checks.length : 0;

    // Determine severity
    const criticalMismatches = mismatches.filter(m => m.severity === 'critical');
    const highMismatches = mismatches.filter(m => m.severity === 'high');

    let severity = 'low';
    if (criticalMismatches.length > 0) {
      severity = 'critical';
    } else if (highMismatches.length > 0) {
      severity = 'high';
    } else if (mismatches.length > 0) {
      severity = 'medium';
    }

    // Determine status
    let status = 'pass';
    if (criticalMismatches.length > 0 || overall_score < 0.7) {
      status = 'fail';
    } else if (mismatches.length > 0 || overall_score < 0.9) {
      status = 'warning';
    }

    console.log(`✅ Validation complete: ${status.toUpperCase()} (score: ${(overall_score * 100).toFixed(1)}%)`);

    return {
      overall_score,
      checks,
      mismatches,
      severity,
      status,
    };
  }

  /**
   * Perform rule-based validation checks
   */
  async performRuleBasedChecks(contractText, proposal) {
    const checks = [];
    const mismatches = [];

    // Check 1: Party names
    const clientNameCheck = this.checkClientName(contractText, proposal.client_name);
    checks.push(clientNameCheck);
    if (clientNameCheck.status !== 'pass') {
      mismatches.push({
        field: 'client_name',
        expected: proposal.client_name,
        found: clientNameCheck.found || 'Not found',
        severity: 'critical',
        suggestion: `Update contract to include client name: "${proposal.client_name}"`,
      });
    }

    // Check 2: Price validation
    const priceCheck = this.checkPrice(contractText, proposal.price, proposal.currency);
    checks.push(priceCheck);
    if (priceCheck.status !== 'pass') {
      mismatches.push({
        field: 'price',
        expected: `${proposal.currency || 'USD'} ${proposal.price}`,
        found: priceCheck.found || 'Not found',
        severity: priceCheck.severity || 'high',
        suggestion: priceCheck.suggestion,
      });
    }

    // Check 3: Dates validation
    if (proposal.start_date) {
      const startDateCheck = this.checkDate(contractText, proposal.start_date, ['start', 'commencement', 'effective']);
      checks.push(startDateCheck);
      if (startDateCheck.status !== 'pass') {
        mismatches.push({
          field: 'start_date',
          expected: proposal.start_date,
          found: startDateCheck.found || 'Not found',
          severity: 'medium',
          suggestion: `Verify start date: ${proposal.start_date}`,
        });
      }
    }

    if (proposal.end_date) {
      const endDateCheck = this.checkDate(contractText, proposal.end_date, ['end', 'termination', 'expiry']);
      checks.push(endDateCheck);
      if (endDateCheck.status !== 'pass') {
        mismatches.push({
          field: 'end_date',
          expected: proposal.end_date,
          found: endDateCheck.found || 'Not found',
          severity: 'medium',
          suggestion: `Verify end date: ${proposal.end_date}`,
        });
      }
    }

    // Check 4: Payment terms
    if (proposal.payment_terms) {
      const paymentTermsCheck = this.checkPaymentTerms(contractText, proposal.payment_terms);
      checks.push(paymentTermsCheck);
      if (paymentTermsCheck.status !== 'pass') {
        mismatches.push({
          field: 'payment_terms',
          expected: proposal.payment_terms,
          found: paymentTermsCheck.found || 'Not found',
          severity: 'high',
          suggestion: `Ensure payment terms match proposal: "${proposal.payment_terms}"`,
        });
      }
    }

    return { checks, mismatches };
  }

  /**
   * Perform semantic validation using embeddings
   */
  async performSemanticChecks(contractText, proposal) {
    const checks = [];
    const mismatches = [];

    try {
      // Check project scope alignment
      if (proposal.project_scope) {
        const scopeCheck = await this.semanticSimilarityCheck(
          contractText,
          proposal.project_scope,
          'Project Scope',
          ['scope', 'services', 'work', 'deliverables']
        );
        checks.push(scopeCheck);

        if (scopeCheck.status !== 'pass') {
          mismatches.push({
            field: 'project_scope',
            expected: proposal.project_scope,
            found: 'Semantic mismatch detected',
            severity: 'high',
            confidence: scopeCheck.confidence,
            suggestion: 'Review scope section to ensure alignment with proposal',
          });
        }
      }

      // Check deliverables
      if (proposal.deliverables) {
        const deliverablesCheck = await this.semanticSimilarityCheck(
          contractText,
          proposal.deliverables,
          'Deliverables',
          ['deliverable', 'output', 'product', 'result']
        );
        checks.push(deliverablesCheck);

        if (deliverablesCheck.status !== 'pass') {
          mismatches.push({
            field: 'deliverables',
            expected: proposal.deliverables,
            found: 'Semantic mismatch detected',
            severity: 'high',
            confidence: deliverablesCheck.confidence,
            suggestion: 'Verify all deliverables from proposal are included',
          });
        }
      }

      // Check SLA terms
      if (proposal.sla_terms) {
        const slaCheck = await this.semanticSimilarityCheck(
          contractText,
          proposal.sla_terms,
          'SLA Terms',
          ['sla', 'service level', 'availability', 'response time', 'uptime']
        );
        checks.push(slaCheck);

        if (slaCheck.status !== 'pass') {
          mismatches.push({
            field: 'sla_terms',
            expected: proposal.sla_terms,
            found: 'Semantic mismatch detected',
            severity: 'medium',
            confidence: slaCheck.confidence,
            suggestion: 'Verify SLA commitments match proposal',
          });
        }
      }
    } catch (error) {
      console.error('Semantic validation error:', error);
      checks.push({
        name: 'Semantic Validation',
        status: 'error',
        message: 'Semantic validation failed: ' + error.message,
      });
    }

    return { checks, mismatches };
  }

  /**
   * Check if client name appears in contract
   */
  checkClientName(contractText, clientName) {
    const found = contractText.includes(clientName);

    return {
      name: 'Client Name Check',
      field: 'client_name',
      status: found ? 'pass' : 'fail',
      expected: clientName,
      found: found ? clientName : null,
      message: found
        ? `Client name "${clientName}" found in contract`
        : `Client name "${clientName}" NOT found in contract`,
    };
  }

  /**
   * Check if price matches (with tolerance)
   */
  checkPrice(contractText, expectedPrice, currency = 'USD') {
    // Extract price from contract
    const pricePattern = /(?:total|amount|price|fee|sum)\s*:?\s*(?:of\s+)?(?:USD|EUR|GBP|\$)?\s*([\d,]+(?:\.\d{2})?)/gi;
    const matches = [...contractText.matchAll(pricePattern)];

    if (matches.length === 0) {
      return {
        name: 'Price Check',
        field: 'price',
        status: 'fail',
        expected: expectedPrice,
        found: null,
        message: 'No price found in contract',
        severity: 'critical',
        suggestion: `Add price: ${currency} ${expectedPrice}`,
      };
    }

    // Check each found price
    for (const match of matches) {
      const foundPrice = parseFloat(match[1].replace(/,/g, ''));
      const difference = Math.abs(foundPrice - expectedPrice);
      const percentDiff = difference / expectedPrice;

      if (percentDiff <= this.priceTolerance) {
        return {
          name: 'Price Check',
          field: 'price',
          status: 'pass',
          expected: expectedPrice,
          found: foundPrice,
          message: `Price matches (${currency} ${foundPrice})`,
        };
      }
    }

    // Found prices but none match
    const foundPrice = parseFloat(matches[0][1].replace(/,/g, ''));
    return {
      name: 'Price Check',
      field: 'price',
      status: 'fail',
      expected: expectedPrice,
      found: foundPrice,
      message: `Price mismatch: expected ${currency} ${expectedPrice}, found ${currency} ${foundPrice}`,
      severity: 'critical',
      suggestion: `Update price to ${currency} ${expectedPrice}`,
    };
  }

  /**
   * Check if date appears in contract
   */
  checkDate(contractText, expectedDate, keywords) {
    // Simple date check - look for the date near relevant keywords
    const dateStr = expectedDate.toString();
    const found = contractText.includes(dateStr);

    if (found) {
      return {
        name: `Date Check (${keywords.join('/')})`,
        field: keywords[0] + '_date',
        status: 'pass',
        expected: dateStr,
        found: dateStr,
        message: `Date ${dateStr} found in contract`,
      };
    }

    return {
      name: `Date Check (${keywords.join('/')})`,
      field: keywords[0] + '_date',
      status: 'warning',
      expected: dateStr,
      found: null,
      message: `Date ${dateStr} not explicitly found`,
    };
  }

  /**
   * Check payment terms
   */
  checkPaymentTerms(contractText, expectedTerms) {
    const lowerContract = contractText.toLowerCase();
    const lowerTerms = expectedTerms.toLowerCase();

    // Simple substring match
    const found = lowerContract.includes(lowerTerms);

    if (found) {
      return {
        name: 'Payment Terms Check',
        field: 'payment_terms',
        status: 'pass',
        expected: expectedTerms,
        found: expectedTerms,
        message: `Payment terms "${expectedTerms}" found`,
      };
    }

    return {
      name: 'Payment Terms Check',
      field: 'payment_terms',
      status: 'fail',
      expected: expectedTerms,
      found: null,
      message: `Payment terms "${expectedTerms}" not found`,
    };
  }

  /**
   * Semantic similarity check using embeddings
   */
  async semanticSimilarityCheck(contractText, expectedContent, checkName, keywords) {
    try {
      // Extract relevant sections from contract based on keywords
      const sections = this.extractRelevantSections(contractText, keywords);

      if (sections.length === 0) {
        return {
          name: checkName,
          status: 'fail',
          confidence: 0,
          message: `No relevant section found for ${checkName}`,
        };
      }

      // Calculate semantic similarity
      const expectedEmbedding = await embeddingService.generateEmbeddings(expectedContent);
      let maxSimilarity = 0;

      for (const section of sections) {
        const sectionEmbedding = await embeddingService.generateEmbeddings(section);
        const similarity = this.cosineSimilarity(expectedEmbedding, sectionEmbedding);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      const status = maxSimilarity >= this.confidenceThreshold ? 'pass' : 'fail';

      return {
        name: checkName,
        status,
        confidence: maxSimilarity,
        expected: expectedContent,
        message: `Semantic similarity: ${(maxSimilarity * 100).toFixed(1)}% (threshold: ${(this.confidenceThreshold * 100)}%)`,
      };
    } catch (error) {
      return {
        name: checkName,
        status: 'error',
        message: `Semantic check failed: ${error.message}`,
      };
    }
  }

  /**
   * Extract relevant sections based on keywords
   */
  extractRelevantSections(text, keywords) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = [];
    let inRelevantSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      // Check if line contains any keyword
      const hasKeyword = keywords.some(keyword => line.includes(keyword.toLowerCase()));

      if (hasKeyword) {
        inRelevantSection = true;
        currentSection = [lines[i]];
      } else if (inRelevantSection) {
        if (line.trim() === '' && currentSection.length > 5) {
          // End of section
          sections.push(currentSection.join('\n'));
          currentSection = [];
          inRelevantSection = false;
        } else {
          currentSection.push(lines[i]);
        }
      }
    }

    // Add last section if any
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }

    return sections;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Generate validation report summary
   */
  generateReport(validationResult) {
    const { overall_score, checks, mismatches, severity, status } = validationResult;

    let report = `# Contract Validation Report\n\n`;
    report += `**Overall Score:** ${(overall_score * 100).toFixed(1)}%\n`;
    report += `**Status:** ${status.toUpperCase()}\n`;
    report += `**Severity:** ${severity.toUpperCase()}\n\n`;

    if (mismatches.length > 0) {
      report += `## Mismatches Found (${mismatches.length})\n\n`;

      for (const mismatch of mismatches) {
        report += `### ${mismatch.field}\n`;
        report += `- **Severity:** ${mismatch.severity}\n`;
        report += `- **Expected:** ${mismatch.expected}\n`;
        report += `- **Found:** ${mismatch.found}\n`;
        report += `- **Suggestion:** ${mismatch.suggestion}\n\n`;
      }
    } else {
      report += `## ✅ No mismatches found\n\n`;
    }

    report += `## All Checks (${checks.length})\n\n`;
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      report += `${icon} **${check.name}:** ${check.message}\n`;
    }

    return report;
  }
}

export default new ValidationService();
