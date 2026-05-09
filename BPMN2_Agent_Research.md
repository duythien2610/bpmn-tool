# BPMN 2.0 — Research Toàn Diện cho Agent Builder (Camunda)

> Tổng hợp từ: OMG BPMN 2.0.2 Spec, Camunda Docs, Signavio, Bruce Silver M&S, arxiv research (2025)

---

## MỤC LỤC

1. [Tổng quan kiến trúc BPMN 2.0](#1-tổng-quan)
2. [Phân loại Element đầy đủ](#2-phân-loại-element)
3. [Quy tắc Pool & Lane](#3-pool--lane-rules)
4. [Events — đầy đủ 9 loại trigger](#4-events)
5. [Activities — Tasks & Sub-Processes](#5-activities)
6. [Gateways — 5 loại](#6-gateways)
7. [Connecting Objects — Flow Rules](#7-connecting-objects)
8. [Artifacts & Data](#8-artifacts--data)
9. [XML Structure & BPMNDI](#9-xml-structure--bpmndi)
10. [Quy tắc Validation cứng (Hard Rules)](#10-hard-validation-rules)
11. [Naming Conventions (Bruce Silver M&S)](#11-naming-conventions)
12. [Common Mistakes của LLM Agent](#12-common-mistakes)
13. [Prompt Engineering cho Agent BPMN](#13-prompt-engineering)
14. [Checklist trước khi output XML](#14-final-checklist)

---

## 1. TỔNG QUAN

### Ba loại diagram trong BPMN 2.0

| Loại | Mô tả | Dùng khi |
|---|---|---|
| **Process Diagram** | Một participant, nội bộ | Mô tả quy trình của 1 tổ chức |
| **Collaboration Diagram** | Nhiều Pool giao tiếp | Nhiều participant trao đổi message |
| **Choreography Diagram** | Tập trung vào message exchange | Ít dùng trong BA thực tế |

### Ba loại Process

| Loại | Mô tả |
|---|---|
| **Private (executable)** | Trong 1 pool kín, có thể deploy lên engine |
| **Private (non-executable)** | Chỉ để document, không deploy |
| **Public** | Chỉ thể hiện phần interaction với bên ngoài |

---

## 2. PHÂN LOẠI ELEMENT

### 2.1 Flow Objects (3 nhóm chính)

```
Flow Objects
├── Events (9 loại trigger × 3 vị trí = ~29 combinations)
│   ├── Start Event
│   ├── Intermediate Event (catching / throwing)
│   └── End Event
├── Activities
│   ├── Task (7 loại: None, User, Service, Script, Business Rule, Manual, Receive, Send)
│   ├── Sub-Process (Embedded, Event, Call Activity)
│   └── Transaction
└── Gateways (5 loại)
    ├── Exclusive (XOR) — X hoặc không có ký hiệu
    ├── Inclusive (OR) — O
    ├── Parallel (AND) — +
    ├── Event-Based — ngũ giác
    └── Complex — *
```

### 2.2 Swimlanes

```
Swimlanes
├── Pool (đại diện 1 Participant — tổ chức, hệ thống, vai trò lớn)
│   ├── White-box Pool (có nội dung bên trong)
│   └── Black-box Pool (chỉ có tên, không có nội dung)
└── Lane (phân chia trách nhiệm trong 1 Pool)
    └── Lane có thể lồng nhau (Sub-Lane)
```

### 2.3 Connecting Objects

```
Connecting Objects
├── Sequence Flow     — mũi tên liền, nối elements TRONG CÙNG Pool
├── Message Flow      — mũi tên đứt nét, nối GIỮA các Pool
├── Association       — đường đứt nét, nối Artifact với Flow Object
└── Data Association  — mũi tên đứt nét với đầu mở, nối Data Object
```

### 2.4 Artifacts

```
Artifacts
├── Data Object       — tài liệu/dữ liệu trong quá trình
├── Data Store        — CSDL, lưu trữ lâu dài
├── Group             — hình chữ nhật đứt nét, nhóm logic
└── Text Annotation   — ghi chú
```

---

## 3. POOL & LANE RULES

### 3.1 Pool Rules — CỨNG

| # | Quy tắc | Vi phạm thường gặp |
|---|---|---|
| P1 | Sequence Flow **không được** vượt qua ranh giới Pool | Nối task từ Pool A sang Pool B bằng sequence flow |
| P2 | Message Flow **chỉ** đi giữa các Pool, **không** đi trong cùng Pool | Dùng message flow để nối task trong 1 pool |
| P3 | Mỗi Pool phải chứa **ít nhất 1 Start Event và 1 End Event** (nếu là white-box) | Pool thiếu End Event |
| P4 | Mỗi Pool là 1 **process độc lập** và hoàn chỉnh | Flow bị đứt giữa chừng trong Pool |
| P5 | Pool label = tên Participant (tổ chức/hệ thống, không phải tên quy trình) | Đặt tên pool là "Quy trình phê duyệt" |
| P6 | Chỉ **1 implicit pool** tồn tại trong collaboration (pool không tên) | Nhiều pool ẩn danh |

### 3.2 Lane Rules

| # | Quy tắc |
|---|---|
| L1 | Lane label = vai trò/bộ phận/người thực hiện (không phải tên bước) |
| L2 | Sequence Flow **được phép** đi qua ranh giới Lane trong cùng Pool |
| L3 | Message Flow **không** bắt đầu hoặc kết thúc tại Lane (phải tại Pool boundary) |
| L4 | Một task chỉ thuộc **1 Lane** (không trải qua 2 lane) |
| L5 | Lane phải **fill toàn bộ chiều cao Pool** (không để khoảng trống) |
| L6 | Nếu Pool có Lane, **mọi** Flow Object phải nằm trong 1 Lane |

### 3.3 Khi nào dùng Pool vs Lane?

```
Dùng POOL khi:
✓ Participant là tổ chức/hệ thống KHÁC (External Customer, Bank, ERP System)
✓ Cần giao tiếp qua message (API call, email, webhook)
✓ Participant có process độc lập, không bị orchestrate bởi engine chung
✓ Black-box: chỉ cần biết "có giao tiếp", không cần biết bên trong làm gì

Dùng LANE khi:
✓ Cùng 1 tổ chức, khác vai trò (Sales, Manager, IT)
✓ Cùng chạy trên 1 process engine
✓ Engine orchestrate toàn bộ, chỉ khác người thực hiện task
```

---

## 4. EVENTS

### 4.1 Ma trận Event Types × Position

| Trigger | Start | Intermediate Catch | Intermediate Throw | End |
|---|---|---|---|---|
| **None** (rỗng) | ✓ | ✗ | ✓ | ✓ |
| **Message** | ✓ | ✓ | ✓ | ✓ |
| **Timer** | ✓ | ✓ | ✗ | ✗ |
| **Conditional** | ✓ | ✓ | ✗ | ✗ |
| **Signal** | ✓ | ✓ | ✓ | ✓ |
| **Error** | ✗ | ✓ (boundary only) | ✗ | ✓ |
| **Escalation** | ✗ | ✓ | ✓ | ✓ |
| **Compensation** | ✗ | ✓ (boundary only) | ✓ | ✓ |
| **Cancel** | ✗ | ✓ (boundary, Transaction only) | ✗ | ✓ (Transaction only) |
| **Link** | ✗ | ✓ | ✓ | ✗ |
| **Terminate** | ✗ | ✗ | ✗ | ✓ |
| **Multiple** | ✓ | ✓ | ✓ | ✓ |
| **Parallel Multiple** | ✓ | ✓ | ✗ | ✗ |

### 4.2 Event Rules Quan Trọng

```
START EVENT:
- KHÔNG được có Incoming Sequence Flow
- PHẢI có ít nhất 1 Outgoing Sequence Flow
- Top-level process: chỉ None, Message, Timer, Conditional, Signal, Multiple, Parallel Multiple
- Event Sub-Process: phải có typed Start Event (không phải None)

INTERMEDIATE EVENT:
- Trong normal flow: PHẢI có 1 incoming VÀ 1 outgoing Sequence Flow
- Boundary (attached to Activity): KHÔNG có incoming SF, PHẢI có 1 outgoing SF
- Interrupting Boundary (solid border): hủy Activity khi trigger
- Non-Interrupting Boundary (dashed border): Activity tiếp tục, spawn luồng mới

END EVENT:
- KHÔNG được có Outgoing Sequence Flow
- PHẢI có ít nhất 1 Incoming Sequence Flow
- Error End: phải có Catch Error trong Sub-Process cha
- Terminate End: kết thúc toàn bộ Process ngay lập tức (không chờ token khác)

LINK EVENT:
- Throw Link + Catch Link phải có cùng tên
- Chỉ 1 Catch Link Event được phép cho mỗi tên
- Dùng để nối các phần của diagram dài (thay cho connector vòng vèo)
```

### 4.3 Catching vs Throwing

```
CATCHING (chờ nhận):  Start Events, Intermediate Catch, Boundary Events
  → Ký hiệu: viền mỏng (outline)
THROWING (gửi đi):    Intermediate Throw, End Events
  → Ký hiệu: fill (filled)
```

---

## 5. ACTIVITIES

### 5.1 Task Types

| Task Type | Icon | Dùng khi |
|---|---|---|
| **None/Abstract** | ký hiệu trống | Chưa xác định loại, hoặc không cần phân biệt |
| **User Task** | hình người | Con người thực hiện qua portal/UI (có Assignee) |
| **Service Task** | bánh răng | Hệ thống tự động gọi (REST API, microservice) |
| **Script Task** | cuộn giấy | Engine thực thi script (Groovy, JS) |
| **Business Rule Task** | bảng kẻ | Gọi DMN decision table |
| **Manual Task** | bàn tay | Con người làm tay, không qua hệ thống |
| **Send Task** | phong bì đặc | Gửi message đến participant khác |
| **Receive Task** | phong bì trống | Chờ nhận message từ participant khác |

### 5.2 Markers trên Task

| Marker | Ý nghĩa |
|---|---|
| Loop (↻) | Lặp dựa trên điều kiện |
| Parallel Multi-Instance (‖‖) | Tạo N instance song song |
| Sequential Multi-Instance (≡) | Tạo N instance tuần tự |
| Compensation (⇦) | Activity dùng để bù trừ (rollback) |
| Ad-hoc (~) | Chỉ trong Sub-Process |

### 5.3 Sub-Process Types

```
EMBEDDED SUB-PROCESS:
- Nằm trong process cha, dùng chung context/data
- Có thể collapse (hiển thị icon +) hoặc expand
- Phải có ít nhất 1 Start Event và 1 End Event
- Không có incoming/outgoing Message Flow trực tiếp (chỉ qua process cha)

EVENT SUB-PROCESS:
- Được trigger bởi Event (không có incoming Sequence Flow)
- Interrupting: hủy host process khi trigger
- Non-Interrupting: chạy song song với host process
- Không có incoming/outgoing Sequence Flow

CALL ACTIVITY:
- Gọi 1 Process hoặc Global Task bên ngoài (reusable)
- Icon: dày viền hơn Sub-Process thường
- Phải reference đến 1 Callable Element hợp lệ

TRANSACTION SUB-PROCESS:
- Có đường viền đôi
- Phải xử lý Cancel Event
- Hỗ trợ compensation
```

---

## 6. GATEWAYS

### 6.1 Exclusive Gateway (XOR) — X hoặc diamond trống

```
SPLITTING (diverge):
- Chỉ 1 trong các outgoing flow được kích hoạt
- PHẢI có condition expression trên mỗi conditional flow
- NÊN có 1 default flow (không có condition, có "/" ký hiệu)
- Nếu không có default và không có condition nào đúng → Exception!

MERGING (join):
- Nhận 1 trong các incoming flow là tiếp tục ngay
- Không chờ đợi (không synchronize)

RULES:
- Label gateway: câu hỏi (?) khi splitting
- Label outgoing flows: câu trả lời
- Dùng cặp XOR split + XOR join cùng tên để rõ ràng
```

### 6.2 Parallel Gateway (AND) — dấu +

```
SPLITTING:
- Kích hoạt TẤT CẢ outgoing flows đồng thời
- KHÔNG có condition trên outgoing flows
- Tạo ra N tokens song song

MERGING:
- Chờ TẤT CẢ incoming flows hoàn thành mới tiếp tục
- Synchronization barrier
- Số incoming vào join PHẢI khớp với số outgoing từ split tương ứng

RULES:
- Parallel gateway KHÔNG có label (vì không có quyết định)
- Join Parallel chỉ merge các flow từ cùng 1 parallel split
- KHÔNG trộn exclusive flows vào parallel join
```

### 6.3 Inclusive Gateway (OR) — O

```
SPLITTING:
- 1 hoặc nhiều outgoing flows được kích hoạt
- Phải có condition trên mỗi conditional flow
- NÊN có default flow

MERGING:
- Chờ tất cả ACTIVE incoming flows (không nhất thiết tất cả)
- Phức tạp hơn Parallel vì phụ thuộc vào branch nào đang active
- Dùng cặp OR split + OR join

RULES:
- Phải có cặp split/join tương ứng để synchronize đúng
- Không dùng OR join standalone nếu không có OR split tương ứng
```

### 6.4 Event-Based Gateway — ngũ giác trong diamond

```
- KHÔNG routing dựa trên data, routing dựa trên event xảy ra trước
- Outgoing flows PHẢI đến Receive Task HOẶC Intermediate Catch Event
  (Timer, Message, Signal, Conditional)
- PHẢI có ít nhất 2 outgoing flows
- Targets KHÔNG được có incoming flow khác (ngoài từ gateway này)
- Không có condition trên outgoing flows
- Dùng khi: "Chờ customer reply HOẶC timeout 24h"

Instantiating Event Gateway:
- Dùng để start process dựa trên event đầu tiên xảy ra
- instantiate = true
```

### 6.5 Complex Gateway — dấu *

```
- Dùng cho logic phức tạp không thể diễn đạt bằng XOR/AND/OR
- Ví dụ: "Ít nhất 2 trong 3 điều kiện đúng thì tiếp tục"
- Phải document rõ condition logic bằng annotation
- Hạn chế dùng vì khó hiểu
```

### 6.6 Gateway Anti-Patterns

```
❌ SÁNG LẦM 1: Dùng XOR join để đồng bộ parallel flows
   Fix: Dùng Parallel join

❌ SAI LẦM 2: Không có default flow trên XOR gateway
   Fix: Luôn thêm 1 default flow

❌ SAI LẦM 3: Condition trên Parallel outgoing flows
   Fix: Remove condition, Parallel không cần/không được có condition

❌ SAI LẦM 4: Dùng Event Gateway với condition-based flows
   Fix: Event-Based chỉ đến Receive Task hoặc Catch Event

❌ SAI LẦM 5: Gateway chỉ có 1 outgoing flow (redundant)
   Fix: Xóa gateway đó
```

---

## 7. CONNECTING OBJECTS

### 7.1 Sequence Flow Rules

```
REQUIRED:
- Phải có sourceRef và targetRef hợp lệ
- Chỉ nối elements trong cùng 1 Pool (hoặc process không có pool)
- Source phải có <outgoing> reference đến flow id
- Target phải có <incoming> reference đến flow id

CONDITIONAL SEQUENCE FLOW:
- Có condition expression
- Chỉ dùng khi source là Gateway (XOR, OR) hoặc Activity
- KHÔNG dùng conditional SF khi source là Event hoặc Parallel/Complex Gateway

DEFAULT FLOW:
- Được đánh dấu bằng "/" ký hiệu trên line
- Chỉ trên XOR và OR gateway, hoặc Activity với multiple outgoing
- Chỉ được 1 default flow cho mỗi source

LABELING:
- XOR outgoing: label điều kiện (ví dụ: "Approved", "Rejected", "[amount > 1000]")
- Parallel outgoing: không label
- Từ Activity (không qua gateway): label nếu có conditional
```

### 7.2 Message Flow Rules

```
- Chỉ nối GIỮA hai Pool khác nhau (không trong cùng pool)
- Source: Pool, Lane, Flow Object trong Pool A
- Target: Pool, Lane, Flow Object trong Pool B
- Không có sequence semantics (không kích hoạt token flow)
- Thể hiện "có thể giao tiếp", không phải "bắt buộc theo thứ tự"
- Thường đi kèm Message Event (Catch/Throw) hoặc Send/Receive Task
```

### 7.3 Association

```
- Nối Artifact (Data Object, Text Annotation) với Flow Object
- Không có direction semantics cho Text Annotation
- Data Association có hướng (input/output data)
- Không được thay thế Sequence Flow
```

---

## 8. ARTIFACTS & DATA

### 8.1 Data Objects

```
DATA OBJECT:
- Tài liệu/dữ liệu cụ thể trong process instance (ví dụ: "Đơn xin nghỉ", "Hóa đơn")
- Có thể có state: [Created], [Submitted], [Approved]
- Kết nối qua Data Input/Output Association
- Không ảnh hưởng control flow

DATA STORE:
- CSDL tồn tại ngoài process (ví dụ: CRM, ERP)
- Có thể đọc/ghi từ nhiều process instance
- Icon: hình trụ như database
```

### 8.2 Text Annotation

```
- Ghi chú giải thích cho element
- Kết nối bằng Association (đường đứt nét)
- Không ảnh hưởng execution
- Dùng để document business rules, SLA, hướng dẫn
```

### 8.3 Group

```
- Hình chữ nhật đứt nét với label
- Nhóm logic các elements liên quan (cross-lane, cross-pool)
- Không ảnh hưởng execution
- Dùng để highlight một giai đoạn trong process
```

---

## 9. XML STRUCTURE & BPMNDI

### 9.1 Cấu trúc XML chuẩn

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="Camunda Modeler"
  exporterVersion="5.0.0">

  <!-- PHẦN 1: SEMANTIC MODEL -->
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_Customer" name="Khách hàng" processRef="Process_Customer"/>
    <bpmn:participant id="Participant_Bank" name="Ngân hàng" processRef="Process_Bank"/>
    <bpmn:messageFlow id="MsgFlow_1" sourceRef="Task_Send" targetRef="StartEvent_Receive"/>
  </bpmn:collaboration>

  <bpmn:process id="Process_Bank" name="Quy trình phê duyệt vay" isExecutable="true">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_CS" name="Customer Service">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Receive</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Risk" name="Risk Team">
        <bpmn:flowNodeRef>Task_Assess</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <bpmn:startEvent id="StartEvent_1" name="Hồ sơ nhận được">
      <bpmn:outgoing>SF_1</bpmn:outgoing>
    </bpmn:startEvent>

    <bpmn:userTask id="Task_Receive" name="Tiếp nhận hồ sơ" camunda:assignee="${csOfficer}">
      <bpmn:incoming>SF_1</bpmn:incoming>
      <bpmn:outgoing>SF_2</bpmn:outgoing>
    </bpmn:userTask>

    <bpmn:serviceTask id="Task_Assess" name="Đánh giá rủi ro">
      <bpmn:incoming>SF_2</bpmn:incoming>
      <bpmn:outgoing>SF_3</bpmn:outgoing>
    </bpmn:serviceTask>

    <bpmn:exclusiveGateway id="Gateway_1" name="Kết quả đánh giá?" default="SF_Default">
      <bpmn:incoming>SF_3</bpmn:incoming>
      <bpmn:outgoing>SF_Approved</bpmn:outgoing>
      <bpmn:outgoing>SF_Rejected</bpmn:outgoing>
      <bpmn:outgoing>SF_Default</bpmn:outgoing>
    </bpmn:exclusiveGateway>

    <bpmn:sequenceFlow id="SF_1" sourceRef="StartEvent_1" targetRef="Task_Receive"/>
    <bpmn:sequenceFlow id="SF_2" sourceRef="Task_Receive" targetRef="Task_Assess"/>
    <bpmn:sequenceFlow id="SF_3" sourceRef="Task_Assess" targetRef="Gateway_1"/>
    <bpmn:sequenceFlow id="SF_Approved" name="Đạt" sourceRef="Gateway_1" targetRef="Task_Approve">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${score >= 70}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SF_Rejected" name="Không đạt" sourceRef="Gateway_1" targetRef="EndEvent_Rejected">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${score < 50}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SF_Default" name="Cần xem xét thêm" sourceRef="Gateway_1" targetRef="Task_Review"/>
  </bpmn:process>

  <!-- PHẦN 2: DIAGRAM INTERCHANGE (BPMNDI) -->
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">

      <!-- Pool shape -->
      <bpmndi:BPMNShape id="Participant_Bank_di" bpmnElement="Participant_Bank" isHorizontal="true">
        <dc:Bounds x="150" y="80" width="800" height="400"/>
      </bpmndi:BPMNShape>

      <!-- Lane shapes -->
      <bpmndi:BPMNShape id="Lane_CS_di" bpmnElement="Lane_CS" isHorizontal="true">
        <dc:Bounds x="180" y="80" width="770" height="200"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Risk_di" bpmnElement="Lane_Risk" isHorizontal="true">
        <dc:Bounds x="180" y="280" width="770" height="200"/>
      </bpmndi:BPMNShape>

      <!-- Flow Object shapes -->
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="222" y="162" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="200" y="205" width="80" height="27"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>

      <bpmndi:BPMNShape id="Task_Receive_di" bpmnElement="Task_Receive">
        <dc:Bounds x="320" y="140" width="100" height="80"/>
      </bpmndi:BPMNShape>

      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="600" y="295" width="50" height="50"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="567" y="352" width="116" height="27"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>

      <!-- Sequence Flow edges -->
      <bpmndi:BPMNEdge id="SF_1_di" bpmnElement="SF_1">
        <di:waypoint x="258" y="180"/>
        <di:waypoint x="320" y="180"/>
      </bpmndi:BPMNEdge>

      <bpmndi:BPMNEdge id="SF_Approved_di" bpmnElement="SF_Approved">
        <di:waypoint x="650" y="320"/>
        <di:waypoint x="750" y="320"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="672" y="302" width="28" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>

    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

### 9.2 Kích thước chuẩn của Elements (px)

| Element | Width | Height | Ghi chú |
|---|---|---|---|
| Start Event | 36 | 36 | Hình tròn |
| Intermediate Event | 36 | 36 | Hình tròn |
| End Event | 36 | 36 | Hình tròn |
| Task (Standard) | 100 | 80 | Hình chữ nhật |
| Gateway | 50 | 50 | Hình thoi |
| Sub-Process (collapsed) | 100 | 80 | Hình chữ nhật + dấu + |
| Pool (horizontal) | ≥300 | ≥100 per lane | Tùy nội dung |
| Lane (horizontal) | = Pool width - 30 | ≥100 | 30px cho label lane |
| Data Object | 36 | 50 | |
| Text Annotation | Auto | Auto | |

### 9.3 Coordinate Rules (BPMNDI)

```
BPMNDI Coordinate System:
- Origin (0,0) ở góc trên bên TRÁI
- X tăng sang phải, Y tăng xuống dưới
- TẤT CẢ tọa độ phải DƯƠNG (>= 0)
- Bounds: x, y = góc trên-trái của element; width, height = kích thước
- Waypoints: tọa độ điểm uốn của edge

LAYOUT RULES:
- Left-to-right flow: element tiếp theo nằm sang phải (x lớn hơn)
- Top-to-bottom flow: element tiếp theo nằm bên dưới (y lớn hơn)
- Khoảng cách tối thiểu giữa elements: 50px (horizontal), 40px (vertical)
- Pool phải bao trùm tất cả Lane và element con
- Lane bounds phải nằm TRONG Pool bounds
- Element bounds phải nằm TRONG Lane bounds của nó
- isHorizontal="true" cho horizontal pools/lanes

POOL HIERARCHY IN BPMNDI:
- BPMNShape của Pool là cha
- BPMNShape của Lane có cùng x,y trong Pool (KHÔNG relative)
  → Lane x = Pool.x + label_width (thường 30px)
  → Lane y = vị trí của lane
  → Lane width = Pool.width - 30
- Element bên trong Lane: tọa độ absolute (không relative)

WAYPOINT RULES:
- Phải có ít nhất 2 waypoints (source và target)
- Source waypoint nên nằm trên border của source element
- Target waypoint nên nằm trên border của target element
- Thêm waypoint trung gian cho đường gập
```

### 9.4 BPMNDI Attributes Quan Trọng

```xml
BPMNShape:
  bpmnElement="id của element trong model"
  isHorizontal="true"          → cho Pool và Lane ngang
  isMarkerVisible="true"       → hiển thị marker X cho XOR gateway
  isExpanded="true/false"      → sub-process collapsed/expanded
  isInterrupting="true/false"  → boundary event interrupting

BPMNEdge:
  bpmnElement="id của sequence/message flow"
  sourceElement="id của BPMNShape source"  (optional nhưng nên có)
  targetElement="id của BPMNShape target"  (optional nhưng nên có)
  messageVisibleKind="non_initiating/initiating"  → cho Message Flow
```

---

## 10. HARD VALIDATION RULES

Đây là các rule từ OMG spec và OCL invariants — vi phạm = INVALID diagram:

### 10.1 Connectivity Rules

```
[CONN-01] Mỗi Flow Node (ngoài Event Sub-Process) trong container có Start+End event
          PHẢI có ít nhất 1 incoming HOẶC 1 outgoing Sequence Flow

[CONN-02] Start Event: KHÔNG có incoming SF, ít nhất 1 outgoing SF

[CONN-03] End Event: KHÔNG có outgoing SF, ít nhất 1 incoming SF

[CONN-04] Intermediate Event (in normal flow): ít nhất 1 incoming VÀ 1 outgoing SF

[CONN-05] Boundary Event: KHÔNG có incoming SF, đúng 1 outgoing SF
          (Exception: Compensation Boundary Event không có outgoing SF)

[CONN-06] Sequence Flow KHÔNG được vượt Pool boundary

[CONN-07] Message Flow KHÔNG được ở trong cùng Pool

[CONN-08] Sub-Process (Event): KHÔNG có incoming/outgoing Sequence Flow
```

### 10.2 Gateway Rules

```
[GW-01] Gateway PHẢI có multiple incoming OR multiple outgoing SF
        (không có gateway với 1 incoming và 1 outgoing — redundant)

[GW-02] XOR/OR split: PHẢI có condition expression trên conditional flows

[GW-03] Parallel Gateway: KHÔNG có condition expression trên outgoing flows

[GW-04] Event Gateway: PHẢI có ít nhất 2 outgoing SF

[GW-05] Event Gateway targets: PHẢI là Receive Task hoặc Catch Event
        (Message, Timer, Signal, Conditional)

[GW-06] Event Gateway targets: KHÔNG có incoming SF khác (ngoài từ gateway)

[GW-07] Complex/Parallel Gateway: KHÔNG có Conditional Sequence Flow outgoing
```

### 10.3 Event Rules

```
[EV-01] Error Intermediate Event: CHỈ được dùng làm Boundary Event

[EV-02] Error End Event: PHẢI có matching Catch Error Event trong Sub-Process cha

[EV-03] Cancel Catching Event: CHỈ dùng làm Boundary trên Transaction Sub-Process

[EV-04] Cancel End Event: CHỈ trong Transaction Sub-Process

[EV-05] Compensation Catching: CHỈ làm Boundary Event

[EV-06] Link Events: Throw và Catch PHẢI cùng tên, cùng container

[EV-07] Non-Interrupting Start Event: CHỈ trong Event Sub-Process

[EV-08] Sequence Flow source là Event: KHÔNG có condition expression
```

### 10.4 Sub-Process Rules

```
[SP-01] Sub-Process PHẢI có ít nhất 1 Start Event và 1 End Event (explicit)

[SP-02] Event Sub-Process Start Event PHẢI là typed (không None)

[SP-03] Call Activity PHẢI reference đến callable element hợp lệ

[SP-04] Transaction Sub-Process: viền đôi, xử lý Cancel Event
```

### 10.5 Process Rules

```
[PR-01] Một Process PHẢI có ít nhất 1 Start Event

[PR-02] Một Process PHẢI có ít nhất 1 End Event

[PR-03] Tất cả paths từ Start phải dẫn đến End (không có dead end, không có orphan)

[PR-04] Không có cycle vô hạn không có exit condition

[PR-05] Public Process: isExecutable phải là false
```

---

## 11. NAMING CONVENTIONS (Bruce Silver Method & Style)

### 11.1 Labeling Rules

| Element | Cú pháp | Ví dụ |
|---|---|---|
| **Start Event** | [Subject] + Quá khứ phân từ | "Đơn hàng nhận được", "Timer hết hạn" |
| **End Event** | [Subject] + Trạng thái kết thúc | "Đơn hàng đã xử lý", "Yêu cầu từ chối" |
| **Task** | Động từ + Tân ngữ | "Phê duyệt hồ sơ", "Gửi thông báo" |
| **XOR Gateway (split)** | Câu hỏi? | "Hồ sơ hợp lệ?", "Số tiền vượt ngưỡng?" |
| **XOR outgoing flow** | Câu trả lời ngắn | "Có", "Không", "Cần xem xét" |
| **Pool** | Tên Participant (tổ chức/hệ thống) | "Khách hàng", "Hệ thống CRM" |
| **Lane** | Vai trò/Bộ phận | "Nhân viên CS", "Quản lý cấp trung" |
| **Parallel Gateway** | Không label | — |
| **Merge Gateway** | Không label | — |
| **Intermediate Event** | [Subject] + Sự kiện | "Phản hồi nhận được", "SLA hết hạn" |

### 11.2 Layout Best Practices

```
VISUAL FLOW:
✓ Left-to-right là hướng chính (trái sang phải = theo thời gian)
✓ Happy path ở giữa, exception paths ở trên/dưới
✓ Tránh đường sequence flow cắt nhau
✓ Không để quá 10 activities trong 1 level (split thành sub-process)
✓ Sử dụng Link Event thay vì đường cong dài

READABILITY:
✓ Mọi element PHẢI có label (không để trống)
✓ Gateway labels nên fit trong 1 dòng
✓ Task labels nên rõ ràng, action-oriented
✓ Dùng Text Annotation cho business rules phức tạp

COMPLEXITY:
✓ 1 diagram = 1 process level
✓ Collapse sub-process nếu quá phức tạp
✓ Tối đa 7 ± 2 lanes trong 1 pool
```

---

## 12. COMMON MISTAKES CỦA LLM AGENT

### 12.1 Structural Mistakes

```
❌ MISSING END EVENT trong Sub-Process
   → Sub-Process phải tự có Start + End riêng

❌ SEQUENCE FLOW xuyên Pool boundary
   → Dùng Message Flow thay thế

❌ MESSAGE FLOW trong cùng 1 Pool
   → Dùng Sequence Flow hoặc chia thành 2 Pool

❌ ORPHAN ELEMENTS (node không connected)
   → Mọi node phải có sequence flow connection

❌ DUPLICATE IDs trong XML
   → Mỗi id là unique toàn bộ file

❌ flowNodeRef trong Lane không trùng với element thực tế
   → Mỗi flow node trong lane phải có <flowNodeRef>

❌ LaneSet khai báo nhưng các element không assign lane
   → Hoặc dùng Lane cho tất cả, hoặc không dùng Lane
```

### 12.2 Gateway Mistakes

```
❌ XOR GATEWAY không có default flow
   → Luôn thêm 1 outgoing flow không có condition

❌ CONDITION trên Parallel Gateway outgoing
   → Parallel không cần condition, xóa đi

❌ Event Gateway đến Task thông thường (không phải Receive Task)
   → Event Gateway chỉ đến Receive Task hoặc Catch Event

❌ Missing condition expression trên XOR/OR outgoing flows
   → Thêm <conditionExpression> vào sequenceFlow

❌ Dùng XOR join để synchronize parallel flows
   → Dùng Parallel Gateway join
```

### 12.3 BPMNDI Mistakes

```
❌ NEGATIVE COORDINATES
   → Tất cả x, y, waypoint phải >= 0

❌ Pool không bao trùm Lane
   → Pool.x <= Lane.x, Pool.y <= Lane.y, Pool.right >= Lane.right

❌ Element nằm ngoài Lane bounds
   → Element phải hoàn toàn trong Lane bounds

❌ MISSING BPMNLabel cho elements có name
   → Mỗi element có name nên có BPMNLabel với Bounds

❌ Waypoint không nằm trên border của element
   → SF_1 từ StartEvent (center: 240, 180) → waypoint nên là (258, 180)

❌ isHorizontal bị bỏ qua cho Pool/Lane
   → isHorizontal="true" cho tất cả Pool và Lane ngang

❌ isMarkerVisible bỏ qua cho XOR Gateway
   → isMarkerVisible="true" để hiện dấu X
```

### 12.4 Semantic Mistakes

```
❌ KHÔNG phân biệt Interrupting vs Non-Interrupting Boundary
   → Interrupting (solid): hủy task; Non-Interrupting (dashed): song song

❌ Dùng Message Event thay vì Message Flow giữa Pools
   → Boundary message event cần pair với message flow

❌ Terminate End Event trong Sub-Process sẽ kết thúc TOÀN BỘ Process
   → Nếu chỉ muốn kết thúc sub-process, dùng None End Event

❌ Signal vs Message nhầm lẫn
   → Message: 1-to-1 có địa chỉ cụ thể; Signal: broadcast 1-to-many

❌ Timer Event trong End Event (không tồn tại)
   → Timer chỉ là Start và Intermediate Catch
```

---

## 13. PROMPT ENGINEERING CHO AGENT BPMN

### 13.1 System Prompt Template

```
Bạn là BPMN 2.0 modeling expert tuân thủ nghiêm ngặt OMG BPMN 2.0.2 spec và Camunda best practices.

KHI TẠO BPMN XML, bạn PHẢI:

STRUCTURAL:
1. Mỗi Process PHẢI có đúng 1 Start Event và ít nhất 1 End Event
2. Mọi Flow Node phải connected — không có orphan elements
3. Sequence Flow chỉ trong cùng Pool; Message Flow chỉ giữa các Pool
4. Mỗi <bpmn:lane> phải có <bpmn:flowNodeRef> cho mọi element trong lane đó
5. Sub-Process phải có Start Event và End Event riêng

GATEWAY:
6. XOR gateway split: mọi outgoing flow (trừ default) PHẢI có conditionExpression
7. XOR gateway: PHẢI có 1 default flow (attribute default="flowId")
8. Parallel gateway: KHÔNG có conditionExpression trên outgoing flows
9. Event-Based Gateway: chỉ target Receive Task hoặc Intermediate Catch Event

BPMNDI:
10. Mọi tọa độ (x, y, waypoints) PHẢI là số DƯƠNG
11. Kích thước chuẩn: StartEvent 36×36, Task 100×80, Gateway 50×50
12. Pool isHorizontal="true", Lane isHorizontal="true"
13. XOR Gateway: isMarkerVisible="true"
14. Mọi element có name phải có BPMNLabel với Bounds

NAMING:
15. Task: Động từ + Tân ngữ ("Phê duyệt hồ sơ")
16. Start Event: Subject + quá khứ phân từ ("Yêu cầu nhận được")  
17. End Event: Subject + trạng thái kết thúc ("Quy trình hoàn tất")
18. XOR split: câu hỏi có dấu ?; outgoing flows: câu trả lời ngắn

IDs:
19. Mỗi ID là UNIQUE trong toàn bộ XML
20. Format: {Type}_{TênVietTat}_{số} (ví dụ: Task_Pheduyet_01, GW_KiemTra_01)
```

### 13.2 Multi-Step Agent Workflow

```
BƯỚC 1 — PHÂN TÍCH YÊU CẦU:
  Input: Mô tả nghiệp vụ bằng text
  Output: 
    - Danh sách Participants (→ Pools)
    - Danh sách Roles (→ Lanes)  
    - Danh sách Activities theo role
    - Danh sách Decision Points (→ Gateways)
    - Danh sách Events (Start triggers, End states, Intermediate events)
    - Message exchanges giữa Participants

BƯỚC 2 — THIẾT KẾ STRUCTURE:
  - Xác định loại diagram: Process / Collaboration
  - Xác định số Pools và Lanes
  - Vẽ happy path trước
  - Thêm exception paths, boundary events

BƯỚC 3 — VALIDATION LOGIC:
  Kiểm tra trước khi generate XML:
  □ Mỗi Pool có Start + End?
  □ Không có SF xuyên Pool?
  □ Mọi XOR có condition + default?
  □ Mọi node đều connected?
  □ Sub-processes có đủ Start/End?

BƯỚC 4 — GENERATE XML:
  Thứ tự: 
  1. bpmn:collaboration (nếu có)
  2. bpmn:process (semantic model) 
     - laneSet > lane > flowNodeRef
     - tất cả flow objects
     - tất cả sequence flows
  3. bpmndi:BPMNDiagram (visual)
     - BPMNPlane
     - Pool shapes (isHorizontal)
     - Lane shapes
     - All element shapes với Bounds
     - All edge shapes với waypoints

BƯỚC 5 — SELF-VALIDATION:
  □ Có duplicate ID không?
  □ Tất cả tọa độ dương?
  □ flowNodeRef trong lane match với element IDs?
  □ sourceRef/targetRef trong SF/MF tồn tại?
  □ Mọi element có BPMNShape/BPMNEdge tương ứng?
```

### 13.3 Correction Loop Prompt

```
Khi gặp lỗi validation, phân tích theo thứ tự:
1. Lỗi namespace/XML syntax → fix trước
2. Lỗi connectivity (orphan, missing flow) → fix
3. Lỗi gateway rules (missing condition, default) → fix
4. Lỗi Pool/Lane structure → fix
5. Lỗi BPMNDI coordinates → fix cuối cùng

Sau mỗi fix, re-validate toàn bộ, không chỉ fix 1 lỗi.
```

---

## 14. FINAL CHECKLIST

Trước khi output BPMN XML, agent PHẢI check:

### Process Structure
- [ ] Có đúng 1 Start Event (top-level process)
- [ ] Có ít nhất 1 End Event
- [ ] Không có orphan node (mọi node có ít nhất 1 connection)
- [ ] Không có dead-end path (mọi path dẫn đến End Event)
- [ ] Tất cả Sub-Process có Start + End riêng

### Pool & Lane
- [ ] Sequence Flow không vượt Pool boundary
- [ ] Message Flow chỉ giữa Pool (không trong Pool)
- [ ] Pool có name (tên Participant)
- [ ] Lane có name (tên Role)
- [ ] Mọi element được assign đúng Lane (nếu có Lane)
- [ ] flowNodeRef list trong Lane = list elements thực tế

### Gateway
- [ ] XOR split có condition trên mọi non-default flow
- [ ] XOR split có đúng 1 default flow
- [ ] Parallel outgoing flows không có condition
- [ ] Event-Based targets là Receive Task hoặc Catch Event
- [ ] Mọi Gateway có ít nhất 2 outgoing HOẶC 2 incoming

### Events
- [ ] Start Event không có incoming SF
- [ ] End Event không có outgoing SF
- [ ] Boundary Event không có incoming SF
- [ ] Error/Cancel/Compensation dùng đúng context

### XML Syntax
- [ ] Mọi ID là unique
- [ ] sourceRef/targetRef tồn tại
- [ ] Namespaces đầy đủ
- [ ] incoming/outgoing elements referenced đúng

### BPMNDI
- [ ] Mọi element có BPMNShape
- [ ] Mọi flow có BPMNEdge với waypoints
- [ ] Tất cả tọa độ dương (>= 0)
- [ ] Pool/Lane có isHorizontal="true"
- [ ] Element bounds nằm trong Lane/Pool bounds
- [ ] Label bounds không bị chồng lên element khác

---

## REFERENCES

- OMG BPMN 2.0.2 Specification: https://www.omg.org/spec/BPMN/2.0.2/PDF/
- Camunda BPMN Reference: https://camunda.com/bpmn/reference/
- Camunda BPMN Examples: https://camunda.com/bpmn/examples/
- Camunda 8 Docs: https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-primer/
- Bruce Silver BPMN Style Rules: https://www.trisotech.com/bpmn-style-rules/
- OCL BPMN Well-Formedness Rules: https://arxiv.org/pdf/1502.06297
- LLM BPMN Generation Research (2025): https://arxiv.org/abs/2604.12105
- BPM Tips Pool & Lane Rules: https://bpmtips.com/bpmn-in-practice-pools-and-lanes/
- Signavio BPMN Pools: https://www.signavio.com/post/bpmn-pools-and-lanes/
