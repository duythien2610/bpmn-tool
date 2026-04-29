/**
 * BPMN Service v5 — Camunda 8 / BPMN 2.0 Compliant
 * Fixes: correct Yes/No gateway branching, Zeebe extensions, proper flow connections
 */
'use strict';

const { layoutProcess } = require('bpmn-auto-layout');

let _n = 0;
const uid = (p='el') => `${p}_${(++_n).toString(36)}${Math.random().toString(36).slice(2,5)}`;
const resetIds = () => { _n = 0; };
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TYPE_MAP = {
  task:'task', usertask:'userTask', servicetask:'serviceTask',
  manualtask:'manualTask', sendtask:'sendTask', receivetask:'receiveTask',
  scripttask:'scriptTask', businessruletask:'businessRuleTask', callactivity:'callActivity',
  user:'userTask', service:'serviceTask', send:'sendTask', manual:'manualTask',
  receive:'receiveTask', script:'scriptTask', rule:'businessRuleTask', call:'callActivity',
  intermediatecatchevent: 'intermediateCatchEvent', intermediatethrowevent: 'intermediateThrowEvent',
  subprocess: 'subProcess'
};
const resolveType = t => TYPE_MAP[(t||'task').toLowerCase().replace(/[-_ ]/g,'')] || 'task';

const SIZE = {
  task:{w:100,h:80}, userTask:{w:100,h:80}, serviceTask:{w:100,h:80},
  sendTask:{w:100,h:80}, receiveTask:{w:100,h:80}, manualTask:{w:100,h:80},
  scriptTask:{w:100,h:80}, businessRuleTask:{w:100,h:80}, callActivity:{w:100,h:80},
  startEvent:{w:36,h:36}, endEvent:{w:36,h:36},
  intermediateCatchEvent:{w:36,h:36}, intermediateThrowEvent:{w:36,h:36},
  exclusiveGateway:{w:50,h:50}, parallelGateway:{w:50,h:50},
  inclusiveGateway:{w:50,h:50}, eventBasedGateway:{w:50,h:50},
  subProcess:{w:120,h:100}
};
const elSize = t => SIZE[t] || {w:100,h:80};

// ── Zeebe extension builder ──────────────────────────────────────────────────
function buildZeebeExtensions(node) {
  const parts = [];
  if (node.type === 'serviceTask' && node.jobType) {
    parts.push(`      <zeebe:taskDefinition type="${esc(node.jobType)}" retries="${node.retries||3}" />`);
  }
  if ((node.type === 'userTask') && (node.assignee || node.candidateGroups || node.formKey || node.dueDate)) {
    if (node.assignee)        parts.push(`      <zeebe:assignment assignee="${esc(node.assignee)}" />`);
    if (node.candidateGroups) parts.push(`      <zeebe:assignment candidateGroups="${esc(node.candidateGroups)}" />`);
    if (node.formKey)         parts.push(`      <zeebe:formDefinition formKey="${esc(node.formKey)}" />`);
  }
  if (!parts.length) return '';
  return `\n    <bpmn:extensionElements>\n${parts.join('\n')}\n    </bpmn:extensionElements>`;
}

