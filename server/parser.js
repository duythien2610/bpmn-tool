/**
 * BPMN Studio — Natural Language Parser
 * 
 * Parse mô tả bằng tiếng Việt / tiếng Anh → structured steps
 * Sử dụng Google Gemini AI để phân tích thông minh
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ── ACTOR PATTERNS ─────────────────────────────────────────────────────────
const ACTOR_PATTERNS = [
  { re: /khách\s*hàng|customer|client|người\s*dùng|user|người\s*mua/i, actor: 'Khách hàng' },
  { re: /nhân\s*viên\s*bán\s*hàng|sales|bán\s*hàng|nhân\s*viên\s*kinh\s*doanh/i, actor: 'Nhân viên bán hàng' },
  { re: /dược\s*sĩ|pharmacist/i, actor: 'Dược sĩ' },
  { re: /kỹ\s*thuật\s*viên|technician/i, actor: 'Kỹ thuật viên' },
  { re: /hệ\s*thống|system|tự\s*động|auto|automated/i, actor: 'Hệ thống' },
  { re: /quản\s*lý|manager|supervisor/i, actor: 'Quản lý' },
  { re: /hr|phòng\s*nhân\s*sự|nhân\s*sự|human\s*resource/i, actor: 'HR' },
  { re: /kế\s*toán|accountant|accounting|tài\s*chính/i, actor: 'Kế toán' },
  { re: /giám\s*đốc|director|ceo|board/i, actor: 'Giám đốc' },
  { re: /shipper|giao\s*hàng|vận\s*chuyển\s*viên/i, actor: 'Shipper' },
  { re: /nhà\s*cung\s*cấp|supplier|vendor|nhà\s*thầu/i, actor: 'Nhà cung cấp' },
  { re: /bác\s*sĩ|doctor|physician/i, actor: 'Bác sĩ' },
  { re: /y\s*tá|nurse/i, actor: 'Y tá' },
  { re: /admin|quản\s*trị\s*viên|administrator/i, actor: 'Admin' },
  { re: /kho|warehouse|thủ\s*kho/i, actor: 'Kho' },
];

// ── TASK TYPE HINTS ────────────────────────────────────────────────────────
const TASK_TYPE_HINTS = [
  { re: /xem\s*xét|phê\s*duyệt|approve|review|confirm|tch|ntl/i, type: 'userTask' },
  { re: /tự\s*động|auto|hệ\s*thống\s*tạo|generate|calculate|tính\s*toán/i, type: 'serviceTask' },
  { re: /gửi\s*(email|thông\s*báo|sms|tin\s*nhắn|notify)|send/i, type: 'sendTask' },
  { re: /nhận\s*đơn|nhận\s*hàng|nhận\s*thông\s*báo|receive/i, type: 'receiveTask' },
  { re: /điền\s*form|nhập\s*dữ\s*liệu|fill|enter|input/i, type: 'userTask' },
  { re: /kiểm\s*tra\s*tay|thủ\s*công|manual|physical/i, type: 'manualTask' },
];

// ── CONDITION INDICATOR PATTERNS ───────────────────────────────────────────
const CONDITION_STARTERS = [
  /^nếu\b/i,
  /^if\b/i,
  /^khi\b/i,
  /^when\b/i,
  /^trong\s*trường\s*hợp/i,
  /^case\b/i,
  /\bxor\b/i,
  /\band\s+gateway\b/i,
  /cổng\s*logic/i,
  /gateway\b/i,
  /\bphân\s*nhánh\b/i,
  /\bkiểm\s*tra\b.*\?/i,
];

// ── SKIP LINE PATTERNS ─────────────────────────────────────────────────────
const SKIP_PATTERNS = [
  /^\s*[-–—•]\s*$/,   // empty bullet
  /^\s*\d+\.?\s*$/,   // lone number
  /^\s*$/,
];

// ── MAIN PARSE FUNCTION ────────────────────────────────────────────────────
/**
 * Parse natural language process description into structured steps
 * @param {string} title - Process title
 * @param {string} description - Free-form text
 * @returns {Promise<{ steps: Array, actors: string[] }>}
 */
async function parseDescriptionToStructure(title, description) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Bạn là chuyên gia phân tích nghiệp vụ và chuẩn BPMN 2.0.
Hãy đọc đoạn mô tả quy trình dưới đây và trích xuất ra các bước theo đúng trình tự.
Quy trình: "${title}"
Mô tả:
"${description}"

