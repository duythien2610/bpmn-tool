/**
 * BPMN Studio — Node.js Express Server
 * Provides REST API để frontend gọi để generate BPMN XML chất lượng cao
 * Sử dụng bpmn-auto-layout để auto-layout đẹp chuẩn Camunda
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const { generateBpmnArtifacts, importAndLayoutBpmn, validateBpmn } = require('./bpmn-service');
const { parseDescriptionToStructure } = require('./parser');

const app = express();
const PORT = process.env.PORT || process.env.BPMN_PORT || 3721;

function countBpmnTag(xml, tag) {
  return (String(xml || '').match(new RegExp(`<(?:\\w+:)?${tag}\\b`, 'gi')) || []).length;
}

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

    const result = await generateBpmnArtifacts({ title: title || 'My Process', steps, lanes });
    res.json({ success: true, ...result });
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
    const flows = countBpmnTag(xml, 'sequenceFlow');
    const condFlows = countBpmnTag(xml, 'conditionExpression');

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
      reply = `🤖 Đã có lỗi kết nối với AI: ${aiError.message}`;
    }

    res.json({ success: true, reply, xml: newXml || undefined });
  } catch(err) {
    console.error('[/api/assistant]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/gemini-studio — Gemini Studio premium BA features ──────────────
app.post('/api/gemini-studio', async (req, res) => {
  try {
    const { mode, title, description } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong file .env trên Server.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let prompt = '';

    if (mode === 'optimize') {
      prompt = `Bạn là một chuyên gia phân tích nghiệp vụ (Business Analyst) chuyên về chuẩn hóa quy trình BPMN 2.0.
Hãy tối ưu hóa bản mô tả quy trình dưới đây thành một danh sách có thứ tự (1, 2, 3...) tuân thủ tuyệt đối quy tắc cú pháp sau:

=== CÚ PHÁP BẮT BUỘC ===

TASK cơ bản:
- Mỗi bước: "Số. Vai trò: Hành động" → Ví dụ: "1. Khách hàng: Gửi yêu cầu mua hàng"
- Vai trò (actor) là tên người/bộ phận thực hiện: Khách hàng, Hệ thống, Quản lý, Kế toán, Kho, HR, Sales, IT Staff...

GATEWAY — XOR (điều kiện rẽ nhánh):
- Phải có ĐÚNG MỘT CẶP dòng "Nếu" liên tiếp, một cho nhánh chính, một cho nhánh từ chối:
  "3. Nếu hồ sơ hợp lệ: Quản lý: Phê duyệt"
  "4. Nếu hồ sơ không hợp lệ: Hệ thống: Gửi thông báo từ chối"

GATEWAY — AND (hành động song song):
- Dùng "Đồng thời:" cho các nhánh song song:
  "5. Đồng thời: Nhân viên kho: Đóng gói hàng"
  "6. Đồng thời: Kế toán: Xuất hóa đơn"

EVENTS — Sự kiện đặc biệt (QUAN TRỌNG — dùng đúng từ khóa để parser nhận diện):
- Timer Catch:       "7. Chờ 30 phút:" hoặc "Chờ 2 giờ:" hoặc "Chờ đến ngày X:"
- Message Catch:     "8. Chờ xác nhận từ ngân hàng:" hoặc "Chờ phê duyệt từ Manager:"
- Signal Throw:      "9. Gửi thông báo: Cập nhật trạng thái cho tất cả hệ thống"
- Escalation Throw:  "10. Leo thang: Chuyển ticket lên Supervisor xử lý khẩn cấp"
- Error End Event:   "11. Báo lỗi: Thanh toán thất bại — hủy đơn hàng"
- Compensation:      "12. Hoàn tác: Hoàn tiền cho khách hàng"
- Conditional Catch: "13. Khi điều kiện phân xét hoàn tất:"
- Link Event:        "14. Link đến: Bước kiểm tra lại"

=== YÊU CẦU ===
TÊN QUY TRÌNH: "${title || 'Process'}"
MÔ TẢ CỦA NGƯỜI DÙNG:
"${description || ''}"

1. Chỉ chỉnh sửa định dạng và cấu trúc câu để tối ưu cho bộ phân tích cú pháp BPMN, tuyệt đối giữ nguyên toàn bộ các bước nghiệp vụ của người dùng.
2. Sửa lại các câu thiếu vai trò (actor) bằng cách gán cho vai trò hợp lý nhất.
3. Sử dụng đúng event keywords ở trên khi phát hiện timeout/escalation/lỗi/hoàn tác trong mô tả.
4. Trả về duy nhất một chuỗi văn bản danh sách các bước đã tối ưu, không có thêm bất kỳ chú thích hay định dạng markdown nào khác.`;


      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      return res.json({ success: true, optimized: text });
    }

    if (mode === 'exceptions') {
      prompt = `Bạn là chuyên gia phân tích nghiệp vụ và chất lượng quy trình BPMN 2.0.
Hãy đọc mô tả quy trình dưới đây và đề xuất từ 3 đến 5 kịch bản ngoại lệ hoặc trường hợp lỗi hoặc ràng buộc thời gian (SLA / Timeout / Error / Rejection) cụ thể cho quy trình này để giúp sơ đồ BPMN đầy đủ và hoàn thiện hơn.

TÊN QUY TRÌNH: "${title || 'Process'}"
MÔ TẢ QUY TRÌNH:
"${description || ''}"

Yêu cầu đề xuất:
1. Mỗi đề xuất phải ghi rõ lý do tại sao nó quan trọng (ví dụ: tránh tắc nghẽn, đảm bảo an toàn giao dịch).
2. Viết đề xuất đó dưới dạng dòng cú pháp BPMN Studio chuẩn để người dùng dễ dàng chèn thêm vào sơ đồ của họ nếu muốn. Cú pháp chuẩn: "Nếu [lỗi/timeout]: [Vai trò]: [Hành động khắc phục]" (Ví dụ: "Nếu sau 2 giờ chưa duyệt: Quản lý: Nhắc nhở khẩn cấp").
3. Trả về dưới dạng một danh sách JSON có cấu trúc như sau (không bọc trong markdown codeblock \`\`\`json, chỉ trả về chuỗi JSON):
[
  {
    "scenario": "Mô tả ngắn gọn về tình huống ngoại lệ",
    "reason": "Giải thích ngắn gọn tại sao cần có bước này",
    "syntax": "Nếu [điều kiện ngoại lệ]: [Vai trò]: [Hành động]"
  }
]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.json({ success: true, exceptions: parsed });
    }

    if (mode === 'compliance') {
      prompt = `Bạn là chuyên gia đánh giá và kiểm định quy trình BPMN 2.0.
Hãy phân tích mô tả quy trình sau và đưa ra đánh giá chi tiết về mặt logic nghiệp vụ và tính chuẩn hóa BPMN 2.0 (ví dụ: các luồng có điểm kết thúc không? có khả năng bị nghẽn (deadlock) không? rẽ nhánh đã đủ các trường hợp chưa?).

TÊN QUY TRÌNH: "${title || 'Process'}"
MÔ TẢ QUY TRÌNH:
"${description || ''}"

Yêu cầu:
1. Đưa ra ít nhất 3 nhận xét logic kèm theo giải thích nguyên nhân và cách khắc phục chi tiết.
2. Xếp hạng điểm chất lượng quy trình theo thang điểm từ 1-10.
3. Trả về kết quả dưới dạng JSON (không bọc trong markdown codeblock \`\`\`json, chỉ trả về chuỗi JSON):
{
  "score": 8.5,
  "rating": "Tốt / Cần cải thiện / Rất tốt",
  "insights": [
    {
      "issue": "Mô tả vấn đề phát hiện được",
      "impact": "Tác động đến vận hành / mô hình hóa",
      "suggestion": "Cách chỉnh sửa tối ưu nhất"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.json({ success: true, compliance: parsed });
    }

    return res.status(400).json({ error: 'Chế độ không hợp lệ' });
  } catch (err) {
    console.error('[/api/gemini-studio]', err);
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
  console.log('\n🎯 BPMN Studio Server đang chạy:');
  console.log('   → Mở trình duyệt: http://localhost:' + PORT);
  console.log('   → API endpoint:   http://localhost:' + PORT + '/api');
  console.log('   → Health check:   http://localhost:' + PORT + '/api/health\n');
});
