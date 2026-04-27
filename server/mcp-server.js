#!/usr/bin/env node
/**
 * BPMN Studio MCP Server v1.0
 * ─────────────────────────────────────────────────────────────────
 * Model Context Protocol server dành cho Business Analyst.
 * Cung cấp AI tools để tương tác với BPMN Studio (http://localhost:3721).
 *
 * Tools:
 *   generate_bpmn        — Tạo BPMN 2.0 từ mô tả ngôn ngữ tự nhiên
 *   validate_bpmn        — Kiểm tra chuẩn BPMN 2.0
 *   analyze_process      — Phân tích sơ đồ: metrics, insights
 *   layout_diagram       — Auto-layout theo chuẩn Camunda
 *   suggest_improvements — Đề xuất cải thiện quy trình (BA perspective)
 *   qa_bpmn              — QA theo Camunda best practice
 *
 * Usage:
 *   node mcp-server.js
 *
 * Config (.mcp.json / claude_desktop_config.json):
 *   {
 *     "servers": {
 *       "bpmn-studio": {
 *         "type": "stdio",
 *         "command": "node",
 *         "args": ["C:/Users/33dod/OneDrive/Desktop/BA/BPMN/server/mcp-server.js"]
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.BPMN_STUDIO_URL || "http://localhost:3721";

// ── Helper: call BPMN Studio REST API ─────────────────────────────────────
async function callApi(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  } catch (err) {
    return { error: err.message, offline: !err.message.includes("HTTP") };
  }
}

// ── Parse natural language steps → structured steps array ─────────────────
function parseStepsFromText(description, defaultActor = "System") {
  const lines = description
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  return lines.map((line) => {
    // Detect actor prefix: "Actor: action" or "Actor — action"
    const actorMatch = line.match(/^([^:—–\-]{2,30})[:\s—–-]+(.+)$/);
    let actor = defaultActor;
    let action = line;
    let condition = "";
    let type = "task";

    if (actorMatch) {
      const potentialActor = actorMatch[1].trim();
      // Only treat as actor if it looks like a noun (no verb indicators)
      if (
        potentialActor.length < 30 &&
        !potentialActor.toLowerCase().includes("nếu") &&
        !potentialActor.toLowerCase().includes("if ")
      ) {
        actor = potentialActor;
        action = actorMatch[2].trim();
      }
    }

    // Detect condition keywords
    const condMatch = action.match(
      /^(Nếu|If|Khi|When)\s+(.+?)[:,]\s*(.+)$/i
    );
    if (condMatch) {
      condition = condMatch[2].trim();
      action = condMatch[3].trim();
    }

    // Detect task type keywords
    const low = action.toLowerCase();
    if (low.includes("gửi") || low.includes("send") || low.includes("email") || low.includes("thông báo"))
      type = "sendTask";
    else if (low.includes("nhận") || low.includes("receive") || low.includes("tiếp nhận"))
      type = "receiveTask";
    else if (low.includes("hệ thống") || low.includes("tự động") || low.includes("system") || low.includes("api"))
      type = "serviceTask";
    else if (low.includes("duyệt") || low.includes("phê duyệt") || low.includes("approve") || low.includes("review") || low.includes("xem xét"))
      type = "userTask";
    else if (low.includes("nhập") || low.includes("điền") || low.includes("fill") || low.includes("form"))
      type = "userTask";

    return { actor, action: action.substring(0, 80), type, condition };
  });
}

// ── Analyze process from XML (without server call) ────────────────────────
function analyzeXmlLocally(xml) {
  const tasks = (xml.match(/<bpmn:(?:task|userTask|serviceTask|sendTask|receiveTask|scriptTask|manualTask|businessRuleTask|callActivity)[^/]*\/>/gi) || []).length;
  const gateways = (xml.match(/<bpmn:(?:exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway)[^/]*\/>/gi) || []).length;
  const lanes = (xml.match(/<bpmn:lane /gi) || []).length;
  const startEvents = (xml.match(/<bpmn:startEvent/gi) || []).length;
  const endEvents = (xml.match(/<bpmn:endEvent/gi) || []).length;
  const flows = (xml.match(/<bpmn:sequenceFlow/gi) || []).length;
  const condFlows = (xml.match(/<bpmn:conditionExpression/gi) || []).length;
  const terminateEnds = (xml.match(/<bpmn:terminateEventDefinition/gi) || []).length;

  const issues = [];
  if (startEvents === 0) issues.push("⚠️ Thiếu Start Event — mỗi process cần đúng 1 None Start Event");
  if (startEvents > 1) issues.push(`⚠️ Có ${startEvents} Start Events — nên chỉ có 1`);
  if (endEvents === 0) issues.push("⚠️ Thiếu End Event — mỗi path cần kết thúc tại End Event");
  if (gateways > 0 && condFlows === 0) issues.push("💡 Có Gateway nhưng không có Condition Expression — thêm nhãn điều kiện (Có/Không)");
  if (lanes === 0 && tasks > 3) issues.push("💡 Quy trình phức tạp nhưng không có Swimlane — nên thêm Lane để phân trách nhiệm");

  // Complexity score (McCabe-like for BA)
  const complexity = 1 + gateways + condFlows;
  let complexityLabel = "Đơn giản";
  if (complexity > 5) complexityLabel = "Trung bình";
  if (complexity > 10) complexityLabel = "Phức tạp";
  if (complexity > 20) complexityLabel = "Rất phức tạp — xem xét tách sub-process";

  return {
    statistics: { tasks, gateways, lanes, startEvents, endEvents, sequenceFlows: flows, conditionalFlows: condFlows, terminateEndEvents: terminateEnds },
    complexity: { score: complexity, label: complexityLabel },
    issues,
    bpmn2Compliance: { hasStart: startEvents === 1, hasEnd: endEvents > 0, hasLanes: lanes > 0, hasConditions: condFlows > 0 },
  };
}

// ── QA rules per Camunda BPMN 2.0 best practice ──────────────────────────
function runQaBpmnChecks(xml) {
  const checks = [];

  // Rule 1: Gateway naming
  const gwMatches = [...xml.matchAll(/bpmn:exclusiveGateway[^>]*name="([^"]+)"/g)];
  gwMatches.forEach((m) => {
    if (!m[1].includes("?")) {
      checks.push({
        severity: "warning",
        rule: "gateway-naming",
        message: `Gateway "${m[1]}" nên là câu hỏi kết thúc bằng "?" (e.g. "Đủ điều kiện?")`,
      });
    }
  });

  // Rule 2: Task naming — should be verb + noun
  const taskRe = /bpmn:(?:task|userTask|serviceTask)[^>]*name="([^"]+)"/g;
  const taskMatches = [...xml.matchAll(taskRe)];
  taskMatches.forEach((m) => {
    if (m[1].length > 60) {
      checks.push({
        severity: "info",
        rule: "task-name-length",
        message: `Task "${m[1].substring(0, 40)}..." quá dài (${m[1].length} ký tự) — nên < 60 ký tự`,
      });
    }
  });

  // Rule 3: Sequence flow labels on conditional flows
  const hasGateway = xml.includes("exclusiveGateway");
  const hasCondExpr = xml.includes("conditionExpression");
  if (hasGateway && !hasCondExpr) {
    checks.push({
      severity: "error",
      rule: "missing-condition-labels",
      message: "ExclusiveGateway phải có conditionExpression trên các outgoing flows — thêm nhãn 'Có'/'Không'",
    });
  }

  // Rule 4: Terminate End Event
  const hasEnd = xml.includes("endEvent");
  const hasTerminate = xml.includes("terminateEventDefinition");
  if (hasEnd && !hasTerminate) {
    checks.push({
      severity: "info",
      rule: "terminate-end-event",
      message: "Nên dùng Terminate End Event cho main process end để tránh token leak",
    });
  }

  // Rule 5: Pool/Participant
  if (!xml.includes("bpmn:collaboration")) {
    checks.push({
      severity: "info",
      rule: "missing-pool",
      message: "Không có Pool/Participant — thêm vào nếu process cần trao đổi Message với hệ thống ngoài",
    });
  }

  const passed = checks.filter((c) => c.severity === "error").length === 0;
  return { passed, checks, score: Math.max(0, 100 - checks.filter((c) => c.severity === "error").length * 20 - checks.filter((c) => c.severity === "warning").length * 10) };
}

// ── Suggest process improvements (BA perspective) ─────────────────────────
function suggestImprovements(xml, title = "") {
  const suggestions = [];
  const analysis = analyzeXmlLocally(xml);

  if (analysis.statistics.tasks > 10 && !xml.includes("callActivity")) {
    suggestions.push({ priority: "high", type: "decompose", suggestion: "Quy trình có > 10 tasks — xem xét tách thành Sub-Process hoặc Call Activity để tăng khả năng tái sử dụng" });
  }

  if (analysis.statistics.lanes === 0) {
    suggestions.push({ priority: "high", type: "swimlane", suggestion: "Thêm Swimlane (Pool/Lane) để phân rõ trách nhiệm theo actor — giúp stakeholder hiểu ngay ai làm gì" });
  }

  if (!xml.includes("errorEventDefinition") && analysis.statistics.gateways > 2) {
    suggestions.push({ priority: "medium", type: "error-handling", suggestion: "Thêm Error Boundary Event hoặc Error End Event để xử lý exception path — đặc biệt quan trọng cho service/system tasks" });
  }

  if (!xml.includes("timerEventDefinition") && (title.toLowerCase().includes("sla") || analysis.statistics.tasks > 5)) {
    suggestions.push({ priority: "medium", type: "timer", suggestion: "Xem xét thêm Timer Intermediate Event cho SLA monitoring — ví dụ: nếu task không hoàn thành trong 24h thì escalate" });
  }

  if (analysis.statistics.conditionalFlows === 0 && analysis.statistics.gateways > 0) {
    suggestions.push({ priority: "high", type: "conditions", suggestion: "Các Gateway chưa có Condition Expression — thêm điều kiện rõ ràng (FEEL expression hoặc text) để diagram có thể execute được" });
  }

  if (analysis.complexity.score > 15) {
    suggestions.push({ priority: "critical", type: "complexity", suggestion: `Độ phức tạp cao (score=${analysis.complexity.score}) — xem xét:\n  1. Dùng Event Sub-Process để tách exception flows\n  2. Tách gateways phức tạp thành Call Activities\n  3. Review với stakeholders để xác nhận đây là quy trình thực tế` });
  }

  suggestions.push({ priority: "low", type: "documentation", suggestion: "Thêm Documentation vào mỗi Task (click → Properties → Docs) để BA document requirements, acceptance criteria, và business rules" });

  return { suggestions, totalSuggestions: suggestions.length, criticalCount: suggestions.filter((s) => s.priority === "critical").length };
}

// ── Create MCP Server ──────────────────────────────────────────────────────
const server = new McpServer({
  name: "BPMN Studio BA Tool",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════
// TOOL 1: generate_bpmn
// ═══════════════════════════════════════════════════════════════
server.tool(
  "generate_bpmn",
  `Tạo sơ đồ BPMN 2.0 chuẩn từ mô tả quy trình bằng ngôn ngữ tự nhiên.
  
Trả về BPMN XML với:
- Pool/Participant container
- Swimlanes (Lanes) phân theo actor
- Tasks đúng loại (userTask, serviceTask, sendTask...)
- Gateways với condition labels
- Start/End Events chuẩn BPMN 2.0

Ví dụ prompt:
  "Khách hàng đặt hàng. Hệ thống kiểm tra tồn kho. Nếu hết hàng: gửi thông báo. Nếu còn: đóng gói và giao. Khách nhận hàng."`,
  {
    title: z.string().describe("Tên quy trình, ví dụ: 'Quy trình cấp phát thuốc'"),
    description: z.string().describe("Mô tả các bước quy trình, mỗi bước một dòng. Có thể dùng 'Actor: action' format"),
    process_type: z.enum(["as-is", "to-be", "happy-path"]).optional().describe("Loại process: as-is (hiện tại), to-be (tương lai), happy-path (luồng chính)"),
    actors: z.array(z.string()).optional().describe("Danh sách actors/swimlanes, ví dụ: ['Khách hàng', 'Dược sĩ', 'Hệ thống']"),
  },
  async ({ title, description, process_type, actors }) => {
    const steps = parseStepsFromText(description, actors?.[0] || "System");
    const result = await callApi("/api/generate", "POST", { title: `[${(process_type || "to-be").toUpperCase()}] ${title}`, steps });

    if (result.error) {
      return {
        content: [{ type: "text", text: `❌ Lỗi kết nối BPMN Studio: ${result.error}\n\nĐảm bảo server đang chạy: node server/server.js` }],
      };
    }

    const analysis = analyzeXmlLocally(result.xml);
    return {
      content: [
        {
          type: "text",
          text: `✅ Đã tạo BPMN diagram: "${title}"

📊 Thống kê:
- Tasks: ${analysis.statistics.tasks}
- Gateways: ${analysis.statistics.gateways}  
- Swimlanes: ${analysis.statistics.lanes}
- Sequence Flows: ${analysis.statistics.sequenceFlows}
- Complexity: ${analysis.complexity.label} (score: ${analysis.complexity.score})

${analysis.issues.length > 0 ? "⚠️ Issues:\n" + analysis.issues.join("\n") : "✅ Không có issues"}

--- BPMN 2.0 XML ---
${result.xml}`,
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 2: validate_bpmn
// ═══════════════════════════════════════════════════════════════
server.tool(
  "validate_bpmn",
  "Kiểm tra BPMN XML có đúng chuẩn BPMN 2.0 không. Phát hiện lỗi: thiếu Start/End Event, Gateway thiếu condition, flow không hoàn chỉnh.",
  { xml: z.string().describe("BPMN XML string cần validate") },
  async ({ xml }) => {
    const result = await callApi("/api/validate", "POST", { xml });
    const analysis = analyzeXmlLocally(xml);

    return {
      content: [
        {
          type: "text",
          text: `${result.valid ? "✅" : "❌"} Validation: ${result.message || (result.error ? "Lỗi server: " + result.error : "")}

📋 Issues (${(result.issues || []).length}):
${(result.issues || []).map((i) => `  [${i.severity.toUpperCase()}] ${i.message}`).join("\n") || "  Không có issues"}

📊 Phân tích:
- Start Events: ${analysis.statistics.startEvents} ${analysis.bpmn2Compliance.hasStart ? "✅" : "❌"}
- End Events: ${analysis.statistics.endEvents} ${analysis.bpmn2Compliance.hasEnd ? "✅" : "❌"}
- Lanes/Swimlanes: ${analysis.statistics.lanes} ${analysis.bpmn2Compliance.hasLanes ? "✅" : "⚠️ nên có"}
- Condition Expressions: ${analysis.statistics.conditionalFlows} ${analysis.bpmn2Compliance.hasConditions ? "✅" : "⚠️ cần thêm nếu có gateway"}`,
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 3: analyze_process  
// ═══════════════════════════════════════════════════════════════
server.tool(
  "analyze_process",
  "Phân tích sâu quy trình BPMN: thống kê elements, đo complexity, phát hiện vấn đề, đưa ra insights cho Business Analyst.",
  {
    xml: z.string().describe("BPMN XML string"),
    process_name: z.string().optional().describe("Tên quy trình (tuỳ chọn, dùng cho report)"),
  },
  async ({ xml, process_name }) => {
    const analysis = analyzeXmlLocally(xml);
    const qa = runQaBpmnChecks(xml);

    return {
      content: [
        {
          type: "text",
          text: `📊 Process Analysis Report: ${process_name || "Unnamed Process"}
${"=".repeat(60)}

📈 STATISTICS
  Tasks:              ${analysis.statistics.tasks}
  Gateways:           ${analysis.statistics.gateways}
  Swimlanes (Lanes):  ${analysis.statistics.lanes}
  Start Events:       ${analysis.statistics.startEvents}
  End Events:         ${analysis.statistics.endEvents}
  Sequence Flows:     ${analysis.statistics.sequenceFlows}
  Conditional Flows:  ${analysis.statistics.conditionalFlows}
  Terminate Ends:     ${analysis.statistics.terminateEndEvents}

🎯 COMPLEXITY
  Score: ${analysis.complexity.score} → ${analysis.complexity.label}
  (Based on: 1 base + ${analysis.statistics.gateways} gateways + ${analysis.statistics.conditionalFlows} conditions)

${analysis.issues.length > 0 ? `⚠️  ISSUES (${analysis.issues.length})\n${analysis.issues.map((i) => "  " + i).join("\n")}` : "✅  No issues found"}

🔍 QA SCORE: ${qa.score}/100 (${qa.passed ? "PASSED" : "FAILED"})
${qa.checks.map((c) => `  [${c.severity.toUpperCase()}] ${c.message}`).join("\n") || "  All checks passed"}

📌 BPMN 2.0 COMPLIANCE
  Has Pool/Participant:  ${xml.includes("bpmn:collaboration") ? "✅" : "❌"}
  Has Start Event:       ${analysis.bpmn2Compliance.hasStart ? "✅" : "❌"}
  Has End Event:         ${analysis.bpmn2Compliance.hasEnd ? "✅" : "❌"}
  Has Swimlanes:         ${analysis.bpmn2Compliance.hasLanes ? "✅" : "⚠️"}
  Has Conditions:        ${analysis.bpmn2Compliance.hasConditions ? "✅" : "⚠️"}`,
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 4: layout_diagram
// ═══════════════════════════════════════════════════════════════
server.tool(
  "layout_diagram",
  "Tự động sắp xếp lại layout diagram theo chuẩn Camunda horizontal swimlane. Trả về BPMN XML với DI (diagram layout) mới.",
  { xml: z.string().describe("BPMN XML cần layout lại") },
  async ({ xml }) => {
    const result = await callApi("/api/import", "POST", { xml });
    if (result.error) {
      return { content: [{ type: "text", text: `❌ Layout error: ${result.error}` }] };
    }
    return {
      content: [{ type: "text", text: `✅ Layout applied${result.warning ? " (with warning: " + result.message + ")" : ""}\n\n${result.xml}` }],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 5: suggest_improvements
// ═══════════════════════════════════════════════════════════════
server.tool(
  "suggest_improvements",
  `Phân tích BPMN và đề xuất cải thiện quy trình từ góc nhìn Business Analyst:
- Decomposition (tách sub-process)
- Error handling (boundary events)
- SLA monitoring (timer events)
- Swimlane assignments
- Complexity reduction`,
  {
    xml: z.string().describe("BPMN XML cần phân tích"),
    process_title: z.string().optional().describe("Tên quy trình"),
    focus: z.enum(["all", "efficiency", "error-handling", "documentation", "complexity"]).optional().describe("Tập trung vào khía cạnh nào"),
  },
  async ({ xml, process_title, focus }) => {
    const result = suggestImprovements(xml, process_title);
    const analysis = analyzeXmlLocally(xml);

    const filteredSuggestions =
      focus && focus !== "all"
        ? result.suggestions.filter((s) => s.type.includes(focus) || s.priority === "critical")
        : result.suggestions;

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = filteredSuggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      content: [
        {
          type: "text",
          text: `🔍 Process Improvement Suggestions: ${process_title || "Process"}
${"=".repeat(60)}

Current State:
  Tasks: ${analysis.statistics.tasks} | Gateways: ${analysis.statistics.gateways} | Complexity: ${analysis.complexity.label}

${result.criticalCount > 0 ? `🚨 ${result.criticalCount} CRITICAL issues cần xử lý ngay!\n` : ""}
📋 Suggestions (${sorted.length}):

${sorted
  .map(
    (s, i) => `${i + 1}. [${s.priority.toUpperCase()}] ${s.suggestion}
   Type: ${s.type}`
  )
  .join("\n\n")}

💡 Next Actions:
  1. Mở http://localhost:3721/designer.html
  2. Import diagram và thực hiện các thay đổi ưu tiên cao
  3. Validate lại sau khi sửa bằng tool validate_bpmn`,
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// TOOL 6: qa_bpmn
// ═══════════════════════════════════════════════════════════════
server.tool(
  "qa_bpmn",
  "QA sơ đồ BPMN theo Camunda modeling guidelines và BPMN 2.0 best practice. Trả về score và danh sách vi phạm quy tắc.",
  { xml: z.string().describe("BPMN XML cần QA") },
  async ({ xml }) => {
    const qa = runQaBpmnChecks(xml);
    const severityEmoji = { error: "🔴", warning: "🟡", info: "🔵" };

    return {
      content: [
        {
          type: "text",
          text: `🎯 QA Report — Camunda BPMN 2.0 Best Practice
${"=".repeat(60)}

Score: ${qa.score}/100  ${qa.passed ? "✅ PASSED" : "❌ FAILED"}

Rules Checked (${qa.checks.length}):
${
  qa.checks.length === 0
    ? "  ✅ All rules passed!"
    : qa.checks
        .map(
          (c) => `  ${severityEmoji[c.severity]} [${c.rule}]
     ${c.message}`
        )
        .join("\n\n")
}

📚 Camunda Best Practice Reference:
  • Gateway: Câu hỏi kết thúc "?" — "Đủ điều kiện?"
  • Task name: Động từ + Danh từ — "Kiểm tra tồn kho"
  • Lanes: Phân theo actor, không theo hệ thống
  • End Events: Dùng Terminate End cho main flow
  • Conditions: FEEL expression trên mọi conditional flow`,
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// Start server
// ═══════════════════════════════════════════════════════════════
const transport = new StdioServerTransport();
await server.connect(transport);
// Log to stderr (won't interfere with MCP stdio protocol)
process.stderr.write("✅ BPMN Studio MCP Server started. Waiting for AI client...\n");
