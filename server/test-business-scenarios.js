const assert = require('assert');
const { parseDescriptionToStructure } = require('./parser');
const { generateBpmn, validateBpmn } = require('./bpmn-service');

function countTag(xml, tag) {
  return (String(xml || '').match(new RegExp(`<(?:\\w+:)?${tag}\\b`, 'gi')) || []).length;
}

const scenarios = [
  {
    name: 'purchase',
    title: 'Online Purchase Process',
    description: `1. Customer: Place order on website
2. System: Validate order information automatically
3. If order information is invalid: System: Display error and request re-entry
4. If order information is valid: Warehouse Staff: Check inventory
5. If out of stock: System: Send cancellation email to customer
6. If in stock: Warehouse Staff: Pack and hand over to shipper
7. Shipper: Deliver goods to customer
8. Customer: Confirm receipt of goods
9. System: Update order status to completed`,
    expect: result => {
      assert.ok(result.steps.length >= 7, 'purchase should produce at least 7 steps');
      assert.ok(result.actors.length >= 3, 'purchase should have multiple actors');
    }
  },
  {
    name: 'leave-request',
    title: 'Employee Leave Request Process',
    description: `1. Employee: Submit leave request form on HR system
2. System: Send automatic notification to direct manager
3. Manager: Review employee leave request
4. If leave duration exceeds 3 days: HR: Review and provide additional approval
5. HR: Check remaining annual leave balance
6. If insufficient leave balance: HR: Reject and notify employee
7. Manager: Approve leave request
8. System: Update leave balance and send confirmation email to employee`,
    expect: result => {
      assert.ok(result.actors.includes('HR'), 'leave request should include HR lane');
      assert.ok(result.steps.some(step => step.condition), 'leave request should include conditional steps');
    }
  },
  {
    name: 'invoice-approval',
    title: 'Supplier Invoice Approval Process',
    description: `1. Accountant: Receive invoice from supplier
2. Accountant: Verify invoice against original purchase order
3. If discrepancy found: Accountant: Contact supplier to request adjustment
4. Accountant: Submit valid invoice to manager for approval
5. Manager: Review and approve invoice
6. If invoice value exceeds 50 million: Director: Provide additional authorization
7. Director: Approve high-value invoice
8. Accountant: Process payment to supplier
9. System: Record payment and archive accounting documents`,
    expect: result => {
      assert.ok(result.actors.includes('Giám đốc') || result.actors.includes('Director'), 'invoice approval should include director lane');
      assert.ok(result.steps.filter(step => step.condition).length >= 2, 'invoice approval should include 2 conditional branches');
    }
  },
  {
    name: 'procurement-xor-and',
    title: 'Goods Procurement Process',
    description: `1. Purchaser: Create purchase order
2. Manager: Approve purchase order
3. If purchase order rejected: Purchaser: Revise purchase order
4. If purchase order approved: Purchaser: Send order to supplier
5. Simultaneously: Warehouse Staff: Prepare receiving area
6. Simultaneously: Accountant: Prepare payment documents
7. Warehouse Staff: Receive and inspect delivered goods
8. If goods do not meet specifications: Warehouse Staff: Return goods to supplier
9. If goods meet specifications: Warehouse Staff: Confirm receipt in system
10. Accountant: Process payment to supplier
11. System: Update inventory and archive documents`,
    expect: result => {
      assert.ok(result.steps.some(step => step.gatewayType === 'parallelGateway'), 'procurement should include AND gateway');
      assert.ok(result.steps.some(step => step.gatewayType === 'exclusiveGateway'), 'procurement should include XOR gateway');
    }
  },
  {
    name: 'rework-loop',
    title: 'Document Rework Flow',
    description: `1. Staff: Draft document
2. Manager: Review document
3. If document needs rework: Staff: Revise document draft
4. If document is acceptable: Manager: Approve document
5. System: Archive approved document`,
    expect: result => {
      assert.ok(result.steps.length >= 4, 'rework loop should keep all steps');
      assert.ok(result.steps.filter(step => step.condition).length >= 2, 'rework loop should include both branches');
    }
  },
  {
    name: 'happy-path-only',
    title: 'Simple Happy Path',
    description: `1. Customer: Submit service request
2. System: Register request
3. Staff: Fulfill request
4. Customer: Confirm completion`,
    expect: result => {
      assert.strictEqual(result.steps.some(step => step.condition), false, 'happy path should not introduce conditions');
      assert.ok(result.actors.length >= 2, 'happy path should still include multiple actors');
    }
  },
  {
    name: 'multi-lane-handoff',
    title: 'Multi-lane Handoff Process',
    description: `1. Receptionist: Receive submitted dossier
2. Processing Dept: Verify dossier completeness
3. Legal: Review compliance
4. Manager: Approve processing result
5. System: Notify applicant about the result`,
    expect: result => {
      assert.ok(result.actors.length >= 4, 'multi-lane handoff should include at least 4 actors');
      assert.ok(result.steps.every(step => step.actor), 'every handoff step should have actor');
    }  },
  {
    name: 'ecommerce-timeout',
    title: 'E-Commerce Order with Payment Timeout',
    description: `1. Customer: Place order on website
2. System: Generate payment invoice and send to customer email
3. Wait 30 minutes for payment notification
4. If payment received within 30 min: System: Confirm order and send shipment notification
5. If payment timeout after 30 min: System: Cancel order and send cancellation email
6. If payment received: Warehouse Staff: Prepare and pack order
7. Warehouse Staff: Hand over package to shipper
8. Shipper: Deliver goods and get customer signature
9. Customer: Confirm delivery and rate transaction
10. System: Update inventory and close order`,
    expect: result => {
      assert.ok(result.steps.some(step => /chờ|wait/i.test(step.action)), 'ecommerce timeout should include wait/timer step');
      assert.ok(result.actors.includes('Khách hàng') || result.actors.includes('Customer'), 'should have customer lane');
      assert.ok(result.steps.filter(step => step.condition).length >= 2, 'should include multiple conditional branches');
    }
  },
  {
    name: 'support-ticket-escalation',
    title: 'Customer Support Ticket with SLA & Escalation',
    description: `1. Customer: Submit support ticket via portal
2. System: Send auto-confirmation email and create ticket record
3. Support Agent: Receive and read ticket notification
4. Support Agent: Attempt to resolve issue within 4 hours (SLA)
5. If issue resolved within 4 hours: Support Agent: Close ticket and mark resolved
6. If issue NOT resolved after 4 hours: System: Send escalation alert to supervisor
7. Supervisor: Review unresolved ticket and assign to senior agent if needed
8. Senior Agent: Investigate complex issue
9. Senior Agent: Implement solution and update ticket
10. Customer: Review solution and confirm ticket closure
11. System: Send satisfaction survey to customer and archive ticket`,
    expect: result => {
      assert.ok(result.actors.length >= 3, 'escalation flow should have multiple actors');
      assert.ok(result.steps.filter(step => step.condition).length >= 2, 'should have escalation conditions');
    }
  },
  {
    name: 'batch-data-import',
    title: 'Batch Data Import with Error Handling & Retry',
    description: `1. Data Team: Prepare CSV file for import
2. System: Schedule batch import job (daily at 2 AM)
3. System: Wait for scheduled time to arrive
4. System: Start data import process from CSV
5. System: Validate each record against business rules
6. If validation error found on any record: System: Log error and move to error queue
7. If record valid: System: Insert record into database and update counter
8. If total errors > 10% of batch: System: Pause import and send alert to Data Manager
9. If errors detected: Data Manager: Review error log and fix source data
10. Data Manager: Retry import job with corrected data
11. If all records valid: System: Generate import report and send to stakeholders
12. System: Archive completed import and cleanup temporary files`,
    expect: result => {
      assert.ok(result.steps.some(step => /chờ|wait|schedule/i.test(step.action)), 'batch import should include scheduled wait');
      assert.ok(result.steps.filter(step => step.condition).length >= 2, 'should include error handling conditions');
    }
  },
  {
    name: 'saas-subscription-renewal',
    title: 'SaaS Subscription Auto-Renewal with Reminders',
    description: `1. System: Check subscription expiry date daily at midnight
2. If expiry in 30 days: System: Send first reminder email to customer
3. Wait 5 days
4. If subscription NOT renewed: System: Send second reminder (urgent)
5. Wait 5 days until 10 days before expiry
6. If subscription NOT renewed: System: Send final warning email
7. Wait 10 days until expiry date
8. On expiry date: System: Attempt to charge saved payment method
9. If payment successful: System: Extend subscription for 1 year and send confirmation
10. If payment failed: System: Disable account and notify customer of failed payment
11. Customer: View account status and can pay manually to restore access
12. If manual payment received: System: Reactivate account immediately
13. System: Archive subscription records and cleanup logs`,
    expect: result => {
      assert.ok(result.steps.some(step => /chờ|wait|schedule/i.test(step.action)), 'subscription renewal should include multiple waits');
      assert.ok(result.steps.filter(step => step.condition).length >= 3, 'should include multiple conditional branches for payment status');
    }  }
];

async function runScenario(scenario) {
  const structure = await parseDescriptionToStructure(scenario.title, scenario.description);
  scenario.expect(structure);

  const xml = await generateBpmn({ title: scenario.title, steps: structure.steps });
  const validation = await validateBpmn(xml);

  assert.strictEqual(validation.valid, true, `${scenario.name} should generate valid BPMN`);
  assert.ok(countTag(xml, 'startEvent') >= 1, `${scenario.name} should have a start event`);
  assert.ok(countTag(xml, 'endEvent') >= 1, `${scenario.name} should have an end event`);
  assert.ok(countTag(xml, 'lane') >= Math.max(1, structure.actors.length), `${scenario.name} should preserve lanes`);
}

async function run() {
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
  console.log(`Business scenarios passed: ${scenarios.length}`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
