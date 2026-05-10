(function () {
  function escHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeLines(description) {
    return String(description || '')
      .split(/\n+/)
      .map((line, index) => ({
        lineNumber: index + 1,
        raw: line,
        text: line.trim()
          .replace(/^\d+[\.\)]\s*/, '')
          .replace(/^[-–—•*]\s*/, '')
          .trim()
      }))
      .filter(line => line.text.length > 0);
  }

  function detectMultipleActions(text) {
    return /(?:\s+rồi\s+|\s+sau đó\s+|\s+tiếp theo\s+|\s+and then\s+|\s+và\s+.*\s+và\s+)/i.test(text || '');
  }

  function hasExplicitActor(text) {
    return /^([^,:\uFF1A\n]{2,40})[:\uFF1A]/.test(String(text || '').trim());
  }

  function findSourceForStep(step, lines, usedLineNumbers) {
    const action = String(step?.action || '').toLowerCase();
    const condition = String(step?.condition || '').toLowerCase();

    let candidate = lines.find(line =>
      !usedLineNumbers.has(line.lineNumber)
      && action
      && line.text.toLowerCase().includes(action.slice(0, Math.min(action.length, 24)))
    );

    if (!candidate && condition) {
      candidate = lines.find(line =>
        !usedLineNumbers.has(line.lineNumber)
        && line.text.toLowerCase().includes(condition.slice(0, Math.min(condition.length, 24)))
      );
    }

    if (!candidate) {
      candidate = lines.find(line => !usedLineNumbers.has(line.lineNumber)) || null;
    }

    if (candidate) usedLineNumbers.add(candidate.lineNumber);
    return candidate;
  }

  function enrichStepsWithTraceability(description, steps) {
    const lines = normalizeLines(description);
    const usedLineNumbers = new Set();
    return (Array.isArray(steps) ? steps : []).map((step, index) => {
      const source = findSourceForStep(step, lines, usedLineNumbers);
      return {
        ...step,
        step: index + 1,
        sourceLine: source?.lineNumber || '',
        sourceText: source?.text || step?.sourceText || '',
        note: step?.note || '',
        businessRuleRef: step?.businessRuleRef || '',
        requirementRef: step?.requirementRef || '',
        nodeId: step?.nodeId || '',
      };
    });
  }

  function buildParseWarnings(description, steps) {
    const lines = normalizeLines(description);
    const warnings = [];
    const sourceMapped = enrichStepsWithTraceability(description, steps);

    lines.forEach(line => {
      if (detectMultipleActions(line.text)) {
        warnings.push({
          severity: 'warning',
          type: 'multiple-actions',
          message: `Line ${line.lineNumber} có thể chứa nhiều hơn 1 hành động chính.`,
          lineNumber: line.lineNumber
        });
      }
      if (!hasExplicitActor(line.text) && !/^(nếu|if|when|khi|đồng thời|simultaneously|parallel)\b/i.test(line.text)) {
        warnings.push({
          severity: 'info',
          type: 'missing-actor',
          message: `Line ${line.lineNumber} chưa có actor rõ dạng "Actor: Action".`,
          lineNumber: line.lineNumber
        });
      }
    });

    sourceMapped.forEach((step, index) => {
      if (!step.actor || /(người dùng|staff|user)$/i.test(step.actor) && !hasExplicitActor(step.sourceText)) {
        warnings.push({
          severity: 'warning',
          type: 'actor-ambiguity',
          message: `Step ${index + 1} có actor suy luận tương đối mơ hồ: "${step.actor}".`,
          step: index + 1
        });
      }
    });

    sourceMapped.forEach((step, index) => {
      if (step.gatewayType === 'exclusiveGateway' && step.condition) {
        const next = sourceMapped[index + 1];
        const hasPair = next && next.gatewayType === 'exclusiveGateway' && next.condition;
        if (!hasPair) {
          warnings.push({
            severity: 'warning',
            type: 'unpaired-condition',
            message: `Step ${index + 1} có điều kiện nhưng chưa thấy nhánh đối ứng ngay sau đó.`,
            step: index + 1
          });
        }
      }
    });

    sourceMapped.forEach((step, index) => {
      if (step.gatewayType === 'parallelGateway') {
        const next = sourceMapped[index + 1];
        const previous = sourceMapped[index - 1];
        const parallelNeighbors = [previous, next].filter(item => item?.gatewayType === 'parallelGateway').length;
        if (parallelNeighbors === 0) {
          warnings.push({
            severity: 'warning',
            type: 'single-and-branch',
            message: `Step ${index + 1} đang dùng AND gateway nhưng mới có 1 branch.`,
            step: index + 1
          });
        }
      }
    });

    return warnings;
  }

  function countUniqueActors(steps) {
    return [...new Set((steps || []).map(step => String(step.actor || '').trim()).filter(Boolean))];
  }

  function buildBaChecklist(steps, xml) {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const safeXml = String(xml || '');
    const actors = countUniqueActors(safeSteps);


    /* ── Cheat Sheet Checks ─────────────────────────────── */

    // [Rule 9.1] Verb + Object naming — task names should start with a verb
    const verbPrefixRe = /^(kiểm|xác|phê|gửi|tạo|nhận|cập|duyệt|xử|đặt|lấy|giao|soạn|tính|thanh|lập|xuất|nhập|đóng|mở|submit|send|validate|review|approve|create|check|update|generate|process|receive|notify|collect|confirm|reject|verify|prepare|complete|cancel|assign|log|call|fetch|calculate|register|schedule|upload|download|trigger|deploy|notify|start|stop|mark|close|report)/i;
    const badNamedTasks = safeSteps.filter(s => s.action && s.type !== 'startEvent' && s.type !== 'endEvent' && !verbPrefixRe.test(s.action.trim()));

    // [Rule 7] Max 30 tasks
    const taskCount = safeSteps.filter(s => !['startEvent','endEvent'].includes(s.type)).length;

    // [Rule 3.1] XOR should always have a paired condition (cover all cases)
    const xorSteps = safeSteps.filter(s => s.gatewayType === 'exclusiveGateway' && s.condition);
    let unpairedXor = 0;
    xorSteps.forEach((s, i) => {
      const idx = safeSteps.indexOf(s);
      const next = safeSteps[idx + 1];
      if (!next || next.gatewayType !== 'exclusiveGateway') unpairedXor++;
    });

    // [Rule 4.2] AND (parallel) must have at least 2 branches
    const andSteps = safeSteps.filter(s => s.gatewayType === 'parallelGateway');
    const andGroups = []; let andBuf = [];
    safeSteps.forEach(s => {
      if (s.gatewayType === 'parallelGateway') { andBuf.push(s); }
      else if (andBuf.length) { andGroups.push(andBuf); andBuf = []; }
    });
    if (andBuf.length) andGroups.push(andBuf);
    const singleBranchAnd = andGroups.filter(g => g.length < 2).length;

    // [Rule 10] Timer / SLA flow
    const hasTimerInXml = /timerEventDefinition|timeDuration|timeCycle|timeDate/i.test(safeXml);
    const hasTimerKeyword = safeSteps.some(s => /chờ\s+\d+|wait\s+\d+|sau\s+\d+\s*(giờ|phút|ngày|hour|minute|day)|timer|sla|timeout/i.test(s.action + ' ' + s.condition));

    // [Rule 11 / 16] Exception / reject path
    const hasRejectPath = /conditionExpression|Rejected|từ chối|reject|error|lỗi/gi.test(safeXml);
    const hasEndState = /bpmn:endEvent\b/gi.test(safeXml);

    // [Rule 9.4] Happy path — at least 1 non-conditional step exists
    const hasHappyPath = safeSteps.some(s => !s.condition && s.action);

    // [Rule 6] Actor coverage
    const hasExclusiveInSteps = safeSteps.some(step => step.gatewayType === 'exclusiveGateway');
    const hasParallelInSteps = safeSteps.some(step => step.gatewayType === 'parallelGateway');
    const ambiguousActions = safeSteps.filter(step => detectMultipleActions(step.sourceText || step.action));
    const actorAligned = safeSteps.filter(step => step.actor && step.sourceText).length === safeSteps.length;

    const checks = [
      {
        key: 'start-end',
        label: '✅ Có Start & End Event',
        status: hasEndState ? 'pass' : 'fail',
        detail: hasEndState ? 'XML có đầy đủ start/end event.' : '⚠️ Thiếu End Event — có thể gây token leak trong Camunda.'
      },
      {
        key: 'actors',
        label: '👥 Actor / Lane rõ ràng',
        status: actors.length > 1 && actorAligned ? 'pass' : actors.length > 0 ? 'warn' : 'fail',
        detail: actors.length > 1
          ? `${actors.length} lane: ${actors.join(', ')}.`
          : 'Mới có 1 lane hoặc còn step thiếu actor.'
      },
      {
        key: 'task-naming',
        label: '🏷️ Task name = Động từ + Tân ngữ',
        status: badNamedTasks.length === 0 ? 'pass' : 'warn',
        detail: badNamedTasks.length === 0
          ? 'Tất cả task đều bắt đầu bằng động từ hành động.'
          : `${badNamedTasks.length} task chưa đúng chuẩn Verb+Object: "${badNamedTasks.slice(0,2).map(s=>s.action).join('", "')}"`
      },
      {
        key: 'gateways',
        label: '🔀 Gateway đúng loại & đối xứng',
        status: (unpairedXor === 0 && singleBranchAnd === 0) ? 'pass' : 'warn',
        detail: (() => {
          const msgs = [];
          if (unpairedXor > 0) msgs.push(`${unpairedXor} XOR chưa có nhánh đối ứng (Nếu A → cần có Nếu B).`);
          if (singleBranchAnd > 0) msgs.push(`${singleBranchAnd} AND gateway chỉ có 1 branch (cần ≥2 để song song).`);
          return msgs.length ? msgs.join(' ') : `Đã phát hiện ${hasExclusiveInSteps?'XOR':''}${hasExclusiveInSteps&&hasParallelInSteps?' và ':''}${hasParallelInSteps?'AND':''} đúng chuẩn.`;
        })()
      },
      {
        key: 'happy-path',
        label: '😊 Có happy path rõ ràng',
        status: hasHappyPath ? 'pass' : 'warn',
        detail: hasHappyPath ? 'Flow có ít nhất 1 nhánh không điều kiện (happy path).' : 'Chưa rõ happy path — tất cả bước đều là điều kiện?'
      },
      {
        key: 'exceptions',
        label: '⚠️ Có reject / exception path',
        status: hasRejectPath ? 'pass' : 'warn',
        detail: hasRejectPath
          ? 'Đã có reject / exception flow trong BPMN.'
          : 'Chưa có nhánh từ chối hoặc ngoại lệ rõ ràng.'
      },
      {
        key: 'timer-sla',
        label: '⏱ Có Timer / SLA nếu cần',
        status: (hasTimerInXml || hasTimerKeyword) ? 'pass' : 'info',
        detail: (hasTimerInXml || hasTimerKeyword)
          ? 'Đã có timer hoặc SLA được mô tả.'
          : 'Chưa thấy timer/SLA. Nếu quy trình có thời hạn, hãy thêm "Chờ X phút" hoặc "Nếu sau X giờ".'
      },
      {
        key: 'task-count',
        label: '📏 Số task trong giới hạn (≤30)',
        status: taskCount <= 30 ? 'pass' : 'warn',
        detail: taskCount <= 30
          ? `${taskCount} task — trong giới hạn 7±2 (visible) và tối đa 30.`
          : `${taskCount} task — vượt ngưỡng 30. Hãy tách subprocess.`
      },
      {
        key: 'ambiguity',
        label: '1️⃣ Mỗi step = 1 hành động duy nhất',
        status: ambiguousActions.length === 0 ? 'pass' : 'warn',
        detail: ambiguousActions.length === 0
          ? 'Mỗi step có xu hướng 1 hành động chính.'
          : `${ambiguousActions.length} step có thể chứa nhiều hành động — hãy tách ra.`
      }
    ];

    return checks;
  }


  function buildBusinessArtifacts(title, description, steps, checklist) {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const actors = countUniqueActors(safeSteps);
    const businessRules = safeSteps
      .filter(step => step.condition || step.businessRuleRef)
      .map((step, index) => `BR-${index + 1}: ${step.businessRuleRef || step.condition}`);
    const exceptionFlows = safeSteps
      .filter(step => step.condition)
      .map(step => `Nếu ${step.condition}: ${step.actor} - ${step.action}`);
    const openQuestions = buildParseWarnings(description, safeSteps)
      .filter(item => item.severity !== 'info')
      .map(item => item.message);

    const summary = safeSteps.length
      ? `${safeSteps[0].actor} khởi tạo quy trình, sau đó flow đi qua ${actors.length} vai trò và ${safeSteps.length} bước chính.`
      : 'Chưa có đủ step để tóm tắt.';

    const io = {
      inputs: normalizeLines(description).slice(0, 3).map(line => line.text),
      outputs: [
        'BPMN XML',
        'Diagram preview',
        'Traceability table',
      ]
    };

    return {
      summary,
      actors,
      raciLite: actors.map(actor => ({ actor, responsibility: safeSteps.filter(step => step.actor === actor).map(step => step.action).slice(0, 3) })),
      businessRules,
      assumptions: [
        'Mỗi dòng mô tả tương ứng tối đa 1 hành động chính.',
        'Actor được chuẩn hóa thành role ngắn gọn để map vào swimlane.',
        'Người dùng sẽ review lại step table trước khi generate BPMN.'
      ],
      exceptionFlows,
      inputs: io.inputs,
      outputs: io.outputs,
      openQuestions,
      checklist
    };
  }

  function buildBaDocumentMarkdown(payload) {
    const title = payload?.title || 'Untitled Process';
    const desc = payload?.description || '';
    const steps = payload?.steps || [];
    const checklist = payload?.checklist || [];
    const artifacts = buildBusinessArtifacts(title, desc, steps, checklist);

    const checklistLines = checklist.map(item => `- [${item.status === 'pass' ? 'x' : ' '}] ${item.label}: ${item.detail}`).join('\n');
    const stepLines = steps.map(step =>
      `| ${step.step} | ${step.actor || '—'} | ${step.action || '—'} | ${step.condition || '—'} | ${step.nodeId || '—'} | ${step.sourceLine || '—'} | ${step.businessRuleRef || '—'} | ${step.requirementRef || '—'} |`
    ).join('\n');
    const raciLines = artifacts.raciLite.map(item => `- ${item.actor}: ${item.responsibility.join('; ') || 'No action captured'}`).join('\n');
    const exceptionLines = artifacts.exceptionFlows.length ? artifacts.exceptionFlows.map(item => `- ${item}`).join('\n') : '- None captured yet';
    const ruleLines = artifacts.businessRules.length ? artifacts.businessRules.map(item => `- ${item}`).join('\n') : '- None captured yet';
    const questionLines = artifacts.openQuestions.length ? artifacts.openQuestions.map(item => `- ${item}`).join('\n') : '- No open questions detected';

    return `# ${title}

## Why This Process Exists
BA teams usually start from text, then spend time redrawing swimlanes, gateways, and exception paths. This tool shortens that handoff while keeping human review before BPMN is finalized.

## Process Summary
${artifacts.summary}

## Source Description
${desc || 'No source description saved.'}

## Actor List / RACI Lite
${raciLines}

## BPMN Quality Checklist
${checklistLines || '- No checklist generated'}

## Traceability
| Step | Actor | Action | Condition | BPMN Node ID | Source Line | BR Ref | Requirement Ref |
| --- | --- | --- | --- | --- | --- | --- | --- |
${stepLines || '| — | — | — | — | — | — | — | — |'}

## Business Rules
${ruleLines}

## Assumptions
- ${artifacts.assumptions.join('\n- ')}

## Exception Flows
${exceptionLines}

## Input / Output
### Inputs
- ${artifacts.inputs.join('\n- ')}

### Outputs
- ${artifacts.outputs.join('\n- ')}

## Open Questions
${questionLines}
`;
  }

  function compareProcessSnapshots(baseItem, targetItem) {
    const baseSteps = Array.isArray(baseItem?.steps) ? baseItem.steps : [];
    const targetSteps = Array.isArray(targetItem?.steps) ? targetItem.steps : [];
    const maxLength = Math.max(baseSteps.length, targetSteps.length);
    const changes = [];

    for (let index = 0; index < maxLength; index++) {
      const before = baseSteps[index];
      const after = targetSteps[index];
      if (!before && after) {
        changes.push(`Thêm step ${index + 1}: ${after.actor} - ${after.action}`);
        continue;
      }
      if (before && !after) {
        changes.push(`Xóa step ${index + 1}: ${before.actor} - ${before.action}`);
        continue;
      }
      if (!before || !after) continue;

      if (before.actor !== after.actor) changes.push(`Step ${index + 1} đổi lane: "${before.actor}" → "${after.actor}"`);
      if (before.action !== after.action) changes.push(`Step ${index + 1} đổi action: "${before.action}" → "${after.action}"`);
      if ((before.condition || '') !== (after.condition || '')) changes.push(`Step ${index + 1} đổi condition: "${before.condition || '—'}" → "${after.condition || '—'}"`);
      if ((before.gatewayType || '') !== (after.gatewayType || '')) changes.push(`Step ${index + 1} đổi gateway: "${before.gatewayType || '—'}" → "${after.gatewayType || '—'}"`);
      if ((before.businessRuleRef || '') !== (after.businessRuleRef || '')) changes.push(`Step ${index + 1} đổi BR ref: "${before.businessRuleRef || '—'}" → "${after.businessRuleRef || '—'}"`);
    }

    const baseActors = countUniqueActors(baseSteps);
    const targetActors = countUniqueActors(targetSteps);
    const addedActors = targetActors.filter(actor => !baseActors.includes(actor));
    const removedActors = baseActors.filter(actor => !targetActors.includes(actor));

    return {
      summary: {
        baseTitle: baseItem?.title || 'Current workspace',
        targetTitle: targetItem?.title || 'Compared process',
        baseStatus: baseItem?.status || 'draft',
        targetStatus: targetItem?.status || 'draft',
        stepDelta: targetSteps.length - baseSteps.length
      },
      actorChanges: {
        added: addedActors,
        removed: removedActors
      },
      changes,
      changelog: changes.length ? changes : ['Không phát hiện khác biệt chính ở step table.']
    };
  }

  function attachNodeIdsFromXml(steps, xml) {
    const safeSteps = Array.isArray(steps) ? steps.map(step => ({ ...step })) : [];
    const candidates = [];
    const elementRe = /<bpmn:(task|userTask|serviceTask|sendTask|receiveTask|manualTask|scriptTask|businessRuleTask|callActivity|subProcess)\b[^>]*id="([^"]+)"[^>]*name="([^"]*)"/gi;
    let match;
    while ((match = elementRe.exec(String(xml || ''))) !== null) {
      candidates.push({ id: match[2], name: match[3] });
    }

    const used = new Set();
    safeSteps.forEach(step => {
      const found = candidates.find(candidate => !used.has(candidate.id) && candidate.name === step.action);
      if (found) {
        step.nodeId = found.id;
        used.add(found.id);
      }
    });
    return safeSteps;
  }

  /* ─── AUTO-FIX ENGINE ────────────────────────────────────────────────── */

  /**
   * applyQuickFixes(steps)
   * Returns { steps: [...], fixes: [{key, description}] }
   * Applies all safe, non-destructive fixes automatically.
   */
  function applyQuickFixes(steps) {
    const safeSteps = Array.isArray(steps) ? steps.map(s => ({...s})) : [];
    const fixes = [];

    const verbPrefixRe = /^(kiểm|xác|phê|gửi|tạo|nhận|cập|duyệt|xử|đặt|lấy|giao|soạn|tính|thanh|lập|xuất|nhập|đóng|mở|submit|send|validate|review|approve|create|check|update|generate|process|receive|notify|collect|confirm|reject|verify|prepare|complete|cancel|assign|log|call|fetch|calculate|register|schedule|upload|download|trigger|deploy|start|stop|mark|close|report)/i;

    // Verb prefix map by task type
    const typeToVerb = {
      userTask: 'Xác nhận', serviceTask: 'Xử lý', sendTask: 'Gửi',
      receiveTask: 'Nhận', manualTask: 'Thực hiện', scriptTask: 'Chạy',
      businessRuleTask: 'Áp dụng quy tắc', callActivity: 'Gọi quy trình',
      task: 'Thực hiện',
    };

    safeSteps.forEach((s, i) => {
      if (!s.action) return;
      const isEvent = /Event/i.test(s.type);
      const isGW    = /Gateway/i.test(s.type) || s.gatewayType;
      if (isEvent || isGW) return;

      // Fix 1: Verb+Object naming
      if (!verbPrefixRe.test(s.action.trim())) {
        const verb = typeToVerb[s.type] || 'Thực hiện';
        const oldAction = s.action;
        s.action = `${verb} ${s.action.charAt(0).toLowerCase()}${s.action.slice(1)}`;
        fixes.push({ key: 'task-naming', description: `"${oldAction}" → "${s.action}"` });
      }

      // Fix 2: Trim actor names > 40 chars
      if (s.actor && s.actor.length > 40) {
        const old = s.actor;
        s.actor = s.actor.substring(0, 40).trim();
        fixes.push({ key: 'actors', description: `Actor rút gọn: "${old}" → "${s.actor}"` });
      }

      // Fix 3: Upgrade Hệ thống actor + generic task → serviceTask
      if (/h[eệ]\s*th[oố]ng|system/i.test(s.actor) && s.type === 'task') {
        s.type = 'serviceTask';
        fixes.push({ key: 'actors', description: `Step ${s.step}: type task → serviceTask (actor là Hệ thống)` });
      }
    });

    return { steps: safeSteps, fixes };
  }

  /**
   * getSuggestions(steps, checks)
   * Returns array of { key, icon, title, suggestions: [string] }
   * Provides specific actionable text suggestions for each failing check.
   */
  function getSuggestions(steps, checks) {
    const safeSteps = Array.isArray(steps) ? steps : [];
    const results = [];

    checks.forEach(check => {
      if (check.status === 'pass') return; // skip passing checks

      const sugg = { key: check.key, icon: '', title: check.label, suggestions: [] };

      switch(check.key) {
        case 'task-naming': {
          const verbPrefixRe = /^(kiểm|xác|phê|gửi|tạo|nhận|cập|duyệt|xử|đặt|lấy|giao|soạn|tính|thanh|lập|xuất|nhập|đóng|mở|submit|send|validate|review|approve|create|check|update|generate|process|receive|notify)/i;
          const bad = safeSteps.filter(s => s.action && !verbPrefixRe.test(s.action.trim()) && !/Event|Gateway/i.test(s.type) && !s.gatewayType);
          bad.slice(0, 4).forEach(s => {
            sugg.suggestions.push(`Step ${s.step}: Đổi "${s.action}" → "Kiểm tra ${s.action.toLowerCase()}" (thêm động từ đứng đầu)`);
          });
          sugg.icon = '🏷️';
          break;
        }
        case 'gateways': {
          const xorSteps = safeSteps.filter(s => s.gatewayType === 'exclusiveGateway' && s.condition);
          xorSteps.forEach((s, i) => {
            const idx = safeSteps.indexOf(s);
            const next = safeSteps[idx + 1];
            if (!next || next.gatewayType !== 'exclusiveGateway') {
              sugg.suggestions.push(`Sau step ${s.step} (Nếu ${s.condition}), hãy thêm dòng: "Nếu không ${s.condition}: [Actor]: [Hành động]"`); 
            }
          });
          const andGroups = [];
          let buf = [];
          safeSteps.forEach(s => {
            if (s.gatewayType === 'parallelGateway') buf.push(s);
            else if (buf.length) { andGroups.push(buf); buf = []; }
          });
          if (buf.length) andGroups.push(buf);
          andGroups.filter(g => g.length < 2).forEach(g => {
            sugg.suggestions.push(`AND gateway chỉ có 1 task (step ${g[0].step}). Hãy thêm 1 dòng "Đồng thời: [Actor]: [Hành động]" liên tiếp.`);
          });
          sugg.icon = '🔀';
          break;
        }
        case 'exceptions': {
          sugg.icon = '⚠️';
          sugg.suggestions.push('Thêm ít nhất 1 nhánh ngoại lệ, ví dụ:');
          sugg.suggestions.push('  → "Nếu từ chối: [Actor]: [Hành động xử lý]"');
          sugg.suggestions.push('  → "Nếu lỗi [chi tiết]: Hệ thống: Ghi log và thông báo admin"');
          break;
        }
        case 'happy-path': {
          sugg.icon = '😊';
          sugg.suggestions.push('Đảm bảo có ít nhất 1 bước KHÔNG điều kiện (không bắt đầu bằng "Nếu").');
          sugg.suggestions.push('Ví dụ: Thêm "1. Khách hàng: Gửi yêu cầu" ở đầu quy trình.');
          break;
        }
        case 'actors': {
          sugg.icon = '👥';
          sugg.suggestions.push('Đảm bảo mỗi step có Actor rõ ràng, ví dụ: Khách hàng, Hệ thống, Quản lý.');
          sugg.suggestions.push('Format: "[Số]. [Actor]: [Hành động]" — Actor ngắn gọn, tối đa 4 từ.');
          break;
        }
        case 'timer-sla': {
          sugg.icon = '⏱';
          sugg.suggestions.push('Nếu quy trình có SLA, thêm timer event:');
          sugg.suggestions.push('  → Timer catch: "Chờ 30 phút:" hoặc "Chờ 2 giờ:"');
          sugg.suggestions.push('  → Timeout escalation: "Nếu sau 4 giờ chưa phê duyệt: Supervisor: Nâng cấp ticket"');
          break;
        }
        case 'task-count': {
          sugg.icon = '📏';
          const taskCount = safeSteps.filter(s => !['startEvent','endEvent'].includes(s.type)).length;
          sugg.suggestions.push(`Hiện có ${taskCount} task (giới hạn 30). Hãy tách thành các subprocess con.`);
          sugg.suggestions.push('Nhóm các bước liên quan vào 1 "Call Activity" (gọi sub-process).');
          break;
        }
        case 'ambiguity': {
          sugg.icon = '1️⃣';
          const bad = safeSteps.filter(s => /\s+(và|và|and|,|;)\s+/i.test(s.action));
          bad.slice(0, 3).forEach(s => {
            sugg.suggestions.push(`Step ${s.step}: "${s.action}" — hãy tách thành 2 step riêng.`);
          });
          if (!bad.length) sugg.suggestions.push('Kiểm tra các step có vẻ mô tả nhiều hành động và tách chúng ra.');
          break;
        }
        default: {
          sugg.icon = '💡';
          sugg.suggestions.push(check.detail);
        }
      }

      if (sugg.suggestions.length) results.push(sugg);
    });

    return results;
  }

  window.BATools = {
    escHtml,
    normalizeLines,
    enrichStepsWithTraceability,
    buildParseWarnings,
    buildBaChecklist,
    buildBusinessArtifacts,
    buildBaDocumentMarkdown,
    compareProcessSnapshots,
    attachNodeIdsFromXml,
    applyQuickFixes,
    getSuggestions,
  };
})();
