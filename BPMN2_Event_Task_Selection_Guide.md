# BPMN 2.0 Camunda — Bộ từ điển chọn đúng Event & Task
> Dành cho BA và AI Agent: đọc mô tả nghiệp vụ → nhận dạng keyword → chọn đúng element → dùng XML mẫu

---

## MỤC LỤC

- [PHẦN 1 — TASK TYPES (8 loại)](#phần-1--task-types)
- [PHẦN 2 — START EVENTS (7 loại)](#phần-2--start-events)
- [PHẦN 3 — INTERMEDIATE CATCH EVENTS](#phần-3--intermediate-catch-events)
- [PHẦN 4 — INTERMEDIATE THROW EVENTS](#phần-4--intermediate-throw-events)
- [PHẦN 5 — BOUNDARY EVENTS (gắn vào Task/Sub-Process)](#phần-5--boundary-events)
- [PHẦN 6 — END EVENTS (6 loại)](#phần-6--end-events)
- [PHẦN 7 — BẢNG TRA NHANH THEO KEYWORD](#phần-7--bảng-tra-nhanh-theo-keyword)
- [PHẦN 8 — CAMUNDA-SPECIFIC ATTRIBUTES](#phần-8--camunda-specific-attributes)

---

## PHẦN 1 — TASK TYPES

> **Quy tắc chọn Task:** Ai làm? Hệ thống hay người? Tự động hay thủ công?

---

### 1.1 User Task 👤
**Khi nào dùng:** Con người thực hiện qua giao diện (Tasklist, portal, form). Engine TẠO task và CHỜ người dùng complete.

**Keywords nhận dạng:**
```
phê duyệt / approve / review / duyệt / kiểm tra / xác nhận
điền form / nhập liệu / submit / chọn / quyết định
xử lý yêu cầu / handle request / assign / phân công
nhân viên làm / bộ phận thực hiện / manager xem xét
```

**XML Camunda 7:**
```xml
<bpmn:userTask id="Task_PheDuyet" name="Phê duyệt hồ sơ"
  camunda:assignee="${managerId}"
  camunda:candidateGroups="managers,hr"
  camunda:formKey="embedded:app:forms/approve-form.html"
  camunda:priority="50"
  camunda:dueDate="${dueDate}">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:userTask>
```

**XML Camunda 8 (Zeebe):**
```xml
<bpmn:userTask id="Task_PheDuyet" name="Phê duyệt hồ sơ">
  <bpmn:extensionElements>
    <zeebe:assignmentDefinition assignee="= managerId" candidateGroups="managers"/>
    <zeebe:formDefinition formKey="camunda-forms:bpmn:approveForm"/>
    <zeebe:taskSchedule dueDate="= dueDate" followUpDate="= followUpDate"/>
  </bpmn:extensionElements>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:userTask>
```

---

### 1.2 Service Task ⚙️
**Khi nào dùng:** Hệ thống tự động thực hiện — gọi API, microservice, external system. Không cần người can thiệp.

**Keywords nhận dạng:**
```
gọi API / call API / REST / HTTP request / webhook
tự động / automated / system / engine thực hiện
gửi email qua SMTP / send notification automatically
tích hợp / integrate / sync data / push to system
tính toán tự động / validate automatically
external worker / job worker
```

**XML Camunda 7 — External Task (recommended):**
```xml
<bpmn:serviceTask id="Task_GoiAPI" name="Gọi API thanh toán"
  camunda:type="external"
  camunda:topic="payment-service">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:serviceTask>
```

**XML Camunda 7 — Java Delegate:**
```xml
<bpmn:serviceTask id="Task_ValidateData" name="Validate dữ liệu"
  camunda:delegateExpression="${validateDataDelegate}">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:serviceTask>
```

**XML Camunda 7 — Expression:**
```xml
<bpmn:serviceTask id="Task_TinhToan" name="Tính phí dịch vụ"
  camunda:expression="${feeService.calculate(amount, type)}"
  camunda:resultVariable="calculatedFee">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:serviceTask>
```

**XML Camunda 8 (Zeebe):**
```xml
<bpmn:serviceTask id="Task_GoiAPI" name="Gọi API thanh toán">
  <bpmn:extensionElements>
    <zeebe:taskDefinition type="payment-service" retries="3"/>
    <zeebe:taskHeaders>
      <zeebe:header key="endpoint" value="https://api.payment.com/charge"/>
      <zeebe:header key="method" value="POST"/>
    </zeebe:taskHeaders>
  </bpmn:extensionElements>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:serviceTask>
```

---

### 1.3 Script Task 📜
**Khi nào dùng:** Engine tự chạy script (Groovy, JavaScript, FEEL) — logic đơn giản, không cần external service.

**Keywords nhận dạng:**
```
tính toán / compute / calculate (đơn giản, trong process)
transform data / chuyển đổi dữ liệu
format / parse / convert
business logic nhỏ / rule đơn giản
không cần gọi API ngoài
set variable / gán biến / mapping
```

**XML Camunda 7:**
```xml
<bpmn:scriptTask id="Task_TinhGia" name="Tính giá sau giảm"
  scriptFormat="groovy"
  camunda:resultVariable="finalPrice">
  <bpmn:script>
    def discount = (orderTotal > 1000000) ? 0.1 : 0.0
    finalPrice = orderTotal * (1 - discount)
  </bpmn:script>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:scriptTask>
```

**XML Camunda 7 — JavaScript:**
```xml
<bpmn:scriptTask id="Task_MapData" name="Map dữ liệu"
  scriptFormat="javascript">
  <bpmn:script>
    var result = JSON.parse(responseBody);
    execution.setVariable('customerId', result.id);
    execution.setVariable('status', result.status);
  </bpmn:script>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:scriptTask>
```

> ⚠️ Camunda 8 không hỗ trợ Script Task native — dùng Service Task với job worker thay thế.

---

### 1.4 Business Rule Task 📊
**Khi nào dùng:** Gọi DMN Decision Table để đánh giá rule/logic nghiệp vụ phức tạp. Engine gọi rule engine và nhận kết quả về.

**Keywords nhận dạng:**
```
đánh giá rủi ro / risk assessment
phân loại khách hàng / customer classification / credit score
áp dụng chính sách / apply policy / apply business rule
quyết định tự động dựa trên bảng quy tắc
DMN / decision table / decision logic
xếp loại / categorize / tier / segment
tính điểm / scoring / rating
```

**XML Camunda 7:**
```xml
<bpmn:businessRuleTask id="Task_DanhGiaRuiro" name="Đánh giá rủi ro tín dụng"
  camunda:decisionRef="credit-risk-assessment"
  camunda:decisionRefBinding="latest"
  camunda:resultVariable="riskDecision"
  camunda:mapDecisionResult="singleEntry">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:businessRuleTask>
```

**XML Camunda 8 (Zeebe):**
```xml
<bpmn:businessRuleTask id="Task_DanhGiaRuiro" name="Đánh giá rủi ro tín dụng">
  <bpmn:extensionElements>
    <zeebe:calledDecision decisionId="credit-risk-assessment" resultVariable="riskDecision"/>
  </bpmn:extensionElements>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:businessRuleTask>
```

---

### 1.5 Manual Task ✋
**Khi nào dùng:** Con người thực hiện NGOÀI hệ thống — engine KHÔNG chờ, KHÔNG track. Task xem như hoàn thành ngay khi token đến. Dùng để document thôi.

**Keywords nhận dạng:**
```
thực hiện thủ công / manually / bằng tay
không qua hệ thống / offline action
ký tay / đóng dấu vật lý / fax / in ấn
kiểm tra thực địa / physical inspection / site visit
công việc ngoại tuyến / vận chuyển thực / giao hàng tay
lắp đặt / thi công / sản xuất / vận hành máy móc
```

**XML:**
```xml
<bpmn:manualTask id="Task_KyTay" name="Ký hợp đồng giấy">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:manualTask>
```

> 💡 **Lưu ý:** Engine xử lý Manual Task như None Task — token đi qua ngay. Nếu cần track, dùng User Task thay thế.

---

### 1.6 Send Task ✉️ (Throw)
**Khi nào dùng:** Gửi message đến participant khác (Pool khác). Về mặt implementation giống Service Task.

**Keywords nhận dạng:**
```
gửi thông báo đến / send notification to [external party]
gửi yêu cầu sang / submit request to [other system/org]
thông báo cho bên [đối tác / khách hàng / nhà cung cấp]
publish message / emit event / notify external
gửi email trigger / push message to queue
```

**XML Camunda 7:**
```xml
<bpmn:sendTask id="Task_GuiThongBao" name="Gửi thông báo cho khách hàng"
  camunda:type="external"
  camunda:topic="send-email-notification">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:sendTask>
```

**XML với Message reference:**
```xml
<bpmn:message id="Msg_ThongBao" name="CustomerNotification"/>

<bpmn:sendTask id="Task_GuiThongBao" name="Gửi thông báo">
  <bpmn:messageEventDefinition messageRef="Msg_ThongBao"
    camunda:class="org.example.SendNotificationDelegate"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:sendTask>
```

---

### 1.7 Receive Task 📨 (Catch)
**Khi nào dùng:** Chờ nhận message từ participant khác. Engine DỪNG và CHỜ đến khi message đến.

**Keywords nhận dạng:**
```
chờ phản hồi từ / wait for response from
chờ xác nhận / await confirmation
chờ thanh toán / wait for payment
nhận kết quả từ bên ngoài / receive result from external
poll / subscribe / listen for message
chờ webhook / chờ callback
```

**XML:**
```xml
<bpmn:message id="Msg_PhanHoi" name="CustomerResponse"/>

<bpmn:receiveTask id="Task_ChoPhanhoi" name="Chờ phản hồi khách hàng"
  messageRef="Msg_PhanHoi">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:receiveTask>
```

> 💡 **Receive Task vs Message Catch Event:** Cả hai đều chờ message. Receive Task trực quan hơn cho BA. Message Catch Event dùng khi kết hợp với Event-Based Gateway.

---

### 1.8 Abstract Task / None Task □
**Khi nào dùng:** Chưa xác định loại cụ thể (khi mới phác thảo process), hoặc không cần phân biệt loại task.

**XML:**
```xml
<bpmn:task id="Task_XuLy" name="Xử lý yêu cầu">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:task>
```

---

## PHẦN 2 — START EVENTS

> **Quy tắc:** Start Event = điều gì TRIGGER process bắt đầu?

---

### 2.1 None Start Event ○
**Khi nào dùng:** Trigger không xác định / manual start / gọi trực tiếp qua API.

**Keywords:** `bắt đầu quy trình / start process / khởi tạo / tạo mới / người dùng tạo`

```xml
<bpmn:startEvent id="StartEvent_1" name="Quy trình bắt đầu">
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>
```

---

### 2.2 Message Start Event ✉️○
**Khi nào dùng:** Process bắt đầu khi NHẬN được message từ hệ thống/participant khác.

**Keywords:**
```
nhận được yêu cầu / receive request
đơn hàng được đặt / order placed
tin nhắn đến / message received
email / webhook kích hoạt / API trigger
khách hàng gửi / partner submits
```

```xml
<bpmn:message id="Msg_DonHang" name="OrderReceived"/>

<bpmn:startEvent id="StartEvent_DonHang" name="Đơn hàng nhận được">
  <bpmn:messageEventDefinition messageRef="Msg_DonHang"/>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>
```

---

### 2.3 Timer Start Event ⏱○
**Khi nào dùng:** Process tự động chạy theo lịch — định kỳ, vào thời điểm cụ thể.

**Keywords:**
```
hàng ngày / hàng tuần / hàng tháng / daily / weekly / monthly
lúc 8 giờ sáng / at midnight / at scheduled time
định kỳ / periodic / scheduled / cron job / batch
cuối tháng / end of month / sau 24 giờ / every hour
chạy tự động / auto-run / auto-triggered
```

```xml
<!-- Chạy lúc 8:00 sáng mỗi ngày -->
<bpmn:startEvent id="StartEvent_Daily" name="Hàng ngày lúc 8:00">
  <bpmn:timerEventDefinition>
    <bpmn:timeCycle>0 0 8 * * ?</bpmn:timeCycle>
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>

<!-- Bắt đầu sau 1 ngày -->
<bpmn:startEvent id="StartEvent_Delay" name="Khởi động sau 24h">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>PT24H</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>

<!-- Chạy vào ngày cụ thể -->
<bpmn:startEvent id="StartEvent_Date" name="Chạy vào ngày xác định">
  <bpmn:timerEventDefinition>
    <bpmn:timeDate>2025-12-31T23:59:00</bpmn:timeDate>
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>
```

> **Timer format:** `PT10M` = 10 phút, `PT1H` = 1 giờ, `P1D` = 1 ngày, `P1W` = 1 tuần
> **Cron format:** `0 0 8 * * ?` = 8:00 sáng mỗi ngày (dùng trong timeCycle)

---

### 2.4 Signal Start Event 📡○
**Khi nào dùng:** Process bắt đầu khi nhận Signal broadcast — nhiều process có thể cùng lắng nghe 1 signal.

**Keywords:**
```
sự kiện hệ thống / system event broadcast
tất cả các quy trình liên quan / all related processes start
khi [sự kiện X] xảy ra ở bất kỳ đâu / when event X happens anywhere
signal / broadcast / notify all subscribers
emergency / alert / global event trigger
```

```xml
<bpmn:signal id="Signal_HeThongLoi" name="SystemFailureAlert"/>

<bpmn:startEvent id="StartEvent_Alert" name="Nhận cảnh báo hệ thống">
  <bpmn:signalEventDefinition signalRef="Signal_HeThongLoi"/>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>
```

---

### 2.5 Error Start Event ⚠️○ (chỉ trong Event Sub-Process)
**Khi nào dùng:** Bắt lỗi trong Sub-Process cha để xử lý exception.

**Keywords:** `khi xảy ra lỗi / on error / exception handling / catch error / rollback`

```xml
<!-- Dùng trong Event Sub-Process -->
<bpmn:subProcess id="SubProcess_ErrorHandler" triggeredByEvent="true">
  <bpmn:startEvent id="StartEvent_Error" name="Lỗi hệ thống xảy ra" isInterrupting="true">
    <bpmn:errorEventDefinition errorRef="Error_HeThong"/>
    <bpmn:outgoing>SF_Error_1</bpmn:outgoing>
  </bpmn:startEvent>
</bpmn:subProcess>

<bpmn:error id="Error_HeThong" name="SystemError" errorCode="SYS_ERR_001"/>
```

---

### 2.6 Conditional Start Event ◇○
**Khi nào dùng:** Process bắt đầu khi một điều kiện dữ liệu được thỏa mãn (ít dùng trong Camunda).

**Keywords:** `khi điều kiện / when condition becomes true / triggered by data change`

```xml
<bpmn:startEvent id="StartEvent_Condition" name="Điều kiện thỏa mãn">
  <bpmn:conditionalEventDefinition>
    <bpmn:condition xsi:type="bpmn:tFormalExpression">${stockLevel < minimumStock}</bpmn:condition>
  </bpmn:conditionalEventDefinition>
  <bpmn:outgoing>SF_1</bpmn:outgoing>
</bpmn:startEvent>
```

---

### 2.7 Escalation Start Event ↑○ (chỉ trong Event Sub-Process)
**Khi nào dùng:** Bắt escalation từ Sub-Process con, xử lý leo thang không làm interrupt.

**Keywords:** `leo thang / escalate / cần xử lý cấp cao hơn / non-interrupting escalation`

```xml
<bpmn:escalation id="Escalation_1" name="NeedsManagerReview" escalationCode="MGMT_REVIEW"/>

<bpmn:subProcess id="SubProcess_Escalation" triggeredByEvent="true">
  <bpmn:startEvent id="StartEvent_Escalation" name="Cần xem xét cấp quản lý" isInterrupting="false">
    <bpmn:escalationEventDefinition escalationRef="Escalation_1"/>
    <bpmn:outgoing>SF_Esc_1</bpmn:outgoing>
  </bpmn:startEvent>
</bpmn:subProcess>
```

---

## PHẦN 3 — INTERMEDIATE CATCH EVENTS

> Process DỪNG và CHỜ sự kiện xảy ra mới tiếp tục.

---

### 3.1 Timer Intermediate Catch Event ⏱
**Keywords:** `chờ X giờ / wait / delay / sau khi / pause / sleep / cooling period`

```xml
<!-- Chờ 30 phút -->
<bpmn:intermediateCatchEvent id="Event_Cho30p" name="Chờ 30 phút">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>PT30M</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateCatchEvent>

<!-- Chờ đến ngày xác định -->
<bpmn:intermediateCatchEvent id="Event_ChoNgay" name="Chờ đến ngày thanh toán">
  <bpmn:timerEventDefinition>
    <bpmn:timeDate>= dueDate</bpmn:timeDate>
  </bpmn:timerEventDefinition>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateCatchEvent>
```

---

### 3.2 Message Intermediate Catch Event ✉️
**Keywords:** `chờ phản hồi / wait for reply / chờ callback / chờ xác nhận từ / await message`

```xml
<bpmn:message id="Msg_XacNhan" name="PaymentConfirmation"/>

<bpmn:intermediateCatchEvent id="Event_ChoXacNhan" name="Chờ xác nhận thanh toán">
  <bpmn:messageEventDefinition messageRef="Msg_XacNhan"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateCatchEvent>
```

---

### 3.3 Signal Intermediate Catch Event 📡
**Keywords:** `chờ signal / chờ broadcast / chờ sự kiện hệ thống / listen for signal`

```xml
<bpmn:signal id="Signal_DongBo" name="DataSyncComplete"/>

<bpmn:intermediateCatchEvent id="Event_ChoDongBo" name="Chờ đồng bộ dữ liệu">
  <bpmn:signalEventDefinition signalRef="Signal_DongBo"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateCatchEvent>
```

---

### 3.4 Conditional Intermediate Catch Event ◇
**Keywords:** `tiếp tục khi / proceed when condition / chờ đến khi điều kiện đúng`

```xml
<bpmn:intermediateCatchEvent id="Event_DieuKien" name="Chờ điều kiện thỏa">
  <bpmn:conditionalEventDefinition>
    <bpmn:condition xsi:type="bpmn:tFormalExpression">${approved == true}</bpmn:condition>
  </bpmn:conditionalEventDefinition>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateCatchEvent>
```

---

### 3.5 Link Intermediate Catch Event 🔗
**Keywords:** `kết nối đến / goto / jump to / tiếp tục từ [điểm X] / connector`

```xml
<!-- Catch (điểm đến) -->
<bpmn:intermediateCatchEvent id="LinkCatch_A" name="Tiếp tục từ đây">
  <bpmn:linkEventDefinition name="LinkPoint_A"/>
  <bpmn:outgoing>SF_After_Link</bpmn:outgoing>
</bpmn:intermediateCatchEvent>
```

---

## PHẦN 4 — INTERMEDIATE THROW EVENTS

> Process PHÁT ra sự kiện và tiếp tục ngay (không chờ).

---

### 4.1 None Intermediate Throw Event ○ (Milestone)
**Khi nào dùng:** Đánh dấu milestone, checkpoint quan trọng trong process. Không trigger gì cả.

**Keywords:** `milestone đạt được / checkpoint / giai đoạn X hoàn thành / bước quan trọng`

```xml
<bpmn:intermediateThrowEvent id="Event_Milestone" name="Giai đoạn 1 hoàn thành">
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateThrowEvent>
```

---

### 4.2 Message Intermediate Throw Event ✉️ (filled)
**Khi nào dùng:** Gửi message đến hệ thống khác và tiếp tục ngay (fire-and-forget kiểu async).

**Keywords:** `gửi thông báo / publish event / notify [external] / emit message / push to queue`

```xml
<bpmn:intermediateThrowEvent id="Event_GuiMessage" name="Gửi thông báo đến ERP">
  <bpmn:messageEventDefinition
    camunda:class="org.example.SendToERPDelegate"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateThrowEvent>
```

---

### 4.3 Signal Intermediate Throw Event 📡 (filled)
**Khi nào dùng:** Broadcast signal đến nhiều process đang lắng nghe (1-to-many).

**Keywords:** `broadcast / thông báo toàn hệ thống / alert all / notify all listeners / trigger nhiều process`

```xml
<bpmn:signal id="Signal_HoanTat" name="OrderFulfilled"/>

<bpmn:intermediateThrowEvent id="Event_Broadcast" name="Phát broadcast hoàn thành đơn hàng">
  <bpmn:signalEventDefinition signalRef="Signal_HoanTat"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateThrowEvent>
```

---

### 4.4 Escalation Intermediate Throw Event ↑ (filled)
**Khi nào dùng:** Leo thang lên Sub-Process cha để xử lý (non-interrupting — process vẫn chạy tiếp).

**Keywords:** `cần leo thang / escalate to manager / báo cáo lên cấp trên / SLA sắp vi phạm`

```xml
<bpmn:escalation id="Esc_SLA" name="SLABreach" escalationCode="SLA_001"/>

<bpmn:intermediateThrowEvent id="Event_Escalate" name="Leo thang: SLA sắp vi phạm">
  <bpmn:escalationEventDefinition escalationRef="Esc_SLA"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateThrowEvent>
```

---

### 4.5 Compensation Intermediate Throw Event ⇦ (filled)
**Khi nào dùng:** Kích hoạt compensation (rollback) cho một activity đã hoàn thành.

**Keywords:** `hoàn tác / undo / rollback / cancel đã thực hiện / bù trừ / compensation / reverse`

```xml
<bpmn:intermediateThrowEvent id="Event_Compensate" name="Hoàn tác thanh toán">
  <bpmn:compensateEventDefinition activityRef="Task_ThanhToan"/>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:intermediateThrowEvent>

<!-- Compensation Task (kết nối bằng Association, không phải Sequence Flow) -->
<bpmn:task id="Task_HoanTienHang" name="Hoàn tiền cho khách"
  isForCompensation="true">
</bpmn:task>

<bpmn:association id="Assoc_Comp" associationDirection="One"
  sourceRef="Event_Compensate" targetRef="Task_HoanTienHang"/>
```

---

### 4.6 Link Intermediate Throw Event 🔗
**Keywords:** `chuyển đến / jump to / goto / off-page connector`

```xml
<!-- Throw (điểm đi) -->
<bpmn:intermediateThrowEvent id="LinkThrow_A" name="Chuyển đến điểm A">
  <bpmn:linkEventDefinition name="LinkPoint_A"/>
  <bpmn:incoming>SF_Before_Link</bpmn:incoming>
</bpmn:intermediateThrowEvent>
```

---

## PHẦN 5 — BOUNDARY EVENTS

> Gắn vào Task hoặc Sub-Process — xử lý khi sự kiện xảy ra TRONG LÚC task đang chạy.

**Hai loại:**
- **Interrupting** (solid border): Hủy task, đi theo exception path
- **Non-Interrupting** (dashed border, `cancelActivity="false"`): Task vẫn chạy, tạo thêm luồng

---

### 5.1 Timer Boundary Event ⏱ — TIMEOUT
**Keywords:**
```
timeout / hết thời gian / quá hạn / SLA vi phạm
nếu sau X phút không xong / if not completed in X hours
nhắc nhở sau Y phút / reminder every Z minutes
deadline / escalate if overdue
```

**Interrupting (hủy task nếu timeout):**
```xml
<bpmn:boundaryEvent id="Boundary_Timeout" name="Timeout 4 giờ"
  attachedToRef="Task_XuLyDon"
  cancelActivity="true">
  <bpmn:timerEventDefinition>
    <bpmn:timeDuration>PT4H</bpmn:timeDuration>
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>SF_Timeout</bpmn:outgoing>
</bpmn:boundaryEvent>
```

**Non-Interrupting (gửi nhắc nhở, task vẫn chạy):**
```xml
<bpmn:boundaryEvent id="Boundary_Reminder" name="Nhắc nhở mỗi giờ"
  attachedToRef="Task_PheDuyet"
  cancelActivity="false">
  <bpmn:timerEventDefinition>
    <bpmn:timeCycle>PT1H</bpmn:timeCycle>
  </bpmn:timerEventDefinition>
  <bpmn:outgoing>SF_Remind</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

### 5.2 Error Boundary Event ⚠️ — BUSINESS ERROR
**Keywords:**
```
nếu xảy ra lỗi / if error occurs / khi thất bại / on failure
lỗi nghiệp vụ / business error / exception path
thử lại / retry sau khi lỗi / fallback
API trả lỗi / service unavailable / invalid data
```

```xml
<bpmn:error id="Error_API" name="APICallFailed" errorCode="API_ERROR"/>

<bpmn:boundaryEvent id="Boundary_Error" name="Lỗi gọi API"
  attachedToRef="Task_GoiAPI"
  cancelActivity="true">
  <bpmn:errorEventDefinition errorRef="Error_API"
    camunda:errorCodeVariable="errorCode"
    camunda:errorMessageVariable="errorMessage"/>
  <bpmn:outgoing>SF_ErrorPath</bpmn:outgoing>
</bpmn:boundaryEvent>

<!-- Bắt mọi lỗi (không chỉ định errorRef) -->
<bpmn:boundaryEvent id="Boundary_AnyError" name="Mọi lỗi"
  attachedToRef="Task_XuLy"
  cancelActivity="true">
  <bpmn:errorEventDefinition/>
  <bpmn:outgoing>SF_ErrorPath</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

### 5.3 Message Boundary Event ✉️
**Keywords:**
```
trong khi chờ / during processing nhận được tin nhắn hủy
khách hàng cancel / customer cancels while [task] is running
tin nhắn đến trong lúc / interrupt by incoming message
```

**Interrupting:**
```xml
<bpmn:message id="Msg_Cancel" name="OrderCancellation"/>

<bpmn:boundaryEvent id="Boundary_Cancel" name="Khách hàng hủy đơn"
  attachedToRef="Task_XuLyDon"
  cancelActivity="true">
  <bpmn:messageEventDefinition messageRef="Msg_Cancel"/>
  <bpmn:outgoing>SF_CancelPath</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

### 5.4 Signal Boundary Event 📡
**Keywords:**
```
nhận signal trong khi / receives signal while processing
system alert during / broadcast nhận khi task đang chạy
emergency stop / force stop / global interrupt
```

```xml
<bpmn:signal id="Signal_Emergency" name="EmergencyStop"/>

<bpmn:boundaryEvent id="Boundary_Emergency" name="Dừng khẩn cấp"
  attachedToRef="Task_SanXuat"
  cancelActivity="true">
  <bpmn:signalEventDefinition signalRef="Signal_Emergency"/>
  <bpmn:outgoing>SF_EmergencyPath</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

### 5.5 Escalation Boundary Event ↑
**Keywords:**
```
leo thang trong lúc / escalate during task / cần cấp trên xử lý
SLA warning nhưng task vẫn chạy / parallel escalation
gửi cảnh báo không dừng task
```

**Non-Interrupting (hay dùng nhất với escalation):**
```xml
<bpmn:escalation id="Esc_Warn" name="SLAWarning" escalationCode="SLA_WARN"/>

<bpmn:boundaryEvent id="Boundary_Escalation" name="Cảnh báo SLA"
  attachedToRef="Task_XuLyPhieu"
  cancelActivity="false">
  <bpmn:escalationEventDefinition escalationRef="Esc_Warn"
    camunda:escalationCodeVariable="escalationCode"/>
  <bpmn:outgoing>SF_NotifyManager</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

### 5.6 Compensation Boundary Event ⇦
**Keywords:** `compensation handler / rollback task / hoàn tác [task cụ thể]`

```xml
<bpmn:boundaryEvent id="Boundary_Comp" attachedToRef="Task_ThanhToan"
  cancelActivity="true">
  <bpmn:compensateEventDefinition/>
</bpmn:boundaryEvent>

<bpmn:task id="Task_HoanTien" name="Hoàn tiền" isForCompensation="true"/>
<bpmn:association sourceRef="Boundary_Comp" targetRef="Task_HoanTien"/>
```

---

### 5.7 Conditional Boundary Event ◇
**Keywords:** `dừng khi điều kiện / stop if condition / interrupt when variable changes`

```xml
<bpmn:boundaryEvent id="Boundary_Cond" attachedToRef="Task_PheDuyet"
  cancelActivity="true">
  <bpmn:conditionalEventDefinition>
    <bpmn:condition xsi:type="bpmn:tFormalExpression">${budgetExceeded == true}</bpmn:condition>
  </bpmn:conditionalEventDefinition>
  <bpmn:outgoing>SF_CondPath</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

## PHẦN 6 — END EVENTS

> **Quy tắc:** End Event = trạng thái KẾT THÚC của process là gì?

---

### 6.1 None End Event ○ (filled)
**Khi nào dùng:** Kết thúc bình thường, không trigger gì thêm.

**Keywords:** `hoàn thành / completed / done / xong / kết thúc bình thường`

```xml
<bpmn:endEvent id="EndEvent_1" name="Quy trình hoàn tất">
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.2 Message End Event ✉️ (filled)
**Khi nào dùng:** Khi kết thúc, gửi message đến participant khác.

**Keywords:** `gửi thông báo kết thúc / notify on completion / send result to / inform external on end`

```xml
<bpmn:endEvent id="EndEvent_ThongBao" name="Gửi thông báo hoàn tất">
  <bpmn:messageEventDefinition
    camunda:class="org.example.SendCompletionNotification"/>
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.3 Error End Event ⚠️ (filled)
**Khi nào dùng:** Kết thúc bằng lỗi nghiệp vụ — lỗi này sẽ được bắt bởi Error Boundary của Sub-Process cha.

**Keywords:**
```
thất bại / failed / rejected với lý do kỹ thuật/nghiệp vụ
lỗi không thể recover / unrecoverable error
vi phạm điều kiện / constraint violation
kết thúc bất thường / abnormal termination
throw error to parent
```

```xml
<bpmn:error id="Error_TuChoi" name="ApplicationRejected" errorCode="REJECTED"/>

<bpmn:endEvent id="EndEvent_LoiNghiepVu" name="Từ chối - lỗi nghiệp vụ">
  <bpmn:errorEventDefinition errorRef="Error_TuChoi"/>
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.4 Signal End Event 📡 (filled)
**Khi nào dùng:** Broadcast signal khi process kết thúc — notify nhiều process khác.

**Keywords:** `broadcast khi kết thúc / signal all listeners on completion / global notify on end`

```xml
<bpmn:signal id="Signal_OrderDone" name="OrderProcessingComplete"/>

<bpmn:endEvent id="EndEvent_Signal" name="Phát tín hiệu hoàn tất">
  <bpmn:signalEventDefinition signalRef="Signal_OrderDone"/>
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.5 Terminate End Event ⊗ (filled, X trong vòng tròn)
**Khi nào dùng:** Hủy TOÀN BỘ process ngay lập tức — kể cả các parallel branch đang chạy.

**Keywords:**
```
hủy toàn bộ / cancel all / terminate immediately / abort
kill process / force stop / chấm dứt tất cả
không cần hoàn thành bước khác / discard all pending
khi phát hiện gian lận / fraud detected — terminate
emergency abort
```

```xml
<bpmn:endEvent id="EndEvent_Terminate" name="Hủy toàn bộ - phát hiện gian lận">
  <bpmn:terminateEventDefinition/>
  <bpmn:incoming>SF_Fraud</bpmn:incoming>
</bpmn:endEvent>
```

> ⚠️ **QUAN TRỌNG:** Terminate End trong Sub-Process sẽ kết thúc **TOÀN BỘ** process cha, không chỉ Sub-Process. Nếu chỉ muốn kết thúc Sub-Process, dùng **None End Event**.

---

### 6.6 Escalation End Event ↑ (filled)
**Khi nào dùng:** Kết thúc Sub-Process bằng cách leo thang lên process cha (non-interrupting).

**Keywords:** `leo thang khi kết thúc / escalate on completion / notify parent on end`

```xml
<bpmn:escalation id="Esc_Done" name="SubProcessEscalated" escalationCode="ESC_001"/>

<bpmn:endEvent id="EndEvent_Escalation" name="Leo thang lên process cha">
  <bpmn:escalationEventDefinition escalationRef="Esc_Done"/>
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.7 Compensation End Event ⇦ (filled)
**Khi nào dùng:** Kích hoạt compensation cho toàn bộ Sub-Process.

**Keywords:** `rollback toàn bộ / undo all steps / compensate all completed activities`

```xml
<bpmn:endEvent id="EndEvent_Comp" name="Hoàn tác toàn bộ giao dịch">
  <bpmn:compensateEventDefinition/>
  <bpmn:incoming>SF_Last</bpmn:incoming>
</bpmn:endEvent>
```

---

### 6.8 Cancel End Event ✕ (chỉ trong Transaction Sub-Process)
**Khi nào dùng:** Hủy Transaction, kích hoạt Cancel Boundary trên Transaction Sub-Process.

**Keywords:** `hủy giao dịch / cancel transaction / rollback transaction / saga cancel`

```xml
<!-- Chỉ dùng TRONG Transaction Sub-Process -->
<bpmn:subProcess id="SubProcess_Transaction">
  <!-- ... các tasks trong transaction ... -->
  <bpmn:endEvent id="EndEvent_Cancel" name="Hủy giao dịch">
    <bpmn:cancelEventDefinition/>
    <bpmn:incoming>SF_Last</bpmn:incoming>
  </bpmn:endEvent>
</bpmn:subProcess>

<!-- Cancel Boundary trên Transaction Sub-Process -->
<bpmn:boundaryEvent id="Boundary_CancelTx" attachedToRef="SubProcess_Transaction"
  cancelActivity="true">
  <bpmn:cancelEventDefinition/>
  <bpmn:outgoing>SF_AfterCancel</bpmn:outgoing>
</bpmn:boundaryEvent>
```

---

## PHẦN 7 — BẢNG TRA NHANH THEO KEYWORD

### 7.1 Keywords → Task Type

| Keyword xuất hiện trong mô tả | → Dùng Element |
|---|---|
| phê duyệt, duyệt, review, approve, confirm | **User Task** |
| nhập liệu, điền form, submit, chọn option | **User Task** |
| gọi API, REST, call service, integrate | **Service Task** |
| tự động, automated, system executes | **Service Task** |
| gửi email (auto), push notification (auto) | **Service Task** |
| external worker, job worker, async task | **Service Task** (external) |
| tính toán, calculate, transform, convert | **Script Task** |
| business rule, DMN, decision table | **Business Rule Task** |
| risk score, credit rating, classify, categorize | **Business Rule Task** |
| ký tay, đóng dấu, in ấn, ngoại tuyến | **Manual Task** |
| kiểm tra thực địa, vận chuyển vật lý | **Manual Task** |
| gửi message sang pool khác, notify partner | **Send Task** |
| chờ phản hồi, wait for reply, await confirm | **Receive Task** |
| chưa xác định, abstract, placeholder | **None Task** |

---

### 7.2 Keywords → Start Event Type

| Keyword | → Start Event |
|---|---|
| bắt đầu thủ công, start manually, API call | **None** |
| nhận email, receive order, message arrives | **Message** |
| hàng ngày, định kỳ, cron, scheduled | **Timer** |
| khi điều kiện, when X is true | **Conditional** |
| broadcast trigger, system signal | **Signal** |
| khi lỗi xảy ra (trong sub-process) | **Error** (Event SubProcess) |
| leo thang (trong sub-process) | **Escalation** (Event SubProcess) |

---

### 7.3 Keywords → Boundary Event Type

| Tình huống mô tả | → Boundary Event |
|---|---|
| timeout X giờ → hủy task | **Timer** Interrupting |
| nhắc nhở mỗi X phút, task vẫn chạy | **Timer** Non-Interrupting |
| lỗi API, exception → xử lý lỗi | **Error** Interrupting |
| khách hàng hủy trong lúc đang xử lý | **Message** Interrupting |
| cảnh báo SLA, task vẫn tiếp tục | **Escalation** Non-Interrupting |
| nhận signal dừng khẩn cấp | **Signal** Interrupting |
| compensation handler cho task | **Compensation** |
| điều kiện thay đổi → dừng task | **Conditional** |

---

### 7.4 Keywords → End Event Type

| Trạng thái kết thúc | → End Event |
|---|---|
| hoàn thành bình thường | **None** |
| gửi thông báo khi xong | **Message** |
| broadcast khi xong | **Signal** |
| lỗi nghiệp vụ, reject, error code | **Error** |
| hủy toàn bộ, abort all, terminate now | **Terminate** |
| leo thang lên sub-process cha | **Escalation** |
| rollback toàn bộ | **Compensation** |
| hủy transaction (saga) | **Cancel** |

---

### 7.5 Keywords → Intermediate Event Type

| Tình huống trong giữa process | → Intermediate Event |
|---|---|
| chờ X phút/giờ rồi tiếp tục | **Timer Catch** |
| chờ phản hồi rồi tiếp tục | **Message Catch** |
| chờ signal rồi tiếp tục | **Signal Catch** |
| milestone đạt được | **None Throw** |
| gửi message không cần chờ | **Message Throw** |
| broadcast signal | **Signal Throw** |
| leo thang nhưng tiếp tục | **Escalation Throw** |
| rollback một bước | **Compensation Throw** |
| nối hai phần diagram dài | **Link Throw + Link Catch** |

---

## PHẦN 8 — CAMUNDA-SPECIFIC ATTRIBUTES

### 8.1 Service Task — các cách implement

```xml
<!-- Cách 1: External Task (Recommended - Camunda 7) -->
<bpmn:serviceTask camunda:type="external" camunda:topic="my-topic"/>

<!-- Cách 2: Java Delegate -->
<bpmn:serviceTask camunda:class="com.example.MyDelegate"/>

<!-- Cách 3: Delegate Expression (Spring Bean) -->
<bpmn:serviceTask camunda:delegateExpression="${myBean}"/>

<!-- Cách 4: Expression (method call) -->
<bpmn:serviceTask camunda:expression="${myService.doSomething(var1)}"
  camunda:resultVariable="result"/>

<!-- Cách 5: Connector -->
<bpmn:serviceTask>
  <bpmn:extensionElements>
    <camunda:connector>
      <camunda:connectorId>http-connector</camunda:connectorId>
      <camunda:inputOutput>
        <camunda:inputParameter name="url">https://api.example.com</camunda:inputParameter>
        <camunda:inputParameter name="method">POST</camunda:inputParameter>
      </camunda:inputOutput>
    </camunda:connector>
  </bpmn:extensionElements>
</bpmn:serviceTask>
```

---

### 8.2 User Task — Assignment

```xml
<bpmn:userTask id="Task_1"
  camunda:assignee="${initiator}"           <!-- Giao cho 1 người cụ thể -->
  camunda:candidateUsers="alice,bob"        <!-- Danh sách người có thể claim -->
  camunda:candidateGroups="managers,hr"     <!-- Nhóm có thể claim -->
  camunda:dueDate="${dueDate}"              <!-- Deadline -->
  camunda:followUpDate="${followUpDate}"    <!-- Follow-up date -->
  camunda:priority="50"                     <!-- Độ ưu tiên 0-100 -->
  camunda:formKey="embedded:app:forms/my-form.html"> <!-- Form hiển thị -->
</bpmn:userTask>
```

---

### 8.3 Async / Transaction Boundary

```xml
<!-- Async Before: job được tạo TRƯỚC khi execute task -->
<bpmn:serviceTask id="Task_1" camunda:asyncBefore="true">...</bpmn:serviceTask>

<!-- Async After: job được tạo SAU khi task hoàn thành -->
<bpmn:serviceTask id="Task_1" camunda:asyncAfter="true">...</bpmn:serviceTask>

<!-- Exclusive: đảm bảo chỉ 1 job chạy cùng lúc cho process instance -->
<bpmn:serviceTask id="Task_1" camunda:exclusive="true">...</bpmn:serviceTask>
```

---

### 8.4 Multi-Instance (dùng cho cả Task lẫn Sub-Process)

```xml
<!-- Parallel Multi-Instance (song song) -->
<bpmn:userTask id="Task_ReviewAll" name="Review từng mục">
  <bpmn:multiInstanceLoopCharacteristics isSequential="false">
    <bpmn:loopDataInputRef>itemList</bpmn:loopDataInputRef>
    <bpmn:inputDataItem name="item"/>
    <bpmn:completionCondition xsi:type="bpmn:tFormalExpression">
      ${nrOfCompletedInstances/nrOfInstances >= 0.6}
    </bpmn:completionCondition>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>

<!-- Sequential Multi-Instance (tuần tự) -->
<bpmn:userTask id="Task_SendEach" name="Gửi từng email">
  <bpmn:multiInstanceLoopCharacteristics isSequential="true">
    <bpmn:loopDataInputRef>recipientList</bpmn:loopDataInputRef>
    <bpmn:inputDataItem name="recipient"/>
  </bpmn:multiInstanceLoopCharacteristics>
</bpmn:userTask>
```

---

### 8.5 Call Activity — Gọi Sub-Process ngoài

```xml
<bpmn:callActivity id="CallAct_OnBoarding" name="Gọi quy trình Onboarding"
  calledElement="Process_Onboarding"
  camunda:calledElementBinding="latest">
  <bpmn:extensionElements>
    <camunda:in source="customerId" target="customerId"/>
    <camunda:out source="onboardingResult" target="onboardingResult"/>
  </bpmn:extensionElements>
  <bpmn:incoming>SF_1</bpmn:incoming>
  <bpmn:outgoing>SF_2</bpmn:outgoing>
</bpmn:callActivity>
```

---

### 8.6 Timer Format Reference

| Biểu diễn | Ý nghĩa | Dùng trong |
|---|---|---|
| `PT30S` | 30 giây | timeDuration |
| `PT10M` | 10 phút | timeDuration |
| `PT4H` | 4 giờ | timeDuration |
| `P1D` | 1 ngày | timeDuration |
| `P1W` | 1 tuần | timeDuration |
| `P1M` | 1 tháng | timeDuration |
| `2025-12-31T08:00:00` | Ngày giờ cụ thể | timeDate |
| `0 0 8 * * ?` | 8:00 sáng mỗi ngày | timeCycle (cron) |
| `R3/PT1H` | Lặp 3 lần, mỗi 1 giờ | timeCycle (ISO) |
| `R/P1D` | Lặp vô hạn mỗi ngày | timeCycle (ISO) |

---

### 8.7 Error & Escalation Reference

```xml
<!-- Khai báo Error (trong definitions) -->
<bpmn:error id="Error_1" name="ValidationError" errorCode="VAL_001"/>
<bpmn:error id="Error_2" name="SystemError" errorCode="SYS_ERROR"/>

<!-- Khai báo Escalation (trong definitions) -->
<bpmn:escalation id="Esc_1" name="ManagerApprovalNeeded" escalationCode="MGR_NEEDED"/>

<!-- Khai báo Signal (trong definitions) -->
<bpmn:signal id="Sig_1" name="OrderCanceled"/>

<!-- Khai báo Message (trong definitions) -->
<bpmn:message id="Msg_1" name="PaymentReceived"/>
```

---

## QUYẾT ĐỊNH NHANH — FLOWCHART CHỌN ELEMENT

```
Mô tả nghiệp vụ
│
├─ AI/System làm? ──────────────────────────────────────┐
│   ├─ Gọi API/service → SERVICE TASK                   │
│   ├─ Tính toán script → SCRIPT TASK                   │
│   ├─ Đánh giá DMN rule → BUSINESS RULE TASK           │
│   ├─ Gửi message sang Pool → SEND TASK                │
│   └─ Chờ message từ Pool → RECEIVE TASK               │
│                                                        │
├─ Người làm?                                            │
│   ├─ Qua hệ thống/form → USER TASK                    │
│   └─ Ngoài hệ thống → MANUAL TASK                     │
│                                                        │
├─ Trigger bắt đầu?                                      │
│   ├─ Thủ công → NONE START                            │
│   ├─ Nhận message → MESSAGE START                     │
│   ├─ Theo lịch → TIMER START                          │
│   ├─ Signal broadcast → SIGNAL START                  │
│   └─ Điều kiện → CONDITIONAL START                    │
│                                                        │
├─ Chờ giữa chừng?                                       │
│   ├─ Chờ thời gian → TIMER CATCH                      │
│   ├─ Chờ message → MESSAGE CATCH                      │
│   └─ Chờ signal → SIGNAL CATCH                        │
│                                                        │
├─ Xử lý exception trên Task?                            │
│   ├─ Timeout → TIMER BOUNDARY                         │
│   ├─ Lỗi API/system → ERROR BOUNDARY                  │
│   ├─ Nhận cancel message → MESSAGE BOUNDARY           │
│   └─ SLA cảnh báo → ESCALATION BOUNDARY (non-int)     │
│                                                        │
└─ Kết thúc?                                             │
    ├─ Bình thường → NONE END                           │
    ├─ Gửi notify → MESSAGE END                         │
    ├─ Hủy tất cả → TERMINATE END                       │
    ├─ Lỗi nghiệp vụ → ERROR END                        │
    └─ Rollback → COMPENSATION END                      │
```

---

## REFERENCES

- Camunda 8 Events Docs: https://docs.camunda.io/docs/components/modeler/bpmn/events/
- Camunda 8 Timer Events: https://docs.camunda.io/docs/components/modeler/bpmn/timer-events/
- Camunda 8 Message Events: https://docs.camunda.io/docs/components/modeler/bpmn/message-events/
- Camunda 8 Signal Events: https://docs.camunda.io/docs/components/modeler/bpmn/signal-events/
- Camunda 7 BPMN Reference: https://docs.camunda.org/manual/latest/reference/bpmn20/
- Camunda 7 External Tasks: https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/
- BPMN 2.0 Symbol Guide: https://camunda.com/bpmn/reference/