// ── Build flow model ─────────────────────────────────────────────────────────
// Gateway rule: each step with a condition spawns an XOR gateway AFTER that task.
// The gateway's YES branch connects forward to the NEXT task in the main sequence.
// The NO branch terminates at a reject EndEvent.
function buildFlow(steps, actors) {
  const nodes = [], flows = [];
  const firstActor = actors[0] || 'System';

  const startId = uid('Start');
  nodes.push({ id: startId, type: 'startEvent', name: 'Bắt đầu', actor: firstActor });

  let prevId = startId;
  let pendingYes = null; // { gwId, yesFlowId } — open Yes-branch waiting for next task

  steps.forEach((step, idx) => {
    const actor   = (step.actor||'').trim() || firstActor;
    const action  = (step.action || `Bước ${idx+1}`).substring(0, 80);
    const cond    = (step.condition||'').trim();
    const type    = resolveType(step.type || 'task');
    const gwType  = step.gatewayType || (cond ? 'exclusiveGateway' : null);
    const taskId  = uid('Task');

    nodes.push({
      id: taskId, type, name: action, actor,
      eventType: step.eventType,
      jobType: step.jobType, retries: step.retries,
      assignee: step.assignee, candidateGroups: step.candidateGroups,
      formKey: step.formKey, dueDate: step.dueDate,
    });

    // Close previous YES branch — connect gateway YES to this task
    if (pendingYes) {
      flows.push({ id: pendingYes.yesFlowId, from: pendingYes.gwId, to: taskId, name: 'Có', condition: 'Có' });
      pendingYes = null;
    } else {
      // Normal flow from previous node
      flows.push({ id: uid('Flow'), from: prevId, to: taskId });
    }

    if (gwType && cond) {
      const gwId  = uid('GW');
      const label = cond.endsWith('?') ? cond : cond + '?';
      nodes.push({ id: gwId, type: gwType, name: label, actor });
      flows.push({ id: uid('Flow'), from: taskId, to: gwId });

      // NO branch → reject end
      const noEndId = uid('End');
      nodes.push({ id: noEndId, type: 'endEvent', name: 'Kết thúc (từ chối)', actor, branchType: 'reject', gatewayRef: gwId });
      flows.push({ id: uid('Flow'), from: gwId, to: noEndId, name: 'Không', condition: 'Không' });

      pendingYes = { gwId, yesFlowId: uid('Flow') };
      prevId = gwId;
    } else {
      prevId = taskId;
    }
  });

  // Main terminate end event
  const lastActor = steps.length > 0 ? ((steps[steps.length-1].actor||'').trim() || firstActor) : firstActor;
  const endId = uid('End');
  nodes.push({ id: endId, type: 'endEvent', name: 'Kết thúc', actor: lastActor });

  if (pendingYes) {
    flows.push({ id: pendingYes.yesFlowId, from: pendingYes.gwId, to: endId, name: 'Có', condition: 'Có' });
  } else {
    flows.push({ id: uid('Flow'), from: prevId, to: endId });
  }

  return { nodes, flows };
}

// ── Semantic XML (no DI) ─────────────────────────────────────────────────────
function buildSemanticXml(title, steps, actors) {
  const processId = uid('Process');
  const { nodes, flows } = buildFlow(steps, actors);

  const laneIds = {};
  actors.forEach(a => { laneIds[a] = uid('Lane'); });

  const laneSetId = uid('LaneSet');
  const laneSetXml = `  <bpmn:laneSet id="${laneSetId}">\n` + actors.map(actor => {
    const refs = nodes.filter(n => n.actor === actor)
      .map(n => `      <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('\n');
    return `    <bpmn:lane id="${laneIds[actor]}" name="${esc(actor)}">\n${refs}\n    </bpmn:lane>`;
  }).join('\n') + `\n  </bpmn:laneSet>`;

  const nodeXml = nodes.map(n => {
    const name = n.name ? ` name="${esc(n.name)}"` : '';
    const ext  = buildZeebeExtensions(n);
    if (n.type === 'startEvent') return `  <bpmn:startEvent id="${n.id}"${name} />`;
    if (n.type === 'endEvent') return `  <bpmn:endEvent id="${n.id}"${name} />`;
    if (n.type === 'exclusiveGateway') return `  <bpmn:exclusiveGateway id="${n.id}"${name} isMarkerVisible="true" />`;
    if (n.type === 'parallelGateway')  return `  <bpmn:parallelGateway id="${n.id}"${name} />`;
    if (n.type === 'inclusiveGateway') return `  <bpmn:inclusiveGateway id="${n.id}"${name} />`;
    if (n.type === 'eventBasedGateway') return `  <bpmn:eventBasedGateway id="${n.id}"${name} />`;
    if (n.type === 'intermediateCatchEvent' || n.type === 'intermediateThrowEvent') {
      const evtDefMap = {
        timer: `<bpmn:timerEventDefinition id="${uid('ED')}" />`,
        message: `<bpmn:messageEventDefinition id="${uid('ED')}" />`,
        error: `<bpmn:errorEventDefinition id="${uid('ED')}" />`,
        signal: `<bpmn:signalEventDefinition id="${uid('ED')}" />`,
        conditional: `<bpmn:conditionalEventDefinition id="${uid('ED')}" />`
      };
      const evtDef = evtDefMap[n.eventType] || '';
      if (evtDef) return `  <bpmn:${n.type} id="${n.id}"${name}>\n    ${evtDef}\n  </bpmn:${n.type}>`;
    }
    if (ext) return `  <bpmn:${n.type} id="${n.id}"${name}>${ext}\n  </bpmn:${n.type}>`;
    return `  <bpmn:${n.type} id="${n.id}"${name} />`;
  }).join('\n');

  const flowXml = flows.map(f => {
    const name = f.name ? ` name="${esc(f.name)}"` : '';
    if (f.condition) {
      return `  <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}">\n    <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>\n  </bpmn:sequenceFlow>`;
    }
    return `  <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}" />`;
  }).join('\n');

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${esc(title)}" isExecutable="false">
${laneSetXml}
${nodeXml}
${flowXml}
  </bpmn:process>
