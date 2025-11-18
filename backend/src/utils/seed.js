import { v4 as uuidv4 } from 'uuid';
import { Template, Proposal } from '../models/index.js';
import { initDatabase } from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Initialize database
  initDatabase();

  try {

    // Read MSA template
    const msaTemplatePath = path.join(__dirname, '../../../data/templates/msa-template.txt');
    let msaContent = '';
    try {
      msaContent = await fs.readFile(msaTemplatePath, 'utf-8');
    } catch (error) {
      console.warn('   ⚠️  MSA template file not found, using default');
      msaContent = `MASTER SERVICES AGREEMENT

This Master Services Agreement is entered into as of {{EffectiveDate}} between {{PartyA}} and {{PartyB}}.

SCOPE: {{Scope}}
DELIVERABLES: {{Deliverables}}
PRICE: {{Price}}
PAYMENT TERMS: {{PaymentTerms}}
TERM: {{StartDate}} to {{EndDate}}
SLA: {{SLA}}`;
    }

    const msaTemplateId = uuidv4();
    Template.create({
      id: msaTemplateId,
      name: 'Master Services Agreement',
      description: 'Standard MSA template for service engagements',
      contract_type: 'MSA',
      version: '1.0',
      content: msaContent,
      placeholders: JSON.stringify([
        { name: 'PartyA', type: 'text', required: true },
        { name: 'PartyB', type: 'text', required: true },
        { name: 'ClientAddress', type: 'address', required: false },
        { name: 'ProviderAddress', type: 'address', required: false },
        { name: 'EffectiveDate', type: 'date', required: true },
        { name: 'Scope', type: 'textarea', required: true },
        { name: 'Deliverables', type: 'textarea', required: true },
        { name: 'Price', type: 'number', required: true },
        { name: 'PaymentTerms', type: 'text', required: true },
        { name: 'StartDate', type: 'date', required: true },
        { name: 'EndDate', type: 'date', required: true },
        { name: 'SLA', type: 'textarea', required: false },
      ]),
      conditional_clauses: JSON.stringify([
        {
          id: 'sla_clause',
          condition: 'price > 50000',
          text: 'Service Level Agreement with 99.9% uptime guarantee',
        },
      ]),
      approved_by: 'system',
      approved_at: new Date().toISOString(),
      is_active: 1,
      created_by: 'system',
    });

    const sowTemplateId = uuidv4();
    Template.create({
      id: sowTemplateId,
      name: 'Statement of Work',
      description: 'SOW template for specific project engagements',
      contract_type: 'SOW',
      version: '1.0',
      content: `STATEMENT OF WORK

Project: {{ProjectTitle}}
Client: {{PartyA}}
Service Provider: {{PartyB}}

1. PROJECT SCOPE
{{Scope}}

2. DELIVERABLES
{{Deliverables}}

3. TIMELINE
Start Date: {{StartDate}}
End Date: {{EndDate}}

4. PRICING
Total Cost: {{Price}}
Payment Terms: {{PaymentTerms}}

5. ACCEPTANCE CRITERIA
{{SLA}}`,
      placeholders: JSON.stringify([
        { name: 'ProjectTitle', type: 'text', required: true },
        { name: 'PartyA', type: 'text', required: true },
        { name: 'PartyB', type: 'text', required: true },
        { name: 'Scope', type: 'textarea', required: true },
        { name: 'Deliverables', type: 'textarea', required: true },
        { name: 'Price', type: 'number', required: true },
        { name: 'PaymentTerms', type: 'text', required: true },
        { name: 'StartDate', type: 'date', required: true },
        { name: 'EndDate', type: 'date', required: true },
        { name: 'SLA', type: 'textarea', required: false },
      ]),
      approved_by: 'system',
      approved_at: new Date().toISOString(),
      is_active: 1,
      created_by: 'system',
    });

    console.log('✅ Created 2 templates (MSA, SOW)\n');

    // Create sample proposals
    console.log('💼 Creating proposals...');

    Proposal.create({
      id: uuidv4(),
      title: 'Enterprise Software Development',
      client_name: 'Acme Corporation',
      project_scope: 'Development of a custom CRM system with integrations to existing ERP, including mobile applications for iOS and Android. The system will support up to 1000 concurrent users and include advanced reporting and analytics capabilities.',
      price: 125000,
      currency: 'USD',
      payment_terms: 'Net 30, with 50% upfront, 30% at milestone completion, 20% upon final delivery',
      milestones: JSON.stringify([
        { name: 'Requirements & Design', date: '2024-03-15', payment: 50000 },
        { name: 'Development & Testing', date: '2024-06-15', payment: 37500 },
        { name: 'Deployment & Training', date: '2024-08-15', payment: 37500 },
      ]),
      start_date: '2024-02-01',
      end_date: '2024-08-31',
      deliverables: 'Web application, iOS app, Android app, API documentation, admin dashboard, user training materials',
      sla_terms: '99.9% uptime, <500ms response time, 24/7 support during business hours, 4-hour response time for critical issues',
      metadata: JSON.stringify({
        industry: 'Technology',
        contact: 'john.doe@acme.com',
        estimatedUsers: 1000,
      }),
      created_by: 'system',
    });

    Proposal.create({
      id: uuidv4(),
      title: 'Cloud Infrastructure Migration',
      client_name: 'TechStart Inc.',
      project_scope: 'Migration of on-premise infrastructure to AWS cloud, including database migration, application containerization, and setup of CI/CD pipelines.',
      price: 85000,
      currency: 'USD',
      payment_terms: 'Net 30, quarterly payments',
      milestones: JSON.stringify([
        { name: 'Assessment & Planning', date: '2024-03-01', payment: 21250 },
        { name: 'Initial Migration', date: '2024-04-15', payment: 21250 },
        { name: 'Application Migration', date: '2024-06-01', payment: 21250 },
        { name: 'Optimization & Handover', date: '2024-07-15', payment: 21250 },
      ]),
      start_date: '2024-02-15',
      end_date: '2024-07-31',
      deliverables: 'Migrated infrastructure, CI/CD pipelines, documentation, team training, 30-day post-migration support',
      sla_terms: '99.95% uptime, automated backups, disaster recovery plan, 2-hour response time for critical issues',
      metadata: JSON.stringify({
        industry: 'SaaS',
        contact: 'cto@techstart.com',
        currentInfra: 'On-premise data center',
      }),
      created_by: 'system',
    });

    Proposal.create({
      id: uuidv4(),
      title: 'Data Analytics Platform',
      client_name: 'Global Retail Co.',
      project_scope: 'Development of a real-time data analytics platform for retail operations, including sales forecasting, inventory optimization, and customer behavior analysis.',
      price: 95000,
      currency: 'USD',
      payment_terms: 'Net 45, 40% upfront, 40% at UAT, 20% at go-live',
      milestones: JSON.stringify([
        { name: 'Data Pipeline Setup', date: '2024-03-30', payment: 38000 },
        { name: 'Analytics Engine', date: '2024-05-30', payment: 38000 },
        { name: 'Dashboard & Reports', date: '2024-07-30', payment: 19000 },
      ]),
      start_date: '2024-03-01',
      end_date: '2024-08-15',
      deliverables: 'Data pipelines, analytics engine, executive dashboards, predictive models, API access, documentation',
      sla_terms: 'Real-time data processing (<5 min latency), 99.9% availability, daily automated reports',
      metadata: JSON.stringify({
        industry: 'Retail',
        contact: 'analytics@globalretail.com',
        dataVolume: '10TB monthly',
      }),
      created_by: 'system',
    });

    console.log('✅ Created 3 sample proposals\n');

    console.log('✅ Database seeded successfully!\n');
    console.log('📝 Summary:');
    console.log(`   - Templates: ${Template.count()}`);
    console.log(`   - Proposals: ${Proposal.count()}\n`);

    console.log('🎯 You can now:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Access the dashboard directly');
    console.log('   3. Generate contracts from proposals\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seed;
