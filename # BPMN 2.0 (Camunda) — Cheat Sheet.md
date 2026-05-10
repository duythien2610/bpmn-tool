# BPMN 2.0 (Camunda) — Cheat Sheet & Best Practice Guide

---

# 1. BPMN 2.0 LÀ GÌ?

BPMN 2.0 (Business Process Model and Notation) là chuẩn mô hình hóa quy trình nghiệp vụ.

Mục tiêu:
- Business Analyst đọc được
- Dev đọc được
- Tester đọc được
- Có thể automate bằng Camunda

BPMN dùng để:
- Phân tích nghiệp vụ
- Chuẩn hóa workflow
- Thiết kế automation
- Làm tài liệu hệ thống
- Hỗ trợ dev implement workflow engine

---

# 2. CÁC THÀNH PHẦN CỐT LÕI

---

## 2.1 Event (Sự kiện)

### Start Event
- Điểm bắt đầu process
- Chỉ nên có 1 start event chính

Ví dụ:
- User submit form
- Nhận request API
- Đến lịch cronjob

Ký hiệu:
○

---

### End Event
- Điểm kết thúc process

Ví dụ:
- Hoàn thành đơn hàng
- Reject hồ sơ
- Hủy workflow

Ký hiệu:
◎

---

### Intermediate Event
Sự kiện xảy ra giữa process.

Ví dụ:
- Chờ thanh toán
- Chờ email
- Chờ timer

---

## 2.2 Task

Task = một hành động đơn lẻ.

Ví dụ:
- Nhập thông tin
- Approve request
- Gửi email

Nguyên tắc:
- 1 task = 1 hành động duy nhất
- Không gộp nhiều action

SAI:
- "Kiểm tra và gửi email"

ĐÚNG:
- "Kiểm tra dữ liệu"
- "Gửi email"

---

## 2.3 Gateway

Gateway dùng để:
- Rẽ nhánh
- Gộp luồng
- Chạy song song

---

# 3. CÁC LOẠI GATEWAY QUAN TRỌNG

---

## 3.1 Exclusive Gateway (XOR)

Chỉ đi MỘT nhánh.

Ví dụ:
- Approved / Rejected
- Có hàng / Hết hàng

Ký hiệu:
X

Rule:
- Luôn có điều kiện rõ ràng
- Phải cover toàn bộ case

Ví dụ đúng:

IF approved
→ tiếp tục

IF rejected
→ kết thúc

---

## 3.2 Parallel Gateway (AND)

Chạy song song nhiều task.

Ví dụ:
- Gửi email
- Tạo invoice
- Trừ kho

Ký hiệu:
+

Rule:
- Split AND → phải có Merge AND
- Không được quên join

SAI:
AND split mà không merge lại.

---

## 3.3 Inclusive Gateway (OR)

Có thể chạy 1 hoặc nhiều nhánh.

Ví dụ:
- Gửi SMS nếu có số điện thoại
- Gửi email nếu có email

Có thể chạy:
- SMS
- Email
- Hoặc cả hai

---

## 3.4 Event-based Gateway

Chờ event xảy ra.

Ví dụ:
- Chờ user approve
- Chờ timeout
- Chờ callback API

---

# 4. RULE ĐỐI XỨNG GATEWAY (QUAN TRỌNG)

Đây là thứ BA hay bị sai nhất.

---

## 4.1 XOR Split → XOR Merge

ĐÚNG:
- XOR tách nhánh
- XOR merge lại

Ví dụ:
Approve?
→ Approved
→ Rejected

Sau đó merge về 1 flow.

---

## 4.2 AND Split → AND Merge

BẮT BUỘC.

Nếu tách song song:
- Task A
- Task B

Thì phải join lại trước khi đi tiếp.

Sai phổ biến:
- Tách song song nhưng không join
→ gây token leak trong Camunda.

---

## 4.3 Không merge sai loại gateway

SAI:
- XOR split
- AND merge

HOẶC:
- AND split
- XOR merge

Rule:
- Split gì → merge đó.

---

# 5. TOKEN LOGIC (RẤT QUAN TRỌNG)

Camunda chạy bằng token.

Mỗi flow = token di chuyển.

AND split:
- 1 token → nhiều token

AND merge:
- Chờ đủ token mới đi tiếp

Nếu quên merge:
- Process treo
- Process duplicate
- Deadlock

---

# 6. RULE "7 ± 2"

Đây là rule bạn đang nhớ.

Nguồn:
George Miller — Cognitive Load Theory.

---

## BPMN Best Practice

Mỗi diagram:
- Chỉ nên có khoảng 5 → 9 activity chính
- Tối đa khoảng 15 task visible cùng lúc

KHÔNG nên:
- 30+ task trên 1 màn hình
- Gateway chằng chịt

