/** BPMN Engine v7.3 — Binary XOR cascade fix + reject-branch layout */
const BpmnEngine = (() => {
  let _n = 0;
  const uid = p => `${p}_${(++_n).toString(36)}${Math.random().toString(36).slice(2,5)}`;
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const resetIds = () => { _n = 0; };

  const SZ = {
    task:'100,80',userTask:'100,80',serviceTask:'100,80',sendTask:'100,80',
    receiveTask:'100,80',manualTask:'100,80',scriptTask:'100,80',
    businessRuleTask:'100,80',callActivity:'100,80',subProcess:'140,100',
    startEvent:'36,36',endEvent:'36,36',
    intermediateCatchEvent:'36,36',intermediateThrowEvent:'36,36',
    exclusiveGateway:'50,50',parallelGateway:'50,50',inclusiveGateway:'50,50',
    eventBasedGateway:'50,50',
  };

  /* Build BPMN EventDefinition XML for events — id is REQUIRED by bpmn-js to render icons */
  function buildEventDef(eventType, duration) {
    const eid = uid('EvDef');
    switch((eventType||'').toLowerCase()) {
      case 'timer':{
        const d=duration||'PT30M';
        return `      <bpmn:timerEventDefinition id="${eid}">\n        <bpmn:timeDuration xsi:type="bpmn:tFormalExpression">${d}</bpmn:timeDuration>\n      </bpmn:timerEventDefinition>`;
      }
      case 'message':  return `      <bpmn:messageEventDefinition id="${eid}" />`;
      case 'signal':   return `      <bpmn:signalEventDefinition id="${eid}" />`;
      case 'error':    return `      <bpmn:errorEventDefinition id="${eid}" />`;
      case 'escalation':return `      <bpmn:escalationEventDefinition id="${eid}" />`;
      case 'termination':return `      <bpmn:terminateEventDefinition id="${eid}" />`;
      case 'compensation':return `      <bpmn:compensateEventDefinition id="${eid}" />`;
      default: return '';
    }
  }
  const sz = t => { const v=SZ[t]||'100,80'; const [w,h]=v.split(',').map(Number); return {w,h}; };

  const POOL_X=100, POOL_LBL=30, LANE_LBL=30;
  const LANE_H=160, LANE_SOLO=120, TOP_Y=60, GAP=55, REJ_DY=100;

  const TMAP={
    task:'task',usertask:'userTask',servicetask:'serviceTask',sendtask:'sendTask',
    receivetask:'receiveTask',manualtask:'manualTask',scripttask:'scriptTask',
    businessruletask:'businessRuleTask',callactivity:'callActivity',subprocess:'subProcess',
    user:'userTask',service:'serviceTask',send:'sendTask',manual:'manualTask',
    receive:'receiveTask',script:'scriptTask',rule:'businessRuleTask',call:'callActivity',
    // Events
    startevent:'startEvent',endevent:'endEvent',
    intermediatecatchevent:'intermediateCatchEvent',
    intermediatethrowevent:'intermediateThrowEvent',
    // Gateways
    exclusivegateway:'exclusiveGateway',parallelgateway:'parallelGateway',
    inclusivegateway:'inclusiveGateway',eventbasedgateway:'eventBasedGateway',
  };
  const rtype = t => {
    const key = (t||'task').toLowerCase().replace(/[-_ ]/g,'');
    return TMAP[key] || t || 'task'; // preserve unknown types instead of defaulting to 'task'
  };

  function xorLabel(c1, c2) {
    const neg=/\b(kh[oô]ng|ch[uư]a|not|invalid|chưa)\b/gi;
    const a=c1.replace(neg,'').replace(/\s+/g,' ').trim();
    const b=c2.replace(neg,'').replace(/\s+/g,' ').trim();
    const wa=a.toLowerCase().split(/\s+/).filter(w=>w.length>2);
    const shared=wa.filter(w=>b.toLowerCase().includes(w));
    return (shared.length ? shared.join(' ') : a) || 'Decision';
  }

  /* ── buildFlow ─────────────────────────────────────
     KEY CHANGE v7.3: Only group EXACTLY 2 consecutive
     conditionals (binary decision). First branch = reject
     (task → End), second = continue (task → main flow).
     This correctly handles cascading validation patterns.
     ────────────────────────────────────────────────── */
  function buildFlow(steps, actors) {
    const nodes=[], flows=[];
    const first=actors[0]||'System';
    const sid=uid('SE');
    nodes.push({id:sid,type:'startEvent',name:'Start',actor:first});
    let prev=sid;

    for (let i=0; i<steps.length; i++) {
      const s=steps[i];
      const actor=(s.actor||'').trim()||first;
      const action=(s.action||'Step '+(i+1)).substring(0,80);
      const cond=(s.condition||'').trim();
      const rgt=(s.gatewayType||'').toLowerCase().replace(/[-_ ]/g,'');
      const gwT=rgt==='parallelgateway'?'parallelGateway'
               :rgt==='inclusivegateway'?'inclusiveGateway'
               :(rgt==='exclusivegateway'||cond)?'exclusiveGateway':null;
      const type=rtype(s.type);
      const tid=uid('T');

      /* ── AND gateway ── */
      if (gwT==='parallelGateway') {
        // Collect ALL consecutive parallel steps starting from current (i)
        const allParallel = [{actor, action, type}];
        let j = i + 1;
        while (j < steps.length) {
          const nx = steps[j];
          const ng = (nx.gatewayType||'').toLowerCase().replace(/[-_ ]/g,'');
          if (ng === 'parallelgateway' && nx.actor && nx.action) {
            allParallel.push({actor:(nx.actor||'').trim()||first, action:nx.action.substring(0,80), type:rtype(nx.type)});
            j++;
          } else break;
        }
        i = j - 1; // skip consumed steps

        // Create AND Split → [branch1, branch2, ...] → AND Join
        const spid = uid('GW'), jnid = uid('GW');
        nodes.push({id:spid, type:'parallelGateway', name:'', actor});
        flows.push({id:uid('F'), from:prev, to:spid});

        allParallel.forEach(b => {
          const bid = uid('T');
          nodes.push({id:bid, type:b.type, name:b.action, actor:b.actor, isBranch:true});
          flows.push({id:uid('F'), from:spid, to:bid});
          flows.push({id:uid('F'), from:bid, to:jnid});
        });

        nodes.push({id:jnid, type:'parallelGateway', name:'', actor, isJoin:true});
        prev = jnid;


      /* ── XOR binary decision (pair of 2 conditions) ── */
      } else if (gwT==='exclusiveGateway' && cond) {
        // Peek: is the NEXT step also conditional?
        const nx = (i+1 < steps.length) ? steps[i+1] : null;
        const nxCond = nx ? (nx.condition||'').trim() : '';
        const nxGT = nx ? (nx.gatewayType||'').toLowerCase().replace(/[-_ ]/g,'') : '';
        const nxIsXor = nxCond && (nxGT==='exclusivegateway'||!nxGT||nxGT==='');

        if (nx && nxIsXor) {
          /* ── BINARY XOR: reject branch (End) + continue branch ── */
          // Don't create task for current step yet — gateway goes directly
          const gwid=uid('GW');
          const lbl=xorLabel(cond, nxCond)+'?';
          nodes.push({id:gwid,type:'exclusiveGateway',name:lbl,actor});
          flows.push({id:uid('F'),from:prev,to:gwid});

          // Branch 1 (reject): gateway → task → End
          const rejTid=tid;
          nodes.push({id:rejTid,type,name:action,actor,isReject:true,gwRef:gwid});
          const rejFid=uid('F');
          flows.push({id:rejFid,from:gwid,to:rejTid,name:cond,condition:cond});
          const rejEnd=uid('EE');
          nodes.push({id:rejEnd,type:'endEvent',name:'End',actor,isReject:true,gwRef:gwid,rejAfter:rejTid});
          flows.push({id:uid('F'),from:rejTid,to:rejEnd});

          // Branch 2 (continue): gateway → task → main flow continues
          const contActor=(nx.actor||'').trim()||first;
          const contAction=(nx.action||'').substring(0,80);
          const contType=rtype(nx.type);
          const contTid=uid('T');
          const defFid=uid('F');
          nodes.push({id:contTid,type:contType,name:contAction,actor:contActor});
          flows.push({id:defFid,from:gwid,to:contTid,name:nxCond,condition:nxCond,isDefault:true});

          nodes.find(n=>n.id===gwid)._defFid=defFid;
          prev=contTid;
          i++; // skip next step (consumed as branch 2)

        } else {
          /* ── SINGLE conditional: yes/no with reject end ── */
          nodes.push({id:tid,type,name:action,actor});
          flows.push({id:uid('F'),from:prev,to:tid});
          const gwid=uid('GW');
          const gwlbl=cond.endsWith('?')?cond:cond+'?';
          nodes.push({id:gwid,type:'exclusiveGateway',name:gwlbl,actor});
          flows.push({id:uid('F'),from:tid,to:gwid});
          const noId=uid('EE'),noFid=uid('F');
          nodes.push({id:noId,type:'endEvent',name:'End (Rejected)',actor,isReject:true,gwRef:gwid});
          flows.push({id:noFid,from:gwid,to:noId,name:'No',condition:'No'});
          const yFid=uid('F');
          // Yes branch deferred — next step connects here
          prev=gwid;
          // Store open gateway for the next non-conditional step to close
          nodes._openGw={gid:gwid,yFid};
        }

      /* ── Normal task / intermediate event ── */
      } else {
        nodes.push({id:tid,type,name:action,actor,eventType:s.eventType||'',eventDuration:s.eventDuration||''});
        // Close any pending single-XOR yes-branch
        if (nodes._openGw) {
          flows.push({id:nodes._openGw.yFid,from:nodes._openGw.gid,to:tid,name:'Yes',condition:'Yes'});
          nodes._openGw=null;
        } else {
          flows.push({id:uid('F'),from:prev,to:tid});
        }
        prev=tid;
      }
    }

    // Final end
    const la=steps.length?((steps[steps.length-1].actor||'').trim()||first):first;
    const eid=uid('EE');
    nodes.push({id:eid,type:'endEvent',name:'End',actor:la});
    if (nodes._openGw) {
      flows.push({id:nodes._openGw.yFid,from:nodes._openGw.gid,to:eid,name:'Yes',condition:'Yes'});
      nodes._openGw=null;
    } else {
      flows.push({id:uid('F'),from:prev,to:eid});
    }
    delete nodes._openGw;
    return {nodes,flows};
  }

  function assignPos(nodes, flows, actors, solo) {
    const baseLH=solo?LANE_SOLO:LANE_H;
    const REJ_OFFSET=95; // vertical offset for reject row below main flow
    const x0=POOL_X+POOL_LBL+(solo?0:LANE_LBL)+GAP;
    let cx=x0, brMaxX=0;
    const pos={};

    // Build source→target map for reject End positioning
    const flowFrom={};
    flows.forEach(f=>{flowFrom[f.to]=f.from;});

    // Count reject items per lane to know how much extra height each lane needs
    const rejPerLane={};
    actors.forEach(a=>{rejPerLane[a]=0;});
    nodes.forEach(n=>{
      if(n.isReject && n.actor && rejPerLane[n.actor]!==undefined) rejPerLane[n.actor]++;
    });

    // Compute each lane's height: base + extra for reject rows
    const laneH={};
    actors.forEach(a=>{
      laneH[a] = rejPerLane[a]>0 ? baseLH+REJ_OFFSET : baseLH;
    });

    // Compute lane top Y (cumulative)
    const lt={};
    let cumY=TOP_Y;
    actors.forEach(a=>{lt[a]=cumY; cumY+=laneH[a];});

    /* PASS 1 — main-flow nodes (gateways, tasks, joins, events) */
    nodes.forEach(n=>{
      if(typeof n!=='object'||!n.id||n.isReject) return;
      const {w,h}=sz(n.type);
      const lTop=lt[n.actor]??TOP_Y;
      const thisLH=laneH[n.actor]??baseLH;
      const lMid = rejPerLane[n.actor]>0 ? lTop+Math.round(baseLH/2) : lTop+Math.round(thisLH/2);
      if (n.isBranch) {
        const ex=cx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        brMaxX=Math.max(brMaxX, cx+w);
      } else if (n.isJoin) {
        const jx=Math.max(cx, brMaxX+GAP);
        const ex=jx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        cx=Math.round(jx)+w+GAP;
        brMaxX=0;
      } else {
        const ex=cx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        cx+=w+GAP;
      }
    });

    /* PASS 2 — reject nodes (pos[gwRef] guaranteed set from pass 1) */
    nodes.forEach(n=>{
      if(typeof n!=='object'||!n.id||!n.isReject) return;
      const {w,h}=sz(n.type);
      const actor=n.actor||actors[0]||'';
      const lTop=lt[actor]??TOP_Y;
      const rejY=lTop+baseLH+10;

      if (n.type!=='endEvent') {
        // Reject TASK — directly below its gateway
        const gp=(n.gwRef&&pos[n.gwRef])?pos[n.gwRef]:null;
        if (gp) {
          const rx=Math.round(gp.cx-w/2);
          pos[n.id]={x:rx,y:rejY,w,h,cx:Math.round(gp.cx),cy:rejY+Math.round(h/2)};
        } else {
          pos[n.id]={x:cx,y:rejY,w,h,cx:cx+Math.round(w/2),cy:rejY+Math.round(h/2)};
        }
      } else {
        // Reject END — 2 sub-cases:
        const srcId=flowFrom[n.id];
        const rp=(srcId&&pos[srcId])?pos[srcId]:null;
        const srcNode=srcId?nodes.find(nd=>nd&&nd.id===srcId):null;
        const isGWSrc=srcNode&&srcNode.type&&srcNode.type.includes('Gateway');

        if (rp && isGWSrc) {
          // Source is GATEWAY directly (single conditional: no reject task between)
          // → place End directly BELOW the gateway (same cx) so straight-down arrow matches
          const ex=Math.round(rp.cx-w/2);
          pos[n.id]={x:ex,y:rejY,w,h,cx:Math.round(rp.cx),cy:rejY+Math.round(h/2)};
        } else if (rp) {
          // Source is a REJECT TASK (binary XOR) → place End to the RIGHT of task
          const ex=rp.x+rp.w+32;
          pos[n.id]={x:ex,y:rejY,w,h,cx:ex+Math.round(w/2),cy:rejY+Math.round(h/2)};
        } else {
          pos[n.id]={x:cx+w+GAP,y:rejY,w,h,cx:cx+w+GAP+Math.round(w/2),cy:rejY+Math.round(h/2)};
        }
      }
    });

    const allP=Object.values(pos);
    const maxR=allP.length?Math.max(...allP.map(p=>p.x+p.w)):x0+200;
    const totalW=maxR-POOL_X+80;
    const totalH=cumY-TOP_Y;
    return {pos,lt,laneH,totalW,totalH};
  }



  function connMap(nodes,flows) {
    const inc={},out={};
    nodes.forEach(n=>{if(n.id){inc[n.id]=[];out[n.id]=[];}});
    flows.forEach(f=>{if(out[f.from])out[f.from].push(f.id);if(inc[f.to])inc[f.to].push(f.id);});
    return {inc,out};
  }

  /* ── waypoints — strict orthogonal BPMN routing ── */
  function waypoints(sp, tp, sn, tn) {
    const srcGW=sn&&sn.type&&sn.type.includes('Gateway');
    if(!sp||!tp) return [[0,0],[100,0]];
    const sy=sp.cy, ty=tp.cy, diff=ty-sy;

    // Gateway → reject task directly below: exit BOTTOM → straight DOWN → enter TOP of task
    if (tn&&tn.isReject&&srcGW) {
      return [[sp.cx, sp.y+sp.h], [sp.cx, tp.y]];
    }
    // Reject task → reject end event: exit RIGHT → straight horizontal → enter LEFT
    if (tn&&tn.isReject&&!srcGW) {
      return [[sp.x+sp.w, sp.cy], [tp.x, tp.cy]];
    }

    // Same lane (horizontal): exit RIGHT → enter LEFT
    if (Math.abs(diff)<=5) return [[sp.x+sp.w, sy], [tp.x, ty]];

    // Gateway → different lane: exit BOTTOM or TOP → go vertical → then horizontal to target LEFT
    if (srcGW) {
      if (diff>0) {
        // Going down: exit bottom → down to target row → right to target
        return [[sp.cx, sp.y+sp.h], [sp.cx, ty], [tp.x, ty]];
      } else {
        // Going up: exit top → up to target row → right to target
        return [[sp.cx, sp.y], [sp.cx, ty], [tp.x, ty]];
      }
    }

    // General cross-lane: exit RIGHT → midpoint → turn vertical → enter LEFT
    const mx=Math.round((sp.x+sp.w+tp.x)/2);
    return [[sp.x+sp.w, sy], [mx, sy], [mx, ty], [tp.x, ty]];
  }


  /* ── generate XML ── */
  function generate(title, steps, opts) {
    const singleProcess = !!(opts && opts.singleProcess);
    resetIds();
    if(!steps||!steps.length) steps=[
      {step:1,actor:'System',action:'Submit request',type:'userTask'},
      {step:2,actor:'System',action:'Process request',type:'serviceTask'},
    ];
    const actSeen=[];
    steps.forEach(s=>{
      const a = singleProcess ? 'Process' : ((s.actor||'').trim()||'System');
      if(!actSeen.includes(a)) actSeen.push(a);
    });
    const actors=actSeen.length?actSeen:['System'];
    const solo = singleProcess || actors.length===1;
    const T=esc(title||'Process');
    const pid=uid('Proc'),cid=uid('Col'),ptid=uid('Part'),lsid=uid('LS');
    const lids={}; if(!solo) actors.forEach(a=>{lids[a]=uid('Lane');});

    // For singleProcess, re-map all actors to 'Process' for layout
    const layoutSteps = singleProcess ? steps.map(s=>({...s, actor:'Process'})) : steps;
    const {nodes,flows}=buildFlow(layoutSteps, actors);
    const {pos,lt,laneH,totalW,totalH}=assignPos(nodes,flows,actors,solo);
    const {inc,out}=connMap(nodes,flows);

    const xdef={};
    nodes.forEach(n=>{if(n._defFid)xdef[n.id]=n._defFid;});

    /* Lane XML */
    const lxml=solo?'':actors.map(a=>{
      const refs=nodes.filter(n=>n.actor===a).map(n=>`        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('\n');
      return `      <bpmn:lane id="${lids[a]}" name="${esc(a)}">\n${refs}\n      </bpmn:lane>`;
    }).join('\n');
    const lsxml=solo?'':`    <bpmn:laneSet id="${lsid}">\n${lxml}\n    </bpmn:laneSet>\n`;

    /* Nodes */
    const nxml=nodes.filter(n=>n.id).map(n=>{
      const nm=n.name?` name="${esc(n.name)}"`:'';
      const ins=(inc[n.id]||[]).map(id=>`      <bpmn:incoming>${id}</bpmn:incoming>`).join('\n');
      const ots=(out[n.id]||[]).map(id=>`      <bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n');
      const body=[ins,ots].filter(Boolean).join('\n');
      const w=(tag,a='')=>body?`    <bpmn:${tag} id="${n.id}"${nm}${a}>\n${body}\n    </bpmn:${tag}>`
                               :`    <bpmn:${tag} id="${n.id}"${nm}${a} />`;
      if(n.type==='startEvent') return w('startEvent');
      if(n.type==='endEvent') {
        const evd=buildEventDef(n.eventType,n.eventDuration);
        if(evd) return `    <bpmn:endEvent id="${n.id}"${nm}>\n${body}\n${evd}\n    </bpmn:endEvent>`;
        return w('endEvent');
      }
      if(n.type==='intermediateCatchEvent') {
        const evd=buildEventDef(n.eventType,n.eventDuration);
        if(evd) return `    <bpmn:intermediateCatchEvent id="${n.id}"${nm}>\n${body}\n${evd}\n    </bpmn:intermediateCatchEvent>`;
        return w('intermediateCatchEvent');
      }
      if(n.type==='intermediateThrowEvent') {
        const evd=buildEventDef(n.eventType,n.eventDuration);
        if(evd) return `    <bpmn:intermediateThrowEvent id="${n.id}"${nm}>\n${body}\n${evd}\n    </bpmn:intermediateThrowEvent>`;
        return w('intermediateThrowEvent');
      }
      if(n.type==='exclusiveGateway'){
        const da=xdef[n.id]?` default="${xdef[n.id]}"`:' ';
        return w('exclusiveGateway',` isMarkerVisible="true"${da}`);
      }
      if(n.type==='parallelGateway')  return w('parallelGateway');
      if(n.type==='inclusiveGateway') return w('inclusiveGateway');
      if(n.type==='eventBasedGateway') return w('eventBasedGateway');
      return w(n.type);
    }).join('\n');

    /* Flows */
    const nById=Object.fromEntries(nodes.filter(n=>n.id).map(n=>[n.id,n]));
    const fxml=flows.map(f=>{
      const nm=f.name?` name="${esc(f.name)}"`:' name=""';
      const src=nById[f.from];
      const isXor=src&&src.type==='exclusiveGateway';
      const isDef=xdef[f.from]===f.id;
      const needCond=f.condition&&isXor&&!isDef;
      if(needCond) return `    <bpmn:sequenceFlow id="${f.id}"${nm} sourceRef="${f.from}" targetRef="${f.to}">\n      <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>\n    </bpmn:sequenceFlow>`;
      return `    <bpmn:sequenceFlow id="${f.id}"${nm} sourceRef="${f.from}" targetRef="${f.to}" />`;
    }).join('\n');

    /* BPMNDI shapes */
    let shapes='';
    if (!singleProcess) {
      shapes+=`    <bpmndi:BPMNShape id="${ptid}_di" bpmnElement="${ptid}" isHorizontal="true">\n      <dc:Bounds x="${POOL_X}" y="${TOP_Y}" width="${totalW}" height="${totalH}" />\n      <bpmndi:BPMNLabel />\n    </bpmndi:BPMNShape>\n`;
      if(!solo) actors.forEach(a=>{
        const lid=lids[a],ly=lt[a],lx=POOL_X+POOL_LBL,lhh=laneH[a];
        shapes+=`    <bpmndi:BPMNShape id="${lid}_di" bpmnElement="${lid}" isHorizontal="true">\n      <dc:Bounds x="${lx}" y="${ly}" width="${totalW-POOL_LBL}" height="${lhh}" />\n      <bpmndi:BPMNLabel />\n    </bpmndi:BPMNShape>\n`;
      });
    }
    nodes.filter(n=>n.id&&pos[n.id]).forEach(n=>{
      const p=pos[n.id];
      const isEv=n.type.includes('Event'),isGW=n.type.includes('Gateway');
      let lbl='';
      if(n.name){
        if(isEv){
          // Dynamic width for event labels (circles: 36x36)
          const evLblW = Math.min(Math.max(n.name.length*6, 48), 140);
          const evLblX = p.x - Math.round((evLblW - p.w)/2);
          lbl=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${evLblX}" y="${p.y+p.h+4}" width="${evLblW}" height="28" /></bpmndi:BPMNLabel>`;
        } else if(isGW){
          // Dynamic width for gateway labels (diamonds: 50x50)
          const gwLblW = Math.min(Math.max(n.name.length*6, 80), 160);
          const gwLblX = p.x - Math.round((gwLblW - p.w)/2);
          lbl=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${gwLblX}" y="${p.y+p.h+5}" width="${gwLblW}" height="28" /></bpmndi:BPMNLabel>`;
        }
      }
      const ga=n.type==='exclusiveGateway'?' isMarkerVisible="true"':'';
      shapes+=`    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${ga}>\n      <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />${lbl}\n    </bpmndi:BPMNShape>\n`;
    });

    /* BPMNDI edges */
    let edges='';
    flows.forEach(f=>{
      const sp=pos[f.from],tp=pos[f.to]; if(!sp||!tp) return;
      const sn=nById[f.from],tn=nById[f.to];
      const wps=waypoints(sp,tp,sn,tn);
      const wxml=wps.map(([x,y])=>`      <di:waypoint x="${x}" y="${y}" />`).join('\n');
      let lbl='';
      if (f.name) {
        const isVertical = wps.length===2 && Math.abs(wps[0][0]-wps[1][0])<=2;
        const lblW = Math.min(Math.max(f.name.length*7, 40), 120);
        let lx, ly;
        if (isVertical) {
          // Vertical flow: label to the LEFT of the line
          lx = wps[0][0] - lblW - 5;
          ly = Math.round((wps[0][1]+wps[1][1])/2) - 7;
        } else {
          // Horizontal/angled flow: label ABOVE the first segment midpoint
          lx = Math.round((wps[0][0]+wps[1][0])/2) - Math.round(lblW/2);
          ly = Math.min(wps[0][1], wps[1][1]) - 18;
        }
        lbl = `\n      <bpmndi:BPMNLabel><dc:Bounds x="${lx}" y="${ly}" width="${lblW}" height="14" /></bpmndi:BPMNLabel>`;
      }
      edges+=`    <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n${wxml}${lbl}\n    </bpmndi:BPMNEdge>\n`;
    });

    /* ── XML output ── */
    if (singleProcess) {
      // Flat process: no Collaboration, no Pool — BPMNPlane references the process directly
      return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="BPMN Studio" exporterVersion="7.3">

  <bpmn:process id="${pid}" name="${T}" isExecutable="false">
${nxml}
${fxml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${pid}">
${shapes}${edges}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="BPMN Studio" exporterVersion="7.3">

  <bpmn:collaboration id="${cid}">
    <bpmn:participant id="${ptid}" name="${T}" processRef="${pid}" />
  </bpmn:collaboration>

  <bpmn:process id="${pid}" name="${T}" isExecutable="false">
${lsxml}${nxml}
${fxml}
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${cid}">
${shapes}${edges}    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }

  return {generate};
})();

if (typeof module !== 'undefined') module.exports = BpmnEngine;
