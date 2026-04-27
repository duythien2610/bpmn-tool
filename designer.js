/**
 * BPMN Studio — Designer v2
 * White theme + Node.js backend integration
 */

/* ─── EXAMPLES ────────────────────────────────────────────────── */
const EXAMPLES = {
  purchase: {
    title: 'Quy trình mua hàng online',
    desc: `Khách hàng đặt hàng trên website.
Nhân viên bán hàng nhận đơn hàng mới.
Nhân viên bán hàng kiểm tra xem sản phẩm còn trong kho không.
Nếu hết hàng: Gửi thông báo hủy đơn cho khách hàng.
Nhân viên bán hàng đóng gói hàng hóa.
Shipper nhận hàng và giao cho khách.
Khách hàng xác nhận đã nhận được hàng.
Hệ thống cập nhật trạng thái đơn hàng hoàn thành.`
  },
  pharmacy: {
    title: 'Quy trình cấp phát thuốc nhà thuốc',
    desc: `Khách hàng đến nhà thuốc với đơn thuốc của bác sĩ.
Dược sĩ nhận đơn và kiểm tra tính hợp lệ của đơn thuốc.
Hệ thống kiểm tra tương tác thuốc tự động (DUR check).
Nếu có cảnh báo: Dược sĩ xem xét và quyết định có override không.
Kỹ thuật viên thực hiện cấp phát thuốc từ kho.
Kỹ thuật viên dán nhãn và đóng gói thuốc.
Dược sĩ kiểm tra chất lượng và xác nhận trước khi giao.
Hệ thống tạo hóa đơn và cập nhật hồ sơ bệnh nhân.
Khách hàng thanh toán và nhận thuốc.`
  },
  leave: {
    title: 'Quy trình xin nghỉ phép nhân viên',
    desc: `Nhân viên điền form xin nghỉ phép trên hệ thống HR.
Hệ thống gửi thông báo tự động cho quản lý trực tiếp.
Quản lý xem xét đơn xin nghỉ của nhân viên.
Nếu số ngày lớn hơn 3: HR cần xem xét và phê duyệt thêm.
HR kiểm tra số ngày phép còn lại trong năm của nhân viên.
Nếu không đủ ngày phép: HR từ chối và thông báo cho nhân viên.
Quản lý phê duyệt đơn xin nghỉ.
Hệ thống cập nhật số ngày phép và gửi email xác nhận cho nhân viên.`
  },
  invoice: {
    title: 'Quy trình phê duyệt hóa đơn nhà cung cấp',
    desc: `Kế toán nhận hóa đơn từ nhà cung cấp.
Kế toán kiểm tra hóa đơn và đối chiếu với đơn đặt hàng gốc.
Nếu có sai lệch: Liên hệ nhà cung cấp yêu cầu điều chỉnh.
Kế toán gửi hóa đơn hợp lệ cho quản lý phê duyệt.
Quản lý xem xét và phê duyệt hóa đơn.
Nếu giá trị trên 50 triệu: Giám đốc cần ký duyệt thêm.
Giám đốc phê duyệt hóa đơn giá trị lớn.
Kế toán thực hiện thanh toán cho nhà cung cấp.
Hệ thống ghi nhận thanh toán và lưu chứng từ kế toán.`
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
  viewer: null,
  assistantCollapsed: localStorage.getItem('diagram_assistant_collapsed') === '1',
};

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
      el.addEventListener('change', () => { state.steps[idx][el.dataset.field] = el.value; });
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
      state.steps = data.structure.steps;
      toast(`✅ Trích xuất ${state.steps.length} bước (Server)`, 'success');
    } else {
      state.steps = parseFallback(title, desc);
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
  state.steps.push({ step: state.steps.length + 1, actor: '', action: 'Bước mới', condition: '', type: 'task' });
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
    }
  });
});

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
      toast('✅ Sơ đồ được tạo bởi BPMN Studio Engine 🎉', 'success');
    } else {
      xml = BpmnEngine.generate(state.title, state.steps);
      toast('Tạo sơ đồ (offline mode)', 'info');
    }

    state.xml = xml;
    document.getElementById('diagram-title-display').textContent = state.title;
    document.getElementById('xml-preview').textContent = xml;
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
  state.title = file.name.replace(/\.(bpmn|xml)$/i, '');
  document.getElementById('diagram-title-display').textContent = state.title;
  document.getElementById('xml-preview').textContent = xml;
  goToStep(3);
  await renderBpmn(xml);
  toast(`Đã import: ${file.name}`, 'success');
  e.target.value = '';
});

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
      throw new Error('Thư viện bpmn-js chưa được tải. Kiểm tra file server/node_modules/bpmn-js/dist/bpmn-modeler.production.min.js.');
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

/* ─── TOGGLE PROPERTIES PANEL ─────────────────────────────────────── */
document.getElementById('btn-toggle-props')?.addEventListener('click', () => {
  const panel = document.getElementById('props-panel');
  const btn   = document.getElementById('btn-toggle-props');
  const isHidden = panel.classList.toggle('hidden');
  btn.classList.toggle('btn-icon--active', !isHidden);
  btn.setAttribute('aria-pressed', String(!isHidden));
});