</bpmn:definitions>`,
    nodes, flows, laneIds, processId,
  };
}

// ── Parse bounds from auto-layout XML ───────────────────────────────────────
function parseBoundsFromXml(xml) {
  const bounds = {};
  const re = /bpmnElement="([^"]+)"[^>]*>\s*<dc:Bounds([^/]*?)\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const id = m[1], a = m[2];
    const x = parseFloat(a.match(/x="([^"]+)"/)?.[1]||'0');
    const y = parseFloat(a.match(/y="([^"]+)"/)?.[1]||'0');
    const w = parseFloat(a.match(/width="([^"]+)"/)?.[1]||'100');
    const h = parseFloat(a.match(/height="([^"]+)"/)?.[1]||'80');
    if (!isNaN(x) && !isNaN(y)) bounds[id] = {x,y,w,h};
  }
  return bounds;
}

// ── Build horizontal DI ──────────────────────────────────────────────────────
function buildHorizontalDI(layoutedXml, nodes, flows, laneIds, actors) {
  const autoPos = parseBoundsFromXml(layoutedXml);
  const PART_LABEL_W = 30, LANE_LABEL_W = 30, LANE_H = 140;
  const START_X = 160, START_Y = 60, H_GAP = 120;

  // Sort by auto-layout Y order
  const sorted = nodes.map(n => ({ ...n, autoY: autoPos[n.id]?.y || 0, autoX: autoPos[n.id]?.x || 0 }))
    .sort((a,b) => a.autoY - b.autoY || a.autoX - b.autoX);

  const COL_X0 = START_X + PART_LABEL_W + LANE_LABEL_W + 50;
  let curX = COL_X0;
  const colMap = {};
  sorted.forEach(n => {
    const {w} = elSize(n.type);
    colMap[n.id] = curX + w/2;
    curX += w + H_GAP;
  });

  const totalW  = curX - START_X + 20;
  const laneYMap = {};
  actors.forEach((a,i) => { laneYMap[a] = START_Y + i * LANE_H; });
  const totalH = actors.length * LANE_H;
  const posById = {};

  const participantId = uid('Participant');
  let di = '';

  // Pool
  di += `      <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true">\n        <dc:Bounds x="${START_X - PART_LABEL_W}" y="${START_Y - 10}" width="${totalW + PART_LABEL_W}" height="${totalH + 20}" />\n      </bpmndi:BPMNShape>\n`;

  // Lanes
  Object.entries(laneIds).forEach(([actor, laneId]) => {
    const ly = laneYMap[actor] || START_Y;
    di += `      <bpmndi:BPMNShape id="${laneId}_di" bpmnElement="${laneId}" isHorizontal="true">\n        <dc:Bounds x="${START_X}" y="${ly}" width="${totalW}" height="${LANE_H}" />\n      </bpmndi:BPMNShape>\n`;
  });

  // Elements
  nodes.forEach(n => {
    let cx = colMap[n.id] || (COL_X0 + 50);
    const ly = laneYMap[n.actor || actors[0]] || START_Y;
    const {w,h} = elSize(n.type);
    let x = Math.round(cx - w/2);
    let y = Math.round(ly + LANE_H/2 - h/2);

    if (n.branchType === 'reject' && n.gatewayRef && colMap[n.gatewayRef]) {
      cx = colMap[n.gatewayRef];
      x = Math.round(cx - w / 2);
      y = Math.round(ly + LANE_H - h - 18);
    }

    posById[n.id] = { x, y, w, h, cx: Math.round(x + w / 2), cy: Math.round(y + h / 2) };

    if (n.type === 'exclusiveGateway') {
      di += `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}" isMarkerVisible="true">\n        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />\n        <bpmndi:BPMNLabel />\n      </bpmndi:BPMNShape>\n`;
    } else if (n.type.includes('Event')) {
      di += `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />\n        <bpmndi:BPMNLabel>\n          <dc:Bounds x="${x-10}" y="${y+h+4}" width="${w+20}" height="14" />\n        </bpmndi:BPMNLabel>\n      </bpmndi:BPMNShape>\n`;
    } else {
      di += `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />\n      </bpmndi:BPMNShape>\n`;
    }
  });

  // Edges
  const nodeById = Object.fromEntries(nodes.map(n => [n.id,n]));
  flows.forEach(f => {
    const src = nodeById[f.from], tgt = nodeById[f.to];
    if (!src || !tgt) return;
    const srcPos = posById[f.from];
    const tgtPos = posById[f.to];
    const srcY = srcPos ? srcPos.cy : (laneYMap[src.actor || actors[0]] || START_Y) + LANE_H / 2;
    const tgtY = tgtPos ? tgtPos.cy : (laneYMap[tgt.actor || actors[0]] || START_Y) + LANE_H / 2;
    const srcCX = srcPos ? srcPos.cx : (colMap[f.from] || 0);
    const tgtCX = tgtPos ? tgtPos.cx : (colMap[f.to] || 0);
    const srcR = srcPos ? Math.round(srcPos.x + srcPos.w) : Math.round(srcCX + elSize(src.type).w / 2);
    const tgtL = tgtPos ? Math.round(tgtPos.x) : Math.round(tgtCX - elSize(tgt.type).w / 2);

    let wp;
    if (f.condition === 'Không' && tgt.branchType === 'reject' && srcPos && tgtPos) {
      const srcBottomY = Math.round(srcPos.y + srcPos.h);
      const tgtTopY = Math.round(tgtPos.y);
      const branchX = Math.round(srcPos.cx);
      wp = `        <di:waypoint x="${branchX}" y="${srcBottomY}" />\n        <di:waypoint x="${branchX}" y="${tgtTopY}" />`;
    } else if (Math.abs(srcY - tgtY) < 5) {
      wp = `        <di:waypoint x="${srcR}" y="${Math.round(srcY)}" />\n        <di:waypoint x="${tgtL}" y="${Math.round(srcY)}" />`;
    } else {
      const midX = Math.round((srcR + tgtL) / 2);
      wp = `        <di:waypoint x="${srcR}" y="${Math.round(srcY)}" />\n        <di:waypoint x="${midX}" y="${Math.round(srcY)}" />\n        <di:waypoint x="${midX}" y="${Math.round(tgtY)}" />\n        <di:waypoint x="${tgtL}" y="${Math.round(tgtY)}" />`;
    }

    const lbl = f.name ? `\n        <bpmndi:BPMNLabel><dc:Bounds x="${Math.round((srcR+tgtL)/2-15)}" y="${Math.round((srcY+tgtY)/2-7)}" width="30" height="14" /></bpmndi:BPMNLabel>` : '';
    di += `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n${wp}${lbl}\n      </bpmndi:BPMNEdge>\n`;
  });

  return { di, participantId };
}

