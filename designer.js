/**
 * BPMN Studio — Designer v2
 * White theme + Node.js backend integration
 */

/* ─── EXAMPLES ────────────────────────────────────────────────── */
const EXAMPLES = {
  purchase: {
    title: 'Online Purchase Process',
    desc: `1. Customer: Place order on website
2. System: Validate order information automatically
3. If order information is invalid: System: Display error and request re-entry
4. If order information is valid: Warehouse Staff: Check inventory
5. If out of stock: System: Send cancellation email to customer
6. If in stock: Warehouse Staff: Pack and hand over to shipper
7. Shipper: Deliver goods to customer
8. Customer: Confirm receipt of goods
9. System: Update order status to completed`
  },
  pharmacy: {
    title: 'Pharmacy Dispensing Process',
    desc: `1. Customer: Arrive at pharmacy with doctor prescription
2. Pharmacist: Receive and validate prescription
3. System: Perform automated drug interaction check (DUR)
4. If warning detected: Pharmacist: Review and decide whether to override
5. Technician: Dispense medication from storage
6. Technician: Label and package medication
7. Pharmacist: Perform quality check and confirm before handover
8. System: Generate invoice and update patient records
9. Customer: Pay and receive medication`
  },
  leave: {
    title: 'Employee Leave Request Process',
    desc: `1. Employee: Submit leave request form on HR system
2. System: Send automatic notification to direct manager
3. Manager: Review employee leave request
4. If leave duration exceeds 3 days: HR: Review and provide additional approval
5. HR: Check remaining annual leave balance
6. If insufficient leave balance: HR: Reject and notify employee
7. Manager: Approve leave request
8. System: Update leave balance and send confirmation email to employee`
  },
  invoice: {
    title: 'Supplier Invoice Approval Process',
    desc: `1. Accountant: Receive invoice from supplier
2. Accountant: Verify invoice against original purchase order
3. If discrepancy found: Accountant: Contact supplier to request adjustment
4. Accountant: Submit valid invoice to manager for approval
5. Manager: Review and approve invoice
6. If invoice value exceeds 50 million: Director: Provide additional authorization
7. Director: Approve high-value invoice
8. Accountant: Process payment to supplier
9. System: Record payment and archive accounting documents`
  },
  procurement: {
    title: 'Goods Procurement Process (AND Gateway)',
    desc: `1. Purchaser: Create purchase order
2. Manager: Approve purchase order
3. If purchase order rejected: Purchaser: Revise purchase order
4. If purchase order approved: Purchaser: Send order to supplier
5. Simultaneously: Warehouse Staff: Prepare receiving area
6. Simultaneously: Accountant: Prepare payment documents
7. Warehouse Staff: Receive and inspect delivered goods
8. If goods do not meet specifications: Warehouse Staff: Return goods to supplier
9. If goods meet specifications: Warehouse Staff: Confirm receipt in system
10. Accountant: Process payment to supplier
11. System: Update inventory and archive documents`
  },
  handoff: {
    title: 'Multi-lane Handoff Process',
    desc: `1. Receptionist: Receive submitted dossier
2. Processing Dept: Verify dossier completeness
3. Legal: Review compliance requirements
4. Manager: Approve processing result
5. System: Notify applicant about the result`
  },
  ecommerce_timeout: {
    title: 'E-Commerce Order with Payment Timeout',
    desc: `1. Customer: Place order on website
2. System: Generate payment invoice and send to customer email
3. Wait 30 minutes for payment notification
4. If payment received within 30 min: System: Confirm order and send shipment notification
5. If payment timeout after 30 min: System: Cancel order and send cancellation email
6. If payment received: Warehouse Staff: Prepare and pack order
7. Warehouse Staff: Hand over package to shipper
8. Shipper: Deliver goods and get customer signature
9. Customer: Confirm delivery and rate transaction
10. System: Update inventory and close order`
  },
  support_ticket_escalation: {
    title: 'Customer Support Ticket with SLA & Escalation',
    desc: `1. Customer: Submit support ticket via portal
2. System: Send auto-confirmation email and create ticket record
3. Support Agent: Receive and read ticket notification
4. Support Agent: Attempt to resolve issue within 4 hours (SLA)
5. If issue resolved within 4 hours: Support Agent: Close ticket and mark resolved
6. If issue NOT resolved after 4 hours: System: Send escalation alert to supervisor
7. Supervisor: Review unresolved ticket and assign to senior agent if needed
8. Senior Agent: Investigate complex issue
9. Senior Agent: Implement solution and update ticket
10. Customer: Review solution and confirm ticket closure
11. System: Send satisfaction survey to customer and archive ticket`
  },
  batch_data_import: {
    title: 'Batch Data Import with Error Handling & Retry',
    desc: `1. Data Team: Prepare CSV file for import
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
12. System: Archive completed import and cleanup temporary files`
  },
  saas_subscription_renewal: {
    title: 'SaaS Subscription Auto-Renewal with Reminders',
    desc: `1. System: Check subscription expiry date daily at midnight
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
13. System: Archive subscription records and cleanup logs`
  }
};

/* ─── SERVER CONFIG ───────────────────────────────────────────── */
// Tự động chọn API: nếu chạy ở localhost thì gọi máy nhà, nếu lên Vercel thì gọi Railway
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal 
  ? 'http://localhost:3721/api' 
  : 'https://bpmn-tool-production.up.railway.app/api';
let serverAvailable = false;

async function checkServer() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    serverAvailable = r.ok;
  } catch { serverAvailable = false; }
  updateServerBadge();
}

function updateServerBadge() {
  const el = document.getElementById('server-status-badge');
  if (!el) return;
  if (serverAvailable) {
    el.textContent = '⬤ Server Online';
    el.className = 'server-badge online';
  } else {
    el.textContent = '⬤ Offline';
    el.className = 'server-badge offline';
  }
}

/* ─── STATE ───────────────────────────────────────────────────── */
const state = {
  step: 1,
  title: '',
  desc: '',
  steps: [],
  xml: '',
  review: {
    warnings: [],
    checklist: [],
  },
  viewer: null,
  assistantCollapsed: localStorage.getItem('diagram_assistant_collapsed') !== '0',
  focusMode: false,
};

function getProcessStats(steps) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const lanes = [...new Set(safeSteps.map(step => String(step.actor || '').trim()).filter(Boolean))];
  return {
    laneCount: lanes.length,
    taskCount: safeSteps.length,
    gatewayCount: safeSteps.filter(step => step.gatewayType || step.condition).length,
    lanes,
  };
}

function renderLogicSummary(steps) {
  const laneEl = document.getElementById('logic-stat-lanes');
  const taskEl = document.getElementById('logic-stat-tasks');
  const gatewayEl = document.getElementById('logic-stat-gateways');
  const hintEl = document.getElementById('logic-lane-hint');
  if (!laneEl || !taskEl || !gatewayEl || !hintEl) return;

  const stats = getProcessStats(steps);
  laneEl.textContent = String(stats.laneCount);
  taskEl.textContent = String(stats.taskCount);
  gatewayEl.textContent = String(stats.gatewayCount);

  if (stats.taskCount === 0) {
    hintEl.textContent = 'Nhập mô tả để bắt đầu.';
  } else if (stats.laneCount <= 1) {
    hintEl.textContent = 'Hiện mới có 1 lane. Nếu quy trình có nhiều vai trò, hãy chỉnh cột Actor trước khi generate.';
  } else {
    hintEl.textContent = `Lane: ${stats.lanes.join(' · ')}`;
  }
}

function renderDiagramInsights(steps) {
  const bar = document.getElementById('diagram-insight-bar');
  const lanes = document.getElementById('diagram-insight-lanes');
  const tasks = document.getElementById('diagram-insight-steps');
  if (!bar || !lanes || !tasks) return;

  const stats = getProcessStats(steps);
  bar.classList.toggle('hidden', stats.taskCount === 0);
  lanes.textContent = `${stats.laneCount} lane${stats.laneCount === 1 ? '' : 's'}`;
  tasks.textContent = `${stats.taskCount} step${stats.taskCount === 1 ? '' : 's'}`;
}

function computeBaReview(steps = state.steps, xml = state.xml) {
  const tracedSteps = BATools.enrichStepsWithTraceability(state.desc, steps);
  const warnings = BATools.buildParseWarnings(state.desc, tracedSteps);
  const checklist = BATools.buildBaChecklist(tracedSteps, xml);
  state.steps = tracedSteps;
  state.review = { warnings, checklist };
  return state.review;
}

function renderParseReview() {
  const list = document.getElementById('parse-review-list');
  const badge = document.getElementById('parse-review-badge');
  if (!list || !badge) return;

  const warnings = state.review.warnings || [];
  badge.textContent = `${warnings.length} cảnh báo`;
  if (warnings.length === 0) {
    list.innerHTML = '<div class="logic-review-empty">Parse hiện chưa phát hiện điểm mơ hồ lớn.</div>';
    return;
  }

  list.innerHTML = warnings.map(item => `
    <article class="logic-review-item logic-review-item--warning">
      <span class="logic-review-label">${esc(item.type || 'review')}</span>
      <div class="logic-review-main">${escHtml(item.message)}</div>
    </article>
  `).join('');
}

function renderBaChecklist() {
  const list = document.getElementById('ba-checklist-list');
  const badge = document.getElementById('ba-checklist-badge');
  if (!list || !badge) return;

  const checklist = state.review.checklist || [];
  badge.textContent = `${checklist.filter(item => item.status === 'pass').length}/${checklist.length || 0} đạt`;
  if (checklist.length === 0) {
    list.innerHTML = '<div class="logic-review-empty">Checklist sẽ xuất hiện sau khi có step.</div>';
    return;
  }

  list.innerHTML = checklist.map(item => `
    <article class="logic-review-item logic-review-item--${item.status === 'pass' ? 'pass' : item.status === 'fail' ? 'fail' : 'warning'}">
      <span class="logic-review-label">${item.status.toUpperCase()}</span>
      <div class="logic-review-main"><strong>${escHtml(item.label)}:</strong> ${escHtml(item.detail)}</div>
    </article>
  `).join('');
}

function refreshReviewPanels(xml = state.xml) {
  computeBaReview(state.steps, xml);
  renderParseReview();
  renderBaChecklist();
}

/* ─── Quick Fix ──────────────────────────────────────────── */
document.addEventListener('click', e => {
  if (e.target.closest('#btn-quick-fix')) runQuickFix();
  if (e.target.closest('#btn-suggest-fix')) toggleSuggestPanel();
});

