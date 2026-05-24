'use strict';

const { layoutProcess } = require('bpmn-auto-layout');

let _n = 0;
const uid = (prefix = 'el') => `${prefix}_${(++_n).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const resetIds = () => { _n = 0; };
const esc = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const TYPE_MAP = {
  task: 'task',
  usertask: 'userTask',
  servicetask: 'serviceTask',
  manualtask: 'manualTask',
  sendtask: 'sendTask',
  receivetask: 'receiveTask',
  scripttask: 'scriptTask',
  businessruletask: 'businessRuleTask',
  callactivity: 'callActivity',
  subprocess: 'subProcess',
  intermediatecatchevent: 'intermediateCatchEvent',
  intermediatethrowevent: 'intermediateThrowEvent',
  user: 'userTask',
  service: 'serviceTask',
  send: 'sendTask',
  manual: 'manualTask',
  receive: 'receiveTask',
  script: 'scriptTask',
  rule: 'businessRuleTask',
  call: 'callActivity'
};

const SIZE = {
  task: { w: 100, h: 80 },
  userTask: { w: 100, h: 80 },
  serviceTask: { w: 100, h: 80 },
  sendTask: { w: 100, h: 80 },
  receiveTask: { w: 100, h: 80 },
  manualTask: { w: 100, h: 80 },
  scriptTask: { w: 100, h: 80 },
  businessRuleTask: { w: 100, h: 80 },
  callActivity: { w: 100, h: 80 },
  subProcess: { w: 140, h: 100 },
  startEvent: { w: 36, h: 36 },
  endEvent: { w: 36, h: 36 },
  intermediateCatchEvent: { w: 36, h: 36 },
  intermediateThrowEvent: { w: 36, h: 36 },
  exclusiveGateway: { w: 50, h: 50 },
  parallelGateway: { w: 50, h: 50 },
  inclusiveGateway: { w: 50, h: 50 },
  eventBasedGateway: { w: 50, h: 50 }
};

const POOL_X = 100;
const POOL_LABEL_W = 30;
const LANE_LABEL_W = 30;
const LANE_H = 170;
const LANE_H_SOLO = 130;
const TOP_Y = 60;
const GAP_X = 70;
const REJECT_OFFSET_Y = 100;

const resolveType = type => TYPE_MAP[String(type || 'task').toLowerCase().replace(/[-_ ]/g, '')] || 'task';
const normalizeGatewayType = type => {
  const raw = String(type || '').toLowerCase().replace(/[-_ ]/g, '');
  if (raw === 'parallelgateway') return 'parallelGateway';
  if (raw === 'inclusivegateway') return 'inclusiveGateway';
  if (raw === 'exclusivegateway') return 'exclusiveGateway';
  if (raw === 'eventbasedgateway') return 'eventBasedGateway';
  return '';
};
const elSize = type => SIZE[type] || SIZE.task;

function buildZeebeExtensions(node) {
  const parts = [];
  if (node.type === 'serviceTask' && node.jobType) {
    parts.push(`      <zeebe:taskDefinition type="${esc(node.jobType)}" retries="${node.retries || 3}" />`);
  }
  if (node.type === 'userTask' && (node.assignee || node.candidateGroups || node.formKey || node.dueDate)) {
    if (node.assignee) parts.push(`      <zeebe:assignment assignee="${esc(node.assignee)}" />`);
    if (node.candidateGroups) parts.push(`      <zeebe:assignment candidateGroups="${esc(node.candidateGroups)}" />`);
    if (node.formKey) parts.push(`      <zeebe:formDefinition formKey="${esc(node.formKey)}" />`);
  }
  if (!parts.length) return '';
  return `\n    <bpmn:extensionElements>\n${parts.join('\n')}\n    </bpmn:extensionElements>`;
}

function xorLabel(leftCond, rightCond) {
  const negativeRe = /\b(kh[oô]ng|ch[uư]a|not|invalid|chưa)\b/gi;
  const a = String(leftCond || '').replace(negativeRe, '').replace(/\s+/g, ' ').trim();
  const b = String(rightCond || '').replace(negativeRe, '').replace(/\s+/g, ' ').trim();
  const aWords = a.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const shared = aWords.filter(word => b.toLowerCase().includes(word));
  return (shared.length ? shared.join(' ') : a) || 'Decision';
}

function buildFlow(steps, actors) {
  const nodes = [];
  const flows = [];
  const firstActor = actors[0] || 'Hệ thống';
  const state = { openExclusive: null };

  const startId = uid('Start');
  nodes.push({ id: startId, type: 'startEvent', name: 'Bắt đầu', actor: firstActor });
  let prevId = startId;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] || {};
    const actor = (step.actor || '').trim() || firstActor;
    const action = String(step.action || `Bước ${i + 1}`).substring(0, 120);
    const condition = String(step.condition || '').trim();
    const gatewayType = normalizeGatewayType(step.gatewayType) || (condition ? 'exclusiveGateway' : '');
    const type = resolveType(step.type);
    const taskId = uid('Task');

    if (gatewayType === 'parallelGateway' || gatewayType === 'inclusiveGateway') {
      const branches = [{
        actor,
        action,
        type,
        eventType: step.eventType,
        jobType: step.jobType,
        retries: step.retries,
        assignee: step.assignee,
        candidateGroups: step.candidateGroups,
        formKey: step.formKey,
        dueDate: step.dueDate
      }];
      let nextIndex = i + 1;

      while (nextIndex < steps.length) {
        const nextStep = steps[nextIndex] || {};
        const nextGateway = normalizeGatewayType(nextStep.gatewayType);
        if (nextGateway !== gatewayType || !nextStep.action) break;
        branches.push({
          actor: (nextStep.actor || '').trim() || firstActor,
          action: String(nextStep.action).substring(0, 120),
          type: resolveType(nextStep.type),
          eventType: nextStep.eventType,
          jobType: nextStep.jobType,
          retries: nextStep.retries,
          assignee: nextStep.assignee,
          candidateGroups: nextStep.candidateGroups,
          formKey: nextStep.formKey,
          dueDate: nextStep.dueDate
        });
        nextIndex++;
      }

      i = nextIndex - 1;
      const splitId = uid('GW');
      const joinId = uid('GW');
      nodes.push({ id: splitId, type: gatewayType, name: '', actor });
      flows.push({ id: uid('Flow'), from: prevId, to: splitId });

      branches.forEach(branch => {
        const branchId = uid('Task');
        nodes.push({
          id: branchId,
          type: branch.type,
          name: branch.action,
          actor: branch.actor,
          isBranch: true,
          gwRef: splitId,
          eventType: branch.eventType,
          jobType: branch.jobType,
          retries: branch.retries,
          assignee: branch.assignee,
          candidateGroups: branch.candidateGroups,
          formKey: branch.formKey,
          dueDate: branch.dueDate
        });
        flows.push({ id: uid('Flow'), from: splitId, to: branchId });
        flows.push({ id: uid('Flow'), from: branchId, to: joinId });
      });

      nodes.push({ id: joinId, type: gatewayType, name: '', actor, isJoin: true });
      prevId = joinId;
      continue;
    }

    if (gatewayType === 'exclusiveGateway' && condition) {
      const nextStep = steps[i + 1] || null;
      const nextCondition = nextStep ? String(nextStep.condition || '').trim() : '';
      const nextGateway = nextStep ? normalizeGatewayType(nextStep.gatewayType) : '';
      const nextIsBinaryPair = nextStep && nextCondition
        && (!nextGateway || nextGateway === 'exclusiveGateway');

      if (nextIsBinaryPair) {
        const gatewayId = uid('GW');
        const gatewayName = `${xorLabel(condition, nextCondition)}?`;
        const continueActor = (nextStep.actor || '').trim() || firstActor;
        const continueId = uid('Task');
        const defaultFlowId = uid('Flow');

        nodes.push({ id: gatewayId, type: 'exclusiveGateway', name: gatewayName, actor, defaultFlowId });
        flows.push({ id: uid('Flow'), from: prevId, to: gatewayId });

        nodes.push({
          id: taskId,
          type,
          name: action,
          actor,
          isReject: true,
          gatewayRef: gatewayId,
          eventType: step.eventType,
          jobType: step.jobType,
          retries: step.retries,
          assignee: step.assignee,
          candidateGroups: step.candidateGroups,
          formKey: step.formKey,
          dueDate: step.dueDate
        });
        flows.push({ id: uid('Flow'), from: gatewayId, to: taskId, name: condition, condition });

        const rejectEndId = uid('End');
        nodes.push({
          id: rejectEndId,
          type: 'endEvent',
          name: 'Kết thúc (từ chối)',
          actor,
          isReject: true,
          gatewayRef: gatewayId
        });
        flows.push({ id: uid('Flow'), from: taskId, to: rejectEndId });

        nodes.push({
          id: continueId,
          type: resolveType(nextStep.type),
          name: String(nextStep.action || `Bước ${i + 2}`).substring(0, 120),
          actor: continueActor,
          eventType: nextStep.eventType,
          jobType: nextStep.jobType,
          retries: nextStep.retries,
          assignee: nextStep.assignee,
          candidateGroups: nextStep.candidateGroups,
          formKey: nextStep.formKey,
          dueDate: nextStep.dueDate
        });
        flows.push({ id: defaultFlowId, from: gatewayId, to: continueId, name: nextCondition, condition: nextCondition, isDefault: true });

        prevId = continueId;
        i++;
        continue;
      }

      nodes.push({
        id: taskId,
        type,
        name: action,
        actor,
        eventType: step.eventType,
        jobType: step.jobType,
        retries: step.retries,
        assignee: step.assignee,
        candidateGroups: step.candidateGroups,
        formKey: step.formKey,
        dueDate: step.dueDate
      });
      flows.push({ id: uid('Flow'), from: prevId, to: taskId });

      const gatewayId = uid('GW');
      const yesFlowId = uid('Flow');
      nodes.push({ id: gatewayId, type: 'exclusiveGateway', name: condition.endsWith('?') ? condition : `${condition}?`, actor, defaultFlowId: yesFlowId });
      flows.push({ id: uid('Flow'), from: taskId, to: gatewayId });

      const rejectEndId = uid('End');
      nodes.push({
        id: rejectEndId,
        type: 'endEvent',
        name: 'Kết thúc (từ chối)',
        actor,
        isReject: true,
        gatewayRef: gatewayId
      });
      flows.push({ id: uid('Flow'), from: gatewayId, to: rejectEndId, name: 'Không', condition: 'Không' });

      state.openExclusive = { gatewayId, yesFlowId };
      prevId = gatewayId;
      continue;
    }

    nodes.push({
      id: taskId,
      type,
      name: action,
      actor,
      eventType: step.eventType,
      jobType: step.jobType,
      retries: step.retries,
      assignee: step.assignee,
      candidateGroups: step.candidateGroups,
      formKey: step.formKey,
      dueDate: step.dueDate
    });

    if (state.openExclusive) {
      flows.push({ id: state.openExclusive.yesFlowId, from: state.openExclusive.gatewayId, to: taskId, name: 'Có', condition: 'Có', isDefault: true });
      state.openExclusive = null;
    } else {
      flows.push({ id: uid('Flow'), from: prevId, to: taskId });
    }

    prevId = taskId;
  }

  const finalActor = steps.length ? ((steps[steps.length - 1].actor || '').trim() || firstActor) : firstActor;
  const endId = uid('End');
  nodes.push({ id: endId, type: 'endEvent', name: 'Kết thúc', actor: finalActor });

  if (state.openExclusive) {
    flows.push({ id: state.openExclusive.yesFlowId, from: state.openExclusive.gatewayId, to: endId, name: 'Có', condition: 'Có', isDefault: true });
  } else {
    flows.push({ id: uid('Flow'), from: prevId, to: endId });
  }

  return { nodes, flows };
}

function assignPositions(nodes, flows, actors, isSoloLane) {
  const baseLaneHeight = isSoloLane ? LANE_H_SOLO : LANE_H;
  const startX = POOL_X + POOL_LABEL_W + (isSoloLane ? 0 : LANE_LABEL_W) + GAP_X;
  let currentX = startX;
  let branchMaxX = 0;
  const positions = {};
  const flowSourceByTarget = {};
  const rejectPerLane = {};
  const laneHeights = {};
  const laneTop = {};

  flows.forEach(flow => {
    flowSourceByTarget[flow.to] = flow.from;
  });

  actors.forEach(actor => {
    rejectPerLane[actor] = 0;
  });

  nodes.forEach(node => {
    if (node.isReject && node.actor && rejectPerLane[node.actor] !== undefined) {
      rejectPerLane[node.actor]++;
    }
  });

  // Calculate branch groups and determine vertical index offsets
  const branchGroups = {};
  nodes.forEach(node => {
    if (node && node.isBranch && node.gwRef) {
      const key = `${node.gwRef}_${node.actor}`;
      if (!branchGroups[key]) branchGroups[key] = [];
      branchGroups[key].push(node);
    }
  });

  Object.values(branchGroups).forEach(group => {
    group.forEach((node, idx) => {
      node.branchIdxInLane = idx;
      node.totalBranchesInLane = group.length;
    });
  });

  const maxBranchesPerLane = {};
  actors.forEach(actor => { maxBranchesPerLane[actor] = 1; });
  Object.entries(branchGroups).forEach(([key, group]) => {
    const actor = key.substring(key.indexOf('_') + 1);
    if (maxBranchesPerLane[actor] !== undefined) {
      maxBranchesPerLane[actor] = Math.max(maxBranchesPerLane[actor], group.length);
    }
  });

  actors.forEach(actor => {
    let height = rejectPerLane[actor] > 0 ? baseLaneHeight + REJECT_OFFSET_Y : baseLaneHeight;
    const extraBranches = maxBranchesPerLane[actor] || 1;
    if (extraBranches > 1) {
      height += (extraBranches - 1) * 90; // scale lane height
    }
    laneHeights[actor] = height;
  });

  let accumulatedY = TOP_Y;
  actors.forEach(actor => {
    laneTop[actor] = accumulatedY;
    accumulatedY += laneHeights[actor];
  });

  nodes.forEach(node => {
    const actor = node.actor || actors[0];
    const laneStart = laneTop[actor] ?? TOP_Y;
    const { w, h } = elSize(node.type);

    // Maintain a stable main-line center logic excluding branch expansion
    const baseLH = rejectPerLane[actor] > 0 ? baseLaneHeight + REJECT_OFFSET_Y : baseLaneHeight;
    const centerY = rejectPerLane[actor] > 0
      ? laneStart + Math.round(baseLaneHeight / 2)
      : laneStart + Math.round(baseLH / 2);

    const rejectRowY = laneStart + baseLaneHeight + 10;

    if (node.isReject && node.type !== 'endEvent') {
      const gatewayPos = node.gatewayRef ? positions[node.gatewayRef] : null;
      const x = gatewayPos ? Math.round(gatewayPos.cx - w / 2) : currentX;
      positions[node.id] = { x, y: rejectRowY, w, h, cx: x + Math.round(w / 2), cy: rejectRowY + Math.round(h / 2) };
      return;
    }

    if (node.isReject && node.type === 'endEvent') {
      const srcId = flowSourceByTarget[node.id];
      const srcPos = srcId ? positions[srcId] : null;
      if (srcPos) {
        const x = srcPos.x + srcPos.w + 30;
        const y = Math.round(srcPos.cy - h / 2);
        positions[node.id] = { x, y, w, h, cx: x + Math.round(w / 2), cy: srcPos.cy };
      } else {
        positions[node.id] = { x: currentX, y: rejectRowY, w, h, cx: currentX + Math.round(w / 2), cy: rejectRowY + Math.round(h / 2) };
      }
      return;
    }

    if (node.isBranch) {
      const x = currentX;
      let targetCenterY = centerY;
      if (node.totalBranchesInLane > 1) {
        const spacing = 90;
        const offset = (node.branchIdxInLane - (node.totalBranchesInLane - 1) / 2) * spacing;
        targetCenterY = centerY + offset;
      }
      const y = Math.round(targetCenterY - h / 2);
      positions[node.id] = { x, y, w, h, cx: x + Math.round(w / 2), cy: targetCenterY };
      branchMaxX = Math.max(branchMaxX, x + w);
      return;
    }

    if (node.isJoin) {
      const x = Math.max(currentX, branchMaxX + GAP_X);
      const y = Math.round(centerY - h / 2);
      positions[node.id] = { x, y, w, h, cx: x + Math.round(w / 2), cy: centerY };
      currentX = x + w + GAP_X;
      branchMaxX = 0;
      return;
    }

    const x = currentX;
    const y = Math.round(centerY - h / 2);
    positions[node.id] = { x, y, w, h, cx: x + Math.round(w / 2), cy: centerY };
    currentX += w + GAP_X;
  });

  const bounds = Object.values(positions);
  const maxRight = bounds.length ? Math.max(...bounds.map(pos => pos.x + pos.w)) : startX + 200;
  return {
    positions,
    laneTop,
    laneHeights,
    totalWidth: maxRight - POOL_X + 90,
    totalHeight: accumulatedY - TOP_Y
  };
}

function edgeWaypoints(sourcePos, targetPos, sourceNode, targetNode) {
  const srcGW = sourceNode && sourceNode.type && sourceNode.type.includes('Gateway');
  if (!sourcePos || !targetPos) return [[0, 0], [100, 0]];
  const sy = sourcePos.cy, ty = targetPos.cy, diff = ty - sy;

  // Gateway → reject node ABOVE: exit TOP → straight UP → enter BOTTOM of target
  if (targetNode && targetNode.isReject && srcGW) {
    return [[sourcePos.cx, sourcePos.y], [targetPos.cx, targetPos.y + targetPos.h]];
  }
  // Reject task → reject end (above row): exit RIGHT → horizontal → enter LEFT
  if (targetNode && targetNode.isReject && !srcGW) {
    return [[sourcePos.x + sourcePos.w, sourcePos.cy], [targetPos.x, targetPos.cy]];
  }

  // Same lane (horizontal, diff ≤ 8px tolerance): exit RIGHT → enter LEFT
  if (Math.abs(diff) <= 8) return [[sourcePos.x + sourcePos.w, sy], [targetPos.x, ty]];

  // Gateway → different lane: use CORRIDOR just to the right of the gateway
  // so the vertical segment never overlaps other horizontal nodes
  if (srcGW) {
    // Corridor X = gateway right-edge + 45px padding (clears reject tasks), capped at target x - 20
    const corridorX = Math.min(sourcePos.x + sourcePos.w + 45, targetPos.x - 20);
    if (diff > 0) {
      // Going down: exit bottom-center → short right → down → into target left
      return [[sourcePos.cx, sourcePos.y + sourcePos.h], [sourcePos.cx, sourcePos.y + sourcePos.h + 18], [corridorX, sourcePos.y + sourcePos.h + 18], [corridorX, ty], [targetPos.x, ty]];
    } else {
      // Going up: exit top-center → short right → up → into target left
      return [[sourcePos.cx, sourcePos.y], [sourcePos.cx, sourcePos.y - 18], [corridorX, sourcePos.y - 18], [corridorX, ty], [targetPos.x, ty]];
    }
  }

  // General cross-lane (task → task): exit RIGHT → corridor just before target → vertical → enter LEFT
  // Corridor placed 45px before the target (clears reject tasks) to avoid cutting through elements
  const corridorX = targetPos.x - 45;
  return [[sourcePos.x + sourcePos.w, sy], [corridorX, sy], [corridorX, ty], [targetPos.x, ty]];
}

function buildBpmnDi(nodes, flows, actors) {
  const isSoloLane = actors.length === 1;
  const { positions, laneTop, laneHeights, totalWidth, totalHeight } = assignPositions(nodes, flows, actors, isSoloLane);
  const nodeById = Object.fromEntries(nodes.map(node => [node.id, node]));
  const participantId = uid('Participant');
  let shapes = '';
  let edges = '';

  shapes += `      <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true">\n        <dc:Bounds x="${POOL_X}" y="${TOP_Y}" width="${totalWidth}" height="${totalHeight}" />\n        <bpmndi:BPMNLabel />\n      </bpmndi:BPMNShape>\n`;

  if (!isSoloLane) {
    actors.forEach(actor => {
      const laneId = nodeById[`lane:${actor}`]?.id;
      const y = laneTop[actor];
      const height = laneHeights[actor];
      if (!laneId) return;
      shapes += `      <bpmndi:BPMNShape id="${laneId}_di" bpmnElement="${laneId}" isHorizontal="true">\n        <dc:Bounds x="${POOL_X + POOL_LABEL_W}" y="${y}" width="${totalWidth - POOL_LABEL_W}" height="${height}" />\n        <bpmndi:BPMNLabel />\n      </bpmndi:BPMNShape>\n`;
    });
  }

  nodes.forEach(node => {
    if (!positions[node.id]) return;
    const pos = positions[node.id];
    const gatewayAttr = node.type === 'exclusiveGateway' ? ' isMarkerVisible="true"' : '';
    let label = '';
    if (node.name) {
      const labelWidth = Math.min(Math.max(node.name.length * 7, 54), 170);
      const labelHeight = node.type.includes('Gateway') ? 28 : 18;
      const labelX = node.type.includes('Event') ? pos.x - 10 : node.type.includes('Gateway') ? pos.x - 12 : pos.x;
      const labelY = pos.y + pos.h + 6;
      label = `\n        <bpmndi:BPMNLabel>\n          <dc:Bounds x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" />\n        </bpmndi:BPMNLabel>`;
    }
    shapes += `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}"${gatewayAttr}>\n        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" />${label}\n      </bpmndi:BPMNShape>\n`;
  });

  flows.forEach(flow => {
    const sourceNode = nodeById[flow.from];
    const targetNode = nodeById[flow.to];
    const sourcePos = positions[flow.from];
    const targetPos = positions[flow.to];
    if (!sourceNode || !targetNode || !sourcePos || !targetPos) return;
    const points = edgeWaypoints(sourcePos, targetPos, sourceNode, targetNode);
    const waypointXml = points.map(([x, y]) => `        <di:waypoint x="${x}" y="${y}" />`).join('\n');

    let label = '';
    if (flow.name) {
      // Capped label width: max 135px to trigger beautiful auto-wrapping and save space
      const labelWidth = Math.min(Math.max(flow.name.length * 8, 48), 135);
      // Height: up to 3 lines (42px) for long wrapped Vietnamese labels
      const labelHeight = flow.name.length > 20 ? 42 : flow.name.length > 10 ? 28 : 14;
      const isVertical = points.length >= 2 && Math.abs(points[0][0] - points[1][0]) <= 4;
      let labelX, labelY;
      if (isVertical) {
        // Vertical flow (reject path): label to the RIGHT of the line — avoids overlap with nodes above
        labelX = points[0][0] + 6;
        // Shift vertical flow label up/down by 25px along the vertical line to prevent horizontal flow label overlap
        const shift = (points[1][1] < points[0][1]) ? -25 : 25;
        labelY = Math.round((points[0][1] + points[1][1]) / 2) - Math.round(labelHeight / 2) + shift;
      } else {
        // Horizontal/angled: label ABOVE the midpoint of first segment
        labelX = Math.round((points[0][0] + points[1][0]) / 2) - Math.round(labelWidth / 2);
        labelY = Math.min(points[0][1], points[1][1]) - labelHeight - 5;
      }
      label = `\n        <bpmndi:BPMNLabel>\n          <dc:Bounds x="${labelX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" />\n        </bpmndi:BPMNLabel>`;
    }

    edges += `      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">\n${waypointXml}${label}\n      </bpmndi:BPMNEdge>\n`;
  });

  return { participantId, shapes, edges };
}

