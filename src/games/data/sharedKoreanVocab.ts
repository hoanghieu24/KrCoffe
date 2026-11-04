import { speakKorean } from '../../services/cafeMusicEngine'

export type VocabTopic =
  | 'Chào hỏi'
  | 'Gia đình'
  | 'Trường học'
  | 'Đồ vật'
  | 'Thức ăn'
  | 'Địa điểm'
  | 'Giao thông'
  | 'Động từ'
  | 'Tính từ'
  | 'Giao tiếp hằng ngày'

export type VocabTopikLevel = 'TOPIK I' | 'TOPIK II'

export type SharedVocabWord = {
  id: number
  hangul: string
  syllables: string[]
  romanization: string
  meaningVi: string
  acceptedVi: string[]
  level: VocabTopikLevel
  topic: VocabTopic
  exampleKo: string
  exampleVi: string
  /**
   * Optional real audio path (e.g. '/assets/audio/vocab-001.mp3').
   * Left undefined when static audio file is not yet bundled — never uses fake broken URLs.
   */
  audioUrl?: string
}

export const VOCAB_TOPICS: VocabTopic[] = [
  'Chào hỏi',
  'Gia đình',
  'Trường học',
  'Đồ vật',
  'Thức ăn',
  'Địa điểm',
  'Giao thông',
  'Động từ',
  'Tính từ',
  'Giao tiếp hằng ngày',
]

type RawEntry = [
  id: number,
  hangul: string,
  romanization: string,
  meaningVi: string,
  extraVi: string[],
  level: VocabTopikLevel,
  topic: VocabTopic,
  exampleKo: string,
  exampleVi: string,
]

