# Lumiere - Frontend Architecture, Design & Layout Documentation

## Tổng quan (Overview)

Lumiere là phần web frontend cho một extension trợ lý AI song ngữ Anh - Việt. Dự án được thiết kế với phong cách **Editorial Aesthetic** (lấy cảm hứng từ Awwwards), mang xu hướng tối giản, tập trung vào Typography (nghệ thuật chữ) và trải nghiệm người dùng (UX) mượt mà, sang trọng trong mảng Edu-tech.

## Tech Stack (Công nghệ sử dụng)

- **Framework:** React 19 + Vite + TypeScript.
- **Routing:** React Router v6 (ứng dụng Single Page Application - SPA).
- **Styling:** Tailwind CSS v4.
- **Animation:** Motion (`motion/react`) cho page transitions và thiết kế tương tác 3D.
- **Data Visualization:** `recharts` để vẽ biểu đồ thống kê học tập.
- **Icons:** `lucide-react`.

## Design System (Hệ thống Thiết kế)

Phong cách "Editorial Aesthetic" được áp dụng đồng nhất qua tệp `index.css` và Tailwind config:

- **Typography:**
  - _Sans-serif (Chính):_ `Inter` - dùng cho text cơ bản, paragraph, hiển thị rõ ràng.
  - _Serif/Display (Tiêu đề):_ `Playfair Display` - tạo điểm nhấn nghệ thuật, sang trọng cho các Heading và số liệu. Giao diện thường đan xen giữa chữ thường và các cụm từ được in nghiêng (italic) có chủ đích.
- **Color Palette (Bảng màu):**
  - _Background:_ `#FAF9F6` (Off-white/Beige) tạo cảm giác như trang giấy của một ấn phẩm.
  - _Foreground:_ `#1A1A1A` (Đen nhám/Dark Gray) cho text chính và các viền (border).
  - _Accent:_ `#E85D04` (Cam cháy) dùng làm điểm nhấn tỷ lệ nhỏ cho các từ khóa, icon, nút bấm.
- **UI Elements:**
  - Layout chia khối bằng đường line mỏng (`border-foreground/10`) thay vì dùng đồ bóng (heavy shadow).
  - Component có viền thẳng, bo góc cực kỳ nhẹ (`rounded-sm` hoặc `rounded-none`) kết hợp với badge bo tròn hoàn toàn (`rounded-full`).
  - Các meta-text (text phụ trợ/tiêu đề phân loại) làm từ class `.editorial-meta` sử dụng style uppercase, chữ siêu nhỏ (`text-[10px]`), font đậm (`font-bold`) và giãn chữ rộng (`tracking-widest`).

---

## Cấu trúc Layout Chi tiết từng Trang (Page Layout Breakdown)

### 1. Landing Page (`/`)

Trang đích sử dụng layout dọc dạng trang cuộn (scroll page) với luồng nội dung trải dài, ưu tiên sự cân bằng thị giác và không gian trống (whitespace).

- **Global Layout:** `flex flex-col` bão hòa toàn bộ trang trên trục dọc.
- **Header (Sticky):** Chiều cao cố định (`h-20`), căn chỉnh `flex items-center justify-between`. Nằm cố định trên cùng (`sticky top-0`) vơi nền gẩy ứng blur (`backdrop-blur-md`). Logo bên trái, Navigation bên phải.
- **Hero Section:** Được bao bọc bằng khối `flex-1 flex flex-col items-center justify-center` với padding khổng lồ (`pt-20 pb-32`) mang hơi hướng tạp chí. Nội dung chính (Badge, Heading chữ khổng lồ, Text mô tả, CTA button) nằm trọn trong một container `max-w-4xl`, tất cả được căn giữa (`text-center`).
- **Feature Section:** Sử dụng `grid md:grid-cols-2`. Trình bày 2 tính năng chính thành 2 cột đều nhau trên Mobile (> ngang kích thước sm) hoặc xếp dọc. Mỗi khối card áp dụng flexbox dọc để sắp xếp Icon, Meta text, Heading và Đoạn mô tả. Cột trái có kẻ viền (`border-r`) ngăn cách với cột phải.
- **Footer:** Gọn gàng vớii chiều cao cố định (`h-16`), căn ranh giới hai cực vớii `justify-between`.

### 2. Authentication Pages (`/login` & `/register`)

Sử dụng Split-screen (Màn hình chia nửa) đặc trưng của các app hiện đại.

