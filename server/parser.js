/**
 * BPMN Studio — Natural Language Parser
 *
 * Parse mô tả bằng tiếng Việt / tiếng Anh → structured steps
 * Ưu tiên Gemini; luôn hậu xử lý để lane/actor ổn định hơn.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

const ACTOR_PATTERNS = [
  { re: /khách\s*hàng|customer|client|người\s*dùng|user|người\s*mua/i, actor: 'Khách hàng' },
  { re: /nhân\s*viên\s*bán\s*hàng|sales|bán\s*hàng|nhân\s*viên\s*kinh\s*doanh/i, actor: 'Nhân viên bán hàng' },
  { re: /\bnhân\s*viên\b|\bstaff\b|\bemployee\b/i, actor: 'Nhân viên' },
  { re: /dược\s*sĩ|pharmacist/i, actor: 'Dược sĩ' },
  { re: /kỹ\s*thuật\s*viên|technician/i, actor: 'Kỹ thuật viên' },
  { re: /hệ\s*thống|system|tự\s*động|auto|automated/i, actor: 'Hệ thống' },
  { re: /quản\s*lý|manager|supervisor|lead\b/i, actor: 'Quản lý' },
  { re: /\bhr\b|phòng\s*nhân\s*sự|nhân\s*sự|human\s*resource/i, actor: 'HR' },
  { re: /kế\s*toán|accountant|accounting|tài\s*chính|finance/i, actor: 'Kế toán' },
  { re: /giám\s*đốc|director|ceo|board/i, actor: 'Giám đốc' },
  { re: /shipper|giao\s*hàng|vận\s*chuyển\s*viên|delivery/i, actor: 'Shipper' },
  { re: /nhà\s*cung\s*cấp|supplier|vendor|nhà\s*thầu/i, actor: 'Nhà cung cấp' },
  { re: /bác\s*sĩ|doctor|physician/i, actor: 'Bác sĩ' },
  { re: /y\s*tá|nurse/i, actor: 'Y tá' },
  { re: /admin|quản\s*trị\s*viên|administrator/i, actor: 'Admin' },
  { re: /kho|warehouse|thủ\s*kho/i, actor: 'Kho' },
];

const ACTOR_INFERENCE_HINTS = [
  { re: /đặt\s*hàng|gửi\s*yêu\s*cầu|nộp\s*đơn|xác\s*nhận|thanh\s*toán|nhận\s*kết\s*quả|nhận\s*hàng|ký\s*xác\s*nhận/i, actor: 'Khách hàng' },
  { re: /phê\s*duyệt|xem\s*xét|duyệt|approve|review/i, actor: 'Quản lý' },
  { re: /kiểm\s*tra\s*kho|xuất\s*kho|nhập\s*kho|đóng\s*gói|soạn\s*hàng/i, actor: 'Kho' },
  { re: /giao\s*hàng|vận\s*chuyển|deliver/i, actor: 'Shipper' },
  { re: /gửi\s*(email|sms|thông\s*báo)|cập\s*nhật|tạo\s*hóa\s*đơn|tạo\s*mã|ghi\s*nhận|đồng\s*bộ|kiểm\s*tra\s*tự\s*động|tự\s*động/i, actor: 'Hệ thống' },
  { re: /nhận\s*đơn|liên\s*hệ|tư\s*vấn|xử\s*lý\s*đơn|kiểm\s*tra\s*đơn/i, actor: 'Nhân viên bán hàng' },
  { re: /kiểm\s*tra\s*phép|hồ\s*sơ\s*nhân\s*sự|ngày\s*phép/i, actor: 'HR' },
  { re: /thanh\s*toán|đối\s*chiếu|ghi\s*nhận\s*chứng\s*từ|hóa\s*đơn/i, actor: 'Kế toán' },
];

const TASK_TYPE_HINTS = [
  { re: /xem\s*xét|phê\s*duyệt|approve|review|confirm|tch|ntl/i, type: 'userTask' },
  { re: /tự\s*động|auto|hệ\s*thống\s*tạo|generate|calculate|tính\s*toán|đồng\s*bộ|ghi\s*nhận/i, type: 'serviceTask' },
  { re: /gửi\s*(email|thông\s*báo|sms|tin\s*nhắn|notify)|send/i, type: 'sendTask' },
  { re: /tiếp\s*nhận|nhận\s*đơn\s*mới|nhận\s*hàng|nhận\s*thông\s*báo|receive/i, type: 'receiveTask' },
  { re: /điền\s*form|nhập\s*dữ\s*liệu|fill|enter|input|nộp\s*đơn/i, type: 'userTask' },
  { re: /kiểm\s*tra\s*tay|thủ\s*công|manual|physical|đóng\s*gói|soạn\s*hàng/i, type: 'manualTask' },
];

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

const SKIP_PATTERNS = [
  /^\s*[-–—•]\s*$/,
  /^\s*\d+\.?\s*$/,
  /^\s*$/,
];

function normalizeActor(actor) {
  const raw = String(actor || '').trim();
  if (!raw) return '';
  const matched = ACTOR_PATTERNS.find(({ re }) => re.test(raw));
  return matched ? matched.actor : raw;
}

function inferTaskType(action) {
  const text = String(action || '');
  const matched = TASK_TYPE_HINTS.find(({ re }) => re.test(text));
  return matched ? matched.type : 'task';
}

function extractActor(text) {
  const raw = String(text || '').trim();
  const matched = ACTOR_PATTERNS.find(({ re }) => re.test(raw));
  return matched ? matched.actor : '';
}

function extractLeadingActor(text) {
  const raw = String(text || '').trim();
  const prefix = raw.split(/[,:;.!?]/)[0].split(/\s+/).slice(0, 5).join(' ');
  return extractActor(prefix);
}

function inferActorFromAction(action, fallbackActor) {
  const raw = String(action || '').trim();
  const explicit = extractLeadingActor(raw);
  if (explicit) return explicit;

  const inferred = ACTOR_INFERENCE_HINTS.find(({ re }) => re.test(raw));
  if (inferred) return inferred.actor;

  if (/^(gửi|thông báo|email|sms)/i.test(raw)) {
    return fallbackActor || 'Hệ thống';
  }

  return fallbackActor || '';
}

function stripLeadingMarkers(line) {
  return String(line || '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^[-–—•]\s*/, '')
    .replace(/^bước\s*\d+\s*[:\-]?\s*/i, '')
    .replace(/^step\s*\d+\s*[:\-]?\s*/i, '')
    .trim();
}

