import { StudentScore } from '../types';
import { classifyScore, DEFAULT_THRESHOLDS } from '../utils/scoreClassifier';

interface RawStudentInput {
  tt: number;
  soBD: string;
  hoTen: string;
  lop: string;
  ngaySinh: string;
  danToc: string;
  khoi: string;
  diem: number | null;
  giaoVien: string;
  monHoc: string;
  ghiChu?: string;
}

// Dữ liệu mẫu chuẩn hóa 100% khớp với biểu mẫu thực tế của trường:
// Đủ 3 khối: Khối 10 (10B1-10B6), Khối 11 (11B1-11B5), Khối 12 (12B1-12B5)
// Đủ 12 môn: Toán, Văn, Tiếng Anh, Vật lý, Hóa, Sinh, Sử, Địa, Tin, KTPL, CNCN, CNNN
const initialSampleStudents: RawStudentInput[] = [
  // --- KHỐI 10: Môn Toán ---
  { tt: 1, soBD: "170001", hoTen: "Hoàng Minh Anh", lop: "10B3", ngaySinh: "11/17/2010", danToc: "Kinh", khoi: "Khối 10", diem: 5.8, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 2, soBD: "170002", hoTen: "Lương Nhất Lê Anh", lop: "10B3", ngaySinh: "10/23/2010", danToc: "Thái", khoi: "Khối 10", diem: 5.3, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 3, soBD: "170003", hoTen: "Bùi Thị Lan Anh", lop: "10B5", ngaySinh: "12/4/2009", danToc: "Mường", khoi: "Khối 10", diem: 5.5, giaoVien: "Lê Thị Như", monHoc: "Toán" },
  { tt: 4, soBD: "170004", hoTen: "A Âu", lop: "10B3", ngaySinh: "11/8/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.3, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán", ghiChu: "Cần kèm thêm" },
  { tt: 5, soBD: "170005", hoTen: "A Bang", lop: "10B1", ngaySinh: "9/13/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.2, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 6, soBD: "170006", hoTen: "Y Bích", lop: "10B2", ngaySinh: "7/7/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 3.8, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Toán", ghiChu: "Yếu đại số" },
  { tt: 7, soBD: "170007", hoTen: "Y Bích", lop: "10B6", ngaySinh: "10/1/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.5, giaoVien: "Mai Thị Thủy", monHoc: "Toán" },
  { tt: 8, soBD: "170008", hoTen: "A Bin", lop: "10B5", ngaySinh: "10/11/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Toán" },
  { tt: 9, soBD: "170009", hoTen: "Tống Thanh Bình", lop: "10B3", ngaySinh: "9/6/2010", danToc: "Kinh", khoi: "Khối 10", diem: 3.8, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 10, soBD: "170010", hoTen: "A To By", lop: "10B1", ngaySinh: "4/24/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 11, soBD: "170011", hoTen: "A Cư", lop: "10B4", ngaySinh: "2/25/2010", danToc: "Xơ-đăng", khoi: "Khối 10", diem: 3.3, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 12, soBD: "170012", hoTen: "Nguyễn Thị Diệu Châu", lop: "10B2", ngaySinh: "8/15/2010", danToc: "Kinh", khoi: "Khối 10", diem: 8.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 13, soBD: "170013", hoTen: "Trần Đình Chiến", lop: "10B4", ngaySinh: "3/12/2010", danToc: "Kinh", khoi: "Khối 10", diem: 9.2, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 14, soBD: "170014", hoTen: "Phan Văn Cương", lop: "10B3", ngaySinh: "5/20/2010", danToc: "Kinh", khoi: "Khối 10", diem: 7.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 15, soBD: "170015", hoTen: "Đinh Thị Duyên", lop: "10B1", ngaySinh: "6/18/2010", danToc: "Mường", khoi: "Khối 10", diem: 4.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },

  // --- KHỐI 10: Môn Ngữ Văn ---
  { tt: 16, soBD: "170001", hoTen: "Hoàng Minh Anh", lop: "10B3", ngaySinh: "11/17/2010", danToc: "Kinh", khoi: "Khối 10", diem: 7.5, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 17, soBD: "170002", hoTen: "Lương Nhất Lê Anh", lop: "10B3", ngaySinh: "10/23/2010", danToc: "Thái", khoi: "Khối 10", diem: 6.8, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 18, soBD: "170003", hoTen: "Bùi Thị Lan Anh", lop: "10B5", ngaySinh: "12/4/2009", danToc: "Mường", khoi: "Khối 10", diem: 4.5, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 19, soBD: "170004", hoTen: "A Âu", lop: "10B3", ngaySinh: "11/8/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.2, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 20, soBD: "170005", hoTen: "A Bang", lop: "10B1", ngaySinh: "9/13/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 21, soBD: "170006", hoTen: "Y Bích", lop: "10B2", ngaySinh: "7/7/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.8, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 22, soBD: "170007", hoTen: "Y Bích", lop: "10B6", ngaySinh: "10/1/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.2, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 23, soBD: "170008", hoTen: "A Bin", lop: "10B5", ngaySinh: "10/11/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 24, soBD: "170009", hoTen: "Tống Thanh Bình", lop: "10B3", ngaySinh: "9/6/2010", danToc: "Kinh", khoi: "Khối 10", diem: 7.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 25, soBD: "170010", hoTen: "A To By", lop: "10B1", ngaySinh: "4/24/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.5, giaoVien: "Lê Thị Như", monHoc: "Văn" },

  // --- KHỐI 10: Môn Tiếng Anh ---
  { tt: 26, soBD: "170001", hoTen: "Hoàng Minh Anh", lop: "10B3", ngaySinh: "11/17/2010", danToc: "Kinh", khoi: "Khối 10", diem: 6.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 27, soBD: "170002", hoTen: "Lương Nhất Lê Anh", lop: "10B3", ngaySinh: "10/23/2010", danToc: "Thái", khoi: "Khối 10", diem: 7.2, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 28, soBD: "170003", hoTen: "Bùi Thị Lan Anh", lop: "10B5", ngaySinh: "12/4/2009", danToc: "Mường", khoi: "Khối 10", diem: 4.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 29, soBD: "170004", hoTen: "A Âu", lop: "10B3", ngaySinh: "11/8/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh", ghiChu: "Yếu từ vựng" },
  { tt: 30, soBD: "170005", hoTen: "A Bang", lop: "10B1", ngaySinh: "9/13/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.8, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 31, soBD: "170006", hoTen: "Y Bích", lop: "10B2", ngaySinh: "7/7/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 3.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 32, soBD: "170007", hoTen: "Y Bích", lop: "10B6", ngaySinh: "10/1/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 33, soBD: "170008", hoTen: "A Bin", lop: "10B5", ngaySinh: "10/11/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.2, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 34, soBD: "170009", hoTen: "Tống Thanh Bình", lop: "10B3", ngaySinh: "9/6/2010", danToc: "Kinh", khoi: "Khối 10", diem: 8.2, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 35, soBD: "170010", hoTen: "A To By", lop: "10B1", ngaySinh: "4/24/2010", danToc: "Ba-na", khoi: "Khối 10", diem: null, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh", ghiChu: "Vắng thi có phép" },

  // --- KHỐI 10: Môn Sử ---
  { tt: 36, soBD: "170001", hoTen: "Hoàng Minh Anh", lop: "10B3", ngaySinh: "11/17/2010", danToc: "Kinh", khoi: "Khối 10", diem: 8.8, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 37, soBD: "170002", hoTen: "Lương Nhất Lê Anh", lop: "10B3", ngaySinh: "10/23/2010", danToc: "Thái", khoi: "Khối 10", diem: 8.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 38, soBD: "170003", hoTen: "Bùi Thị Lan Anh", lop: "10B5", ngaySinh: "12/4/2009", danToc: "Mường", khoi: "Khối 10", diem: 4.5, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 39, soBD: "170004", hoTen: "A Âu", lop: "10B3", ngaySinh: "11/8/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.8, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 40, soBD: "170005", hoTen: "A Bang", lop: "10B1", ngaySinh: "9/13/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 6.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 41, soBD: "170006", hoTen: "Y Bích", lop: "10B2", ngaySinh: "7/7/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.8, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 42, soBD: "170007", hoTen: "Y Bích", lop: "10B6", ngaySinh: "10/1/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.5, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 43, soBD: "170008", hoTen: "A Bin", lop: "10B5", ngaySinh: "10/11/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.5, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 44, soBD: "170009", hoTen: "Tống Thanh Bình", lop: "10B3", ngaySinh: "9/6/2010", danToc: "Kinh", khoi: "Khối 10", diem: 9.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 45, soBD: "170010", hoTen: "A To By", lop: "10B1", ngaySinh: "4/24/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 5.8, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },

  // --- CÁC MÔN CÒN LẠI CHO KHỐI 10 (Vật lý, Hóa, Sinh, Địa, Tin, KTPL, CNCN, CNNN) ---
  { tt: 46, soBD: "170011", hoTen: "A Cư", lop: "10B1", ngaySinh: "2/25/2010", danToc: "Xơ-đăng", khoi: "Khối 10", diem: 4.0, giaoVien: "Trần Đình Hùng", monHoc: "Vật lý" },
  { tt: 47, soBD: "170012", hoTen: "Nguyễn Thị Diệu Châu", lop: "10B3", ngaySinh: "8/15/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.2, giaoVien: "Trần Đình Hùng", monHoc: "Vật lý" },
  { tt: 48, soBD: "170013", hoTen: "Trần Đình Chiến", lop: "10B4", ngaySinh: "3/12/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.0, giaoVien: "Lê Văn Hóa", monHoc: "Hóa" },
  { tt: 49, soBD: "170014", hoTen: "Phan Văn Cương", lop: "10B5", ngaySinh: "5/20/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.5, giaoVien: "Lê Văn Hóa", monHoc: "Hóa" },
  { tt: 50, soBD: "170015", hoTen: "Đinh Thị Duyên", lop: "10B6", ngaySinh: "6/18/2010", danToc: "Mường", khoi: "Khối 10", diem: 4.0, giaoVien: "Lê Văn Hóa", monHoc: "Hóa" },
  { tt: 51, soBD: "170001", hoTen: "Hoàng Minh Anh", lop: "10B2", ngaySinh: "11/17/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.2, giaoVien: "Phạm Sinh Viên", monHoc: "Sinh" },
  { tt: 52, soBD: "170002", hoTen: "Lương Nhất Lê Anh", lop: "10B4", ngaySinh: "10/23/2010", danToc: "Thái", khoi: "Khối 10", diem: 3.8, giaoVien: "Phạm Sinh Viên", monHoc: "Sinh" },
  { tt: 53, soBD: "170003", hoTen: "Bùi Thị Lan Anh", lop: "10B6", ngaySinh: "12/4/2009", danToc: "Mường", khoi: "Khối 10", diem: 4.5, giaoVien: "Phạm Sinh Viên", monHoc: "Sinh" },
  { tt: 54, soBD: "170004", hoTen: "A Âu", lop: "10B1", ngaySinh: "11/8/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.0, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
  { tt: 55, soBD: "170005", hoTen: "A Bang", lop: "10B2", ngaySinh: "9/13/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.5, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
  { tt: 56, soBD: "170006", hoTen: "Y Bích", lop: "10B5", ngaySinh: "7/7/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.2, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
  { tt: 57, soBD: "170007", hoTen: "Y Bích", lop: "10B1", ngaySinh: "10/1/2010", danToc: "Gia-rai", khoi: "Khối 10", diem: 4.0, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 58, soBD: "170008", hoTen: "A Bin", lop: "10B3", ngaySinh: "10/11/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.5, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 59, soBD: "170009", hoTen: "Tống Thanh Bình", lop: "10B2", ngaySinh: "9/6/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.2, giaoVien: "Vũ Pháp Luật", monHoc: "KTPL" },
  { tt: 60, soBD: "170010", hoTen: "A To By", lop: "10B3", ngaySinh: "4/24/2010", danToc: "Ba-na", khoi: "Khối 10", diem: 4.0, giaoVien: "Vũ Pháp Luật", monHoc: "KTPL" },
  { tt: 61, soBD: "170011", hoTen: "A Cư", lop: "10B1", ngaySinh: "2/25/2010", danToc: "Xơ-đăng", khoi: "Khối 10", diem: 4.2, giaoVien: "Đặng Công Nghệ", monHoc: "CNCN" },
  { tt: 62, soBD: "170012", hoTen: "Nguyễn Thị Diệu Châu", lop: "10B3", ngaySinh: "8/15/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.0, giaoVien: "Đặng Công Nghệ", monHoc: "CNCN" },
  { tt: 63, soBD: "170013", hoTen: "Trần Đình Chiến", lop: "10B5", ngaySinh: "3/12/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.5, giaoVien: "Đặng Công Nghệ", monHoc: "CNCN" },
  { tt: 64, soBD: "170014", hoTen: "Phan Văn Cương", lop: "10B2", ngaySinh: "5/20/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.0, giaoVien: "Lâm Nông Nghiệp", monHoc: "CNNN" },
  { tt: 65, soBD: "170015", hoTen: "Đinh Thị Duyên", lop: "10B4", ngaySinh: "6/18/2010", danToc: "Mường", khoi: "Khối 10", diem: 4.2, giaoVien: "Lâm Nông Nghiệp", monHoc: "CNNN" },
  { tt: 66, soBD: "170016", hoTen: "Vũ Văn Giang", lop: "10B6", ngaySinh: "1/10/2010", danToc: "Kinh", khoi: "Khối 10", diem: 4.5, giaoVien: "Lâm Nông Nghiệp", monHoc: "CNNN" },

  // --- KHỐI 11: Đủ 5 lớp 11B1..11B5 ---
  { tt: 67, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 68, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 69, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.2, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 70, soBD: "180004", hoTen: "Đỗ Quốc Đạt", lop: "11B4", ngaySinh: "10/5/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 71, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 72, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 73, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 74, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.2, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 75, soBD: "180004", hoTen: "Đỗ Quốc Đạt", lop: "11B4", ngaySinh: "10/5/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 76, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.2, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 77, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 78, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.2, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 79, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 80, soBD: "180004", hoTen: "Đỗ Quốc Đạt", lop: "11B4", ngaySinh: "10/5/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 81, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 82, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Trần Đình Hùng", monHoc: "Vật lý" },
  { tt: 83, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Lê Văn Hóa", monHoc: "Hóa" },
  { tt: 84, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.2, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 85, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 86, soBD: "180004", hoTen: "Đỗ Quốc Đạt", lop: "11B4", ngaySinh: "10/5/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 87, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 88, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
  { tt: 89, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.0, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
  { tt: 90, soBD: "180001", hoTen: "Lê Hoàng Bảo", lop: "11B1", ngaySinh: "5/12/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 91, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.2, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 92, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.0, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 93, soBD: "180004", hoTen: "Đỗ Quốc Đạt", lop: "11B4", ngaySinh: "10/5/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.5, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 94, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.0, giaoVien: "Ngô Tin Học", monHoc: "Tin" },
  { tt: 95, soBD: "180002", hoTen: "Trần Gia Huy", lop: "11B2", ngaySinh: "3/14/2009", danToc: "Kinh", khoi: "Khối 11", diem: 4.0, giaoVien: "Vũ Pháp Luật", monHoc: "KTPL" },
  { tt: 96, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.5, giaoVien: "Vũ Pháp Luật", monHoc: "KTPL" },
  { tt: 97, soBD: "180003", hoTen: "Ngô Diệu Linh", lop: "11B3", ngaySinh: "8/22/2009", danToc: "Mường", khoi: "Khối 11", diem: 4.0, giaoVien: "Đặng Công Nghệ", monHoc: "CNCN" },
  { tt: 98, soBD: "180005", hoTen: "Phan Tuấn Kiệt", lop: "11B5", ngaySinh: "7/19/2009", danToc: "Ba-na", khoi: "Khối 11", diem: 4.2, giaoVien: "Đặng Công Nghệ", monHoc: "CNCN" },

  // --- KHỐI 12: Đủ 5 lớp 12B1..12B5 ---
  { tt: 99, soBD: "190001", hoTen: "Vũ Đình Trọng", lop: "12B1", ngaySinh: "1/15/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 100, soBD: "190002", hoTen: "Nguyễn Hải Đăng", lop: "12B2", ngaySinh: "6/20/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.2, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 101, soBD: "190003", hoTen: "Lê Thị Mai", lop: "12B3", ngaySinh: "9/9/2008", danToc: "Thái", khoi: "Khối 12", diem: 4.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 102, soBD: "190004", hoTen: "Phạm Hồng Phúc", lop: "12B4", ngaySinh: "11/3/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 103, soBD: "190005", hoTen: "Hoàng Gia Bảo", lop: "12B5", ngaySinh: "4/28/2008", danToc: "Kinh", khoi: "Khối 12", diem: 7.5, giaoVien: "Trần Thị Mỹ Tuyên", monHoc: "Toán" },
  { tt: 104, soBD: "190001", hoTen: "Vũ Đình Trọng", lop: "12B1", ngaySinh: "1/15/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.5, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 105, soBD: "190003", hoTen: "Lê Thị Mai", lop: "12B3", ngaySinh: "9/9/2008", danToc: "Thái", khoi: "Khối 12", diem: 4.0, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 106, soBD: "190004", hoTen: "Phạm Hồng Phúc", lop: "12B4", ngaySinh: "11/3/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.2, giaoVien: "Lê Thị Như", monHoc: "Văn" },
  { tt: 107, soBD: "190001", hoTen: "Vũ Đình Trọng", lop: "12B1", ngaySinh: "1/15/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 108, soBD: "190002", hoTen: "Nguyễn Hải Đăng", lop: "12B2", ngaySinh: "6/20/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.5, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 109, soBD: "190003", hoTen: "Lê Thị Mai", lop: "12B3", ngaySinh: "9/9/2008", danToc: "Thái", khoi: "Khối 12", diem: 4.2, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 110, soBD: "190004", hoTen: "Phạm Hồng Phúc", lop: "12B4", ngaySinh: "11/3/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Mai Thị Thủy", monHoc: "Tiếng Anh" },
  { tt: 111, soBD: "190001", hoTen: "Vũ Đình Trọng", lop: "12B1", ngaySinh: "1/15/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Lê Văn Hóa", monHoc: "Hóa" },
  { tt: 112, soBD: "190001", hoTen: "Vũ Đình Trọng", lop: "12B1", ngaySinh: "1/15/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.5, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 113, soBD: "190003", hoTen: "Lê Thị Mai", lop: "12B3", ngaySinh: "9/9/2008", danToc: "Thái", khoi: "Khối 12", diem: 4.0, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 114, soBD: "190004", hoTen: "Phạm Hồng Phúc", lop: "12B4", ngaySinh: "11/3/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.2, giaoVien: "Nguyễn Thanh Dũng", monHoc: "Sử" },
  { tt: 115, soBD: "190002", hoTen: "Nguyễn Hải Đăng", lop: "12B2", ngaySinh: "6/20/2008", danToc: "Kinh", khoi: "Khối 12", diem: 4.0, giaoVien: "Hoàng Địa Lý", monHoc: "Địa" },
];

/**
 * Sinh danh sách học sinh mẫu theo các đợt điểm (KS đầu năm, GKI - HK1, CKI - HK1, GKII - HK2, CKII - HK2)
 * Bao quát 3 khối: Khối 10, Khối 11, Khối 12 và 12 môn chuẩn
 */
export function getSampleStudents(targetYear = '2025-2026'): StudentScore[] {
  const allGenerated: StudentScore[] = [];

  const periodsConfig = [
    { academicYear: targetYear, semester: 'KS', period: 'KS', scoreDelta: -0.3 },
    { academicYear: targetYear, semester: 'HK1', period: 'GKI', scoreDelta: 0 },
    { academicYear: targetYear, semester: 'HK1', period: 'CKI', scoreDelta: 0.4 },
    { academicYear: targetYear, semester: 'HK2', period: 'GKII', scoreDelta: 0.6 },
    { academicYear: targetYear, semester: 'HK2', period: 'CKII', scoreDelta: 0.9 },
  ];

  periodsConfig.forEach((cfg) => {
    initialSampleStudents.forEach((s, index) => {
      let finalScore: number | null = null;
      if (s.diem !== null) {
        let calc = s.diem + (cfg.scoreDelta * ((index % 3 === 0) ? 1 : (index % 4 === 0) ? -0.3 : 0.5));
        calc = Math.max(2.0, Math.min(10.0, calc));
        finalScore = Number(calc.toFixed(1));
      } else if (cfg.period === 'CKI' || cfg.period === 'CKII') {
        finalScore = 6.0; // Thi lại đợt cuối kỳ
      }

      const rank = classifyScore(finalScore, DEFAULT_THRESHOLDS);
      const compositeId = `${cfg.academicYear}_${cfg.semester}_${cfg.period}_${s.monHoc}_${s.lop}_${s.soBD}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();

      allGenerated.push({
        id: compositeId,
        subject: s.monHoc,
        studentId: s.soBD,
        fullName: s.hoTen,
        class: s.lop,
        dob: s.ngaySinh,
        ethnicity: s.danToc,
        grade: s.khoi,
        score: finalScore,
        teacherName: s.giaoVien,
        rank: rank,

        academicYear: cfg.academicYear,
        semester: cfg.semester,
        period: cfg.period,

        // Aliases tiếng Việt
        tt: s.tt,
        soBD: s.soBD,
        hoTen: s.hoTen,
        lop: s.lop,
        ngaySinh: s.ngaySinh,
        danToc: s.danToc,
        khoi: s.khoi,
        diem: finalScore,
        giaoVien: s.giaoVien,
        monHoc: s.monHoc,
        xepLoai: rank,
        namHoc: cfg.academicYear,
        hocKy: cfg.semester,
        dotDiem: cfg.period,
        ghiChu: s.ghiChu || '',
      });
    });
  });

  return allGenerated;
}