function buildLaneXml(nodes, actors, laneIds) {
  return `  <bpmn:laneSet id="${uid('LaneSet')}">\n${actors.map(actor => {
    const refs = nodes
      .filter(node => node.actor === actor)
      .map(node => `      <bpmn:flowNodeRef>${node.id}</bpmn:flowNodeRef>`)
      .join('\n');
    return `    <bpmn:lane id="${laneIds[actor]}" name="${esc(actor)}">\n${refs}\n    </bpmn:lane>`;
  }).join('\n')}\n  </bpmn:laneSet>`;
}

function buildNodeXml(node) {
  const name = node.name ? ` name="${esc(node.name)}"` : '';
  const ext = buildZeebeExtensions(node);
  if (node.type === 'startEvent') return `  <bpmn:startEvent id="${node.id}"${name} />`;
  if (node.type === 'endEvent') return `  <bpmn:endEvent id="${node.id}"${name} />`;
  if (node.type === 'exclusiveGateway') {
    const defaultAttr = node.defaultFlowId ? ` default="${node.defaultFlowId}"` : '';
    return `  <bpmn:exclusiveGateway id="${node.id}"${name} isMarkerVisible="true"${defaultAttr} />`;
  }
  if (node.type === 'parallelGateway') return `  <bpmn:parallelGateway id="${node.id}"${name} />`;
  if (node.type === 'inclusiveGateway') return `  <bpmn:inclusiveGateway id="${node.id}"${name} />`;
  if (node.type === 'eventBasedGateway') return `  <bpmn:eventBasedGateway id="${node.id}"${name} />`;
  if (node.type === 'intermediateCatchEvent' || node.type === 'intermediateThrowEvent') {
    const definitions = {
      timer: `<bpmn:timerEventDefinition id="${uid('ED')}" />`,
      message: `<bpmn:messageEventDefinition id="${uid('ED')}" />`,
      error: `<bpmn:errorEventDefinition id="${uid('ED')}" />`,
      signal: `<bpmn:signalEventDefinition id="${uid('ED')}" />`,
      conditional: `<bpmn:conditionalEventDefinition id="${uid('ED')}" />`
    };
    const eventDefinition = definitions[node.eventType] || '';
    if (eventDefinition) {
      return `  <bpmn:${node.type} id="${node.id}"${name}>\n    ${eventDefinition}\n  </bpmn:${node.type}>`;
    }
  }
  if (ext) return `  <bpmn:${node.type} id="${node.id}"${name}>${ext}\n  </bpmn:${node.type}>`;
  return `  <bpmn:${node.type} id="${node.id}"${name} />`;
}

