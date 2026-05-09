/** BPMN Engine v7.2 — Fix: merge node AFTER branches, cross-lane waypoints */
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
    exclusiveGateway:'50,50',parallelGateway:'50,50',inclusiveGateway:'50,50',
  };
  const sz = t => { const v=SZ[t]||'100,80'; const [w,h]=v.split(',').map(Number); return {w,h}; };

  // Layout constants
  const POOL_X=100, POOL_LBL=30, LANE_LBL=30;
  const LANE_H=160, LANE_SOLO=120, TOP_Y=60, GAP=55, REJ_DROP=40;

  const TMAP={task:'task',usertask:'userTask',servicetask:'serviceTask',sendtask:'sendTask',
    receivetask:'receiveTask',manualtask:'manualTask',scripttask:'scriptTask',
    businessruletask:'businessRuleTask',callactivity:'callActivity',subprocess:'subProcess',
    user:'userTask',service:'serviceTask',send:'sendTask',manual:'manualTask',
    receive:'receiveTask',script:'scriptTask',rule:'businessRuleTask',call:'callActivity'};
  const rtype = t => TMAP[(t||'task').toLowerCase().replace(/[-_ ]/g,'')] || 'task';

  function xorLabel(conds) {
    const neg=/\b(kh[oô]ng|ch[uư]a|not|invalid)\b/gi;
    const cl=conds.map(c=>c.replace(neg,'').replace(/\s+/g,' ').trim());
    const ws=cl[0].toLowerCase().split(/\s+/).filter(w=>w.length>2&&cl.every(c=>c.toLowerCase().includes(w)));
    return ws.length?ws.join(' '):(cl[0]||'Decision');
  }

  /* ─────────────────────────────────────────
     buildFlow — KEY FIX: merge pushed AFTER branches
     ───────────────────────────────────────── */
  function buildFlow(steps, actors) {
    const nodes=[], flows=[];
    const first=actors[0]||'System';
    const sid=uid('SE');
    nodes.push({id:sid,type:'startEvent',name:'Start',actor:first});
    let prev=sid, openGw=null;

    for (let i=0;i<steps.length;i++) {
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

      if (openGw&&gwT!=='parallelGateway') {
        flows.push({id:openGw.yid,from:openGw.gid,to:tid,name:'Yes',condition:'Yes'});
        openGw=null;
      }

      nodes.push({id:tid,type,name:action,actor});
      flows.push({id:uid('F'),from:prev,to:tid});

      /* AND */
      if (gwT==='parallelGateway') {
        const spid=uid('GW'), jnid=uid('GW');
        nodes.push({id:spid,type:'parallelGateway',name:'',actor});
        flows.push({id:uid('F'),from:tid,to:spid});
        const bst=[]; let j=i+1;
        while(j<steps.length){
          const nx=steps[j],ng=(nx.gatewayType||'').toLowerCase().replace(/[-_ ]/g,'');
          if(ng==='parallelgateway'&&nx.actor&&nx.action){bst.push(nx);j++;}else break;
        }
        if(!bst.length){
          flows.push({id:uid('F'),from:spid,to:jnid});
          flows.push({id:uid('F'),from:spid,to:jnid});
        } else {
          bst.forEach(b=>{
            const ba=(b.actor||'').trim()||actor,bid=uid('T');
            nodes.push({id:bid,type:rtype(b.type),name:b.action.substring(0,80),actor:ba,isBranch:true,gwGroup:jnid});
            flows.push({id:uid('F'),from:spid,to:bid});
            flows.push({id:uid('F'),from:bid,to:jnid});
          });
          i=j-1;
        }
        // push join AFTER branches
        nodes.push({id:jnid,type:'parallelGateway',name:'',actor,isJoin:true});
        prev=jnid;

      /* XOR multi-branch */
      } else if (gwT==='exclusiveGateway'&&cond) {
        const grp=[{actor,action,type,cond,tid}];
        let j=i+1;
        while(j<steps.length){
          const nx=steps[j],ng=(nx.gatewayType||'').toLowerCase().replace(/[-_ ]/g,''),nc=(nx.condition||'').trim();
          if(nc&&nx.action&&(ng==='exclusivegateway'||!ng)){
            grp.push({actor:(nx.actor||'').trim()||first,action:nx.action.substring(0,80),type:rtype(nx.type),cond:nc,tid:uid('T')});
            j++;
          } else break;
        }

        if(grp.length>=2) {
          nodes.pop(); flows.pop(); // remove pre-created task+flow
          const gwid=uid('GW'), mid=uid('GW');
          const gwlbl=xorLabel(grp.map(b=>b.cond))+'?';
          nodes.push({id:gwid,type:'exclusiveGateway',name:gwlbl,actor:grp[0].actor});
          flows.push({id:uid('F'),from:prev,to:gwid});
          const defFid=uid('F');
          // Push branch tasks first
          grp.forEach((b,bi)=>{
            nodes.push({id:b.tid,type:b.type,name:b.action,actor:b.actor,isBranch:true,gwGroup:mid});
            const fid=bi===0?defFid:uid('F');
            flows.push({id:fid,from:gwid,to:b.tid,name:b.cond,condition:b.cond,isDefault:bi===0});
            flows.push({id:uid('F'),from:b.tid,to:mid});
          });
          // Push merge AFTER all branches
          nodes.push({id:mid,type:'exclusiveGateway',name:'',actor:grp[0].actor,isJoin:true});
          nodes.find(n=>n.id===gwid)._defFid=defFid;
          prev=mid; i=j-1;

        } else {
          // Single cond → yes/no + reject end
          const gwid=uid('GW');
          nodes.push({id:gwid,type:'exclusiveGateway',name:cond.endsWith('?')?cond:cond+'?',actor});
          flows.push({id:uid('F'),from:tid,to:gwid});
          const neid=uid('EE'),nfid=uid('F');
          nodes.push({id:neid,type:'endEvent',name:'End (Rejected)',actor,isReject:true,gwRef:gwid});
          flows.push({id:nfid,from:gwid,to:neid,name:'No',condition:'No',isDefault:false});
          const yid=uid('F');
          openGw={gid:gwid,yid,defFid:nfid};
          prev=gwid;
        }

      /* OR */
      } else if (gwT==='inclusiveGateway'&&cond) {
        const gwid=uid('GW');
        nodes.push({id:gwid,type:'inclusiveGateway',name:cond+'?',actor});
        flows.push({id:uid('F'),from:tid,to:gwid});
        const neid=uid('EE'),nfid=uid('F');
        nodes.push({id:neid,type:'endEvent',name:'End (Skipped)',actor,isReject:true,gwRef:gwid});
        flows.push({id:nfid,from:gwid,to:neid,name:'No',condition:'No'});
        const yid=uid('F');
        openGw={gid:gwid,yid,defFid:nfid};
        prev=gwid;
      } else {
        prev=tid;
      }
    }

    const la=steps.length?((steps[steps.length-1].actor||'').trim()||first):first;
    const eid=uid('EE');
    nodes.push({id:eid,type:'endEvent',name:'End',actor:la});
    if(openGw) flows.push({id:openGw.yid,from:openGw.gid,to:eid,name:'Yes',condition:'Yes'});
    else flows.push({id:uid('F'),from:prev,to:eid});
    return {nodes,flows};
  }

  /* ─────────────────────────────────────────
     assignPos — branches same col, join after
     ───────────────────────────────────────── */
  function assignPos(nodes, actors, solo) {
    const lH=solo?LANE_SOLO:LANE_H;
    const lt={};
    actors.forEach((a,i)=>{lt[a]=TOP_Y+i*lH;});
    const x0=POOL_X+POOL_LBL+(solo?0:LANE_LBL)+GAP;
    let cx=x0, brMaxX=0;
    const pos={};

    nodes.forEach(n=>{
      const {w,h}=sz(n.type);
      const lTop=lt[n.actor]??TOP_Y;
      const lMid=lTop+lH/2;
      const lBot=lTop+lH;

      if(n.isReject&&n.gwRef&&pos[n.gwRef]) {
        // Place reject end BELOW its gateway
        const gp=pos[n.gwRef];
        const ex=gp.cx, ey=lBot+REJ_DROP+h/2;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:ex,cy:Math.round(ey)};
      } else if(n.isBranch) {
        // All branches share same X column (curX unchanged)
        const ex=cx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        brMaxX=Math.max(brMaxX,Math.round(ex-w/2)+w);
      } else if(n.isJoin) {
        // Place join AFTER all branches
        const jx=Math.max(cx,brMaxX+GAP);
        const ex=jx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        cx=Math.round(ex)+Math.round(w/2)+GAP;
        brMaxX=0;
      } else {
        const ex=cx+w/2, ey=lMid;
        pos[n.id]={x:Math.round(ex-w/2),y:Math.round(ey-h/2),w,h,cx:Math.round(ex),cy:Math.round(ey)};
        cx+=w+GAP;
      }
    });

    const allP=Object.values(pos);
    const maxR=allP.length?Math.max(...allP.map(p=>p.x+p.w)):x0+200;
    const totalW=maxR-POOL_X+70;
    const hasReject=nodes.some(n=>n.isReject);
    const totalH=actors.length*lH+(hasReject?REJ_DROP+60:0);
    return {pos,lt,lH,totalW,totalH};
  }

  function connMap(nodes,flows) {
    const inc={},out={};
    nodes.forEach(n=>{inc[n.id]=[];out[n.id]=[];});
    flows.forEach(f=>{out[f.from]&&out[f.from].push(f.id);inc[f.to]&&inc[f.to].push(f.id);});
    return {inc,out};
  }

  /* ─────────────────────────────────────────
     Waypoint routing — proper cross-lane BPMN
     Rules (Camunda Modeler style):
       • Same lane → straight horizontal
       • Gateway → lower lane task: exit BOTTOM of GW → down → left of task
       • Gateway → upper lane task: exit TOP of GW → up → left of task
       • Lower branch → upper merge: exit RIGHT of task → right to merge cx → up to merge cy → left
       • Reject end: exit BOTTOM of gateway → down → top of reject event
     ───────────────────────────────────────── */
  function waypoints(sp, tp, sn, tn) {
    const srcIsGW = sn && sn.type && sn.type.includes('Gateway');
    const tgtIsGW = tn && tn.type && tn.type.includes('Gateway');

    // ── Reject end: go straight DOWN from gateway bottom ──
    if (tn && tn.isReject) {
      const gcx = sp.cx, gbot = sp.y + sp.h;
      const tcx = tp.cx, ttop = tp.y;
      return [[gcx, gbot], [gcx, ttop], [tcx, ttop], [tcx, tp.cy]];
    }

    const sy = sp.cy, ty = tp.cy;
    const diff = ty - sy;

    // ── Same lane (within 5px) → straight ──
    if (Math.abs(diff) <= 5) {
      return [[sp.x + sp.w, sy], [tp.x, ty]];
    }

    // ── Gateway → task in different lane ──
    if (srcIsGW) {
      if (diff > 0) {
        // Going DOWN: exit BOTTOM of gateway → drop to target cy → enter LEFT
        const gbot = sp.y + sp.h, gcx = sp.cx;
        return [[gcx, gbot], [gcx, ty], [tp.x, ty]];
      } else {
        // Going UP: exit TOP of gateway → rise to target cy → enter LEFT
        const gtop = sp.y, gcx = sp.cx;
        return [[gcx, gtop], [gcx, ty], [tp.x, ty]];
      }
    }

    // ── Task in lower lane → XOR merge in upper lane ──
    if (tgtIsGW && diff < 0) {
      // Exit RIGHT of task → go right to merge cx → rise to merge cy → enter LEFT
      const mcx  = tp.cx;
      const mbot = tp.y + tp.h;
      return [[sp.x + sp.w, sy], [mcx, sy], [mcx, mbot], [mcx, ty]];
    }

    // ── Task in upper lane → XOR merge in lower lane ──
    if (tgtIsGW && diff > 0) {
      const mcx  = tp.cx;
      const mtop = tp.y;
      return [[sp.x + sp.w, sy], [mcx, sy], [mcx, mtop], [mcx, ty]];
    }

    // ── Default cross-lane: right → midX → drop → left ──
    const midX = Math.round((sp.x + sp.w + tp.x) / 2);
    return [[sp.x + sp.w, sy], [midX, sy], [midX, ty], [tp.x, ty]];
  }


  /* ─────────────────────────────────────────
     generate — main entry point
     ───────────────────────────────────────── */
  function generate(title, steps) {
    resetIds();
    if(!steps||!steps.length) steps=[
      {step:1,actor:'Customer',action:'Submit request',condition:'',type:'userTask',gatewayType:''},
      {step:2,actor:'System',  action:'Process request',condition:'',type:'serviceTask',gatewayType:''},
    ];
    const actSeen=[];
    steps.forEach(s=>{const a=(s.actor||'').trim()||'System';if(!actSeen.includes(a))actSeen.push(a);});
    const actors=actSeen.length?actSeen:['User'];
    const solo=actors.length===1;
    const T=esc(title||'Process');
    const pid=uid('Proc'),cid=uid('Col'),ptid=uid('Part'),lsid=uid('LS');
    const lids={};
    if(!solo)actors.forEach(a=>{lids[a]=uid('Lane');});

    const {nodes,flows}=buildFlow(steps,actors);
    const {pos,lt,lH,totalW,totalH}=assignPos(nodes,actors,solo);
    const {inc,out}=connMap(nodes,flows);

    // XOR default flow map
    const xdef={};
    nodes.forEach(n=>{if(n._defFid)xdef[n.id]=n._defFid;});
    flows.forEach(f=>{
      if(f.name==='Yes'&&f.condition==='Yes'){
        const s=nodes.find(n=>n.id===f.from);
        if(s&&s.type==='exclusiveGateway'&&!xdef[f.from])xdef[f.from]=f.id;
      }
    });

    /* Lane XML */
    const lxml=solo?'':actors.map(a=>{
      const refs=nodes.filter(n=>n.actor===a).map(n=>`        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`).join('\n');
      return `      <bpmn:lane id="${lids[a]}" name="${esc(a)}">\n${refs}\n      </bpmn:lane>`;
    }).join('\n');
    const lsxml=solo?'':
      `    <bpmn:laneSet id="${lsid}">\n${lxml}\n    </bpmn:laneSet>\n`;

    /* Nodes semantic */
    const nxml=nodes.map(n=>{
      const nm=n.name?` name="${esc(n.name)}"`:'';
      const ins=(inc[n.id]||[]).map(id=>`      <bpmn:incoming>${id}</bpmn:incoming>`).join('\n');
      const ots=(out[n.id]||[]).map(id=>`      <bpmn:outgoing>${id}</bpmn:outgoing>`).join('\n');
      const body=[ins,ots].filter(Boolean).join('\n');
      const w=(tag,a='')=>body?`    <bpmn:${tag} id="${n.id}"${nm}${a}>\n${body}\n    </bpmn:${tag}>`
                               :`    <bpmn:${tag} id="${n.id}"${nm}${a} />`;
      if(n.type==='startEvent') return w('startEvent');
      if(n.type==='endEvent')   return w('endEvent');
      if(n.type==='exclusiveGateway'){
        const da=xdef[n.id]?` default="${xdef[n.id]}"`:' ';
        return w('exclusiveGateway',` isMarkerVisible="true"${da}`);
      }
      if(n.type==='parallelGateway')  return w('parallelGateway');
      if(n.type==='inclusiveGateway') return w('inclusiveGateway');
      return w(n.type);
    }).join('\n');

    /* Flows semantic */
    const nById=Object.fromEntries(nodes.map(n=>[n.id,n]));
    const fxml=flows.map(f=>{
      const nm=f.name?` name="${esc(f.name)}"`:' name=""';
      const src=nById[f.from];
      const isXorSrc=src&&src.type==='exclusiveGateway';
      const isDef=xdef[f.from]===f.id;
      const needCond=f.condition&&isXorSrc&&!isDef;
      if(needCond) return `    <bpmn:sequenceFlow id="${f.id}"${nm} sourceRef="${f.from}" targetRef="${f.to}">\n      <bpmn:conditionExpression xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="bpmn:tFormalExpression">${esc(f.condition)}</bpmn:conditionExpression>\n    </bpmn:sequenceFlow>`;
      return `    <bpmn:sequenceFlow id="${f.id}"${nm} sourceRef="${f.from}" targetRef="${f.to}" />`;
    }).join('\n');

    /* BPMNDI shapes */
    let shapes='';
    shapes+=`    <bpmndi:BPMNShape id="${ptid}_di" bpmnElement="${ptid}" isHorizontal="true">\n      <dc:Bounds x="${POOL_X}" y="${TOP_Y}" width="${totalW}" height="${totalH}" />\n      <bpmndi:BPMNLabel />\n    </bpmndi:BPMNShape>\n`;
    if(!solo)actors.forEach((a,i)=>{
      const lid=lids[a],ly=TOP_Y+i*lH,lx=POOL_X+POOL_LBL;
      shapes+=`    <bpmndi:BPMNShape id="${lid}_di" bpmnElement="${lid}" isHorizontal="true">\n      <dc:Bounds x="${lx}" y="${ly}" width="${totalW-POOL_LBL}" height="${lH}" />\n      <bpmndi:BPMNLabel />\n    </bpmndi:BPMNShape>\n`;
    });
    nodes.forEach(n=>{
      const p=pos[n.id]; if(!p) return;
      const isEv=n.type.includes('Event'),isGW=n.type.includes('Gateway');
      let lbl='';
      if(n.name){
        if(isEv) lbl=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${p.x-6}" y="${p.y+p.h+4}" width="${p.w+12}" height="14" /></bpmndi:BPMNLabel>`;
        else if(isGW) lbl=`\n      <bpmndi:BPMNLabel><dc:Bounds x="${p.x-10}" y="${p.y+p.h+5}" width="70" height="27" /></bpmndi:BPMNLabel>`;
      }
      const ga=n.type==='exclusiveGateway'?' isMarkerVisible="true"':'';
      shapes+=`    <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${ga}>\n      <dc:Bounds x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" />${lbl}\n    </bpmndi:BPMNShape>\n`;
    });

    /* BPMNDI edges */
    let edges='';
    flows.forEach(f=>{
      const sp=pos[f.from],tp=pos[f.to]; if(!sp||!tp) return;
      const tn=nById[f.to],sn=nById[f.from];
      const wps=waypoints(sp,tp,sn&&sn.type,tn);
      const wxml=wps.map(([x,y])=>`      <di:waypoint x="${x}" y="${y}" />`).join('\n');
      const lmx=Math.round((wps[0][0]+wps[wps.length-1][0])/2)-12;
      const lmy=Math.round((wps[0][1]+wps[wps.length-1][1])/2)-7;
      const lbl=f.name?`\n      <bpmndi:BPMNLabel><dc:Bounds x="${lmx}" y="${lmy}" width="36" height="14" /></bpmndi:BPMNLabel>`:'';
      edges+=`    <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n${wxml}${lbl}\n    </bpmndi:BPMNEdge>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="BPMN Studio" exporterVersion="7.2">

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