YÊU CẦU:
1. Xác định đúng tác nhân (actor) cho từng bước. Nếu không rõ, hãy dùng "Hệ thống" hoặc "Người dùng".
2. Tóm tắt hành động (action) ngắn gọn, dễ hiểu.
3. Nếu có rẽ nhánh (nếu, trong trường hợp...), hãy ghi vào trường condition và thêm gatewayType là "exclusiveGateway".
4. Phân loại loại task (type) chuẩn BPMN: task, userTask, serviceTask, sendTask, receiveTask, manualTask, scriptTask, businessRuleTask.

TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON (Không bọc trong markdown \`\`\`json):
{
  "steps": [
    { "step": 1, "actor": "Tên tác nhân", "action": "Mô tả ngắn gọn", "condition": "", "type": "userTask", "gatewayType": "" }
  ],
  "actors": ["Tác nhân 1", "Tác nhân 2"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Gemini parse failed, fallback to regex:", e);
    }
  }

  // Fallback regex parsing
  const rawLines = description
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 2 && !SKIP_PATTERNS.some(p => p.test(l)));

  let stepNum = 1;
  let lastActor = null;
  const steps = [];
  const actorsSeen = [];

  for (const line of rawLines) {
    // Remove leading list markers
    const cleanLine = line
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/^[-–—•]\s*/, '')
      .replace(/^bước\s*\d+\s*[:\-]?\s*/i, '')
      .replace(/^step\s*\d+\s*[:\-]?\s*/i, '')
      .trim();

    if (!cleanLine) continue;

    // Detect actor
    let detectedActor = null;
    let lineWithoutActor = cleanLine;
    for (const ap of ACTOR_PATTERNS) {
      if (ap.re.test(cleanLine)) {
        detectedActor = ap.actor;
        // Remove actor prefix from action text if at start
        lineWithoutActor = cleanLine.replace(/^[^:：]+[：:]\s*/, '').trim();
        if (!lineWithoutActor) lineWithoutActor = cleanLine;
        break;
      }
    }
    const actor = detectedActor || lastActor || 'Người dùng';
    lastActor = actor;
    if (!actorsSeen.includes(actor)) actorsSeen.push(actor);

    // Detect condition
    const isCondition = CONDITION_STARTERS.some(p => p.test(cleanLine));
    let condition = '';
    let action = lineWithoutActor;

    if (isCondition) {
      // Extract condition text — look for parentheses or colon split
      const colonSplit = cleanLine.split(/[：:]/);
      if (colonSplit.length >= 2) {
        // e.g. "Nếu hết hàng: Hủy đơn"
        const condPart = colonSplit[0]
          .replace(/^(nếu|if|khi|when)\s*/i, '')
          .replace(/\s*\(.*?\)/g, '')
          .trim();
        condition = condPart;
        action = colonSplit.slice(1).join(':').trim();
      } else {
        const parenMatch = cleanLine.match(/\(([^)]+)\)/);
        if (parenMatch) {
          condition = parenMatch[1];
        } else {
          const cMatch = cleanLine.match(/(?:nếu|if|khi|when)\s+([^,\.:]+)/i);
          condition = cMatch ? cMatch[1].trim() : '';
        }
        action = cleanLine.replace(/^(nếu|if|khi|when)\s+/i, '');
      }
    }

    // Detect task type
    let taskType = 'task';
    for (const th of TASK_TYPE_HINTS) {
      if (th.re.test(action)) { taskType = th.type; break; }
    }

    // Don't add if action is too short
    if (action.length < 3) continue;

    steps.push({
      step: stepNum++,
      actor,
      action: action.substring(0, 100),
      condition: condition.substring(0, 80),
      type: taskType,
    });
  }

  // Fallback: if nothing parsed
  if (steps.length === 0) {
    return {
      steps: [
        { step: 1, actor: 'Người dùng', action: title || 'Bắt đầu quy trình', condition: '', type: 'task' },
        { step: 2, actor: 'Hệ thống', action: 'Xử lý yêu cầu', condition: '', type: 'serviceTask' },
        { step: 3, actor: 'Người dùng', action: 'Nhận kết quả', condition: '', type: 'task' },
      ],
      actors: ['Người dùng', 'Hệ thống'],
    };
  }

  return { steps, actors: actorsSeen };
}

module.exports = { parseDescriptionToStructure };