function buildFlowXml(flow, nodeById) {
  const name = flow.name ? ` name="${esc(flow.name)}"` : '';
  const sourceNode = nodeById[flow.from];
  const needsCondition = flow.condition && sourceNode?.type === 'exclusiveGateway' && !flow.isDefault;
  if (needsCondition) {
    return `  <bpmn:sequenceFlow id="${flow.id}"${name} sourceRef="${flow.from}" targetRef="${flow.to}">\n    <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(flow.condition)}</bpmn:conditionExpression>\n  </bpmn:sequenceFlow>`;
  }
  return `  <bpmn:sequenceFlow id="${flow.id}"${name} sourceRef="${flow.from}" targetRef="${flow.to}" />`;
}

async function generateBpmnArtifacts({ title, steps }) {
  resetIds();
  const safeSteps = Array.isArray(steps) ? steps : [];
  const normalizedSteps = safeSteps.length ? safeSteps : [
    { actor: 'Người dùng', action: title || 'Khởi tạo quy trình', type: 'userTask' },
    { actor: 'Hệ thống', action: 'Xử lý yêu cầu', type: 'serviceTask' }
  ];

  const actors = [];
  normalizedSteps.forEach(step => {
    const actor = (step.actor || '').trim() || 'Hệ thống';
    if (!actors.includes(actor)) actors.push(actor);
  });

  const laneIds = {};
  actors.forEach(actor => {
    laneIds[actor] = uid('Lane');
  });

  const { nodes, flows } = buildFlow(normalizedSteps, actors);
  const nodeById = Object.fromEntries(nodes.map(node => [node.id, node]));
  actors.forEach(actor => {
    nodeById[`lane:${actor}`] = { id: laneIds[actor] };
  });

  const { participantId, shapes, edges } = buildBpmnDi(nodes, flows, actors);
  const processId = uid('Process');
  const collaborationId = uid('Collab');
  const laneXml = buildLaneXml(nodes, actors, laneIds);
  const nodeXml = nodes.map(buildNodeXml).join('\n');
  const flowXml = flows.map(flow => buildFlowXml(flow, nodeById)).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  xmlns:modeler="http://camunda.org/schema/modeler/1.0"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="BPMN Studio"
  exporterVersion="6.0"
  modeler:executionPlatform="Camunda Cloud"
  modeler:executionPlatformVersion="8.6.0">

  <bpmn:collaboration id="${collaborationId}">
    <bpmn:participant id="${participantId}" name="${esc(title || 'Process')}" processRef="${processId}" />
  </bpmn:collaboration>

  <bpmn:process id="${processId}" name="${esc(title || 'Process')}" isExecutable="false">
${laneXml}
${nodeXml}
${flowXml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collaborationId}">
${shapes}${edges}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  const usedNodeIds = new Set();
  const traceability = normalizedSteps.map(step => {
    const found = nodes.find(node =>
      !usedNodeIds.has(node.id)
      && !node.type.includes('Gateway')
      && node.type !== 'startEvent'
      && node.type !== 'endEvent'
      && node.name === step.action
    );
    if (found) usedNodeIds.add(found.id);
    return {
      action: step.action,
      actor: step.actor,
      nodeId: found?.id || ''
    };
  });

  return { xml, traceability };
}