- **Desktop Layout (`lg:flex`):**
  - Màn hình được chia làm 2 phần tĩnh diện tích 50-50 (`flex-1`).
  - **Left Panel (Hình ảnh/Branding):** Nền sáng (`bg-white`), đè thêm một lớp pattern lưới (radial-gradient grid) cùng padding để chứa khối nội dung Branding (Logo, Slogan 5XL, Mô tả) được gióng khung theo mép lề (`border-l`).
  - **Right Panel (Form Input):** Căn giữa toàn hoàn nội dung trên cả hai trục (`flex flex-col justify-center items-center`). Chứa một box giới hạn tối đa `max-w-sm`. Form áp dụng input chỉ có viền dưới (`border-b`), label nhỏ ở trên.
- **Mobile Layout:**
  - Left Panel bị ẩn đi (`hidden lg:flex`).
  - Right Panel chiếm trọn 100% diện tích màn hình, có thêm Logo ở góc trái trên cùng `absolute top-8 left-8` cho người dùng mobile bấm quay về trang chủ.

### 3. Dashboard Cốt lõi (Vùng `/app/*`)

Được bọc tại `DashboardLayout`, phân thân ra thành phần Navigation và Main.

- **Global Structure:** Áp dụng `flex` chiều ngang cho toàn màn hình (`min-h-screen`).
- **Sidebar (Desktop):**
  - Giao diện dạng thanh dọc `w-64`, tách rời bằng Border phải.
  - Sử dụng `flex flex-col` cho phép Logo nằm trên cùng, Navigation Links giãn đều ở phần trung tâm (`flex-1`), và Action (Logout) ở dưới cùng.
- **Mobile Tab Bar:** Thanh chức năng dính sát mép dưới (`fixed bottom-0`). Layout trải ngang `flex justify-between`.
- **Main Content Area:** Không gian linh hoạt, tự chiếm phần còn lại với `flex-1 overflow-y-auto`. Nội dung các trang con bên trong được căn vào giữa thông qua `max-w-7xl mx-auto`.

---

### 4. Layout Các Trang Bên Trong Dashboard (Inner Pages)

#### 4.1 Dashboard Tổng quan (`/app/dashboard`)

Lối sắp xếp mạng lưới (Grid System) dày đặc thông tin nhưng không rối mắt. Cấu trúc gồm 4 tầng thẳng đứng:

- **Tầng 1 (Header):** `flex flex-col md:flex-row justify-between items-end`. Căn trái khối Text lời chúc, và đẩy nút CTA ("Tải Extension") về phía phải, viền kẻ dưới (`border-b`).
- **Tầng 2 (Stats - Chỉ số nhanh):** Sử dụng `grid grid-cols-2 md:grid-cols-4 gap-6`. 4 con số quan trọng nằm trải ngang màn hình, thiết kế tối giản hoá bằng những kẻ line ở trên (`border-t-2`) thay vì bọc trọn trong box.
- **Tầng 3 (Biểu đồ):** Một khối hộp vuông vức `p-8` đầy viền kéo dài. Bên trong chia thành vùng Tool Header (`flex justify-between items-end`) để chứa Tiêu đề và Nút lọc ngày, và bên dưới là vùng biểu đồ tĩnh (`h-64`) bọc gói `Recharts`.
- **Tầng 4 (Thực hành & Lịch sử):** `grid md:grid-cols-3`. Chia theo tỷ lệ 2:1.
  - Khu vực Call-to-action Practice chiếm 2 phần (`md:col-span-2`), sử dụng `flex flex-col justify-between`.
  - Khu vực "Từ lưu gần đây" chiếm 1 phần, trình bày danh sách dạng cột đứng, nội dung các từ được flex dòng (`flex items-center gap-2`).

#### 4.2 Practice Room (`/app/practice`)

Một bố cục tập trung cao độ, chiếm trọn chiều cao màn hiển thị.

- **Wrapper Constraint:** Lấy chiều cao View Height trừ đi Nav bar (`h-[calc(100vh-4rem)]`), ngắt viền không cho cuộn trang tổng.
- **Header:** Layout flex hai đầu `justify-between`, thông tin session (01 of 04) được gắn số hiển thị cực lớn nằm mép bên phải.
- **Container Sân Khấu (Flashcard Area):** Trải rộng phần chiều cao còn lại (`flex-1`) và đặt nội dung chính xác ở trung tâm (`items-center justify-center`). Vùng xung quanh đổ màu xám nhẹ (`bg-background/30`) tạo chiều sâu.
- **Khối Flashcard (3D Card):**
  - Khung giới hạn `max-w-2xl h-[28rem] relative` bọc bởi Perspective: 1000px ("không gian 3 chiều").
  - Mặt trước và mặt sau thẻ bài đều xếp chồng nhau ở toạ độ gốc (`absolute inset-0`), dùng `backface-hidden` che đi mặt không nhàn rỗi. Text bên trong thẻ được `flex flex-col items-center justify-center text-center`.