function cleanupAction(text, actor) {
  let action = String(text || '').trim();
  if (!action) return '';

  const actorLabel = normalizeActor(actor);
  if (actorLabel) {
    const escapedActor = actorLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    action = action.replace(new RegExp(`^${escapedActor}\\s*[:：-]?\\s*`, 'i'), '').trim();
  }

  action = action
    .replace(/^(nếu|if|khi|when)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return action;
}

function splitDescriptionToClauses(description) {
  return String(description || '')
    .split(/\n+/)
    .flatMap(line => line.split(/(?<=[\.\?!;])\s+|(?=Sau đó\b)|(?=Tiếp theo\b)|(?=Then\b)|(?=Next\b)/i))
    .map(stripLeadingMarkers)
    .filter(line => line.length > 2 && !SKIP_PATTERNS.some(re => re.test(line)));
}

function buildStepFromClause(line, stepNum, lastActor) {
  const cleanLine = stripLeadingMarkers(line);
  if (!cleanLine) return null;

  const isCondition = CONDITION_STARTERS.some(re => re.test(cleanLine));
  const fallbackActor = inferActorFromAction(cleanLine, lastActor || 'Người dùng') || lastActor || 'Người dùng';

  let condition = '';
  let action = cleanLine;

  if (isCondition) {
    const colonSplit = cleanLine.split(/[：:]/);
    if (colonSplit.length >= 2) {
      condition = colonSplit[0]
        .replace(/^(nếu|if|khi|when)\s*/i, '')
        .replace(/\s*\(.*?\)/g, '')
        .trim();
      action = colonSplit.slice(1).join(':').trim();
    } else {
      const conditionMatch = cleanLine.match(/(?:nếu|if|khi|when)\s+([^,\.:]+)/i);
      condition = conditionMatch ? conditionMatch[1].trim() : '';
      action = cleanLine.replace(/^(nếu|if|khi|when)\s+/i, '');
    }
  }

  const actor = inferActorFromAction(action, fallbackActor) || fallbackActor;
  action = cleanupAction(action, actor);
  if (action.length < 3) return null;

  return {
    step: stepNum,
    actor,
    action: action.substring(0, 120),
    condition: condition.substring(0, 80),
    type: inferTaskType(action),
    gatewayType: condition ? 'exclusiveGateway' : '',
  };
}

function postProcessStructure(title, description, structure) {
  const fallbackActors = [];
  splitDescriptionToClauses(description).forEach(clause => {
    const actor = extractActor(clause);
    if (actor && !fallbackActors.includes(actor)) fallbackActors.push(actor);
  });

  const sourceSteps = Array.isArray(structure?.steps) ? structure.steps : [];
  const steps = [];
  const actors = [];
  let lastActor = fallbackActors[0] || '';

  sourceSteps.forEach((rawStep, index) => {
    const candidateActor =
      normalizeActor(rawStep?.actor) ||
      extractActor(rawStep?.action) ||
      inferActorFromAction(rawStep?.action, lastActor) ||
      lastActor ||
      fallbackActors[0] ||
      'Người dùng';

    const action = cleanupAction(rawStep?.action, candidateActor);
    if (!action) return;

    const condition = String(rawStep?.condition || '').trim().substring(0, 80);
    const normalized = {
      step: steps.length + 1,
      actor: candidateActor,
      action: action.substring(0, 120),
      condition,
      type: rawStep?.type ? String(rawStep.type) : inferTaskType(action),
      gatewayType: rawStep?.gatewayType || (condition ? 'exclusiveGateway' : ''),
      eventType: rawStep?.eventType || '',
    };

    lastActor = normalized.actor;
    steps.push(normalized);
    if (!actors.includes(normalized.actor)) actors.push(normalized.actor);

    if (!rawStep?.actor && /(?:\svà\s|\sand\s)/i.test(action) && index === sourceSteps.length - 1 && steps.length < 2) {
      const clauses = splitDescriptionToClauses(action);
      if (clauses.length > 1) {
        steps.pop();
        actors.splice(actors.indexOf(normalized.actor), 1);
        clauses.forEach(clause => {
          const subStep = buildStepFromClause(clause, steps.length + 1, lastActor);
          if (!subStep) return;
          lastActor = subStep.actor;
          steps.push(subStep);
          if (!actors.includes(subStep.actor)) actors.push(subStep.actor);
        });
      }
    }
  });

  if (steps.length > 0) {
    return { steps, actors };
  }

  const regexSteps = [];
  let currentActor = fallbackActors[0] || '';
  splitDescriptionToClauses(description).forEach(clause => {
    const step = buildStepFromClause(clause, regexSteps.length + 1, currentActor);
    if (!step) return;
    currentActor = step.actor;
    regexSteps.push(step);
  });

  if (regexSteps.length > 0) {
    return {
      steps: regexSteps,
      actors: [...new Set(regexSteps.map(step => step.actor))],
    };
  }

  return {
    steps: [
      { step: 1, actor: 'Người dùng', action: title || 'Bắt đầu quy trình', condition: '', type: 'task', gatewayType: '' },
      { step: 2, actor: 'Hệ thống', action: 'Xử lý yêu cầu', condition: '', type: 'serviceTask', gatewayType: '' },
      { step: 3, actor: 'Người dùng', action: 'Nhận kết quả', condition: '', type: 'task', gatewayType: '' },
    ],
    actors: ['Người dùng', 'Hệ thống'],
  };
}

async function parseDescriptionToStructure(title, description) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Bạn là chuyên gia phân tích nghiệp vụ và chuẩn BPMN 2.0 cho Camunda.
Hãy đọc mô tả quy trình và chuyển thành JSON steps theo đúng trình tự.

Quy trình: "${title}"
Mô tả:
"${description}"

YÊU CẦU BẮT BUỘC:
1. Tách mô tả thành nhiều bước nhỏ theo thứ tự thực thi. Mỗi bước chỉ có 1 hành động chính.
2. Mọi bước phải có actor rõ ràng để frontend tạo đúng swimlane. KHÔNG được dồn toàn bộ bước vào một actor nếu mô tả có nhiều vai trò. Nếu mô tả không ghi rõ actor của từng câu, hãy suy luận actor nghiệp vụ hợp lý nhất.
3. Chuẩn hóa actor về vai trò ngắn gọn như: "Khách hàng", "Hệ thống", "Quản lý", "Kế toán", "HR", "Shipper", "Nhân viên bán hàng", ...
4. Nếu có điều kiện, điền "condition" và "gatewayType" phù hợp.
5. Chỉ trả về duy nhất 1 object JSON, không markdown.

Định dạng:
{
  "steps": [
    { "step": 1, "actor": "Khách hàng", "action": "Tạo yêu cầu", "condition": "", "type": "userTask", "gatewayType": "", "eventType": "" }
  ],
  "actors": ["Khách hàng", "Hệ thống"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return postProcessStructure(title, description, parsed);
    } catch (e) {
      console.error('Gemini parse failed, fallback to heuristic parser:', e);
    }
  }

  return postProcessStructure(title, description, null);
}

module.exports = { parseDescriptionToStructure };