function runQuickFix() {
  if (!state.steps || state.steps.length === 0) {
    toast('Chưa có steps để fix. Hãy Analyze trước.', 'warning'); return;
  }
  const { steps: fixed, fixes } = BATools.applyQuickFixes(state.steps);
  if (fixes.length === 0) {
    toast('✅ Không có lỗi nào cần Quick Fix!', 'success'); return;
  }
  state.steps = fixed;
  // Re-render steps table
  renderLogicSummary(state.steps);
  // Re-run checklist
  const xml = state.xml || '';
  computeBaReview(state.steps, xml);
  renderBaChecklist();
  // Show toast summary
  const toast2 = document.getElementById('ba-fix-toast');
  if (toast2) {
    toast2.innerHTML = `<strong>🔧 Quick Fix: ${fixes.length} thay đổi</strong><ul>` +
      fixes.slice(0, 6).map(f => `<li>${escHtml(f.description)}</li>`).join('') +
      (fixes.length > 6 ? `<li>...và ${fixes.length - 6} thay đổi khác</li>` : '') +
      '</ul><button class="ba-fix-toast__close" onclick="this.parentElement.style.display=\'none\'">✕</button>';
    toast2.style.display = 'block';
    setTimeout(() => { if (toast2) toast2.style.display = 'none'; }, 8000);
  }
  toast(`🔧 Đã fix ${fixes.length} vấn đề tự động!`, 'success');
}

function toggleSuggestPanel() {
  const panel = document.getElementById('ba-suggest-panel');
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  if (!state.steps || state.steps.length === 0) {
    toast('Chưa có steps. Hãy Analyze trước.', 'warning'); return;
  }
  const checks = state.review.checklist || [];
  const suggestions = BATools.getSuggestions(state.steps, checks);
  if (!suggestions.length) {
    panel.innerHTML = '<div class="ba-suggest-empty">✅ Tất cả checks đều pass — không có gợi ý nào!</div>';
    panel.style.display = 'block'; return;
  }
  panel.innerHTML = `
    <div class="ba-suggest-header">
      💡 Gợi ý Fix (${suggestions.length} mục)
      <button class="ba-suggest-close" onclick="document.getElementById('ba-suggest-panel').style.display='none'">✕</button>
    </div>
    ${suggestions.map(s => `
      <div class="ba-suggest-item">
        <div class="ba-suggest-title">${escHtml(s.icon)} ${escHtml(s.title)}</div>
        <ul class="ba-suggest-list">
          ${s.suggestions.map(sg => `<li>${escHtml(sg)}</li>`).join('')}
        </ul>
      </div>
    `).join('')}
  `;
  panel.style.display = 'block';
}

function syncFocusModeButton() {
  const btn = document.getElementById('btn-focus-mode');
  if (!btn) return;
  btn.classList.toggle('btn-icon--active', state.focusMode);
  btn.setAttribute('aria-pressed', String(state.focusMode));
  btn.setAttribute('title', state.focusMode ? 'Thoát Focus BPMN Editor' : 'Focus BPMN Editor');
}

