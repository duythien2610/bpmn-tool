const assert = require('assert');
const { generateBpmn, validateBpmn } = require('./bpmn-service');

async function testParallelGatewayGeneration() {
  const xml = await generateBpmn({
    title: 'Parallel Approval',
    steps: [
      { actor: 'Nhân viên', action: 'Tạo yêu cầu', type: 'userTask' },
      { actor: 'Kho', action: 'Chuẩn bị hàng', gatewayType: 'parallelGateway', type: 'manualTask' },
      { actor: 'Kế toán', action: 'Chuẩn bị chứng từ', gatewayType: 'parallelGateway', type: 'manualTask' },
      { actor: 'Shipper', action: 'Giao hàng', type: 'task' }
    ]
  });

  const parallelGatewayCount = (xml.match(/<bpmn:parallelGateway\b/gi) || []).length;
  assert.ok(parallelGatewayCount >= 2, `expected split/join parallel gateways, got ${parallelGatewayCount}`);
}

async function testBinaryExclusiveDefaultFlow() {
  const xml = await generateBpmn({
    title: 'Binary Validation',
    steps: [
      { actor: 'Hệ thống', action: 'Kiểm tra dữ liệu', condition: 'Hồ sơ không hợp lệ', type: 'serviceTask' },
      { actor: 'Nhân viên', action: 'Xử lý tiếp hồ sơ', condition: 'Hồ sơ hợp lệ', type: 'userTask' },
      { actor: 'Quản lý', action: 'Phê duyệt', type: 'userTask' }
    ]
  });

  const defaultGatewayCount = (xml.match(/<bpmn:exclusiveGateway\b[^>]*\bdefault="/gi) || []).length;
  const conditionExpressionCount = (xml.match(/<bpmn:conditionExpression\b/gi) || []).length;

  assert.strictEqual(defaultGatewayCount, 1, 'expected one exclusive gateway default flow');
  assert.strictEqual(conditionExpressionCount, 1, 'expected only the reject branch to carry a condition expression');
}

async function testValidationHasNoErrorsForGeneratedDiagram() {
  const xml = await generateBpmn({
    title: 'Readable Process',
    steps: [
      { actor: 'Khách hàng', action: 'Gửi yêu cầu', type: 'userTask' },
      { actor: 'Hệ thống', action: 'Ghi nhận và kiểm tra', type: 'serviceTask' },
      { actor: 'Nhân viên', action: 'Hoàn tất xử lý', type: 'userTask' }
    ]
  });

  const result = await validateBpmn(xml);
  assert.strictEqual(result.valid, true, `expected valid diagram, got issues: ${JSON.stringify(result.issues)}`);
}

async function run() {
  await testParallelGatewayGeneration();
  await testBinaryExclusiveDefaultFlow();
  await testValidationHasNoErrorsForGeneratedDiagram();
  console.log('All regression tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