document.getElementById('btn-close-props')?.addEventListener('click', () => {
  document.getElementById('props-panel').classList.add('hidden');
  const btn = document.getElementById('btn-toggle-props');
  btn?.classList.remove('btn-icon--active');
  btn?.setAttribute('aria-pressed', 'false');
});

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
      const res = await fetch(`${API_BASE}/layout`, {
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
  }
  btn.disabled = false;
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

/* ─── SAVE (localStorage + Catalog) ──────────────────────────── */
// Handled by the BA Catalog section below — this stub prevents the old handler from conflicting.
// (The old plain localStorage save is replaced by the full catalog save)


/* ─── START OVER ──────────────────────────────────────────────── */
document.getElementById('btn-start-over').addEventListener('click', () => {
  if (!confirm('Bắt đầu lại từ đầu?')) return;
  document.getElementById('process-title').value = '';
  document.getElementById('process-desc').value = '';
  state.steps = []; state.xml = '';
  if (state.viewer) { state.viewer.destroy(); state.viewer = null; }
  goToStep(1);
});

/* ─── FALLBACK PARSER (offline mode) ─────────────────────────── */
function parseFallback(title, desc) {
  const ACTORS = [
    { re: /khách\s*hàng|customer|client|người\s*dùng|user/i, a: 'Khách hàng' },
    { re: /nhân\s*viên\s*bán|sales|bán\s*hàng/i, a: 'Nhân viên bán hàng' },
    { re: /dược\s*sĩ|pharmacist/i, a: 'Dược sĩ' },
    { re: /kỹ\s*thuật\s*viên|technician/i, a: 'Kỹ thuật viên' },
    { re: /hệ\s*thống|system|tự\s*động|auto/i, a: 'Hệ thống' },
    { re: /quản\s*lý|manager|supervisor/i, a: 'Quản lý' },
    { re: /hr|nhân\s*sự/i, a: 'HR' },
    { re: /kế\s*toán|accountant/i, a: 'Kế toán' },
    { re: /giám\s*đốc|director/i, a: 'Giám đốc' },
    { re: /shipper|giao\s*hàng/i, a: 'Shipper' },
    { re: /bác\s*sĩ|doctor/i, a: 'Bác sĩ' },
  ];
  const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 4);
  let lastActor = 'Người dùng', n = 1;
  const steps = [];
  for (const line of lines) {
    const clean = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-–•]\s*/, '').trim();
    if (!clean) continue;
    let actor = null;
    for (const { re, a } of ACTORS) { if (re.test(clean)) { actor = a; break; } }
    actor = actor || lastActor;
    lastActor = actor;
    const isCond = /^(nếu|if|khi|when)\b/i.test(clean);
    let condition = '', action = clean;
    if (isCond) {
      const parts = clean.split(/[:：]/);
      if (parts.length > 1) { condition = parts[0].replace(/^(nếu|if|khi|when)\s*/i, '').trim(); action = parts.slice(1).join(':').trim(); }
      else { condition = 'Điều kiện'; }
    }
    let type = 'task';
    if (/phê\s*duyệt|approve|review|xem\s*xét/i.test(action)) type = 'userTask';
    if (/hệ\s*thống|tự\s*động|auto|tạo|generate/i.test(action)) type = 'serviceTask';
    if (/gửi\s*(email|thông|sms)|send/i.test(action)) type = 'sendTask';
    steps.push({ step: n++, actor, action: action.substring(0, 100), condition: condition.substring(0, 80), type });
  }
  return steps.length > 0 ? steps : [
    { step: 1, actor: 'Người dùng', action: title, condition: '', type: 'task' },
    { step: 2, actor: 'Hệ thống', action: 'Xử lý yêu cầu', condition: '', type: 'serviceTask' },
  ];
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

function openCatalog() {
  document.getElementById('catalog-drawer').classList.remove('hidden');
  document.getElementById('catalog-overlay').classList.remove('hidden');
  renderCatalog();
}
function closeCatalog() {
  document.getElementById('catalog-drawer').classList.add('hidden');
  document.getElementById('catalog-overlay').classList.add('hidden');
}

document.getElementById('btn-catalog').addEventListener('click', openCatalog);
document.getElementById('btn-close-catalog').addEventListener('click', closeCatalog);
document.getElementById('catalog-overlay').addEventListener('click', closeCatalog);
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
  const entry = { id: existing >= 0 ? items[existing].id : Date.now().toString(), title, xml, owner, version, status, savedAt: new Date().toISOString() };

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
    const res  = await fetch('/api/analyze', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ xml })
    });
    const data = await res.json();
    renderAnalyzeModal(data, xml);
  } catch(e) {
    document.getElementById('analyze-modal-body').innerHTML = `<div style="color:#dc2626">❌ Lỗi: ${e.message}</div>`;
  }
});

function renderAnalyzeModal(data, xml) {
  const s   = data.statistics || {};
  const cmp = data.complexity || {};
  const issues = data.issues || [];
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
        <span>BPMN 2.0 Quality Score</span>
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
      <div style="font-weight:700; font-size:13px; margin-bottom:8px">📌 BPMN 2.0 Compliance</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:12.5px">
        <span>${xml.includes('bpmn:collaboration') ? '✅' : '❌'} Pool/Participant</span>
        <span>${(s.startEvents||0) === 1 ? '✅' : '❌'} Start Event (1)</span>
        <span>${(s.endEvents||0) > 0 ? '✅' : '❌'} End Event</span>
        <span>${(s.lanes||0) > 0 ? '✅' : '⚠️'} Swimlanes</span>
        <span>${(s.conditionalFlows||0) > 0 ? '✅' : '⚠️'} Conditions</span>
        <span>${xml.includes('terminateEventDefinition') ? '✅' : '⚠️'} Terminate End</span>
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
    const res  = await fetch('/api/validate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ xml })
    });
    const data = await res.json();
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


