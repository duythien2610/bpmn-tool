/**
 * BPMN Studio — Node.js Express Server
 * Provides REST API để frontend gọi để generate BPMN XML chất lượng cao
 * Sử dụng bpmn-auto-layout để auto-layout đẹp chuẩn Camunda
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const { generateBpmn, importAndLayoutBpmn, validateBpmn } = require('./bpmn-service');
const { parseDescriptionToStructure } = require('./parser');

const app = express();
const PORT = process.env.PORT || process.env.BPMN_PORT || 3721;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', engine: 'bpmn-js + bpmn-auto-layout' });
});

// ── POST /api/parse — Parse text description → structured steps ────────────
app.post('/api/parse', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    const structure = await parseDescriptionToStructure(title || 'My Process', description);
    res.json({ success: true, structure });
  } catch (err) {
    console.error('[/api/parse]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/generate — Generate BPMN XML from structured steps ────────────
app.post('/api/generate', async (req, res) => {
  try {
    const { title, steps, lanes } = req.body;

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'steps array is required' });
    }

    const xml = await generateBpmn({ title: title || 'My Process', steps, lanes });
    res.json({ success: true, xml });
  } catch (err) {
    console.error('[/api/generate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/import — Import existing BPMN XML and auto-layout ─────────────
app.post('/api/import', async (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'xml is required' });
    }
    const result = await importAndLayoutBpmn(xml);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[/api/import]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/validate — Validate BPMN XML ──────────────────────────────────
app.post('/api/validate', async (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) {
      return res.status(400).json({ error: 'xml is required' });
    }
    const result = await validateBpmn(xml);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[/api/validate]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/analyze — Analyze BPMN XML (statistics + insights) ────────────
app.post('/api/analyze', async (req, res) => {
  try {
    const { xml } = req.body;
    if (!xml) return res.status(400).json({ error: 'xml is required' });

    const tasks      = (xml.match(/<bpmn:(?:task|userTask|serviceTask|sendTask|receiveTask|scriptTask|manualTask|businessRuleTask|callActivity)[^/]*\/>/gi)||[]).length;
    const gateways   = (xml.match(/<bpmn:(?:exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway)[^/]*\/>/gi)||[]).length;
    const lanes      = (xml.match(/<bpmn:lane /gi)||[]).length;
    const startEvents = (xml.match(/<bpmn:startEvent/gi)||[]).length;
    const endEvents  = (xml.match(/<bpmn:endEvent/gi)||[]).length;
    const flows      = (xml.match(/<bpmn:sequenceFlow/gi)||[]).length;
    const condFlows  = (xml.match(/<bpmn:conditionExpression/gi)||[]).length;

    const complexity = 1 + gateways + condFlows;
    const complexityLabel = complexity > 20 ? 'Rất phức tạp'
      : complexity > 10 ? 'Phức tạp'
      : complexity > 5  ? 'Trung bình' : 'Đơn giản';

    const issues = [];
    if (startEvents === 0) issues.push({ severity: 'error',   message: 'Thiếu Start Event' });
    if (endEvents === 0)   issues.push({ severity: 'warning',  message: 'Thiếu End Event' });
    if (gateways > 0 && condFlows === 0) issues.push({ severity: 'warning', message: 'Gateway không có Condition Expression' });
    if (lanes === 0 && tasks > 3) issues.push({ severity: 'info', message: 'Nên thêm Swimlane để phân trách nhiệm' });

    res.json({
      success: true,
      statistics: { tasks, gateways, lanes, startEvents, endEvents, sequenceFlows: flows, conditionalFlows: condFlows },
      complexity: { score: complexity, label: complexityLabel },
      issues,
      valid: !issues.some(i => i.severity === 'error'),
    });
  } catch (err) {
    console.error('[/api/analyze]', err);
    res.status(500).json({ error: err.message });
  }
});


// ── POST /api/assistant — Diagram Assistant: natural language → XML edit ────
app.post('/api/assistant', async (req, res) => {
  try {
    const { message, xml, title } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const msg = message.toLowerCase().trim();
    let newXml = xml || '';
    let reply  = '';

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
Bạn là một chuyên gia BPMN 2.0 (Camunda).
Người dùng đang có một sơ đồ BPMN (XML) và yêu cầu chỉnh sửa sơ đồ đó thông qua câu lệnh: "${message}"

XML SƠ ĐỒ HIỆN TẠI:
\`\`\`xml
${newXml}
\`\`\`

NHIỆM VỤ CỦA BẠN:
1. Đọc XML và hiểu cấu trúc hiện tại.
2. Sửa đổi trực tiếp mã XML dựa theo yêu cầu của người dùng (ví dụ: đổi tên phần tử, thay đổi loại task, thêm/xóa điều kiện rẽ nhánh, đánh dấu isExecutable...).
3. Tuyệt đối giữ nguyên không gian tên (namespaces), tọa độ (nếu có thể) và các thuộc tính khác không liên quan.
4. Trả về cho tôi duy nhất một object JSON có 2 trường (không bọc trong markdown codeblock \`\`\`json, chỉ trả về chuỗi JSON):
{
  "reply": "Câu trả lời giải thích ngắn gọn bằng tiếng Việt những gì bạn đã sửa",
  "xml": "Mã XML đã được sửa lại hoàn chỉnh (nếu có sửa đổi, nếu không sửa thì để rỗng)"
}
`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Parse JSON from Gemini response (clean markdown if any)
      const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      reply = parsed.reply || "Đã xử lý xong yêu cầu của bạn.";
      if (parsed.xml && parsed.xml.trim() !== '') {
        newXml = parsed.xml;
      }

    } catch (aiError) {
      console.error('Lỗi gọi Gemini API:', aiError);
      reply = \`🤖 Đã có lỗi kết nối với AI: \${aiError.message}\`;
    }

    res.json({ success: true, reply, xml: newXml || undefined });
  } catch(err) {
    console.error('[/api/assistant]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/smoke-result — Persist smoke test output for headless checks ──
app.post('/api/smoke-result', (req, res) => {
  try {
    const outputPath = path.join(__dirname, '..', 'smoke-result.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      receivedAt: new Date().toISOString(),
      ...req.body,
    }, null, 2), 'utf8');
    res.json({ success: true, outputPath });
  } catch (err) {
    console.error('[/api/smoke-result]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Serve index.html for all other routes ──────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎯 BPMN Studio Server đang chạy:`);
  console.log(`   → Mở trình duyệt: http://localhost:${PORT}`);
  console.log(`   → API endpoint:   http://localhost:${PORT}/api`);
  console.log(`   → Health check:   http://localhost:${PORT}/api/health\n`);
});