- **Thanh Điều khiển:** Bộ ba nút (Back - Flip - Next) đặt ở dưới qua lệnh `mt-12 flex gap-6`.

#### 4.3 Vocabulary List (`/app/vocabulary`)

Trang danh sách dữ liệu trình bày theo mô tuýp "Header - Filter - Grid Items".

- **Header:** Giống trang chủ Dashboard với Title cỡ lớn in nghiêng dấu chấm.
- **Filter Toolbar:** Một thanh dòng cuộn. Trên Desktop sẽ chia 2 nửa `justify-between` (Trái: Tabs, Phải: Input Filter). Trên Mobile tự động nhảy xuống `flex-col` hai dòng. Tabbar sử dụng hiệu ứng viền gạch chân (`border-bottom`). Thanh search loại bỏ border-box, chỉ chừa 1 line mỏng bên dưới như form Login.
- **Word Grid System:** Tuỳ biến kích cỡ viewport: ngang Mobile sẽ hiển thị 1 cột, lên Tablet thành 2 cột (`sm:grid-cols-2`), Desktop thành 3 cột (`lg:grid-cols-3`).
- **Word Card (Item):** Box trắng chứa viền (border). Dùng relative layout. Mặt trên chứa Heading + Phát âm (flex ngang) + Nút phát âm (góc phải); dải phân cách; Mặt dưới chứa Nghĩa tiếng việt. Dùng line giả 1 pixel nằm gắn vách trên góc trái để tô màu điểm nhấn trạng thái (Status indicator line).

#### 4.4 Profile (`/app/profile`)

Trang cài đặt tập trung hiển thị hẹp lại ở giữa màn hình chứ không bành trướng tối đa.

- **Container Tối đa:** `max-w-4xl mx-auto` để dồn nội dung vào giữa.
- **Grid Layout phân bổ thông tin:** Mạng lưới chia 3 cột (`grid md:grid-cols-3`).
  - **Left Sidebar (Info):** Chiếm tỷ lệ 1/3 (`md:col-span-1`). Tối ưu hoá hiển thị xếp dọc trung tâm `flex flex-col items-center`. Chứa Avatar (khoanh lớp viền), Tên người dùng và Badge huy hiệu.
  - **Right Main (Stats & Actions):** Chiếm tỉ lệ 2/3 (`md:col-span-2`). Bố cục theo chiều dọc chứa:
    - _Mini Stats Grid_: Chia nhánh 2 ô thống kê nhỏ đều nhau bên trên.
    - _Settings List Module_: Một panel được list dọc. Mỗi hàng (Row) là một Flex container căn ngang `justify-between p-6`, gạch chân ngăn cách nhờ phân giải `divide-y divide-foreground/10`. Tên Cài đặt bên trái (Icon + Text), Trạng thái phụ ở lề phía tay phải.

---

## Tương tác & Trải nghiệm (UX Highlights)

1. **Micro-interactions:** Mọi nút bấm (buttons), Links, icon (có bo tròn) hay thẻ từ vựng đều tích hợp state: `hover:bg` hoặc dịch chuyển nhỏ đối với Icon mũi tên (`group-hover:translate-x-1`), tạo tín hiệu tốt tới User.
2. **Page Transitions:** Tích hợp `animate-in fade-in duration-500` cho vùng không gian Main của mọi trang trong web app thông báo quá trình tải nội dung/Route đã xong.
3. **Flashcard 3D Mechanics:** Việc kết hợp `rotateX(180deg)` kết hợp config vật lí 3D của `framer-motion` (Spring Type, stiffness: 260) giúp việc lặp thẻ mượt và mang cảm giác thật trên tay.
4. **Tránh nhiễu (Noise reduction):** Sử dụng các đường kẻ rất mảnh, kết hợp font xám (`opacity-40` tới `opacity-60`) ở các chi tiết phụ giúp mắt người dùng tự động bắt trúng thông tin mang typography chủ thể.
