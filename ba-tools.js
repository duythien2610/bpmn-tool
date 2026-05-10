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
    const hasExclusiveInSteps = safeSteps.some(step => step.gatewayType === 'exclusiveGateway');
    const hasParallelInSteps = safeSteps.some(step => step.gatewayType === 'parallelGateway');
    const hasRejectPath = /Kết thúc \(từ chối\)|End \(Rejected\)|conditionExpression/gi.test(safeXml);
    const hasEndState = /<bpmn:endEvent\b/gi.test(safeXml);
    const ambiguousActions = safeSteps.filter(step => detectMultipleActions(step.sourceText || step.action));
    const actorAligned = safeSteps.filter(step => step.actor && step.sourceText).length === safeSteps.length;

    const checks = [
      {
        key: 'actors',
        label: 'Đúng actor / lane',
        status: actors.length > 1 && actorAligned ? 'pass' : actors.length > 0 ? 'warn' : 'fail',
        detail: actors.length > 1
          ? `Đã nhận diện ${actors.length} lane chính: ${actors.join(', ')}.`
          : 'Mới có 1 lane hoặc còn step thiếu actor rõ ràng.'
      },
      {
        key: 'gateways',
        label: 'Đúng loại gateway',
        status: hasExclusiveInSteps || hasParallelInSteps ? 'pass' : 'warn',
        detail: hasExclusiveInSteps || hasParallelInSteps
          ? `Đã phát hiện ${hasExclusiveInSteps ? 'XOR' : ''}${hasExclusiveInSteps && hasParallelInSteps ? ' và ' : ''}${hasParallelInSteps ? 'AND' : ''} trong flow.`
          : 'Chưa có gateway hoặc chưa đủ dữ liệu để xác nhận rẽ nhánh.'
      },
      {
        key: 'coverage',
        label: 'Không mất bước nghiệp vụ',
        status: safeSteps.length > 0 ? 'pass' : 'warn',
        detail: `${safeSteps.length} step đang được giữ trong bảng review trước khi generate.`
      },
      {
        key: 'ambiguity',
        label: 'Không nhập nhằng condition / action',
        status: ambiguousActions.length === 0 ? 'pass' : 'warn',
        detail: ambiguousActions.length === 0
          ? 'Mỗi step hiện có xu hướng giữ 1 hành động chính.'
          : `${ambiguousActions.length} step cần tách bớt nhiều hành động trong cùng một câu.`
      },
      {
        key: 'exceptions',
        label: 'Có reject path / exception path',
        status: hasRejectPath ? 'pass' : 'warn',
        detail: hasRejectPath
          ? 'Đã có reject / exception flow thể hiện trong BPMN.'
          : 'Chưa thấy reject path rõ ràng. Nên bổ sung nhánh từ chối hoặc ngoại lệ.'
      },
      {
        key: 'end-state',
        label: 'Có end state rõ ràng',
        status: hasEndState ? 'pass' : 'fail',
        detail: hasEndState ? 'XML đã có end event rõ ràng.' : 'Chưa có end event trong XML.'
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

  window.BATools = {
    escHtml,
    normalizeLines,
    enrichStepsWithTraceability,
    buildParseWarnings,
    buildBaChecklist,
    buildBusinessArtifacts,
    buildBaDocumentMarkdown,
    compareProcessSnapshots,
    attachNodeIdsFromXml
  };
})();