// ── Main generate ────────────────────────────────────────────────────────────
async function generateBpmn({ title, steps }) {
  resetIds();
  const actorOrder = [];
  steps.forEach(s => { const a=(s.actor||'').trim()||'Hệ thống'; if(!actorOrder.includes(a)) actorOrder.push(a); });
  const actors = actorOrder.length > 0 ? actorOrder : ['System'];

  const { xml: semXml, nodes, flows, laneIds, processId } = buildSemanticXml(title, steps, actors);

  let layoutedXml = semXml;
  try { layoutedXml = await layoutProcess(semXml); } catch(e) { /* fallback */ }

  const { di, participantId } = buildHorizontalDI(layoutedXml, nodes, flows, laneIds, actors);

  const collabId  = uid('Collab');
  const laneSetId = uid('LaneSet');

  const collabXml = `  <bpmn:collaboration id="${collabId}">\n    <bpmn:participant id="${participantId}" name="${esc(title)}" processRef="${processId}" />\n  </bpmn:collaboration>`;

  const laneSetXml = `  <bpmn:laneSet id="${laneSetId}">\n` + actors.map(actor => {
    const laneId = laneIds[actor] || uid('Lane');
    laneIds[actor] = laneId;
    const refs = nodes.filter(n => n.actor === actor)
      .map(n => `      <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('\n');
    return `    <bpmn:lane id="${laneId}" name="${esc(actor)}">\n${refs}\n    </bpmn:lane>`;
  }).join('\n') + `\n  </bpmn:laneSet>`;

  const tasksXml = nodes.map(n => {
    const name = n.name ? ` name="${esc(n.name)}"` : '';
    const ext  = buildZeebeExtensions(n);
    if (n.type === 'startEvent') return `  <bpmn:startEvent id="${n.id}"${name} />`;
    if (n.type === 'endEvent') return `  <bpmn:endEvent id="${n.id}"${name} />`;
    if (n.type === 'exclusiveGateway') return `  <bpmn:exclusiveGateway id="${n.id}"${name} isMarkerVisible="true" />`;
    if (n.type === 'parallelGateway')  return `  <bpmn:parallelGateway id="${n.id}"${name} />`;
    if (n.type === 'inclusiveGateway') return `  <bpmn:inclusiveGateway id="${n.id}"${name} />`;
    if (n.type === 'eventBasedGateway') return `  <bpmn:eventBasedGateway id="${n.id}"${name} />`;
    if (n.type === 'intermediateCatchEvent' || n.type === 'intermediateThrowEvent') {
      const evtDefMap = {
        timer: `<bpmn:timerEventDefinition id="${uid('ED')}" />`,
        message: `<bpmn:messageEventDefinition id="${uid('ED')}" />`,
        error: `<bpmn:errorEventDefinition id="${uid('ED')}" />`,
        signal: `<bpmn:signalEventDefinition id="${uid('ED')}" />`,
        conditional: `<bpmn:conditionalEventDefinition id="${uid('ED')}" />`
      };
      const evtDef = evtDefMap[n.eventType] || '';
      if (evtDef) return `  <bpmn:${n.type} id="${n.id}"${name}>\n    ${evtDef}\n  </bpmn:${n.type}>`;
    }
    if (ext) return `  <bpmn:${n.type} id="${n.id}"${name}>${ext}\n  </bpmn:${n.type}>`;
    return `  <bpmn:${n.type} id="${n.id}"${name} />`;
  }).join('\n');

  const flowsXml = flows.map(f => {
    const name = f.name ? ` name="${esc(f.name)}"` : '';
    if (f.condition) {
      return `  <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}">\n    <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>\n  </bpmn:sequenceFlow>`;
    }
    return `  <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}" />`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
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
  exporterVersion="5.0"
  modeler:executionPlatform="Camunda Cloud"
  modeler:executionPlatformVersion="8.6.0">

${collabXml}

  <bpmn:process id="${processId}" name="${esc(title)}" isExecutable="false">
${laneSetXml}
${tasksXml}
${flowsXml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collabId}">
${di}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>

</bpmn:definitions>`;
}

// ── Layout & Validate ────────────────────────────────────────────────────────
async function importAndLayoutBpmn(xml) {
  try { return { xml: await layoutProcess(xml), message: 'Layout applied' }; }
  catch(err) { return { xml, message: 'Layout skipped: ' + err.message, warning: true }; }
}

async function validateBpmn(xml) {
  const issues = [];
  if (!xml.includes('<bpmn:process') && !xml.includes('<process'))
    issues.push({ severity:'error', message:'Missing <bpmn:process> element' });
  if (!xml.includes('startEvent'))
    issues.push({ severity:'error', message:'No Start Event — every process requires exactly one None Start Event' });
  if (!xml.includes('endEvent'))
    issues.push({ severity:'warning', message:'No End Event — every process path must terminate at an End Event' });
  if (!xml.includes('bpmn:collaboration'))
    issues.push({ severity:'warning', message:'No Pool/Participant — consider wrapping in a Collaboration for swimlane processes' });
  const gwCount = (xml.match(/exclusiveGateway/g)||[]).length;
  const condCount = (xml.match(/conditionExpression/g)||[]).length;
  if (gwCount > 0 && condCount === 0)
    issues.push({ severity:'warning', message:'Exclusive Gateway present but no conditionExpression on outgoing flows' });
  const tasks = (xml.match(/<bpmn:(?:userTask|serviceTask)\b/gi)||[]).length;
  if (tasks > 0 && !xml.includes('zeebe:'))
    issues.push({ severity:'info', message:'No Zeebe extensions — add zeebe:taskDefinition / zeebe:assignment for Camunda 8 execution' });
  return { valid: !issues.some(i=>i.severity==='error'), issues, message: issues.length===0?'Valid BPMN 2.0':'Has issues' };
}

module.exports = { generateBpmn, importAndLayoutBpmn, validateBpmn };