async function setFocusMode(next) {
  state.focusMode = next;
  document.body.classList.toggle('focus-bpmn', next);
  syncFocusModeButton();

  try {
    if (next && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else if (!next && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch (_) {
    // Ignore browser fullscreen errors; custom focus mode still applies.
  }

  if (state.viewer) {
    setTimeout(() => {
      try { state.viewer.get('canvas').zoom('fit-viewport', 'auto'); } catch (_) {}
    }, 120);
  }
}

function toggleFocusMode() {
  setFocusMode(!state.focusMode);
}

function updatePromptWorkspace() {
  const title = document.getElementById('process-title')?.value.trim() || '';
  const desc = document.getElementById('process-desc')?.value || '';
  const words = desc.trim() ? desc.trim().split(/\s+/).filter(Boolean).length : 0;
  const lines = desc.split(/\n+/).map(line => line.trim()).filter(Boolean).length;
  const chars = desc.length;

  const wordEl = document.getElementById('prompt-word-count');
  const lineEl = document.getElementById('prompt-line-count');
  const qualityEl = document.getElementById('prompt-quality-label');
  const charEl = document.getElementById('prompt-char-count');
  const hintEl = document.getElementById('prompt-structure-hint');
  const statusEl = document.getElementById('prompt-status-badge');

  if (wordEl) wordEl.textContent = String(words);
  if (lineEl) lineEl.textContent = String(lines);
  if (charEl) charEl.textContent = `${chars} ký tự`;

  let quality = 'Đang chờ';
  let status = 'Chưa đủ dữ liệu';
  let hint = 'Mẹo: thêm actor ở đầu câu để lane chính xác hơn.';

  if (title && chars >= 15 && lines >= 3) {
    quality = lines >= 5 && /\bnếu\b|^nếu\b/i.test(desc) ? 'Tốt' : 'Ổn';
    status = 'Sẵn sàng phân tích';
    hint = lines >= 5
      ? 'Mô tả đang đủ chi tiết để hệ thống tách lane và gateway tốt hơn.'
      : 'Nên thêm vài bước nữa để sơ đồ đầy đủ hơn.';
  } else if (chars > 0 || title) {
    quality = 'Đang nhập';
    status = 'Cần thêm chi tiết';
    hint = 'Cần tên quy trình và mô tả tối thiểu vài bước nghiệp vụ.';
  }

  if (qualityEl) qualityEl.textContent = quality;
  if (statusEl) statusEl.textContent = status;
  if (hintEl) hintEl.textContent = hint;
}

/* ─── STEP NAVIGATION ─────────────────────────────────────────── */
function goToStep(n) {
  state.step = n;
  [1, 2, 3].forEach(i => {
    document.getElementById(`panel-step${i}`).classList.toggle('hidden', i !== n);
    const ind = document.getElementById(`step-indicator-${i}`);
    ind.classList.remove('active', 'done');
    if (i < n) ind.classList.add('done');
    if (i === n) ind.classList.add('active');
    ind.querySelector('.step-circle').textContent = i < n ? '✓' : String(i);
  });
  document.getElementById('line-1-2').classList.toggle('done', n > 1);
  document.getElementById('line-2-3').classList.toggle('done', n > 2);

  if (n === 3) {
    syncAssistantState();
  }
}

function syncAssistantState() {
  const assistant = document.getElementById('diagram-assistant');
  const toggle = document.getElementById('btn-toggle-assistant');
  if (!assistant || !toggle) return;

  assistant.classList.toggle('collapsed', state.assistantCollapsed);
  toggle.setAttribute('aria-expanded', String(!state.assistantCollapsed));
  toggle.setAttribute('title', state.assistantCollapsed ? 'Mở chatbot' : 'Thu gọn chatbot');
}

/* ─── TOAST ───────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const wrap = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  t.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = '0.2s'; setTimeout(() => t.remove(), 200); }, 3500);
}

/* ─── RENDER STEPS TABLE ──────────────────────────────────────── */
function renderTable(steps) {
  const tbody = document.getElementById('logic-tbody');
  tbody.innerHTML = '';
  const label = document.getElementById('steps-count-label');
  if (label) label.textContent = steps.length > 0 ? `${steps.length} bước được trích xuất.` : '';
  renderLogicSummary(steps);
  refreshReviewPanels();

  const TASK_OPTIONS = [
    ['task', 'Task'],
    ['userTask', 'User Task 👤'],
    ['serviceTask', 'Service Task ⚙️'],
    ['manualTask', 'Manual Task 🖐'],
    ['sendTask', 'Send Task 📤'],
    ['receiveTask', 'Receive Task 📥'],
    ['scriptTask', 'Script Task 📜'],
    ['businessRuleTask', 'Business Rule Task 📋'],
  ];

  const GW_OPTIONS = [
    ['', '—'],
    ['exclusiveGateway', 'XOR (Exclusive)'],
    ['parallelGateway', 'AND (Parallel)'],
    ['inclusiveGateway', 'OR (Inclusive)'],
  ];

  steps.forEach((step, idx) => {
    const tr = document.createElement('tr');
    const taskOpts = TASK_OPTIONS.map(([v, l]) =>
      `<option value="${v}" ${step.type === v ? 'selected' : ''}>${l}</option>`
    ).join('');
    const gwOpts = GW_OPTIONS.map(([v, l]) =>
      `<option value="${v}" ${(step.gatewayType||'') === v ? 'selected' : ''}>${l}</option>`
    ).join('');

    tr.innerHTML = `
      <td class="td-step"><div class="step-badge">${idx + 1}</div></td>
      <td><input class="table-input" data-field="actor" value="${esc(step.actor)}" placeholder="Actor / Swimlane" /></td>
      <td><input class="table-input" data-field="action" value="${esc(step.action)}" placeholder="Hành động..." /></td>
      <td><select class="table-select" data-field="type">${taskOpts}</select></td>
      <td><input class="table-input" data-field="condition" value="${esc(step.condition || '')}" placeholder="Điều kiện…" /></td>
      <td><select class="table-select" data-field="gatewayType">${gwOpts}</select></td>
      <td><input class="table-input table-input--source" data-field="sourceText" value="${esc(step.sourceText || '')}" placeholder="Line nguồn..." /></td>
      <td><input class="table-input table-input--meta" data-field="nodeId" value="${esc(step.nodeId || '')}" placeholder="Task_123" /></td>
      <td><input class="table-input table-input--meta" data-field="note" value="${esc(step.note || '')}" placeholder="BA note" /></td>
      <td><input class="table-input table-input--meta" data-field="businessRuleRef" value="${esc(step.businessRuleRef || '')}" placeholder="BR-01" /></td>
      <td><input class="table-input table-input--meta" data-field="requirementRef" value="${esc(step.requirementRef || '')}" placeholder="US-101" /></td>
      <td>
        <button class="btn-delete-row" data-idx="${idx}" title="Xóa bước này">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 0 1 2 0v1M6 6v4M8 6v4M3 3.5l.8 7a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.8-7"
              stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </td>`;
    tbody.appendChild(tr);

    tr.querySelectorAll('.table-input, .table-select').forEach(el => {
      el.addEventListener('change', () => {
        state.steps[idx][el.dataset.field] = el.value;
        refreshReviewPanels();
      });
    });
    tr.querySelector('.btn-delete-row').addEventListener('click', () => {
      state.steps.splice(idx, 1);
      renderTable(state.steps);
    });
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── STEP 1 → 2: ANALYZE ────────────────────────────────────── */
document.getElementById('btn-analyze').addEventListener('click', async () => {
  const title = document.getElementById('process-title').value.trim();
  const desc = document.getElementById('process-desc').value.trim();
  if (!title) { toast('Hãy nhập tên quy trình!', 'error'); return; }
  if (desc.length < 15) { toast('Mô tả quá ngắn — hãy thêm chi tiết', 'error'); return; }

  state.title = title; state.desc = desc;
  const btn = document.getElementById('btn-analyze');
  setLoading(btn, 'analyze-text', 'analyze-spinner', true, 'Đang phân tích…');

  await delay(250);
  try {
    if (serverAvailable) {
      const res = await fetch(`${API_BASE}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      state.steps = BATools.enrichStepsWithTraceability(desc, data.structure.steps);
      toast(`✅ Trích xuất ${state.steps.length} bước (Server)`, 'success');
    } else {
      state.steps = BATools.enrichStepsWithTraceability(desc, parseFallback(title, desc));
      toast(`Trích xuất ${state.steps.length} bước (Offline)`, 'info');
    }
    renderTable(state.steps);
    goToStep(2);
  } catch (e) {
    toast('Lỗi: ' + e.message, 'error');
  }
  setLoading(btn, 'analyze-text', 'analyze-spinner', false, 'Phân tích & Tiếp tục');
});

/* ─── BACK BUTTONS ────────────────────────────────────────────── */
['btn-back-1', 'btn-back-1b'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', () => goToStep(1));
});
document.getElementById('btn-back-2').addEventListener('click', () => goToStep(2));

/* ─── ADD ROW ─────────────────────────────────────────────────── */
document.getElementById('btn-add-row').addEventListener('click', () => {
  state.steps.push({
    step: state.steps.length + 1,
    actor: '',
    action: 'Bước mới',
    condition: '',
    type: 'task',
    gatewayType: '',
    sourceText: '',
    sourceLine: '',
    note: '',
    businessRuleRef: '',
    requirementRef: '',
    nodeId: ''
  });
  renderTable(state.steps);
  document.querySelector('.logic-table-wrap').scrollTop = 9999;
});

/* ─── EXAMPLE CHIPS ───────────────────────────────────────────── */
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const ex = EXAMPLES[chip.dataset.example];
    if (ex) {
      document.getElementById('process-title').value = ex.title;
      document.getElementById('process-desc').value = ex.desc;
      updatePromptWorkspace();
    }
  });
});

document.getElementById('process-title')?.addEventListener('input', updatePromptWorkspace);
document.getElementById('process-desc')?.addEventListener('input', updatePromptWorkspace);

/* ─── STEP 2 → 3: GENERATE ───────────────────────────────────── */
document.getElementById('btn-generate').addEventListener('click', async () => {
  if (state.steps.length === 0) { toast('Cần ít nhất 1 bước!', 'error'); return; }

  const btn = document.getElementById('btn-generate');
  setLoading(btn, 'gen-text', 'gen-spinner', true, 'Đang tạo…');
  await delay(200);

  try {
    let xml;
    if (serverAvailable) {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: state.title, steps: state.steps }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      xml = data.xml;
      if (Array.isArray(data.traceability) && data.traceability.length === state.steps.length) {
        state.steps = state.steps.map((step, index) => ({ ...step, nodeId: data.traceability[index]?.nodeId || step.nodeId || '' }));
      }
      toast('✅ Sơ đồ được tạo bởi BPMN Studio Engine 🎉', 'success');
    } else {
      xml = BpmnEngine.generate(state.title, state.steps, {
        singleProcess: !!document.getElementById('toggle-single-process')?.checked
      });
      toast('Tạo sơ đồ (offline mode)', 'info');
    }

    state.xml = xml;
    state.steps = BATools.attachNodeIdsFromXml(state.steps, xml);
    document.getElementById('diagram-title-display').textContent = state.title;
    document.getElementById('xml-preview').textContent = xml;
    renderDiagramInsights(state.steps);
    refreshReviewPanels(xml);
    goToStep(3);
    await renderBpmn(xml);
  } catch (e) {
    toast('Lỗi tạo BPMN: ' + e.message, 'error');
    console.error(e);
  }
  setLoading(btn, 'gen-text', 'gen-spinner', false, 'Tạo Sơ đồ BPMN');
});

/* ─── IMPORT .bpmn ────────────────────────────────────────────── */
document.getElementById('btn-import-bpmn').addEventListener('click', () => {
  document.getElementById('input-file-bpmn').click();
});

document.getElementById('input-file-bpmn').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const xml = await file.text();
  state.xml = xml;
  state.steps = [];
  state.title = file.name.replace(/\.(bpmn|xml)$/i, '');
  document.getElementById('diagram-title-display').textContent = state.title;
  document.getElementById('xml-preview').textContent = xml;
  renderDiagramInsights(state.steps);
  goToStep(3);
  await renderBpmn(xml);
  toast(`Đã import: ${file.name}`, 'success');
  e.target.value = '';
});

function applyCamundaMarkers(viewer) {
  const canvas = viewer.get('canvas');
  const registry = viewer.get('elementRegistry');

  registry.getAll().forEach(element => {
    const type = element.type;
    if (type === 'bpmn:Participant') canvas.addMarker(element.id, 'camunda-pool');
    if (type === 'bpmn:Lane') canvas.addMarker(element.id, 'camunda-lane');
    if (type === 'bpmn:UserTask') canvas.addMarker(element.id, 'camunda-user-task');
    if (type === 'bpmn:ServiceTask') canvas.addMarker(element.id, 'camunda-service-task');
    if (type === 'bpmn:ManualTask') canvas.addMarker(element.id, 'camunda-manual-task');
    if (type === 'bpmn:StartEvent') canvas.addMarker(element.id, 'camunda-start-event');
    if (type === 'bpmn:EndEvent') canvas.addMarker(element.id, 'camunda-end-event');
    if (type === 'bpmn:IntermediateCatchEvent' || type === 'bpmn:IntermediateThrowEvent') {
      canvas.addMarker(element.id, 'camunda-intermediate-event');
    }
    if (type === 'bpmn:ExclusiveGateway' || type === 'bpmn:ParallelGateway' || type === 'bpmn:InclusiveGateway' || type === 'bpmn:EventBasedGateway') {
      canvas.addMarker(element.id, 'camunda-gateway');
    }
  });
}

/* ─── RENDER BPMN (bpmn-js modeler, supports lanes+participants) ── */
async function renderBpmn(xml) {
  const loading = document.getElementById('bpmn-loading');
  loading.classList.remove('hidden');
  try {
    if (state.viewer) { state.viewer.destroy(); state.viewer = null; }
    const canvas = document.getElementById('bpmn-canvas');
    canvas.innerHTML = '';

    // Use BpmnModeler (not BpmnJS viewer) — supports Participant + Lane rendering
    const Modeler = window.BpmnModeler || window.BpmnJS;
    if (!Modeler) {
      throw new Error('Thư viện bpmn-js chưa được tải. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau (do lỗi tải file từ CDN).');
    }
    const viewer = new Modeler({
      container: canvas,
      width: '100%',
      height: '100%',
      keyboard: { bindTo: document },
    });
    // IMPORTANT: Let the DOM reflow after removing the 'hidden' class from #panel-step3
    // so the canvas container gets actual width/height instead of 0x0
    await new Promise(resolve => setTimeout(resolve, 150));
    state.viewer = viewer;
    
    await viewer.importXML(xml);
    applyCamundaMarkers(viewer);

    await new Promise(resolve => setTimeout(resolve, 150)); // let SVG elements mount properly before computing bboxes
    
    // Try to fit viewport, fallback to zoom 1 if it fails (fixes SVGMatrix non-finite float error)
    try {
      viewer.get('canvas').zoom('fit-viewport', 'auto');
    } catch (zoomErr) {
      console.warn('fit-viewport failed, using default zoom:', zoomErr);
      try { viewer.get('canvas').zoom(1); } catch(e) { console.error('Zoom 1 fallback also failed', e); }
    }

    // (We now leave the palette visible so users can edit the diagram as requested)

    // Attach properties panel selection listener
    state._selectedElement = null;
    populatePropsPanel(null);
    attachSelectionListener(viewer);
    renderDiagramInsights(state.steps);

    loading.classList.add('hidden');
  } catch (err) {
    loading.classList.add('hidden');
    document.getElementById('bpmn-canvas').innerHTML = `
      <div style="padding:32px;color:#6b7280;font-size:0.875rem;line-height:1.8;max-width:520px;margin:40px auto">
        <p style="color:#d97706;font-weight:700;margin-bottom:12px;font-size:1rem">⚠ Không thể hiển thị preview</p>
        <p>File <strong>.bpmn đã tạo thành công</strong> và sẵn sàng để tải về.</p>
        <p style="margin-top:8px">Nhấn <strong>Tải .bpmn</strong> → mở trong <strong>Camunda Modeler</strong> để xem sơ đồ hoàn chỉnh với swimlane.</p>
        <p style="margin-top:12px;font-size:0.78rem;color:#9ca3af">Chi tiết: ${err.message}</p>
      </div>`;
    toast('Tải .bpmn rồi mở Camunda Modeler để xem sơ đồ đẹp!', 'info');
  }
}

/* ─── ZOOM ──────────────────────────────────────────────────── */
document.getElementById('btn-zoom-fit').addEventListener('click', () => state.viewer?.get('canvas').zoom('fit-viewport', 'auto'));
document.getElementById('btn-zoom-in').addEventListener('click', () => { const c = state.viewer?.get('canvas'); if (c) c.zoom(c.zoom() * 1.25); });
document.getElementById('btn-zoom-out').addEventListener('click', () => { const c = state.viewer?.get('canvas'); if (c) c.zoom(c.zoom() * 0.8); });
document.getElementById('btn-focus-mode')?.addEventListener('click', toggleFocusMode);

/* keyboard shortcut Ctrl+Shift+H — fit viewport */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
    e.preventDefault();
    state.viewer?.get('canvas').zoom('fit-viewport', 'auto');
  }
  // Ctrl+Z = Undo
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    if (state.viewer) { e.preventDefault(); try { state.viewer.get('commandStack').undo(); syncXmlPreview(); } catch(err){} }
  }
  // Ctrl+Y = Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    if (state.viewer) { e.preventDefault(); try { state.viewer.get('commandStack').redo(); syncXmlPreview(); } catch(err){} }
  }
  // Ctrl+S = Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    document.getElementById('btn-save')?.click();
  }
  // Delete = remove selected element
  if (e.key === 'Delete' && state.viewer && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    try {
      const sel = state.viewer.get('selection').get();
      if (sel.length > 0) state.viewer.get('modeling').removeElements(sel);
    } catch(err) {}
  }
  if (e.key === 'F11' && state.step === 3) {
    e.preventDefault();
    toggleFocusMode();
  }
  if (e.key === 'Escape') {
    if (state.focusMode) {
      setFocusMode(false);
    }
    closePropsPanel();
  }
});


/* ─── UNDO / REDO ─────────────────────────────────── */
document.getElementById('btn-undo')?.addEventListener('click', () => {
  if (!state.viewer) return;
  try { state.viewer.get('commandStack').undo(); syncXmlPreview(); }
  catch(e) { toast('Không thể undo', 'warning'); }
});
document.getElementById('btn-redo')?.addEventListener('click', () => {
  if (!state.viewer) return;
  try { state.viewer.get('commandStack').redo(); syncXmlPreview(); }
  catch(e) { toast('Không thể redo', 'warning'); }
});

/* ─── TOGGLE XML SIDEBAR ─────────────────────────────────────── */
document.getElementById('btn-toggle-xml').addEventListener('click', () => {
  const sidebar = document.getElementById('xml-sidebar');
  sidebar.classList.toggle('hidden');
});

function openPropsPanel() {
  const panel = document.getElementById('props-panel');
  const overlay = document.getElementById('props-overlay');
  const btn   = document.getElementById('btn-toggle-props');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
  overlay?.classList.remove('hidden');
  btn?.classList.add('btn-icon--active');
  btn?.setAttribute('aria-pressed', 'true');
}

function closePropsPanel() {
  const panel = document.getElementById('props-panel');
  const overlay = document.getElementById('props-overlay');
  const btn = document.getElementById('btn-toggle-props');
  panel?.classList.add('hidden');
  panel?.setAttribute('aria-hidden', 'true');
  overlay?.classList.add('hidden');
  btn?.classList.remove('btn-icon--active');
  btn?.setAttribute('aria-pressed', 'false');
}

/* ─── TOGGLE PROPERTIES PANEL ─────────────────────────────────────── */
document.getElementById('btn-toggle-props')?.addEventListener('click', () => {
  const panel = document.getElementById('props-panel');
  if (!panel) return;
  if (panel.classList.contains('hidden')) {
    openPropsPanel();
    populatePropsPanel(state._selectedElement || null);
  } else {
    closePropsPanel();
  }
});

document.getElementById('btn-close-props')?.addEventListener('click', closePropsPanel);
document.getElementById('props-overlay')?.addEventListener('click', closePropsPanel);

/* ─── TOGGLE ASSISTANT ──────────────────────────────────────────────── */
document.getElementById('btn-toggle-assistant')?.addEventListener('click', () => {
  state.assistantCollapsed = !state.assistantCollapsed;
  localStorage.setItem('diagram_assistant_collapsed', state.assistantCollapsed ? '1' : '0');
  syncAssistantState();
});

/* ─── DIAGRAM ASSISTANT IMPLEMENTATION ─────────────────────────────── */
function addChatMessage(text, role = 'bot') {
  const body = document.querySelector('.assistant-body');
  if (!body) return;
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

async function sendAssistantMessage() {
  const input = document.getElementById('assistant-input');
  const msg   = (input?.value || '').trim();
  if (!msg) return;

  addChatMessage(msg, 'user');
  input.value = '';
  input.style.height = 'auto';

  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'chat-message bot';
  thinkingEl.textContent = '⏳ Đang xử lý...';
  document.querySelector('.assistant-body')?.appendChild(thinkingEl);

  try {
    // Get current XML
    let xml = state.xml;
    if (state.viewer) {
      try { const r = await state.viewer.saveXML({ format: true }); xml = r.xml || xml; } catch(e) {}
    }

    if (!serverAvailable) {
      thinkingEl.textContent = '⚠️ Server offline — Diagram Assistant cần server. Khởi động server rồi thử lại.';
      return;
    }

    const res = await fetch(`${API_BASE}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, xml, title: state.title }),
    });
    const data = await res.json();
    thinkingEl.remove();

    if (data.reply) addChatMessage(data.reply, 'bot');
    if (data.xml && data.xml !== xml) {
      state.xml = data.xml;
      document.getElementById('xml-preview').textContent = data.xml;
      await renderBpmn(data.xml);
      addChatMessage('✅ Sơ đồ đã được cập nhật.', 'bot');
    }
  } catch(e) {
    thinkingEl.textContent = '❌ Lỗi: ' + e.message;
  }
}

document.getElementById('btn-send-assistant')?.addEventListener('click', sendAssistantMessage);
document.getElementById('assistant-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAssistantMessage();
  }
  // Auto-resize textarea
  setTimeout(() => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, 0);
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && state.focusMode) {
    state.focusMode = false;
    document.body.classList.remove('focus-bpmn');
    syncFocusModeButton();
  }
});

/* ─── PROPERTIES PANEL ENGINE ─────────────────────────────────────────── */
const ELEMENT_ICONS = {
  'bpmn:Task':             '🟦',
  'bpmn:UserTask':         '👤',
  'bpmn:ServiceTask':      '⚙️',
  'bpmn:SendTask':         '📤',
  'bpmn:ReceiveTask':      '📥',
  'bpmn:ManualTask':       '🖐️',
  'bpmn:ScriptTask':       '📜',
  'bpmn:BusinessRuleTask': '📋',
  'bpmn:StartEvent':       '●',
  'bpmn:EndEvent':         '◉',
  'bpmn:IntermediateThrowEvent': '◎',
  'bpmn:IntermediateCatchEvent': '◎',
  'bpmn:ExclusiveGateway': '◇',
  'bpmn:ParallelGateway':  '⊕',
  'bpmn:InclusiveGateway': '○',
  'bpmn:EventBasedGateway':'⧗',
  'bpmn:SequenceFlow':     '→',
  'bpmn:Lane':             '—',
  'bpmn:Participant':      '□',
  'bpmn:SubProcess':       '☑',
};

const TASK_TYPE_LABELS = {
  'bpmn:Task':             'Task',
  'bpmn:UserTask':         'User Task 👤',
  'bpmn:ServiceTask':      'Service Task ⚙️',
  'bpmn:SendTask':         'Send Task 📤',
  'bpmn:ReceiveTask':      'Receive Task 📥',
  'bpmn:ManualTask':       'Manual Task 🖐',
  'bpmn:ScriptTask':       'Script Task 📜',
  'bpmn:BusinessRuleTask': 'Business Rule Task 📋',
  'bpmn:StartEvent':       'Start Event',
  'bpmn:EndEvent':         'End Event',
  'bpmn:ExclusiveGateway': 'Exclusive Gateway',
  'bpmn:ParallelGateway':  'Parallel Gateway',
  'bpmn:InclusiveGateway': 'Inclusive Gateway',
  'bpmn:EventBasedGateway':'Event-Based Gateway',
  'bpmn:SequenceFlow':     'Sequence Flow',
  'bpmn:SubProcess':       'Sub Process',
  'bpmn:Lane':             'Lane',
  'bpmn:Participant':      'Pool / Participant',
};

// Store per-element metadata (assignee, groups, condition, etc.) locally
const elementMeta = {}; // key: elementId, value: metadata object

function getOrInitMeta(id) {
  if (!elementMeta[id]) elementMeta[id] = {};
  return elementMeta[id];
}

let _activePropsTab = 'general';

function initPropsPanel() {
  // Tab switching
  document.querySelectorAll('.props-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activePropsTab = tab.dataset.tab;
      document.querySelectorAll('.props-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.props-tab-body').forEach(body => body.classList.add('hidden'));
      document.getElementById(`props-tab-${tab.dataset.tab}`)?.classList.remove('hidden');
    });
  });

  // Input change handlers (local meta store)
  const bindField = (inputId, metaKey) => {
    document.getElementById(inputId)?.addEventListener('input', () => {
      const el = state._selectedElement;
      if (!el) return;
      const meta = getOrInitMeta(el.id || el.businessObject?.id);
      meta[metaKey] = document.getElementById(inputId).value;
    });
  };

  bindField('prop-name',             'name');
  bindField('prop-id',               'id');
  bindField('prop-assignee',         'assignee');
  bindField('prop-candidate-groups', 'candidateGroups');
  bindField('prop-due-date',         'dueDate');
  bindField('prop-condition',        'condition');
  bindField('prop-form-key',         'formKey');
  bindField('prop-job-type',         'jobType');
  bindField('prop-retries',          'retries');
  bindField('prop-docs',             'docs');
  bindField('prop-ext-ref',          'extRef');

  // ── Apply Name → diagram on blur ───────────────────────────────
  document.getElementById('prop-name')?.addEventListener('blur', () => {
    const el = state._selectedElement;
    if (!el || !state.viewer) return;
    const newName = document.getElementById('prop-name').value;
    try {
      state.viewer.get('modeling').updateProperties(el, { name: newName });
      syncXmlPreview();
    } catch(e) { /* ignore */ }
  });

  // ── Apply Condition → diagram on blur / button click ───────────
  function applyConditionToFlow() {
    const el = state._selectedElement;
    if (!el || !state.viewer) return;
    const val = document.getElementById('prop-condition').value.trim();
    const modeling = state.viewer.get('modeling');
    try {
      if (el.type === 'bpmn:SequenceFlow') {
        if (val) {
          modeling.updateProperties(el, {
            conditionExpression: state.viewer.get('moddle').create('bpmn:FormalExpression', { body: val })
          });
        } else {
          modeling.updateProperties(el, { conditionExpression: undefined });
        }
      } else {
        // On any element — store in meta
        const meta = getOrInitMeta(el.id);
        meta.condition = val;
      }
      syncXmlPreview();
      toast('Condition applied ✓', 'success');
    } catch(err) {
      toast('Could not apply condition: ' + err.message, 'error');
    }
  }

  document.getElementById('prop-condition')?.addEventListener('blur', applyConditionToFlow);
  document.getElementById('btn-apply-condition')?.addEventListener('click', applyConditionToFlow);

  // ── I/O Mapping rows ────────────────────────────────────────────
  document.getElementById('btn-add-input')?.addEventListener('click', () => {
    const el = state._selectedElement;
    if (!el) return;
    const meta = getOrInitMeta(el.id);
    meta.inputs = meta.inputs || [];
    meta.inputs.push({ source: '', target: '' });
    renderIORows('inputs-list', meta.inputs, 'inputs', el.id);
  });

  document.getElementById('btn-add-output')?.addEventListener('click', () => {
    const el = state._selectedElement;
    if (!el) return;
    const meta = getOrInitMeta(el.id);
    meta.outputs = meta.outputs || [];
    meta.outputs.push({ source: '', target: '' });
    renderIORows('outputs-list', meta.outputs, 'outputs', el.id);
  });

  // ── Color swatches ────────────────────────────────────────────
  document.getElementById('color-palette')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-swatch');
    if (!btn || !state._selectedElement || !state.viewer) return;
    const color = btn.dataset.color;
    try {
      state.viewer.get('modeling').setColor([state._selectedElement], { fill: color === 'default' ? undefined : color });
      document.querySelectorAll('#color-palette .color-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      syncXmlPreview();
    } catch(e) { /* ignore */ }
  });

  document.getElementById('stroke-palette')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-swatch');
    if (!btn || !state._selectedElement || !state.viewer) return;
    const color = btn.dataset.color;
    try {
      state.viewer.get('modeling').setColor([state._selectedElement], { stroke: color === 'default' ? undefined : color });
      document.querySelectorAll('#stroke-palette .color-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      syncXmlPreview();
    } catch(e) { /* ignore */ }
  });
}

