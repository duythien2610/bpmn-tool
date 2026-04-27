const { generateBpmn } = require('./bpmn-service');

const steps = [
  { actor: 'Khách hàng', action: 'Đặt hàng online', condition: '', type: 'userTask' },
  { actor: 'Nhân viên', action: 'Xác nhận đơn hàng', condition: '', type: 'userTask' },
  { actor: 'Hệ thống', action: 'Kiểm tra kho tự động', condition: 'Còn hàng', type: 'serviceTask' },
  { actor: 'Nhân viên', action: 'Đóng gói hàng', condition: '', type: 'manualTask' },
  { actor: 'Shipper', action: 'Giao hàng cho khách', condition: '', type: 'task' },
  { actor: 'Khách hàng', action: 'Xác nhận nhận hàng', condition: '', type: 'userTask' },
];

async function test() {
  console.log('Testing bpmn-service generateBpmn...');
  const t0 = Date.now();
  try {
    const xml = await generateBpmn({ title: 'Quy trình mua hàng', steps });
    const elapsed = Date.now() - t0;
    console.log(`✅ SUCCESS in ${elapsed}ms`);
    console.log('XML length:', xml.length);
    
    // Check for key structure
    const hasDI = xml.includes('BPMNDiagram');
    const hasLane = xml.includes('bpmn:lane') || xml.includes('bpmn:laneSet');
    const hasStartEvent = xml.includes('startEvent');
    const hasEndEvent = xml.includes('endEvent');
    const hasWaypoints = xml.includes('waypoint') || xml.includes('Bounds');
    
    console.log('Has BPMNDiagram (DI):', hasDI);
    console.log('Has lanes:', hasLane);
    console.log('Has start event:', hasStartEvent);
    console.log('Has end event:', hasEndEvent);
    console.log('Has positions/waypoints:', hasWaypoints);
    
    require('fs').writeFileSync('test-output.bpmn', xml);
    console.log('\nSaved to test-output.bpmn');
    console.log('\nFirst 600 chars of XML:');
    console.log(xml.substring(0, 600));
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    console.error(e.stack);
  }
}

test();