const RAW_WORDS: RawEntry[] = [
  // 1. Chào hỏi (10 words)
  [1, '안녕', 'annyeong', 'Xin chào', ['chào', 'xin chao'], 'TOPIK I', 'Chào hỏi', '안녕! 오늘 기분이 어때?', 'Chào cậu! Hôm nay tâm trạng thế nào?'],
  [2, '인사', 'insa', 'Lời chào', ['chào hỏi'], 'TOPIK I', 'Chào hỏi', '밝게 인사를 나누어요.', 'Cùng trao nhau lời chào tươi tắn.'],
  [3, '환영', 'hwanyeong', 'Hoan nghênh', ['chào mừng'], 'TOPIK I', 'Chào hỏi', '카페에 오신 것을 환영해요.', 'Chào mừng bạn đến với quán cà phê.'],
  [4, '반가워', 'bangawo', 'Rất vui được gặp', ['vui gặp bạn'], 'TOPIK I', 'Chào hỏi', '만나서 정말 반가워!', 'Rất vui được gặp cậu!'],
  [5, '고마워', 'gomawo', 'Cảm ơn nhé', ['cảm ơn', 'cám ơn'], 'TOPIK I', 'Chào hỏi', '도와줘서 정말 고마워.', 'Cảm ơn cậu nhiều vì đã giúp mình.'],
  [6, '미안해', 'mianhae', 'Xin lỗi nhé', ['xin lỗi'], 'TOPIK I', 'Chào hỏi', '조금 늦어서 미안해.', 'Xin lỗi vì mình đến hơi muộn.'],
  [7, '안녕하세요', 'annyeonghaseyo', 'Xin chào lịch sự', ['xin chào'], 'TOPIK I', 'Chào hỏi', '선생님, 안녕하세요!', 'Em chào thầy/cô ạ!'],
  [8, '감사합니다', 'gamsahamnida', 'Xin cảm ơn', ['cảm ơn', 'cám ơn'], 'TOPIK I', 'Chào hỏi', '친절하게 알려 주셔서 감사합니다.', 'Xin cảm ơn vì đã chỉ dẫn tận tình.'],
  [9, '죄송합니다', 'joesonghamnida', 'Thành thật xin lỗi', ['xin lỗi'], 'TOPIK I', 'Chào hỏi', '기다리게 해서 죄송합니다.', 'Thành thật xin lỗi vì đã để bạn đợi.'],
  [10, '오랜만이야', 'oraenmaniya', 'Lâu rồi không gặp', ['lâu không gặp'], 'TOPIK II', 'Chào hỏi', '우리 정말 오랜만이야!', 'Tụi mình thật sự lâu lắm rồi mới gặp!'],

  // 2. Gia đình (10 words)
  [11, '가족', 'gajok', 'Gia đình', ['nhà'], 'TOPIK I', 'Gia đình', '주말에 가족과 식사해요.', 'Cuối tuần tôi dùng bữa cùng gia đình.'],
  [12, '부모', 'bumo', 'Bố mẹ', ['cha mẹ'], 'TOPIK I', 'Gia đình', '부모님께 전화를 드렸어요.', 'Tôi đã gọi điện cho bố mẹ.'],
  [13, '언니', 'eonni', 'Chị gái', ['chị'], 'TOPIK I', 'Gia đình', '언니와 함께 카페에 왔어요.', 'Em đến quán cà phê cùng chị gái.'],
  [14, '오빠', 'oppa', 'Anh trai', ['anh'], 'TOPIK I', 'Gia đình', '오빠는 요리를 잘해요.', 'Anh trai nấu ăn rất giỏi.'],
  [15, '동생', 'dongsaeng', 'Em', ['em trai', 'em gái'], 'TOPIK I', 'Gia đình', '동생에게 한국어를 가르쳐요.', 'Tôi dạy tiếng Hàn cho em.'],
  [16, '어머니', 'eomeoni', 'Mẹ', ['má'], 'TOPIK I', 'Gia đình', '어머니께서 차를 좋아하세요.', 'Mẹ tôi rất thích uống trà.'],
  [17, '아버지', 'abeoji', 'Bố', ['cha', 'ba'], 'TOPIK I', 'Gia đình', '아버지와 공원을 산책해요.', 'Tôi đi dạo công viên cùng bố.'],
  [18, '할머니', 'halmeoni', 'Bà', ['bà nội', 'bà ngoại'], 'TOPIK I', 'Gia đình', '할머니 댁에 놀러 갔어요.', 'Tôi đã về thăm nhà bà.'],
  [19, '할아버지', 'harabeoji', 'Ông', ['ông nội', 'ông ngoại'], 'TOPIK I', 'Gia đình', '할아버지께서 이야기를 들려주셨어요.', 'Ông đã kể chuyện cho chúng tôi nghe.'],
  [20, '친척분들', 'chincheokbundeul', 'Họ hàng', ['người thân'], 'TOPIK II', 'Gia đình', '명절에 친척분들을 만났어요.', 'Vào dịp lễ tôi đã gặp gỡ họ hàng.'],

  // 3. Trường học (10 words)
  [21, '학교', 'hakgyo', 'Trường học', ['trường'], 'TOPIK I', 'Trường học', '학교 앞 카페에서 만나요.', 'Gặp nhau ở quán cà phê trước trường nhé.'],
  [22, '학생', 'haksaeng', 'Học sinh', ['sinh viên'], 'TOPIK I', 'Trường học', '한국어를 배우는 학생이에요.', 'Tôi là học sinh đang học tiếng Hàn.'],
  [23, '교실', 'gyosil', 'Lớp học', ['phòng học'], 'TOPIK I', 'Trường học', '교실 창문이 아주 넓어요.', 'Cửa sổ lớp học rất rộng.'],
  [24, '숙제', 'sukje', 'Bài tập về nhà', ['bài tập'], 'TOPIK I', 'Trường học', '오늘 숙제를 모두 끝냈어요.', 'Hôm nay tôi đã làm xong hết bài tập.'],
  [25, '시험', 'siheom', 'Kỳ thi', ['bài thi'], 'TOPIK I', 'Trường học', '다음 주에 토픽 시험이 있어요.', 'Tuần sau có kỳ thi TOPIK.'],
  [26, '선생님', 'seonsaengnim', 'Giáo viên', ['thầy giáo', 'cô giáo'], 'TOPIK I', 'Trường học', '선생님께서 천천히 읽어 주셨어요.', 'Thầy/cô đã đọc thật chậm rãi.'],
  [27, '도서관', 'doseogwan', 'Thư viện', [], 'TOPIK I', 'Trường học', '도서관에서 조용히 책을 읽어요.', 'Tôi đọc sách yên tĩnh ở thư viện.'],
  [28, '대학교', 'daehakgyo', 'Trường đại học', ['đại học'], 'TOPIK I', 'Trường học', '서울에 있는 대학교에 다녀요.', 'Tôi theo học trường đại học ở Seoul.'],
  [29, '장학금', 'janghakgeum', 'Học bổng', [], 'TOPIK II', 'Trường học', '열심히 공부해서 장학금을 받았어요.', 'Nhờ học chăm chỉ nên tôi nhận được học bổng.'],
  [30, '졸업식날', 'joreopsiknal', 'Ngày lễ tốt nghiệp', ['lễ tốt nghiệp'], 'TOPIK II', 'Trường học', '졸업식날 친구들과 사진을 찍었어요.', 'Ngày tốt nghiệp tôi chụp ảnh cùng bạn bè.'],

  // 4. Đồ vật (10 words)
  [31, '가방', 'gabang', 'Cặp sách', ['túi xách', 'ba lô'], 'TOPIK I', 'Đồ vật', '가방 안에 공책이 있어요.', 'Trong cặp có quyển vở.'],
  [32, '시계', 'sigye', 'Đồng hồ', [], 'TOPIK I', 'Đồ vật', '벽에 나무 시계가 걸려 있어요.', 'Trên tường treo chiếc đồng hồ gỗ.'],
  [33, '우산', 'usan', 'Cái ô', ['cây dù', 'ô'], 'TOPIK I', 'Đồ vật', '비가 오니까 우산을 챙기세요.', 'Trời mưa nên hãy mang theo ô nhé.'],
  [34, '의자', 'uija', 'Cái ghế', ['ghế'], 'TOPIK I', 'Đồ vật', '창가 의자에 앉아 보세요.', 'Hãy thử ngồi ghế cạnh cửa sổ xem.'],
  [35, '안경', 'angyeong', 'Mắt kính', ['kính'], 'TOPIK I', 'Đồ vật', '책을 읽을 때 안경을 써요.', 'Tôi đeo kính khi đọc sách.'],
  [36, '컴퓨터', 'keompyuteo', 'Máy tính', [], 'TOPIK I', 'Đồ vật', '컴퓨터로 온라인 강의를 들어요.', 'Tôi nghe bài giảng trực tuyến bằng máy tính.'],
  [37, '노트북', 'noteubuk', 'Máy tính xách tay', ['laptop'], 'TOPIK I', 'Đồ vật', '카페에 노트북을 가져왔어요.', 'Tôi mang laptop đến quán cà phê.'],
  [38, '휴대폰', 'hyudaepon', 'Điện thoại di động', ['điện thoại'], 'TOPIK I', 'Đồ vật', '휴대폰으로 단어장을 보아요.', 'Tôi xem sổ từ vựng trên điện thoại.'],
  [39, '이어폰', 'ieopon', 'Tai nghe', [], 'TOPIK I', 'Đồ vật', '이어폰으로 발음을 다시 들어요.', 'Tôi nghe lại phát âm bằng tai nghe.'],
  [40, '사진첩들', 'sajincheopdeul', 'Những cuốn album ảnh', ['album ảnh'], 'TOPIK II', 'Đồ vật', '추억이 담긴 사진첩들을 펼쳐 보았어요.', 'Tôi mở xem những cuốn album đầy kỷ niệm.'],

  // 5. Thức ăn (12 words)
  [41, '커피', 'keopi', 'Cà phê', ['cafe'], 'TOPIK I', 'Thức ăn', '따뜻한 커피 한 잔 주세요.', 'Cho tôi một tách cà phê ấm.'],
  [42, '우유', 'uyu', 'Sữa', ['sữa tươi'], 'TOPIK I', 'Thức ăn', '아침마다 신선한 우유를 마셔요.', 'Mỗi sáng tôi đều uống sữa tươi.'],
  [43, '녹차', 'nokcha', 'Trà xanh', [], 'TOPIK I', 'Thức ăn', '달콤한 케이크와 녹차가 잘 어울려요.', 'Bánh kem ngọt rất hợp với trà xanh.'],
  [44, '김밥', 'gimbap', 'Cơm cuộn Hàn Quốc', ['cơm cuộn', 'kimbap'], 'TOPIK I', 'Thức ăn', '소풍 갈 때 김밥을 싸 가요.', 'Khi đi dã ngoại tôi mang theo cơm cuộn.'],
  [45, '과일', 'gwail', 'Trái cây', ['hoa quả'], 'TOPIK I', 'Thức ăn', '계절 과일이 정말 신선해요.', 'Trái cây theo mùa thật tươi ngon.'],
  [46, '떡볶이', 'tteokbokki', 'Bánh gạo cay', ['bánh gạo'], 'TOPIK I', 'Thức ăn', '비 오는 날 떡볶이가 생각나요.', 'Ngày mưa lại nhớ món bánh gạo cay.'],
  [47, '비빔밥', 'bibimbap', 'Cơm trộn', [], 'TOPIK I', 'Thức ăn', '야채가 많은 비빔밥을 좋아해요.', 'Tôi thích món cơm trộn nhiều rau.'],
  [48, '케이크', 'keikeu', 'Bánh kem', ['bánh ngọt'], 'TOPIK I', 'Thức ăn', '생일 축하 케이크를 샀어요.', 'Tôi đã mua bánh kem mừng sinh nhật.'],
  [49, '삼겹살', 'samgyeopsal', 'Thịt ba chỉ nướng', ['thịt nướng'], 'TOPIK I', 'Thức ăn', '저녁에 친구들과 삼겹살을 먹었어요.', 'Buổi tối tôi ăn thịt nướng cùng bạn bè.'],
  [50, '아메리카노', 'amerikano', 'Cà phê Americano', ['americano'], 'TOPIK I', 'Thức ăn', '아이스 아메리카노 한 잔 부탁해요.', 'Cho mình một ly Americano đá nhé.'],
  [51, '딸기케이크', 'ttalgikeikeu', 'Bánh kem dâu', ['bánh dâu'], 'TOPIK I', 'Thức ăn', '부드러운 딸기케이크를 주문했어요.', 'Tôi đã gọi món bánh kem dâu mềm mịn.'],
  [52, '김치찌개', 'gimchijjigae', 'Canh kim chi', [], 'TOPIK II', 'Thức ăn', '따끈한 김치찌개가 밥과 잘 맞아요.', 'Canh kim chi nóng hổi rất đưa cơm.'],

  // 6. Địa điểm (10 words)
  [53, '카페', 'kape', 'Quán cà phê', ['tiệm cà phê'], 'TOPIK I', 'Địa điểm', '조용한 카페에서 단어를 외워요.', 'Tôi học thuộc từ vựng ở quán cà phê yên tĩnh.'],
  [54, '공원', 'gongwon', 'Công viên', [], 'TOPIK I', 'Địa điểm', '저녁에 강변 공원을 걸어요.', 'Buổi tối tôi đi bộ ở công viên bờ sông.'],
  [55, '서점', 'seojeom', 'Hiệu sách', ['nhà sách'], 'TOPIK I', 'Địa điểm', '서점에서 한국어 교재를 샀어요.', 'Tôi mua giáo trình tiếng Hàn ở hiệu sách.'],
  [56, '병원', 'byeongwon', 'Bệnh viện', [], 'TOPIK I', 'Địa điểm', '감기에 걸려서 병원에 갔어요.', 'Vì bị cảm nên tôi đã đi bệnh viện.'],
  [57, '은행', 'eunhaeng', 'Ngân hàng', [], 'TOPIK I', 'Địa điểm', '은행은 오후 네 시에 닫아요.', 'Ngân hàng đóng cửa lúc bốn giờ chiều.'],
  [58, '백화점', 'baekhwajeom', 'Trung tâm thương mại', [], 'TOPIK I', 'Địa điểm', '주말에 백화점에 사람이 많아요.', 'Cuối tuần trung tâm thương mại rất đông người.'],
  [59, '편의점', 'pyeonuijeom', 'Cửa hàng tiện lợi', [], 'TOPIK I', 'Địa điểm', '집 앞 편의점에서 우유를 샀어요.', 'Tôi mua sữa ở cửa hàng tiện lợi trước nhà.'],
  [60, '박물관', 'bangmulgwan', 'Bảo tàng', ['viện bảo tàng'], 'TOPIK II', 'Địa điểm', '한국 역사 박물관을 관람했어요.', 'Tôi đã tham quan bảo tàng lịch sử Hàn Quốc.'],
  [61, '영화관', 'yeonghwagwan', 'Rạp chiếu phim', ['rạp phim'], 'TOPIK I', 'Địa điểm', '금요일 밤에 영화관에 갈까요?', 'Tối thứ Sáu mình đi rạp chiếu phim nhé?'],
  [62, '인천공항', 'incheongonghang', 'Sân bay Incheon', [], 'TOPIK II', 'Địa điểm', '아침 일찍 인천공항에 도착했어요.', 'Tôi đã tới sân bay Incheon từ sáng sớm.'],

  // 7. Giao thông (10 words)
  [63, '버스', 'beoseu', 'Xe buýt', ['xe bus'], 'TOPIK I', 'Giao thông', '학교까지 버스를 타고 가요.', 'Tôi đi xe buýt tới trường.'],
  [64, '기차', 'gicha', 'Tàu hỏa', ['xe lửa'], 'TOPIK I', 'Giao thông', '기차를 타고 부산에 여행 가요.', 'Tôi đi tàu hỏa du lịch Busan.'],
  [65, '택시', 'taeksi', 'Xe taxi', ['taxi'], 'TOPIK I', 'Giao thông', '짐이 많아서 택시를 탔어요.', 'Vì nhiều hành lý nên tôi đi taxi.'],
  [66, '길가', 'gilga', 'Bên đường', ['ven đường'], 'TOPIK II', 'Giao thông', '길가에 벚꽃이 예쁘게 피었어요.', 'Hoa anh đào nở rộ tuyệt đẹp bên đường.'],
  [67, '지하철', 'jihacheol', 'Tàu điện ngầm', [], 'TOPIK I', 'Giao thông', '서울 지하철은 정말 편리해요.', 'Tàu điện ngầm Seoul thật sự rất tiện lợi.'],
  [68, '비행기', 'bihaenggi', 'Máy bay', [], 'TOPIK I', 'Giao thông', '구름 위로 비행기가 날아가요.', 'Máy bay bay phía trên những đám mây.'],
  [69, '자전거', 'jajeongeo', 'Xe đạp', [], 'TOPIK I', 'Giao thông', '한강에서 자전거를 타면 시원해요.', 'Đạp xe bên sông Hàn rất mát mẻ.'],
  [70, '정류장', 'jeongnyujang', 'Trạm dừng xe', ['trạm xe buýt'], 'TOPIK I', 'Giao thông', '버스 정류장에서 친구를 기다려요.', 'Tôi đợi bạn ở trạm dừng xe buýt.'],
  [71, '횡단보도', 'hoengdanbodo', 'Vạch qua đường', ['lối sang đường'], 'TOPIK II', 'Giao thông', '초록불에 횡단보도를 건너세요.', 'Hãy băng qua vạch sang đường khi đèn xanh.'],
  [72, '교통카드', 'gyotongkadeu', 'Thẻ giao thông', [], 'TOPIK I', 'Giao thông', '편의점에서 교통카드를 충전했어요.', 'Tôi nạp tiền thẻ giao thông ở cửa hàng tiện lợi.'],

  // 8. Động từ (10 words)
  [73, '가다', 'gada', 'Đi', [], 'TOPIK I', 'Động từ', '같이 도서관에 가다.', 'Cùng nhau đi đến thư viện.'],
  [74, '먹다', 'meokda', 'Ăn', [], 'TOPIK I', 'Động từ', '맛있는 점심을 먹다.', 'Ăn một bữa trưa thật ngon.'],
  [75, '읽다', 'ikda', 'Đọc', [], 'TOPIK I', 'Động từ', '한국어 소설책을 읽다.', 'Đọc cuốn tiểu thuyết tiếng Hàn.'],
  [76, '듣다', 'deutda', 'Nghe', [], 'TOPIK I', 'Động từ', '잔잔한 피아노 음악을 듣다.', 'Nghe nhạc piano êm dịu.'],
  [77, '만나다', 'mannada', 'Gặp gỡ', ['gặp'], 'TOPIK I', 'Động từ', '주말에 좋은 친구를 만나다.', 'Gặp gỡ người bạn tốt vào cuối tuần.'],
  [78, '배우다', 'baeuda', 'Học', ['học hỏi'], 'TOPIK I', 'Động từ', '새로운 표현을 즐겁게 배우다.', 'Hào hứng học những cách diễn đạt mới.'],
  [79, '마시다', 'masida', 'Uống', [], 'TOPIK I', 'Động từ', '따뜻한 유자차를 마시다.', 'Uống tách trà thanh yên ấm áp.'],
  [80, '공부하다', 'gongbuhada', 'Học tập', ['ôn tập'], 'TOPIK I', 'Động từ', '매일 삼십 분씩 공부하다.', 'Học tập mỗi ngày ba mươi phút.'],
  [81, '이야기하다', 'iyagihada', 'Trò chuyện', ['nói chuyện'], 'TOPIK I', 'Động từ', '같은 테이블에서 이야기하다.', 'Trò chuyện cùng nhau tại bàn.'],
  [82, '연습하다', 'yeonseupada', 'Luyện tập', ['thực hành'], 'TOPIK II', 'Động từ', '정확한 발음을 꾸준히 연습하다.', 'Kiên trì luyện tập phát âm chuẩn xác.'],

  // 9. Tính từ (10 words)
  [83, '좋다', 'jota', 'Tốt', ['hay', 'thích'], 'TOPIK I', 'Tính từ', '오늘 날씨가 정말 좋다.', 'Thời tiết hôm nay thật tuyệt.'],
  [84, '크다', 'keuda', 'To lớn', ['rộng', 'lớn'], 'TOPIK I', 'Tính từ', '카페 창문이 아주 크다.', 'Cửa sổ quán cà phê rất lớn.'],
  [85, '작다', 'jakda', 'Nhỏ nhắn', ['nhỏ'], 'TOPIK I', 'Tính từ', '작고 아늑한 책방이에요.', 'Đó là một tiệm sách nhỏ và ấm cúng.'],
  [86, '많다', 'manta', 'Nhiều', [], 'TOPIK I', 'Tính từ', '배우고 싶은 단어가 많다.', 'Có rất nhiều từ vựng tôi muốn học.'],
  [87, '예쁘다', 'yeppeuda', 'Xinh đẹp', ['đẹp', 'xinh'], 'TOPIK I', 'Tính từ', '찻잔 디자인이 참 예쁘다.', 'Thiết kế tách trà thật xinh xắn.'],
  [88, '맛있다', 'masitda', 'Ngon', ['ngon miệng'], 'TOPIK I', 'Tính từ', '이 집 크루아상이 정말 맛있다.', 'Bánh sừng bò quán này ngon thật sự.'],
  [89, '즐겁다', 'jeulgeopda', 'Vui vẻ', ['hào hứng'], 'TOPIK I', 'Tính từ', '함께 게임을 하니 즐겁다.', 'Cùng chơi game nên thấy thật vui vẻ.'],
  [90, '따뜻하다', 'ttatteutada', 'Ấm áp', ['ấm'], 'TOPIK I', 'Tính từ', '노란 조명이 마음을 따뜻하다.', 'Ánh đèn vàng làm lòng thấy ấm áp.'],
  [91, '조용하다', 'joyonghada', 'Yên tĩnh', ['tĩnh lặng'], 'TOPIK I', 'Tính từ', '밤의 카페는 차분하고 조용하다.', 'Quán cà phê buổi đêm trầm lắng và yên tĩnh.'],
  [92, '행복하다', 'haengbokada', 'Hạnh phúc', [], 'TOPIK I', 'Tính từ', '작은 성취에도 마음이 행복하다.', 'Dù là thành tựu nhỏ cũng thấy hạnh phúc.'],

  // 10. Giao tiếp hằng ngày (12 words)
  [93, '약속', 'yaksok', 'Cuộc hẹn', ['lời hứa'], 'TOPIK I', 'Giao tiếp hằng ngày', '오늘 저녁 일곱 시 약속이에요.', 'Hẹn lúc bảy giờ tối nay nhé.'],
  [94, '시간', 'sigan', 'Thời gian', ['giờ'], 'TOPIK I', 'Giao tiếp hằng ngày', '지금 잠깐 시간 있으세요?', 'Bây giờ bạn có rảnh một lát không?'],
  [95, '내일', 'naeil', 'Ngày mai', [], 'TOPIK I', 'Giao tiếp hằng ngày', '내일 같은 자리에서 또 봐요!', 'Ngày mai lại gặp ở chỗ ngồi này nhé!'],
  [96, '오늘', 'oneul', 'Hôm nay', [], 'TOPIK I', 'Giao tiếp hằng ngày', '오늘 배운 단어를 복습했어요.', 'Tôi đã ôn lại từ vựng học hôm nay.'],
  [97, '주말', 'jumal', 'Cuối tuần', [], 'TOPIK I', 'Giao tiếp hằng ngày', '즐거운 주말 보내세요!', 'Chúc bạn một kỳ nghỉ cuối tuần vui vẻ!'],
  [98, '분위기', 'bunwigi', 'Bầu không khí', ['không khí'], 'TOPIK II', 'Giao tiếp hằng ngày', '비 오는 카페 분위기가 최고예요.', 'Không khí quán cà phê ngày mưa là tuyệt nhất.'],
  [99, '이야기', 'iyagi', 'Câu chuyện', [], 'TOPIK I', 'Giao tiếp hằng ngày', '재미있는 이야기를 들려주세요.', 'Hãy kể cho mình nghe câu chuyện thú vị nhé.'],
  [100, '기다리다', 'gidarida', 'Chờ đợi', ['đợi'], 'TOPIK I', 'Giao tiếp hằng ngày', '친구가 올 때까지 기다리다.', 'Đợi cho tới khi bạn đến.'],
  [101, '도와주다', 'dowajuda', 'Giúp đỡ', ['giúp'], 'TOPIK I', 'Giao tiếp hằng ngày', '서로 모르는 문제를 도와주다.', 'Giúp đỡ nhau những câu chưa biết.'],
  [102, '괜찮아요', 'gwaenchanayo', 'Không sao đâu', ['ổn mà'], 'TOPIK I', 'Giao tiếp hằng ngày', '천천히 말해도 괜찮아요.', 'Bạn cứ nói chậm rãi cũng không sao đâu.'],
  [103, '화이팅해요', 'hwaitinghaeyo', 'Cố lên nhé', ['cố lên'], 'TOPIK II', 'Giao tiếp hằng ngày', '우리 모두 끝까지 화이팅해요!', 'Tất cả chúng mình cùng cố lên tới cùng nhé!'],
  [104, '수고했어요', 'sugohaesseoyo', 'Bạn vất vả rồi', ['làm tốt lắm'], 'TOPIK II', 'Giao tiếp hằng ngày', '오늘 하루도 정말 수고했어요.', 'Hôm nay bạn cũng đã vất vả nhiều rồi.'],
]