function renderIORows(listId, items, field, elementId) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';
  items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'io-row';
    row.innerHTML = `
      <span class="io-row-label">${field === 'inputs' ? '←' : '→'}</span>
      <input type="text" placeholder="Source / FEEL expr" value="${esc(item.source)}" data-idx="${idx}" data-field="source" />
      <input type="text" placeholder="Target var" value="${esc(item.target)}" data-idx="${idx}" data-field="target" />
      <button class="io-delete-btn" data-idx="${idx}" title="Remove">×</button>`;
    list.appendChild(row);

    row.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        items[+inp.dataset.idx][inp.dataset.field] = inp.value;
        const meta = getOrInitMeta(elementId);
        meta[field] = items;
      });
    });
    row.querySelector('.io-delete-btn').addEventListener('click', (e) => {
      const i = +e.currentTarget.dataset.idx;
      items.splice(i, 1);
      renderIORows(listId, items, field, elementId);
    });
  });
}

function syncXmlPreview() {
  if (!state.viewer) return;
  state.viewer.saveXML({ format: true }).then(({ xml }) => {
    if (xml) {
      state.xml = xml;
      const preview = document.getElementById('xml-preview');
      if (preview) preview.textContent = xml;
    }
  }).catch(() => {});
}


function populatePropsPanel(element) {
  const panel = document.getElementById('props-panel');
  if (!panel || panel.classList.contains('hidden')) return;

  const noSel   = document.getElementById('props-no-selection');
  const fields   = document.getElementById('props-fields-general');
  const elType   = document.getElementById('props-element-type');
  const elId     = document.getElementById('props-element-id');
  const elIcon   = document.getElementById('props-element-icon');
  const typeBadge = document.getElementById('prop-type-badge');

  if (!element) {
    noSel?.classList.remove('hidden');
    fields?.classList.add('hidden');
    elType.textContent = 'No Selection';
    elId.textContent   = '—';
    elIcon.textContent = '⬡';
    typeBadge.textContent = '—';
    state._selectedElement = null;
    return;
  }

  state._selectedElement = element;
  const bo   = element.businessObject;
  const type = element.type || 'unknown';

  noSel?.classList.add('hidden');
  fields?.classList.remove('hidden');

  // Header
  elIcon.textContent = ELEMENT_ICONS[type] || '□';
  elType.textContent = TASK_TYPE_LABELS[type] || type.replace('bpmn:', '');
  elId.textContent   = bo?.id || element.id || '—';

  // Type badge
  typeBadge.textContent = TASK_TYPE_LABELS[type] || type.replace('bpmn:', '');

  // Fill General fields
  document.getElementById('prop-name').value = bo?.name || '';
  document.getElementById('prop-id').value   = bo?.id   || '';

  // Fill condition from businessObject (SequenceFlow) or meta
  let conditionVal = '';
  if (type === 'bpmn:SequenceFlow' && bo?.conditionExpression?.body) {
    conditionVal = bo.conditionExpression.body;
  } else {
    const mi = getOrInitMeta(bo?.id || element.id);
    conditionVal = mi.condition || '';
  }
  document.getElementById('prop-condition').value = conditionVal;

  // Fill Detail fields from meta store
  const meta = getOrInitMeta(bo?.id || element.id);
  document.getElementById('prop-assignee').value         = meta.assignee         || '';
  document.getElementById('prop-candidate-groups').value = meta.candidateGroups  || '';
  document.getElementById('prop-due-date').value         = meta.dueDate          || '';
  document.getElementById('prop-form-key').value         = meta.formKey          || '';
  document.getElementById('prop-job-type').value         = meta.jobType          || '';
  document.getElementById('prop-retries').value          = meta.retries          || '';
  document.getElementById('prop-docs').value             = meta.docs             || '';
  document.getElementById('prop-ext-ref').value          = meta.extRef           || '';

  // Render I/O rows
  renderIORows('inputs-list',  meta.inputs  || [], 'inputs',  bo?.id || element.id);
  renderIORows('outputs-list', meta.outputs || [], 'outputs', bo?.id || element.id);

  // Pulse animation
  panel.classList.remove('props-panel-updated');
  void panel.offsetWidth; // reflow
  panel.classList.add('props-panel-updated');
}