async function generateBpmn({ title, steps }) {
  const result = await generateBpmnArtifacts({ title, steps });
  return result.xml;
}

async function importAndLayoutBpmn(xml) {
  try {
    return { xml: await layoutProcess(xml), message: 'Layout applied' };
  } catch (error) {
    return { xml, message: `Layout skipped: ${error.message}`, warning: true };
  }
}

async function validateBpmn(xml) {
  const issues = [];
  const count = tag => (xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b`, 'gi')) || []).length;
  const exclusiveGatewayCount = count('exclusiveGateway');
  const conditionalFlowCount = count('conditionExpression');
  const defaultFlowCount = (xml.match(/\bdefault="/gi) || []).length;

  if (!xml.includes('<bpmn:process') && !xml.includes('<process')) {
    issues.push({ severity: 'error', message: 'Missing <bpmn:process> element' });
  }
  if (count('startEvent') === 0) {
    issues.push({ severity: 'error', message: 'No Start Event — every process requires exactly one None Start Event' });
  }
  if (count('endEvent') === 0) {
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
  if ((count('userTask') + count('serviceTask')) > 0 && !xml.includes('zeebe:')) {
    issues.push({ severity: 'info', message: 'No Zeebe extensions — add zeebe:taskDefinition / zeebe:assignment for Camunda 8 execution' });
  }

  return {
    valid: !issues.some(issue => issue.severity === 'error'),
    issues,
    message: issues.length === 0 ? 'Valid BPMN 2.0' : 'Has issues'
  };
}

module.exports = { generateBpmn, generateBpmnArtifacts, importAndLayoutBpmn, validateBpmn };