export const SHARED_KOREAN_VOCAB: SharedVocabWord[] = RAW_WORDS.map(
  ([id, hangul, romanization, meaningVi, extraVi, level, topic, exampleKo, exampleVi]) => ({
    id,
    hangul,
    syllables: Array.from(hangul.replace(/\s+/g, '')),
    romanization,
    meaningVi,
    acceptedVi: [meaningVi, ...extraVi],
    level,
    topic,
    exampleKo,
    exampleVi,
  }),
)

export function stripViAccents(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isVietnameseMeaningMatch(typedRaw: string, word: SharedVocabWord): boolean {
  const clean = typedRaw.trim()
  if (!clean) return false
  if (clean === word.hangul) return true

  const normTyped = stripViAccents(clean)
  if (!normTyped || normTyped.length < 1) return false

  for (const candidate of word.acceptedVi) {
    const normCand = stripViAccents(candidate)
    if (normTyped === normCand) return true
  }
  return false
}

export function getWordsByDifficulty(difficulty: 'easy' | 'normal' | 'hard', topic?: VocabTopic | 'Tất cả'): SharedVocabWord[] {
  const topicFiltered =
    topic && topic !== 'Tất cả' ? SHARED_KOREAN_VOCAB.filter((w) => w.topic === topic) : SHARED_KOREAN_VOCAB

  const base = topicFiltered.length >= 12 ? topicFiltered : SHARED_KOREAN_VOCAB

  if (difficulty === 'easy') {
    const easy = base.filter((w) => w.level === 'TOPIK I' && w.syllables.length <= 2)
    return easy.length >= 10 ? easy : base.filter((w) => w.syllables.length <= 2)
  }
  if (difficulty === 'normal') {
    const normal = base.filter((w) => w.syllables.length === 3)
    return normal.length >= 10 ? normal : SHARED_KOREAN_VOCAB.filter((w) => w.syllables.length === 3)
  }
  const hard = base.filter((w) => w.syllables.length >= 4 || w.level === 'TOPIK II')
  return hard.length >= 10 ? hard : SHARED_KOREAN_VOCAB.filter((w) => w.syllables.length >= 4 || w.level === 'TOPIK II')
}

export function getBuilderWordsByDifficulty(difficulty: 'easy' | 'normal' | 'hard'): SharedVocabWord[] {
  if (difficulty === 'easy') {
    return SHARED_KOREAN_VOCAB.filter((w) => w.syllables.length === 2)
  }
  if (difficulty === 'normal') {
    return SHARED_KOREAN_VOCAB.filter((w) => w.syllables.length === 3)
  }
  return SHARED_KOREAN_VOCAB.filter((w) => w.syllables.length >= 4)
}

export function playVocabPronunciation(word: Pick<SharedVocabWord, 'hangul' | 'audioUrl'>) {
  if (word.audioUrl) {
    try {
      const audio = new Audio(word.audioUrl)
      void audio.play()
      return
    } catch {
      // Fallback to Google Korean TTS below
    }
  }
  speakKorean(word.hangul)
}