// Hook into modeler selection events (called after each renderBpmn)
function attachSelectionListener(modeler) {
  const eventBus = modeler.get('eventBus');
  eventBus.on('selection.changed', ({ newSelection }) => {
    if (newSelection.length === 1) {
      // Only populate data — do NOT auto-open the panel on click
      populatePropsPanel(newSelection[0]);
    } else {
      populatePropsPanel(null);
    }
  });
  eventBus.on('element.changed', ({ element }) => {
    if (state._selectedElement?.id === element.id) {
      populatePropsPanel(element);
    }
  });
}


/* ─── AUTO LAYOUT ──────────────────────────────────────────────────── */
document.getElementById('btn-auto-layout')?.addEventListener('click', async () => {
  if (!state.viewer || !state.xml) { toast('Chưa có sơ đồ', 'error'); return; }
  const btn = document.getElementById('btn-auto-layout');
  btn.disabled = true;
  toast('Đang canh chỉnh layout...', 'info');
  try {
    if (serverAvailable) {
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml: state.xml }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.xml) {
          state.xml = data.xml;
          document.getElementById('xml-preview').textContent = data.xml;
          await renderBpmn(data.xml);
          toast('✅ Auto layout hoàn thành!', 'success');
          return;
        }
      }
    }
    // Fallback: use bpmn-js built-in fit-viewport
    state.viewer.get('canvas').zoom('fit-viewport', 'auto');
    toast('Layout được làm sạch (offline mode)', 'info');
  } catch(e) {
    toast('Lỗi auto layout: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ─── ALIGN ELEMENTS ─────────────────────────────────────────────── */
function alignSelected(alignment) {
  if (!state.viewer) return;
  const selection = state.viewer.get('selection');
  const selected  = selection.get();
  if (selected.length < 2) { toast('Chọn ít nhất 2 phần tử để căn chỉnh', 'warning'); return; }
  try {
    const alignElements = state.viewer.get('alignElements');
    alignElements.trigger(selected, alignment);
  } catch(e) { toast('Lỗi align: ' + e.message, 'error'); }
}

function distributeSelected(axis) {
  if (!state.viewer) return;
  const selection = state.viewer.get('selection');
  const selected  = selection.get();
  if (selected.length < 3) { toast('Chọn ít nhất 3 phần tử để phân bố', 'warning'); return; }
  try {
    const distributeElements = state.viewer.get('distributeElements');
    distributeElements.trigger(selected, axis);
  } catch(e) { toast('Lỗi distribute: ' + e.message, 'error'); }
}

document.getElementById('btn-align-left')?.addEventListener('click', () => alignSelected('left'));
document.getElementById('btn-align-center')?.addEventListener('click', () => alignSelected('center'));
document.getElementById('btn-distribute-h')?.addEventListener('click', () => distributeSelected('horizontal'));


/* ─── COPY XML ────────────────────────────────────────────────── */
document.getElementById('btn-copy-xml').addEventListener('click', async () => {
  if (!state.xml) return;
  try {
    await navigator.clipboard.writeText(state.xml);
    toast('Đã copy XML!', 'success');
  } catch { toast('Không thể copy', 'error'); }
});

/* ─── DOWNLOAD .bpmn ──────────────────────────────────────────── */
document.getElementById('btn-download').addEventListener('click', () => {
  if (!state.xml) { toast('Chưa có sơ đồ', 'error'); return; }
  const blob = new Blob([state.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: (state.title || 'process').replace(/[<>:"|?*\\/]/g, '_').trim() + '.bpmn',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Đã tải file .bpmn — mở trong Camunda Modeler!', 'success');
});

document.getElementById('btn-export-ba-brief')?.addEventListener('click', () => {
  if (!state.title || state.steps.length === 0) {
    toast('Cần có process và step table trước khi export BA brief', 'warning');
    return;
  }
  refreshReviewPanels(state.xml);
  const markdown = BATools.buildBaDocumentMarkdown({
    title: state.title,
    description: state.desc,
    steps: state.steps,
    checklist: state.review.checklist
  });
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${(state.title || 'process').replace(/[<>:"|?*\\/]/g, '_').trim()}-BA-brief.md`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Đã export BA brief', 'success');
});

/* ─── SAVE (localStorage + Catalog) ──────────────────────────── */
// Handled by the BA Catalog section below — this stub prevents the old handler from conflicting.
// (The old plain localStorage save is replaced by the full catalog save)


/* ─── START OVER ──────────────────────────────────────────────── */
document.getElementById('btn-start-over').addEventListener('click', () => {
  if (!confirm('Bắt đầu lại từ đầu?')) return;
  document.getElementById('process-title').value = '';
  document.getElementById('process-desc').value = '';
  state.title = '';
  state.desc = '';
  state.steps = [];
  state.xml = '';
  state.review = { warnings: [], checklist: [] };
  if (state.viewer) { state.viewer.destroy(); state.viewer = null; }
  renderLogicSummary([]);
  renderDiagramInsights([]);
  renderParseReview();
  renderBaChecklist();
  goToStep(1);
});

/* ─── FALLBACK PARSER (offline mode) ─────────────────────────── */
/**
 * parseFallback — Bộ parser local thông minh, KHÔNG cần AI/Gemini.
 *
 * Hỗ trợ định dạng AI chuẩn hoá (ChatGPT / Claude):
 *   1. Actor: Hành động
 *   2. Nếu [điều kiện]: Actor: Hành động
 *   3. Nếu [điều kiện]: Hành động (actor tự suy luận)
 *   4. Actor: Hành động (không số thứ tự)
 *
 * Logic ưu tiên:
 *   A) Dòng bắt đầu "Nếu"/"If"/"Khi"/"When" → conditional branch
 *   B) Pattern "Actor: Action" với actor ≤ 4 từ, không có dấu phẩy
 *   C) Keyword-based actor inference
 *   D) Inherit actor từ dòng trước
 */
function parseFallback(title, desc) {

  /* 1. ACTOR DICTIONARY */
  const ACTOR_DICT = [
    { re: /kh[aá]ch\s*h[aà]ng|customer|client|ng[uư][oờ]i\s*mua|buyer|user|ng[uư][oờ]i\s*d[uù]ng/i, a: 'Customer' },
    { re: /nh[aâ]n\s*vi[eê]n\s*(b[aá]n|sales)|sales/i,                                a: 'Sales Staff' },
    { re: /nh[aâ]n\s*vi[eê]n\s*(k[yỹ]\s*thu[aậ]t|it|cntt)|it\s*staff/i,               a: 'IT Staff' },
    { re: /nh[aâ]n\s*vi[eê]n\s*(kho|l[uư]u\s*kho)|warehouse/i,                        a: 'Warehouse Staff' },
    { re: /d[uư][oợ]c\s*s[iĩ]|pharmacist/i,                                           a: 'Pharmacist' },
    { re: /k[yỹ]\s*thu[aậ]t\s*vi[eê]n|technician/i,                                   a: 'Technician' },
    { re: /h[eệ]\s*th[oố]ng|system|t[uự]\s*[dđ][oộ]ng|automat|app/i,                  a: 'System' },
    { re: /gi[aá]m\s*[dđ][oố]c|ceo|director|\bGD\b/i,                                 a: 'Director' },
    { re: /ph[oó]\s*gi[aá]m\s*[dđ][oố]c|pgd|deputy/i,                                 a: 'Deputy Director' },
    { re: /qu[aả]n\s*l[yý]|tr[uư][oở]ng\s*ph[oò]ng|manager|supervisor|lead/i,         a: 'Manager' },
    { re: /b[oộ]\s*ph[aậ]n\s*ti[eế]p\s*nh[aậ]n|l[eễ]\s*t[aâ]n|receptionist/i,         a: 'Receptionist' },
    { re: /b[oộ]\s*ph[aậ]n\s*x[uử]\s*l[yý]|processing/i,                              a: 'Processing Dept' },
    { re: /b[oộ]\s*ph[aậ]n\s*ph[aá]p\s*l[yý]|legal/i,                                 a: 'Legal' },
    { re: /hr|nh[aâ]n\s*s[uự]|human\s*resource/i,                                     a: 'HR' },
    { re: /k[eế]\s*to[aá]n|accountant|finance/i,                                      a: 'Accountant' },
    { re: /ki[eể]m\s*to[aá]n|auditor/i,                                               a: 'Auditor' },
    { re: /shipper|[dđ][oơ]n\s*v[iị]\s*v[aậ]n\s*chuy[eể]n|courier|delivery/i,         a: 'Shipper' },
    { re: /b[aá]c\s*s[iĩ]|doctor|physician/i,                                         a: 'Doctor' },
    { re: /y\s*t[aá]|nurse/i,                                                         a: 'Nurse' },
    { re: /nh[aà]\s*cung\s*c[aấ]p|supplier|vendor/i,                                  a: 'Supplier' },
    { re: /ng[aâ]n\s*h[aà]ng|bank/i,                                                  a: 'Bank' },
    { re: /\bnh[aâ]n\s*vi[eê]n\b|\bstaff\b|\bemployee\b|\bclerk\b/i,                  a: 'Staff' },
  ];

  /* 2. KEYWORD → ACTOR INFERENCE */
  const INFER_ACTOR = [
    { re: /[dđ][aặ]t\s*h[aà]ng|n[oộ]p\s*[dđ][oơ]n|[dđ]i[eề]n\s*form|[dđ][aă]ng\s*k[yý]|y[eê]u\s*c[aầ]u|login/i, a: 'Customer' },
    { re: /g[uử]i\s*(email|th[oô]ng\s*b[aá]o|sms)|c[aậ]p\s*nh[aậ]t|t[aạ]o.*t[uự]\s*[dđ][oộ]ng|ghi\s*nh[aậ]n/i,   a: 'System' },
    { re: /ph[eê]\s*duy[eệ]t|k[yý]\s*duy[eệ]t|approve|review.*[dđ][oơ]n/i,                                            a: 'Manager' },
    { re: /ki[eể]m\s*tra\s*kho|xu[aấ]t\s*kho|nh[aậ]p\s*kho|[dđ][oó]ng\s*g[oó]i/i,                                 a: 'Warehouse Staff' },
    { re: /giao\s*h[aà]ng|v[aậ]n\s*chuy[eể]n|deliver|ship(?!per)/i,                                                    a: 'Shipper' },
    { re: /thanh\s*to[aá]n|chi\s*ti[eề]n|tr[aả]\s*ti[eề]n|payment/i,                                                 a: 'Accountant' },
  ];

  /* 3. KEYWORD → TASK TYPE */
  const TASK_TYPE_RULES = [
    { re: /ph[eê]\s*duy[eệ]t|k[yý]\s*x[aá]c\s*nh[aậ]n|approve|review|xem\s*x[eé]t|ki[eể]m\s*tra|x[aá]c\s*nh[aậ]n|[dđ]i[eề]n\s*form|nh[aậ]p\s*li[eệ]u/i, t: 'userTask' },
    { re: /h[eệ]\s*th[oố]ng|t[uự]\s*[dđ][oộ]ng|auto|g[uử]i\s*email|g[uử]i\s*sms|c[aậ]p\s*nh[aậ]t|generate|t[aạ]o.*t[uự]/i,                                   t: 'serviceTask' },
    { re: /g[uử]i\s*(th[oô]ng\s*b[aá]o|email|sms|alert)|send\s*(notification|email|msg)/i,                                                                          t: 'sendTask' },
    { re: /ti[eế]p\s*nh[aậ]n|nh[aậ]n\s*([dđ][oơ]n|h[aà]ng|h[oồ]\s*s[oơ]|th[oô]ng\s*b[aá]o|y[eê]u\s*c[aầ]u)|receive/i,                                      t: 'receiveTask' },
    { re: /vi[eế]t\s*script|ch[aạ]y\s*script|t[ií]nh\s*to[aá]n.*t[uự]\s*[dđ][oộ]ng|process\s*data/i,                                                          t: 'scriptTask' },
    { re: /quy\s*t[aắ]c\s*nghi[eệ]p\s*v[uụ]|business\s*rule|dmn/i,                                                                                               t: 'businessRuleTask' },
    { re: /th[uủ]\s*c[oô]ng|k[yý]\s*tay|[dđ][oó]ng\s*d[aấ]u|manual/i,                                                                                            t: 'manualTask' },
  ];

  /* 4. SPLIT INTO LINES */
  const rawLines = desc
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 2);

  /* 5. PARSE EACH LINE */
  let lastActor = 'Người dùng';
  let n = 1;
  const steps = [];

  for (const rawLine of rawLines) {
    // Strip leading numbering: "1.", "1)", "- ", "• "
    const line = rawLine
      .replace(/^\d+[\.]\s*/, '')
      .replace(/^\d+[\)]\s*/, '')
      .replace(/^[-–•*]\s*/, '')
      .trim();
    if (!line || line.length < 3) continue;

    /* 5A-EV. DETECT INTERMEDIATE / SPECIAL EVENT LINES (before cond check) */
    let eventType     = '';
    let eventDuration = '';

    // Timer catch: "Chờ 30 phút:", "Chờ 2 giờ:", "Chờ đến ngày 15:"
    const timerCatchRe = /^(ch[oờ]|wait)\s+(\d+\s*(gi[aâ]y|ph[uú]t|gi[oờ]|ng[aà]y|tu[aầ]n|th[aá]ng|second|minute|hour|day)|[dđ][eế]n\s+|until\s+)/i;
    // Message catch: "Chờ xác nhận từ ngân hàng:"
    const msgCatchRe  = /^(ch[oờ]|wait)\s+(?!\d)\S.*\b(t[uừ]|from)\b/i;
    // Signal/message throw: "Gửi thông báo:", "Broadcast:"
    const sigThrowRe  = /^(g[uử]i\s+th[oô]ng\s*b[aá]o|broadcast|throw\s+signal|ph[aá]t\s+t[ií]n\s*hi[eệ]u)/i;
    // Error end: "Nếu lỗi ...:"
    const errLineRe   = /^(n[eế]u\s+l[oỗ]i|if\s+error)/i;

    const isTimerCatch = timerCatchRe.test(line);
    const isMsgCatch   = !isTimerCatch && msgCatchRe.test(line);
    const isSigThrow   = sigThrowRe.test(line);

    if (isTimerCatch) {
      // Normalize duration to ISO 8601
      const dm = line.match(/(\d+)\s*(gi[aâ]y|second|s)/i);
      const hm = line.match(/(\d+)\s*(gi[oờ]|hour|h)/i);
      const nm2= line.match(/(\d+)\s*(ng[aà]y|day|d)/i);
      const pm = line.match(/(\d+)\s*(ph[uú]t|minute|m)/i);
      if (dm) eventDuration = `PT${dm[1]}S`;
      else if (hm) eventDuration = `PT${hm[1]}H`;
      else if (nm2) eventDuration = `P${nm2[1]}D`;
      else if (pm) eventDuration = `PT${pm[1]}M`;
      else eventDuration = 'PT30M';
      eventType = 'timer';
    } else if (isMsgCatch) {
      eventType = 'message';
    } else if (isSigThrow) {
      eventType = 'signal';
    }

    /* 5A. DETECT CONDITIONAL PREFIX & GATEWAY TYPE */
    const condPrefixRe = /^(n[eế]u|if|khi|when|tr[uư][oờ]ng\s*h[oợ]p|trong\s*tr[uư][oờ]ng\s*h[oợ]p)\b/i;
    const isCond = condPrefixRe.test(line);

    const parallelPrefixRe = /^([dđ][oồ]ng\s*th[oờ]i|song\s*song|c[uù]ng\s*l[uú]c|parallel|simultaneously|concurrently|at\s*the\s*same\s*time|and)\b/i;
    const isParallel = parallelPrefixRe.test(line);

    let condition = '';
    let bodyText  = line;
    let gatewayType = '';

    if (isCond || isParallel) {
      const activeRe = isCond ? condPrefixRe : parallelPrefixRe;
      gatewayType = isParallel ? 'parallelGateway' : 'exclusiveGateway';
      // Find the FIRST colon that separates condition from action body
      const colonIdx = line.search(/[:\uFF1A]/);
      if (colonIdx !== -1) {
        condition = line.substring(0, colonIdx).replace(activeRe, '').trim() || (isParallel ? 'parallel split' : '');
        bodyText  = line.substring(colonIdx + 1).trim();
      } else {
        // No colon: entire line is condition label
        condition = line.replace(activeRe, '').trim() || (isParallel ? 'parallel split' : '');
        bodyText  = '';
      }
    }

    /* 5B. SPLIT ACTOR : ACTION — skip for intermediate events */
    let actor  = null;
    let action = bodyText;

    const isIntermediateEvent = isTimerCatch || isMsgCatch || isSigThrow;

    if (bodyText && !isIntermediateEvent) {
      // Match "Actor: Action" where actor is short (<=4 words), no commas
      const m = bodyText.match(/^([^,:\uFF1A\n]{2,40})[:\uFF1A](.*)/);
      if (m) {
        const cActor  = m[1].trim();
        const cAction = m[2].trim();
        const wordCount = cActor.split(/\s+/).length;
        const notConj   = !/^(n[eế]u|if|khi|when|sau|ti[eế]p|tr[uư][oờ]c|[dđ][oồ]ng|song|v[aà]|ho[aặ]c)/i.test(cActor);
        if (wordCount <= 4 && notConj && cAction.length > 0) {
          actor  = cActor;
          action = cAction;
        }
      }
    }

    /* 5C. KEYWORD-BASED ACTOR LOOKUP */
    if (!actor) {
      for (const { re, a } of ACTOR_DICT) {
        if (re.test(bodyText || line)) { actor = a; break; }
      }
    }
    if (!actor) {
      for (const { re, a } of INFER_ACTOR) {
        if (re.test(action || line)) { actor = a; break; }
      }
    }
    actor = actor || lastActor;
    lastActor = actor;

    /* 5D. HANDLE EMPTY ACTION */
    if (!action && condition) action = condition;
    if (!action) continue;

    /* 5E. INFER TASK TYPE */
    let type = 'task';
    // Intermediate events take priority
    if (isTimerCatch) {
      type = 'intermediateCatchEvent';
      // Use line text as action if not set
      if (!action || action === bodyText) {
        const colonIdx = line.indexOf(':');
        action = colonIdx !== -1 ? line.substring(0, colonIdx).trim() : line.trim();
      }
      actor = lastActor; // inherit actor for catch events
    } else if (isMsgCatch) {
      type = 'intermediateCatchEvent';
      if (!action || action === bodyText) {
        const colonIdx = line.indexOf(':');
        action = colonIdx !== -1 ? line.substring(0, colonIdx).trim() : line.trim();
      }
      actor = lastActor;
    } else if (isSigThrow) {
      type = 'intermediateThrowEvent';
      // Extract description after "Gửi thông báo:"
      const colonIdx = line.indexOf(':');
      action = colonIdx !== -1 ? line.substring(colonIdx + 1).trim() : line.trim();
      if (!action) action = line.trim();
      actor = lastActor; // inherit last actor, NOT a new lane
    } else {
      for (const { re, t } of TASK_TYPE_RULES) {
        if (re.test(action)) { type = t; break; }
      }
      // Upgrade generic task → serviceTask when actor = 'Hệ thống'
      if (type === 'task' && /h[eệ]\s*th[oố]ng|system/i.test(actor)) {
        type = 'serviceTask';
      }
    }

    /* 5F. GATEWAY */
    // Already resolved during step 5A


    steps.push({
      step:          n++,
      actor:         actor.substring(0, 60),
      action:        action.substring(0, 120),
      condition:     condition.substring(0, 100),
      type,
      gatewayType,
      eventType,
      eventDuration,
      sourceText:    line,
      sourceLine:    rawLines.indexOf(rawLine) + 1,
      note: '',
      businessRuleRef: '',
      requirementRef: '',
      nodeId: '',
    });
  }

  /* 6. FALLBACK: ensure at least 2 steps */
  if (steps.length === 0) {
    return [
      { step: 1, actor: 'Người dùng', action: title || 'Bắt đầu quy trình', condition: '', type: 'userTask', gatewayType: '', sourceText: title || 'Bắt đầu quy trình', sourceLine: 1, note: '', businessRuleRef: '', requirementRef: '', nodeId: '' },
      { step: 2, actor: 'Hệ thống', action: 'Xử lý và ghi nhận kết quả', condition: '', type: 'serviceTask', gatewayType: '', sourceText: 'Xử lý và ghi nhận kết quả', sourceLine: 2, note: '', businessRuleRef: '', requirementRef: '', nodeId: '' },
    ];
  }
  return steps;
}

/* ─── HELPERS ─────────────────────────────────────────────────── */
function setLoading(btn, textId, spinnerId, on, label) {
  document.getElementById(textId).textContent = label;
  document.getElementById(spinnerId)?.classList.toggle('hidden', !on);
  btn.disabled = on;
}
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ─── INIT ──────────────────────────────────────────────────────────── */
state._selectedElement = null;
checkServer();
setInterval(checkServer, 12000);
syncAssistantState();
initPropsPanel();
updatePromptWorkspace();
renderLogicSummary([]);
renderDiagramInsights([]);
syncFocusModeButton();
renderParseReview();
renderBaChecklist();
goToStep(1);

/* ════════════════════════════════════════════════════════════════
   BA TOOL — Process Catalog, Metadata, Analyze, Validate, Export
   ════════════════════════════════════════════════════════════════ */

/* ─── PROCESS CATALOG ────────────────────────────────────────────── */
const CATALOG_KEY = 'bpmn_studio_catalog_v2';

function loadCatalog() {
  try { return JSON.parse(localStorage.getItem(CATALOG_KEY) || '[]'); }
  catch { return []; }
}
function saveCatalog(items) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
}

function renderCatalog(filter = '') {
  const items = loadCatalog();
  const list  = document.getElementById('catalog-list');
  const count = document.getElementById('catalog-count');
  const filtered = filter
    ? items.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()) || (i.owner||'').toLowerCase().includes(filter.toLowerCase()))
    : items;

  count.textContent = `${items.length} quy trình`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="catalog-empty">${filter ? 'Không tìm thấy kết quả.' : 'Chưa có quy trình nào.<br>Tạo sơ đồ và nhấn <strong>Lưu</strong>.'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(item => `
    <div class="catalog-item" data-id="${item.id}">
      <div class="catalog-item-title">${escHtml(item.title)}</div>
      <div class="catalog-item-meta">
        <span class="catalog-item-status status-${item.status||'draft'}">${(item.status||'draft').toUpperCase()}</span>
        <span>${escHtml(item.owner || '—')}</span>
        <span>${escHtml(item.version || '')}</span>
        <span style="margin-left:auto">${item.savedAt ? new Date(item.savedAt).toLocaleDateString('vi-VN') : ''}</span>
      </div>
      <div class="catalog-item-actions">
        <button onclick="loadFromCatalog('${item.id}')">📂 Load</button>
        <button onclick="compareCatalogItem('${item.id}')">🔀 Compare</button>
        <button onclick="duplicateCatalogItem('${item.id}')">📋 Duplicate</button>
        <button class="btn-delete" onclick="deleteCatalogItem('${item.id}')">🗑 Xóa</button>
      </div>
    </div>
  `).join('');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.loadFromCatalog = async function(id) {
  const items = loadCatalog();
  const item  = items.find(i => i.id === id);
  if (!item || !item.xml) { toast('Không tìm thấy XML trong catalog', 'warn'); return; }

  try {
    // Navigate to diagram step first so canvas exists
    goToStep(3);
    await new Promise(r => setTimeout(r, 200));

    // Import via renderBpmn (which creates/reuses state.viewer)
    await renderBpmn(item.xml);
    state.xml = item.xml;
    state.title = item.title;
    state.desc = item.description || '';
    state.steps = Array.isArray(item.steps) ? item.steps : [];
    refreshReviewPanels(item.xml);
    renderTable(state.steps);

    // Restore metadata
    document.getElementById('meta-owner').value   = item.owner || '';
    document.getElementById('meta-version').value = item.version || '';
    document.querySelectorAll('.meta-status-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.status === (item.status||'as-is'));
    });
    document.getElementById('meta-date').textContent = item.savedAt
      ? new Date(item.savedAt).toLocaleString('vi-VN') : '—';
    document.getElementById('diagram-title-display').textContent = item.title;

    closeCatalog();
    toast(`Loaded: "${item.title}"`, 'success');
  } catch(e) {
    toast('Lỗi load: ' + e.message, 'error');
  }
};

window.deleteCatalogItem = function(id) {
  const items = loadCatalog().filter(i => i.id !== id);
  saveCatalog(items);
  renderCatalog(document.getElementById('catalog-search').value);
  toast('Đã xóa khỏi catalog', 'info');
};

window.duplicateCatalogItem = function(id) {
  const items = loadCatalog();
  const orig  = items.find(i => i.id === id);
  if (!orig) return;
  const copy = { ...orig, id: Date.now().toString(), title: orig.title + ' (Copy)', savedAt: new Date().toISOString() };
  items.push(copy);
  saveCatalog(items);
  renderCatalog(document.getElementById('catalog-search').value);
  toast('Đã duplicate quy trình', 'success');
};

window.compareCatalogItem = function(id) {
  const items = loadCatalog();
  const item = items.find(entry => entry.id === id);
  if (!item) return;

  const current = {
    title: state.title || 'Current workspace',
    status: document.querySelector('.meta-status-btn.active')?.dataset.status || 'draft',
    steps: state.steps || []
  };

  const diff = BATools.compareProcessSnapshots(item, current);
  document.getElementById('compare-overlay').classList.remove('hidden');
  document.getElementById('compare-modal').classList.remove('hidden');
  document.getElementById('compare-modal-body').innerHTML = `
    <div class="compare-summary">
      <div class="compare-card">
        <strong>${escHtml(diff.summary.baseTitle)}</strong>
        <span>Status: ${escHtml(diff.summary.baseStatus)}</span>
        <span>${(item.steps || []).length} step</span>
      </div>
      <div class="compare-card">
        <strong>${escHtml(diff.summary.targetTitle)}</strong>
        <span>Status: ${escHtml(diff.summary.targetStatus)}</span>
        <span>${(current.steps || []).length} step</span>
      </div>
      <div class="compare-card">
        <strong>Stakeholder changelog</strong>
        <span>Step delta: ${diff.summary.stepDelta > 0 ? '+' : ''}${diff.summary.stepDelta}</span>
        <span>Actor added: ${diff.actorChanges.added.join(', ') || 'None'}</span>
        <span>Actor removed: ${diff.actorChanges.removed.join(', ') || 'None'}</span>
      </div>
    </div>
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">Changed steps / lanes / rules</div>
    <div class="compare-list">
      ${diff.changelog.map(itemText => `<div class="compare-item">${escHtml(itemText)}</div>`).join('')}
    </div>
  `;
};

function openCatalog() {
  document.getElementById('catalog-drawer').classList.remove('hidden');
  document.getElementById('catalog-overlay').classList.remove('hidden');
  renderCatalog();
}
function closeCatalog() {
  document.getElementById('catalog-drawer').classList.add('hidden');
  document.getElementById('catalog-overlay').classList.add('hidden');
}

function closeCompare() {
  document.getElementById('compare-modal').classList.add('hidden');
  document.getElementById('compare-overlay').classList.add('hidden');
}

document.getElementById('btn-catalog').addEventListener('click', openCatalog);
document.getElementById('btn-close-catalog').addEventListener('click', closeCatalog);
document.getElementById('catalog-overlay').addEventListener('click', closeCatalog);
document.getElementById('btn-close-compare')?.addEventListener('click', closeCompare);
document.getElementById('compare-overlay')?.addEventListener('click', closeCompare);
document.getElementById('catalog-search').addEventListener('input', e => renderCatalog(e.target.value));
document.getElementById('btn-catalog-clear').addEventListener('click', () => {
  if (confirm('Xóa tất cả quy trình trong catalog?')) {
    saveCatalog([]);
    renderCatalog();
    toast('Đã xóa toàn bộ catalog', 'info');
  }
});

/* Override btn-save to save into catalog ──────────────────────── */
document.getElementById('btn-save').addEventListener('click', async () => {
  // Get XML either from state or from viewer directly
  let xml = state.xml;
  if (state.viewer) {
    try { const r = await state.viewer.saveXML({ format: true }); xml = r.xml; } catch(e) { /* use state.xml */ }
  }
  if (!xml) { toast('Chưa có diagram để lưu', 'error'); return; }

  const title   = document.getElementById('diagram-title-display').textContent
    || document.getElementById('process-title').value || 'Untitled Process';
  const owner   = document.getElementById('meta-owner').value;
  const version = document.getElementById('meta-version').value || 'v1.0';
  const statusBtn = document.querySelector('.meta-status-btn.active');
  const status    = statusBtn ? statusBtn.dataset.status : 'as-is';

  const items = loadCatalog();
  const existing = items.findIndex(i => i.title === title);
  const entry = {
    id: existing >= 0 ? items[existing].id : Date.now().toString(),
    title,
    xml,
    owner,
    version,
    status,
    description: state.desc,
    steps: state.steps,
    savedAt: new Date().toISOString()
  };

  if (existing >= 0) items[existing] = entry;
  else items.push(entry);
  saveCatalog(items);

  // Also keep legacy key in sync
  state.xml = xml;
  document.getElementById('meta-date').textContent = new Date().toLocaleString('vi-VN');
  toast(`Đã lưu vào Catalog: "${title}"`, 'success');
});

/* ─── PROCESS METADATA ───────────────────────────────────────────── */
document.getElementById('meta-status-group').addEventListener('click', e => {
  const btn = e.target.closest('.meta-status-btn');
  if (!btn) return;
  document.querySelectorAll('.meta-status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

document.getElementById('btn-meta-save').addEventListener('click', () => {
  const owner   = document.getElementById('meta-owner').value;
  const version = document.getElementById('meta-version').value;
  const statusBtn = document.querySelector('.meta-status-btn.active');
  const status    = statusBtn ? statusBtn.dataset.status : 'as-is';
  document.getElementById('meta-date').textContent = new Date().toLocaleString('vi-VN');
  toast(`Metadata: ${owner} · ${version} · ${status.toUpperCase()}`, 'success');
});

function countBpmnTag(xml, tag) {
  return (String(xml || '').match(new RegExp(`<(?:\\w+:)?${tag}\\b`, 'gi')) || []).length;
}

function analyzeXmlLocally(xml) {
  const tasks = [
    'task',
    'userTask',
    'serviceTask',
    'sendTask',
    'receiveTask',
    'scriptTask',
    'manualTask',
    'businessRuleTask',
    'callActivity',
    'subProcess'
  ].reduce((sum, tag) => sum + countBpmnTag(xml, tag), 0);
  const gateways = ['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway']
    .reduce((sum, tag) => sum + countBpmnTag(xml, tag), 0);
  const lanes = countBpmnTag(xml, 'lane');
  const startEvents = countBpmnTag(xml, 'startEvent');
  const endEvents = countBpmnTag(xml, 'endEvent');
  const sequenceFlows = countBpmnTag(xml, 'sequenceFlow');
  const conditionalFlows = countBpmnTag(xml, 'conditionExpression');

  const issues = [];
  if (startEvents === 0) issues.push({ severity: 'error', message: 'Thiếu Start Event' });
  if (endEvents === 0) issues.push({ severity: 'warning', message: 'Thiếu End Event' });
  if (gateways > 0 && conditionalFlows === 0) issues.push({ severity: 'warning', message: 'Gateway không có Condition Expression' });
  if (lanes === 0 && tasks > 3) issues.push({ severity: 'info', message: 'Nên thêm Swimlane để phân trách nhiệm' });

  const complexityScore = 1 + gateways + conditionalFlows;
  const complexityLabel = complexityScore > 20 ? 'Rất phức tạp'
    : complexityScore > 10 ? 'Phức tạp'
    : complexityScore > 5 ? 'Trung bình'
    : 'Đơn giản';

  return {
    success: true,
    statistics: { tasks, gateways, lanes, startEvents, endEvents, sequenceFlows, conditionalFlows },
    complexity: { score: complexityScore, label: complexityLabel },
    issues,
    valid: !issues.some(issue => issue.severity === 'error'),
    offline: true,
  };
}

function validateXmlLocally(xml) {
  const issues = [];
  const exclusiveGatewayCount = countBpmnTag(xml, 'exclusiveGateway');
  const conditionalFlowCount = countBpmnTag(xml, 'conditionExpression');
  const defaultFlowCount = (String(xml || '').match(/\bdefault="/gi) || []).length;

  if (!xml.includes('<bpmn:process') && !xml.includes('<process')) {
    issues.push({ severity: 'error', message: 'Missing <bpmn:process> element' });
  }
  if (countBpmnTag(xml, 'startEvent') === 0) {
    issues.push({ severity: 'error', message: 'No Start Event — every process requires exactly one None Start Event' });
  }
  if (countBpmnTag(xml, 'endEvent') === 0) {
    issues.push({ severity: 'warning', message: 'No End Event — every process path should terminate at an End Event' });
  }
  if (!xml.includes('bpmn:collaboration')) {
    issues.push({ severity: 'warning', message: 'No Pool/Participant — consider wrapping in a Collaboration for swimlane processes' });
  }
  if (exclusiveGatewayCount > 0 && conditionalFlowCount === 0) {
    issues.push({ severity: 'warning', message: 'Exclusive Gateway present but no conditionExpression on outgoing flows' });
  }
  if (exclusiveGatewayCount > 0 && defaultFlowCount === 0) {
    issues.push({ severity: 'info', message: 'Exclusive Gateway has no default flow — diagram is valid but can be harder to read in modelers' });
  }

  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    message: issues.length === 0 ? 'Valid BPMN 2.0 (offline)' : 'Has issues',
    offline: true,
  };
}

/* ─── ANALYZE DIAGRAM ────────────────────────────────────────────── */
document.getElementById('btn-analyze-diagram').addEventListener('click', async () => {
  if (!state.viewer && !state.xml) { toast('Chưa có diagram để phân tích', 'warn'); return; }

  document.getElementById('analyze-modal').classList.remove('hidden');
  document.getElementById('analyze-overlay').classList.remove('hidden');
  document.getElementById('analyze-modal-body').innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary)">⏳ Đang phân tích...</div>';

  try {
    // Get XML from viewer if available, else from state
    let xml = state.xml;
    if (state.viewer) {
      try { const r = await state.viewer.saveXML({ format: true }); xml = r.xml; } catch(e) { /* use state.xml */ }
    }
    const data = serverAvailable
      ? await fetch(`${API_BASE}/analyze`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ xml })
        }).then(res => res.json())
      : analyzeXmlLocally(xml);
    renderAnalyzeModal(data, xml);
  } catch(e) {
    document.getElementById('analyze-modal-body').innerHTML = `<div style="color:#dc2626">❌ Lỗi: ${e.message}</div>`;
  }
});

function renderAnalyzeModal(data, xml) {
  const s   = data.statistics || {};
  const cmp = data.complexity || {};
  const issues = data.issues || [];
  const checklist = BATools.buildBaChecklist(state.steps, xml);
  const score  = Math.max(0, 100 - issues.filter(i=>i.severity==='error').length*20 - issues.filter(i=>i.severity==='warning').length*10);
  const scoreCls = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad';

  document.getElementById('analyze-modal-body').innerHTML = `
    <div class="analyze-grid">
      <div class="analyze-card">
        <div class="analyze-card-label">Tasks</div>
        <div class="analyze-stat">${s.tasks||0}</div>
        <div class="analyze-stat-sub">userTask · serviceTask · ...</div>
      </div>
      <div class="analyze-card">
        <div class="analyze-card-label">Gateways</div>
        <div class="analyze-stat">${s.gateways||0}</div>
        <div class="analyze-stat-sub">${s.conditionalFlows||0} conditional flows</div>
      </div>
      <div class="analyze-card">
        <div class="analyze-card-label">Swimlanes</div>
        <div class="analyze-stat">${s.lanes||0}</div>
        <div class="analyze-stat-sub">${s.startEvents||0} start · ${s.endEvents||0} end events</div>
      </div>
      <div class="analyze-card">
        <div class="analyze-card-label">Complexity</div>
        <div class="analyze-stat" style="font-size:18px">${cmp.label||'—'}</div>
        <div class="analyze-stat-sub">Score: ${cmp.score||'?'}</div>
      </div>
    </div>

    <div class="compliance-bar-wrap" style="margin-bottom:16px">
      <div class="compliance-label-row">
        <span>BPMN 2.0 Quality Score${data.offline ? ' · Offline' : ''}</span>
        <strong>${score}/100</strong>
      </div>
      <div class="compliance-bar">
        <div class="compliance-bar-fill ${scoreCls}" style="width:${score}%"></div>
      </div>
    </div>

    <div style="font-weight:700; font-size:13px; margin-bottom:8px">
      ${issues.length === 0 ? '✅ Không có vấn đề nào' : `⚠️ Issues (${issues.length})`}
    </div>
    <ul class="analyze-issue-list">
      ${issues.map(i => `
        <li class="analyze-issue-item ${i.severity}">
          <span>${i.severity==='error'?'🔴':i.severity==='warning'?'🟡':'🔵'}</span>
          <span>${escHtml(i.message)}</span>
        </li>
      `).join('')}
    </ul>

    <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border)">
      <div style="font-weight:700; font-size:13px; margin-bottom:8px">🧭 BA-Friendly Checklist</div>
      <ul class="analyze-issue-list">
        ${checklist.map(item => `
          <li class="analyze-issue-item ${item.status === 'pass' ? 'info' : item.status === 'fail' ? 'error' : 'warning'}">
            <span>${item.status === 'pass' ? '🟢' : item.status === 'fail' ? '🔴' : '🟡'}</span>
            <span><strong>${escHtml(item.label)}:</strong> ${escHtml(item.detail)}</span>
          </li>
        `).join('')}
      </ul>
    </div>

    <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border)">
      <div style="font-weight:700; font-size:13px; margin-bottom:8px">📌 BPMN 2.0 Compliance</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12.5px">
        <span>${xml.includes('bpmn:collaboration') ? '✅' : '❌'} Pool/Participant</span>
        <span>${(s.startEvents||0) === 1 ? '✅' : '❌'} Start Event (1)</span>
        <span>${(s.endEvents||0) > 0 ? '✅' : '❌'} End Event</span>
        <span>${(s.lanes||0) > 0 ? '✅' : '⚠️'} Swimlanes</span>
        <span>${(s.conditionalFlows||0) > 0 ? '✅' : '⚠️'} Conditions</span>
        <span>${xml.includes('<bpmn:endEvent') ? '✅' : '⚠️'} Camunda-style End Event</span>
      </div>
    </div>
  `;
}

/* ─── VALIDATE DIAGRAM ───────────────────────────────────────────── */
document.getElementById('btn-validate-diagram').addEventListener('click', async () => {
  const modeler = state.viewer;
  if (!modeler) { toast('⚠️ Không có diagram', 'warn'); return; }
  try {
    const { xml } = await modeler.saveXML({ format: true });
    const data = serverAvailable
      ? await fetch(`${API_BASE}/validate`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ xml })
        }).then(res => res.json())
      : validateXmlLocally(xml);
    if (data.valid) {
      toast('✅ Valid BPMN 2.0 — ' + (data.message||'OK'), 'success');
    } else {
      const errs = (data.issues||[]).filter(i=>i.severity==='error').map(i=>i.message).join('; ');
      toast('❌ ' + (errs || data.message || 'Invalid BPMN'), 'error');
    }
  } catch(e) {
    toast('❌ Validate error: ' + e.message, 'error');
  }
});

/* ─── EXPORT PNG ──────────────────────────────────────────────────── */
document.getElementById('btn-export-png').addEventListener('click', async () => {
  if (!state.viewer) { toast('Chưa có diagram để export PNG', 'warn'); return; }
  try {
    const { svg } = await state.viewer.saveSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const scale = 2;
      const cnv = document.createElement('canvas');
      cnv.width  = img.width  * scale;
      cnv.height = img.height * scale;
      const ctx = cnv.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = cnv.toDataURL('image/png');
      const a = document.createElement('a');
      const title = document.getElementById('diagram-title-display').textContent || 'diagram';
      a.download = `${title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF ]/g,'_')}.png`;
      a.href = pngUrl;
      a.click();
      toast('📸 Đã export PNG thành công!', 'success');
    };
    img.onerror = () => toast('❌ Lỗi xuất PNG — SVG có thể chứa external images', 'error');
    img.src = url;
  } catch(e) {
    toast('❌ Export error: ' + e.message, 'error');
  }
});