Nếu quá lớn:
→ split subprocess.

---

# 7. RULE "NO MORE THAN 30 TASKS"

Best practice phổ biến:

1 process:
- <= 30 task

Nếu lớn hơn:
- Tách subprocess
- Tách reusable workflow

---

# 8. SUBPROCESS

Dùng khi:
- Workflow quá dài
- Logic reusable
- Logic phức tạp

Ví dụ:
Main Process
→ Payment Subprocess
→ Delivery Subprocess

---

# 9. BEST PRACTICE CHO CAMUNDA

---

## 9.1 Đặt tên task = Verb + Object

ĐÚNG:
- Validate Order
- Send Email
- Approve Request

SAI:
- Email
- Request
- Process data

---

## 9.2 Không crossing line quá nhiều

Nếu line giao nhau:
- Refactor flow
- Dùng subprocess

---

## 9.3 Không dùng quá nhiều gateway liên tiếp

SAI:
XOR → XOR → XOR → XOR

ĐÚNG:
- Gom logic
- Tách subprocess

---

## 9.4 Một process chỉ nên có:
- 1 happy path rõ ràng
- Exception flow riêng

---

## 9.5 Exception flow luôn explicit

Ví dụ:
- Payment failed
- Timeout
- API error

Không được implicit.

---

# 10. TIMER & SLA RULE

---

## Timer Event

Dùng để:
- Retry
- Reminder
- Escalation

Ví dụ:
- Chờ 30 phút
- Chờ đến 15h

---

## SLA Rule

Ví dụ:
- Sau 2 giờ chưa approve
→ escalate manager

Đây là boundary timer event.

---

# 11. ERROR HANDLING RULE

Camunda cực kỳ quan trọng phần này.

---

## Boundary Error Event

Dùng cho:
- API fail
- Payment fail
- Validation fail

Rule:
- Luôn có recovery flow

SAI:
Fail → end process ngay.

ĐÚNG:
Fail
→ retry
→ notify
→ manual handling

---

# 12. MESSAGE EVENT

Dùng khi:
- Nhận callback
- Nhận webhook
- Chờ user action

Ví dụ:
- Payment callback
- OTP response

---

# 13. SIGNAL EVENT

Broadcast toàn hệ thống.

Ví dụ:
- System maintenance
- Global notification

---

# 14. USER TASK vs SERVICE TASK

---

## User Task

Con người làm.

Ví dụ:
- Approve request
- Review document

---

## Service Task

Hệ thống tự động.

Ví dụ:
- Call API
- Send email
- Generate PDF

---

# 15. BPMN CLEAN DESIGN RULE

---

## Một diagram đẹp thường:

✓ Flow từ trái sang phải

✓ Không loop lung tung

✓ Không crossing line

✓ Có happy path rõ ràng

✓ Exception riêng

✓ Gateway đối xứng

✓ Tên task rõ nghĩa

✓ Có SLA nếu cần

✓ Có timeout nếu wait lâu

✓ Có retry logic

---

# 16. ANTI-PATTERN PHỔ BIẾN

---

## God Process

1 diagram:
- 100 task
- mọi thứ nhét chung

→ rất tệ.

---

## Missing End Event

Có nhánh không end.

→ token leak.

---

## Infinite Loop

Loop không có exit condition.

---

## XOR không có default flow

Nếu không condition nào đúng:
→ process stuck.

---

# 17. CAMUNDA-SPECIFIC BEST PRACTICE

---

## Async Before / Async After

Dùng cho:
- API call
- External system

Để tránh:
- transaction rollback toàn flow.

---

## External Task

Dùng khi:
- Microservice xử lý riêng.

---

## Retry Strategy

Ví dụ:
- retry 3 lần
- exponential backoff

---

# 18. CHECKLIST REVIEW BPMN

Trước khi bàn giao:

✓ Có Start Event

✓ Có End Event

✓ Gateway đối xứng

✓ Không deadlock

✓ Không token leak

✓ Có exception flow

✓ Có timeout flow

✓ Có SLA flow

✓ Không quá 30 task

✓ Không crossing line nhiều

✓ Task name rõ nghĩa

✓ Có subprocess nếu phức tạp

✓ Happy path dễ đọc

✓ Dev có thể implement

---

# 19. CÔNG THỨC BPMN ĐẸP

START
→ VALIDATE
→ DECISION
→ PROCESS
→ EXCEPTION
→ NOTIFICATION
→ END

---

# 20. QUY TẮC VÀNG CHO BA

Nếu nhìn BPMN mà:
- Dev hiểu ngay
- Tester viết testcase được
- Business đọc được
- Không cần giải thích miệng

→ BPMN tốt.

Nếu phải giải thích liên tục:
→ BPMN đang sai hoặc quá phức tạp.