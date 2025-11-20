import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const API_VERSION = process.env.API_VERSION || 'v1';
const API_BASE = `${BASE_URL}/api/${API_VERSION}`;

console.log('🧪 Testing Supabase Integration for Proposals and Templates\n');
console.log(`📍 API Base: ${API_BASE}`);
console.log(`🔧 Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'Not configured (will use SQLite fallback)'}\n`);

/**
 * Test function to make API requests
 */
async function testEndpoint(method, endpoint, data = null, description = '') {
  try {
    const url = `${API_BASE}${endpoint}`;
    console.log(`🔍 Testing ${method} ${endpoint} ${description ? `- ${description}` : ''}`);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (response.ok) {
      console.log(`✅ SUCCESS: ${response.status} - ${result.message || 'OK'}`);
      return { success: true, data: result };
    } else {
      console.log(`❌ FAILED: ${response.status} - ${result.error || result.message}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('📋 Testing Proposals API\n');

  // Test 1: Get all proposals
  const proposalsList = await testEndpoint('GET', '/proposals', null, 'List all proposals');

  // Test 2: Create a new proposal
  const newProposal = {
    title: 'Test Proposal - Supabase Integration',
    client_name: 'Test Client Corp',
    project_scope: 'Integration testing for Supabase database operations',
    price: 50000,
    currency: 'USD',
    payment_terms: 'Net 30',
    start_date: '2025-01-01',
    end_date: '2025-06-01',
    deliverables: 'Complete Supabase integration testing',
    sla_terms: '99.9% uptime',
  };

  const createdProposal = await testEndpoint('POST', '/proposals', newProposal, 'Create new proposal');
  let proposalId = null;

  if (createdProposal.success) {
    proposalId = createdProposal.data.id;
    console.log(`📝 Created proposal with ID: ${proposalId}\n`);
  } else {
    console.log('⚠️  Skipping update/delete tests due to creation failure\n');
  }

  // Test 3: Get single proposal (if created successfully)
  if (proposalId) {
    await testEndpoint('GET', `/proposals/${proposalId}`, null, 'Get single proposal');

    // Test 4: Update proposal
    const updateData = {
      title: 'Updated Test Proposal - Supabase Integration',
      price: 75000,
    };
    await testEndpoint('PUT', `/proposals/${proposalId}`, updateData, 'Update proposal');

    // Test 5: Delete proposal
    await testEndpoint('DELETE', `/proposals/${proposalId}`, null, 'Delete proposal');
  }

  console.log('\n📋 Testing Templates API\n');

  // Test 6: Get all templates
  const templatesList = await testEndpoint('GET', '/templates', null, 'List all templates');

  // Test 7: Create a new template
  const newTemplate = {
    name: 'Test Template - Supabase Integration',
    description: 'Template for testing Supabase database operations',
    contract_type: 'MSA',
    version: '1.0',
    content: 'This is a test template content for {{ClientName}}. Price: {{Price}}',
    conditional_clauses: null,
  };

  const createdTemplate = await testEndpoint('POST', '/templates', newTemplate, 'Create new template');
  let templateId = null;

  if (createdTemplate.success) {
    templateId = createdTemplate.data.id;
    console.log(`📄 Created template with ID: ${templateId}\n`);
  } else {
    console.log('⚠️  Skipping template update/delete tests due to creation failure\n');
  }

  // Test 8: Get single template (if created successfully)
  if (templateId) {
    await testEndpoint('GET', `/templates/${templateId}`, null, 'Get single template');
    await testEndpoint('GET', `/templates/${templateId}/preview`, null, 'Preview template');

    // Test 9: Update template
    const templateUpdateData = {
      description: 'Updated template description for Supabase testing',
      version: '1.1',
    };
    await testEndpoint('PUT', `/templates/${templateId}`, templateUpdateData, 'Update template');

    // Test 10: Approve template
    await testEndpoint('PUT', `/templates/${templateId}/approve`, null, 'Approve template');

    // Test 11: Delete template
    await testEndpoint('DELETE', `/templates/${templateId}`, null, 'Delete template');
  }

  console.log('\n🏁 Testing Complete!');
  console.log('\n📝 Summary:');
  console.log('- ✅ If all tests passed, Supabase integration is working correctly');
  console.log('- 🔄 If some tests failed but others passed, check your Supabase configuration');
  console.log('- 📊 If all tests failed, the API server may not be running or Supabase credentials are missing');
  console.log('\n💡 To enable Supabase:');
  console.log('1. Set SUPABASE_URL and SUPABASE_KEY in your .env file');
  console.log('2. Ensure your Supabase database has the required tables (proposals, templates)');
  console.log('3. Make sure your Supabase RLS policies allow the operations');
}

// Handle missing fetch in older Node versions
if (!global.fetch) {
  global.fetch = fetch;
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
