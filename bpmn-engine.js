/**
 * BPMN Engine — Offline BPMN 2.0 XML Generator
 * Camunda-compliant: Collaboration/Pool, Swimlanes, correct Gateway flow,
 * standard element sizes (Task 100×80, Event 36×36, Gateway 50×50)
 * Version: 5.0
 */

const BpmnEngine = (() => {
  /* ── ID GENERATOR ──────────────────────────────────────────── */
  let _n = 0;
  const uid  = (p = 'id') => `${p}_${(++_n).toString(36)}${Math.random().toString(36).slice(2,5)}`;
  const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const resetIds = () => { _n = 0; };

  /* ── ELEMENT SIZES (BPMN 2.0 / Camunda standard) ─────────── */
  const SIZE = {
    task:             { w:100, h:80 },
    userTask:         { w:100, h:80 },
    serviceTask:      { w:100, h:80 },
    sendTask:         { w:100, h:80 },
    receiveTask:      { w:100, h:80 },
    manualTask:       { w:100, h:80 },
    scriptTask:       { w:100, h:80 },
    businessRuleTask: { w:100, h:80 },
    callActivity:     { w:100, h:80 },
    startEvent:       { w:36,  h:36  },
    endEvent:         { w:36,  h:36  },
    exclusiveGateway: { w:50,  h:50  },
    parallelGateway:  { w:50,  h:50  },
    inclusiveGateway: { w:50,  h:50  },
  };
  const sz = t => SIZE[t] || { w:100, h:80 };

  /* ── LAYOUT CONSTANTS ─────────────────────────────────────── */
  const POOL_X        = 160;   // Pool left edge x
  const POOL_LABEL_W  = 30;    // Pool label strip
  const LANE_LABEL_W  = 30;    // Lane label strip
  const LANE_H        = 140;   // Per-lane height
  const CONTENT_X0    = POOL_X + POOL_LABEL_W + LANE_LABEL_W + 50; // First element X
  const H_GAP         = 120;   // Gap between elements
  const POOL_TOP_Y    = 60;    // Pool top y

  /* ── TASK TYPE RESOLVER ───────────────────────────────────── */
  const TYPE_MAP = {
    task:'task', usertask:'userTask', servicetask:'serviceTask',
    manualtask:'manualTask', sendtask:'sendTask', receivetask:'receiveTask',
    scripttask:'scriptTask', businessruletask:'businessRuleTask',
    callactivity:'callActivity',
    user:'userTask', service:'serviceTask', send:'sendTask',
    manual:'manualTask', receive:'receiveTask', script:'scriptTask',
    rule:'businessRuleTask', call:'callActivity',
    intermediatecatchevent: 'intermediateCatchEvent', intermediatethrowevent: 'intermediateThrowEvent',
    subprocess: 'subProcess'
  };
  const resolveType = t => TYPE_MAP[(t||'task').toLowerCase().replace(/[-_ ]/g,'')] || 'task';

  /* ── BUILD FLOW MODEL ─────────────────────────────────────── */
  /**
   * Converts steps[] → { nodes[], flows[] }
   * Gateway rule: XOR gateway is inserted BEFORE the step that has a condition.
   * Branch "Yes" → the step itself; Branch "No" → a separate EndEvent (Reject).
   */
  function buildFlow(steps, actors) {
    const nodes = [], flows = [];
    const firstActor = actors[0] || 'System';

    // Start event
    const startId = uid('Start');
    nodes.push({ id: startId, type: 'startEvent', name: 'Bắt đầu', actor: firstActor });

    let prevId  = startId;
    let openGw  = null; // { gwId, yesFlowId } — waiting for next task to close Yes branch

    steps.forEach((step, idx) => {
      const actor   = (step.actor||'').trim() || firstActor;
      const action  = (step.action || `Bước ${idx+1}`).substring(0, 80);
      const cond    = (step.condition||'').trim();
      const gwType  = step.gatewayType || (cond ? 'exclusiveGateway' : null);
      const type    = resolveType(step.type || 'task');
      const taskId  = uid('Task');

      // If previous step had an open XOR gateway, connect its Yes-branch to this task
      if (openGw) {
        flows.push({ id: openGw.yesFlowId, from: openGw.gwId, to: taskId, name: 'Có', condition: 'Có' });
        openGw = null;
      }

      nodes.push({ id: taskId, type, name: action, actor });

      // Flow from previous node to this task
      flows.push({ id: uid('Flow'), from: prevId, to: taskId });

      if (gwType && cond) {
        // Insert XOR gateway AFTER this task → branch for next steps
        const gwId       = uid('GW');
        const gwQuestion = cond.endsWith('?') ? cond : cond + '?';
        nodes.push({ id: gwId, type: gwType, name: gwQuestion, actor });

        // Task → Gateway
        flows.push({ id: uid('Flow'), from: taskId, to: gwId });

        // "No" branch → reject end event
        const noEndId = uid('End');
        nodes.push({ id: noEndId, type: 'endEvent', name: 'Kết thúc (từ chối)', actor });
        flows.push({ id: uid('Flow'), from: gwId, to: noEndId, name: 'Không', condition: 'Không' });

        // "Yes" branch → will be connected when next step is processed
        const yesFlowId = uid('Flow');
        openGw  = { gwId, yesFlowId };
        prevId  = gwId; // next task will connect from gateway via openGw
      } else {
        prevId = taskId;
      }
    });

    // Close any still-open gateway Yes branch with the main End event
    const lastActor = steps.length > 0 ? ((steps[steps.length-1].actor||'').trim() || firstActor) : firstActor;
    const endId = uid('End');
    nodes.push({ id: endId, type: 'endEvent', name: 'Kết thúc', actor: lastActor, terminate: true });

    if (openGw) {
      flows.push({ id: openGw.yesFlowId, from: openGw.gwId, to: endId, name: 'Có', condition: 'Có' });
    } else {
      flows.push({ id: uid('Flow'), from: prevId, to: endId });
    }

    return { nodes, flows };
  }

  /* ── ASSIGN POSITIONS ─────────────────────────────────────── */
  function assignPositions(nodes, actors) {
    const laneYMap = {};
    actors.forEach((a, i) => { laneYMap[a] = POOL_TOP_Y + i * LANE_H; });

    // Column slot: assign X left→right in order of nodes array
    let curX = CONTENT_X0;
    const posMap = {};

    nodes.forEach(n => {
      const { w, h } = sz(n.type);
      const laneY  = laneYMap[n.actor] || POOL_TOP_Y;
      const cx     = curX + w / 2;
      const cy     = laneY + LANE_H / 2;
      posMap[n.id] = { x: Math.round(cx - w/2), y: Math.round(cy - h/2), w, h, cx, cy, actor: n.actor };
      curX += w + H_GAP;
    });

    return { posMap, laneYMap, totalW: curX - POOL_X + 20 };
  }

  /* ── BUILD XML ────────────────────────────────────────────── */
  function generate(processTitle, steps) {
    resetIds();

    // Collect unique actors in order
    const actorsSeen = [];
    steps.forEach(s => {
      const a = (s.actor||'').trim() || 'Hệ thống';
      if (!actorsSeen.includes(a)) actorsSeen.push(a);
    });
    const actors = actorsSeen.length > 0 ? actorsSeen : ['Người dùng'];

    const safeTitle   = esc(processTitle || 'My Process');
    const processId   = uid('Process');
    const collabId    = uid('Collab');
    const participantId = uid('Participant');
    const laneSetId   = uid('LaneSet');
    const laneIds     = {};
    actors.forEach(a => { laneIds[a] = uid('Lane'); });

    const { nodes, flows } = buildFlow(steps, actors);
    const { posMap, laneYMap, totalW } = assignPositions(nodes, actors);
    const totalH = actors.length * LANE_H;

    /* ── Semantic XML ──────────────────────────────────────── */
    // LaneSet
    const laneXml = actors.map(actor => {
      const laneId = laneIds[actor];
      const refs   = nodes.filter(n => n.actor === actor)
        .map(n => `        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('\n');
      return `      <bpmn:lane id="${laneId}" name="${esc(actor)}">\n${refs}\n      </bpmn:lane>`;
    }).join('\n');

    // Nodes
    const nodesXml = nodes.map(n => {
      const name = n.name ? ` name="${esc(n.name)}"` : '';
      if (n.type === 'startEvent')
        return `    <bpmn:startEvent id="${n.id}"${name} />`;
      if (n.type === 'endEvent') {
        if (n.terminate)
          return `    <bpmn:endEvent id="${n.id}"${name}>\n      <bpmn:terminateEventDefinition id="${uid('TermDef')}" />\n    </bpmn:endEvent>`;
        return `    <bpmn:endEvent id="${n.id}"${name} />`;
      }
      if (n.type === 'exclusiveGateway')
        return `    <bpmn:exclusiveGateway id="${n.id}"${name} isMarkerVisible="true" />`;
      if (n.type === 'parallelGateway')
        return `    <bpmn:parallelGateway id="${n.id}"${name} />`;
      if (n.type === 'inclusiveGateway')
        return `    <bpmn:inclusiveGateway id="${n.id}"${name} />`;
      if (n.type === 'eventBasedGateway')
        return `    <bpmn:eventBasedGateway id="${n.id}"${name} />`;
      if (n.type === 'intermediateCatchEvent' || n.type === 'intermediateThrowEvent') {
        const evtDefMap = {
          timer: `<bpmn:timerEventDefinition id="${uid('ED')}" />`,
          message: `<bpmn:messageEventDefinition id="${uid('ED')}" />`,
          error: `<bpmn:errorEventDefinition id="${uid('ED')}" />`,
          signal: `<bpmn:signalEventDefinition id="${uid('ED')}" />`,
          conditional: `<bpmn:conditionalEventDefinition id="${uid('ED')}" />`
        };
        const evtDef = evtDefMap[n.eventType] || '';
        if (evtDef) return `    <bpmn:${n.type} id="${n.id}"${name}>\n      ${evtDef}\n    </bpmn:${n.type}>`;
      }
      return `    <bpmn:${n.type} id="${n.id}"${name} />`;
    }).join('\n');

    // Flows
    const flowsXml = flows.map(f => {
      const name = f.name ? ` name="${esc(f.name)}"` : '';
      if (f.condition) {
        return `    <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}">\n      <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>\n    </bpmn:sequenceFlow>`;
      }
      return `    <bpmn:sequenceFlow id="${f.id}"${name} sourceRef="${f.from}" targetRef="${f.to}" />`;
    }).join('\n');

    /* ── DI XML ────────────────────────────────────────────── */
    // Pool shape
    let diShapes = `    <bpmndi:BPMNShape id="${participantId}_di" bpmnElement="${participantId}" isHorizontal="true">\n      <dc:Bounds x="${POOL_X}" y="${POOL_TOP_Y}" width="${totalW}" height="${totalH}" />\n    </bpmndi:BPMNShape>\n`;

    // Lane shapes
    actors.forEach((actor, i) => {
      const laneId = laneIds[actor];
      const laneY  = POOL_TOP_Y + i * LANE_H;
      diShapes += `    <bpmndi:BPMNShape id="${laneId}_di" bpmnElement="${laneId}" isHorizontal="true">\n      <dc:Bounds x="${POOL_X + POOL_LABEL_W}" y="${laneY}" width="${totalW - POOL_LABEL_W}" height="${LANE_H}" />\n    </bpmndi:BPMNShape>\n`;
    });

    // Element shapes
    nodes.forEach(n => {
      const p = posMap[n.id];
      if (!p) return;
      if (n.type === 'exclusiveGateway') {
        diShapes += `    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}" isMarkerVisible="true">\n      <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />\n      <bpmndi:BPMNLabel />\n    </bpmndi:BPMNShape>\n`;
      } else if (n.type.includes('Event')) {
        diShapes += `    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n      <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />\n      <bpmndi:BPMNLabel>\n        <dc:Bounds x="${p.x - 10}" y="${p.y + p.h + 4}" width="${p.w + 20}" height="14" />\n      </bpmndi:BPMNLabel>\n    </bpmndi:BPMNShape>\n`;
      } else {
        diShapes += `    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n      <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />\n    </bpmndi:BPMNShape>\n`;
      }
    });

    // Edge waypoints — L-shaped for cross-lane, straight for same lane
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
    let diEdges = '';
    flows.forEach(f => {
      const srcN = nodeById[f.from];
      const tgtN = nodeById[f.to];
      const srcP = posMap[f.from];
      const tgtP = posMap[f.to];
      if (!srcP || !tgtP) return;

      const srcRightX = srcP.x + srcP.w;
      const srcMidY   = srcP.y + Math.round(srcP.h / 2);
      const tgtLeftX  = tgtP.x;
      const tgtMidY   = tgtP.y + Math.round(tgtP.h / 2);

      let waypoints;
      if (Math.abs(srcMidY - tgtMidY) < 5) {
        // Same lane — straight
        waypoints = `      <di:waypoint x="${srcRightX}" y="${srcMidY}" />\n      <di:waypoint x="${tgtLeftX}" y="${tgtMidY}" />`;
      } else {
        // Cross-lane — orthogonal L-shape
        const midX = Math.round((srcRightX + tgtLeftX) / 2);
        waypoints = `      <di:waypoint x="${srcRightX}" y="${srcMidY}" />\n      <di:waypoint x="${midX}" y="${srcMidY}" />\n      <di:waypoint x="${midX}" y="${tgtMidY}" />\n      <di:waypoint x="${tgtLeftX}" y="${tgtMidY}" />`;
      }

      const labelElem = f.name
        ? `\n      <bpmndi:BPMNLabel>\n        <dc:Bounds x="${Math.round((srcRightX+tgtLeftX)/2-15)}" y="${Math.round((srcMidY+tgtMidY)/2-7)}" width="30" height="14" />\n      </bpmndi:BPMNLabel>`
        : '';

      diEdges += `    <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n${waypoints}${labelElem}\n    </bpmndi:BPMNEdge>\n`;
    });

    /* ── FINAL XML ─────────────────────────────────────────── */
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

  <bpmn:collaboration id="${collabId}">
    <bpmn:participant id="${participantId}" name="${safeTitle}" processRef="${processId}" />
  </bpmn:collaboration>

  <bpmn:process id="${processId}" name="${safeTitle}" isExecutable="false">
    <bpmn:laneSet id="${laneSetId}">
${laneXml}
    </bpmn:laneSet>
${nodesXml}
${flowsXml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collabId}">
${diShapes}${diEdges}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  return { generate };
})();
