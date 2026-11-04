export type TopikLevel = 'TOPIK 1' | 'TOPIK 2' | 'TOPIK 3' | 'TOPIK 4' | 'TOPIK 5' | 'TOPIK 6'

export type VocabItem = {
  id: number
  hangul: string
  romanization: string
  meaningVi: string
  exampleKo: string
  exampleVi: string
  level: TopikLevel
  category: 'Quán cà phê' | 'Giao tiếp' | 'Đời sống' | 'Cảm xúc' | 'Học tập & Công việc'
}

export type AchievementDef = {
  code: string
  title: string
  description: string
  xpReward: number
  badge: string
}

export type CafeMenuItem = {
  id: string
  hangul: string
  romanization: string
  nameVi: string
  orderPhraseKo: string
  orderPhraseVi: string
  priceWon: string
  assetKey: string
}

export type MusicTrackDef = {
  id: string
  title: string
  artist: string
  mood: string
  bpm: number
  style: 'lofi-rain' | 'acoustic-warm' | 'seoul-night' | 'piano-study' | 'spring-breeze' | 'latte-jazz'
  durationSec: number
  suggestedBy?: string
  votes?: number
  audioUrl?: string
  status?: 'pending' | 'approved' | 'rejected'
}

export const KOREAN_VOCABULARY: VocabItem[] = [
  // === TOPIK 1 (22 core words) ===
  { id: 1, hangul: '커피', romanization: 'keopi', meaningVi: 'Cà phê', exampleKo: '따뜻한 커피 한 잔 주세요.', exampleVi: 'Cho tôi một tách cà phê ấm.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 2, hangul: '우유', romanization: 'uyu', meaningVi: 'Sữa', exampleKo: '우유를 매일 마셔요.', exampleVi: 'Tôi uống sữa mỗi ngày.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 3, hangul: '빵', romanization: 'ppang', meaningVi: 'Bánh mì / bánh ngọt', exampleKo: '이 카페 빵이 정말 맛있어요.', exampleVi: 'Bánh ở quán này thật sự rất ngon.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 4, hangul: '물', romanization: 'mul', meaningVi: 'Nước', exampleKo: '시원한 물 좀 주세요.', exampleVi: 'Cho tôi xin chút nước mát.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 5, hangul: '차', romanization: 'cha', meaningVi: 'Trà', exampleKo: '비 오는 날에는 따뜻한 차가 좋아요.', exampleVi: 'Ngày mưa uống trà ấm rất tuyệt.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 6, hangul: '친구', romanization: 'chingu', meaningVi: 'Bạn bè', exampleKo: '카페에서 친구를 만나요.', exampleVi: 'Tôi gặp bạn ở quán cà phê.', level: 'TOPIK 1', category: 'Giao tiếp' },
  { id: 7, hangul: '안녕', romanization: 'annyeong', meaningVi: 'Xin chào', exampleKo: '안녕! 오늘 기분이 어때?', exampleVi: 'Chào cậu! Hôm nay tâm trạng thế nào?', level: 'TOPIK 1', category: 'Giao tiếp' },
  { id: 8, hangul: '감사합니다', romanization: 'gamsahamnida', meaningVi: 'Cảm ơn', exampleKo: '도와주셔서 감사합니다.', exampleVi: 'Cảm ơn vì đã giúp đỡ tôi.', level: 'TOPIK 1', category: 'Giao tiếp' },
  { id: 9, hangul: '사랑', romanization: 'sarang', meaningVi: 'Tình yêu', exampleKo: '한국어 공부를 사랑해요.', exampleVi: 'Tôi yêu việc học tiếng Hàn.', level: 'TOPIK 1', category: 'Cảm xúc' },
  { id: 10, hangul: '행복', romanization: 'haengbok', meaningVi: 'Hạnh phúc', exampleKo: '함께 공부해서 행복해요.', exampleVi: 'Mình thấy hạnh phúc vì được học cùng nhau.', level: 'TOPIK 1', category: 'Cảm xúc' },
  { id: 11, hangul: '책', romanization: 'chaek', meaningVi: 'Sách', exampleKo: '한국어 책을 읽고 있어요.', exampleVi: 'Tôi đang đọc sách tiếng Hàn.', level: 'TOPIK 1', category: 'Học tập & Công việc' },
  { id: 12, hangul: '공부', romanization: 'gongbu', meaningVi: 'Học tập', exampleKo: '매일 조금씩 공부해요.', exampleVi: 'Mỗi ngày học một chút.', level: 'TOPIK 1', category: 'Học tập & Công việc' },
  { id: 13, hangul: '학교', romanization: 'hakgyo', meaningVi: 'Trường học', exampleKo: '학교 근처에 예쁜 카페가 있어요.', exampleVi: 'Gần trường có một quán cà phê xinh xắn.', level: 'TOPIK 1', category: 'Học tập & Công việc' },
  { id: 14, hangul: '음악', romanization: 'eumak', meaningVi: 'Âm nhạc', exampleKo: '조용한 음악을 들으면서 쉬어요.', exampleVi: 'Vừa nghe nhạc êm dịu vừa nghỉ ngơi.', level: 'TOPIK 1', category: 'Đời sống' },
  { id: 15, hangul: '비', romanization: 'bi', meaningVi: 'Cơn mưa', exampleKo: '창밖에 비가 내리고 있어요.', exampleVi: 'Ngoài cửa sổ trời đang mưa.', level: 'TOPIK 1', category: 'Đời sống' },
  { id: 16, hangul: '오늘', romanization: 'oneul', meaningVi: 'Hôm nay', exampleKo: '오늘 날씨가 참 시원해요.', exampleVi: 'Thời tiết hôm nay thật mát mẻ.', level: 'TOPIK 1', category: 'Đời sống' },
  { id: 17, hangul: '내일', romanization: 'naeil', meaningVi: 'Ngày mai', exampleKo: '내일 다시 여기서 만나요!', exampleVi: 'Ngày mai gặp lại ở đây nhé!', level: 'TOPIK 1', category: 'Đời sống' },
  { id: 18, hangul: '시간', romanization: 'sigan', meaningVi: 'Thời gian', exampleKo: '지금 시간 괜찮으세요?', exampleVi: 'Bây giờ bạn có rảnh không?', level: 'TOPIK 1', category: 'Giao tiếp' },
  { id: 19, hangul: '노래', romanization: 'norae', meaningVi: 'Bài hát', exampleKo: '이 노래 제목이 뭐예요?', exampleVi: 'Tên bài hát này là gì thế?', level: 'TOPIK 1', category: 'Đời sống' },
  { id: 20, hangul: '의자', romanization: 'uija', meaningVi: 'Cái ghế', exampleKo: '창가 의자에 앉을까요?', exampleVi: 'Mình ngồi ở ghế cạnh cửa sổ nhé?', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 21, hangul: '창문', romanization: 'changmun', meaningVi: 'Cửa sổ', exampleKo: '창문 너머로 밤하늘이 보여요.', exampleVi: 'Nhìn thấy bầu trời đêm qua khung cửa sổ.', level: 'TOPIK 1', category: 'Quán cà phê' },
  { id: 22, hangul: '선생님', romanization: 'seonsaengnim', meaningVi: 'Giáo viên', exampleKo: '선생님께서 친절하게 설명해 주셨어요.', exampleVi: 'Thầy/cô đã giải thích rất tận tình.', level: 'TOPIK 1', category: 'Học tập & Công việc' },

  // === TOPIK 2 (20 core words) ===
  { id: 23, hangul: '약속', romanization: 'yaksok', meaningVi: 'Cuộc hẹn / lời hứa', exampleKo: '오후에 친구와 약속이 있어요.', exampleVi: 'Buổi chiều tôi có hẹn với bạn.', level: 'TOPIK 2', category: 'Giao tiếp' },
  { id: 24, hangul: '분위기', romanization: 'bunwigi', meaningVi: 'Bầu không khí', exampleKo: '이 카페는 분위기가 정말 따뜻해요.', exampleVi: 'Quán cà phê này có bầu không khí thật ấm áp.', level: 'TOPIK 2', category: 'Quán cà phê' },
  { id: 25, hangul: '주문', romanization: 'jumun', meaningVi: 'Gọi món / đặt hàng', exampleKo: '여기서 음료수를 주문하세요.', exampleVi: 'Bạn hãy gọi đồ uống ở đây nhé.', level: 'TOPIK 2', category: 'Quán cà phê' },
  { id: 26, hangul: '대화', romanization: 'daehwa', meaningVi: 'Cuộc hội thoại', exampleKo: '한국어로 자연스럽게 대화하고 싶어요.', exampleVi: 'Tôi muốn trò chuyện tự nhiên bằng tiếng Hàn.', level: 'TOPIK 2', category: 'Giao tiếp' },
  { id: 27, hangul: '연습', romanization: 'yeonseup', meaningVi: 'Luyện tập', exampleKo: '발음을 매일 연습하면 좋아져요.', exampleVi: 'Luyện phát âm mỗi ngày sẽ tiến bộ hơn.', level: 'TOPIK 2', category: 'Học tập & Công việc' },
  { id: 28, hangul: '기억', romanization: 'gieok', meaningVi: 'Ký ức / trí nhớ', exampleKo: '새 단어를 오래 기억하는 방법이에요.', exampleVi: 'Đây là cách nhớ từ mới thật lâu.', level: 'TOPIK 2', category: 'Học tập & Công việc' },
  { id: 29, hangul: '선물', romanization: 'seonmul', meaningVi: 'Món quà', exampleKo: '친구에게 작은 선물을 주었어요.', exampleVi: 'Tôi đã tặng bạn một món quà nhỏ.', level: 'TOPIK 2', category: 'Đời sống' },
  { id: 30, hangul: '여행', romanization: 'yeohaeng', meaningVi: 'Du lịch', exampleKo: '가을에 서울로 여행을 가고 싶어요.', exampleVi: 'Mùa thu tôi muốn đi du lịch Seoul.', level: 'TOPIK 2', category: 'Đời sống' },
  { id: 31, hangul: '준비', romanization: 'junbi', meaningVi: 'Chuẩn bị', exampleKo: '토픽 시험을 열심히 준비하고 있어요.', exampleVi: 'Tôi đang chăm chỉ chuẩn bị cho kỳ thi TOPIK.', level: 'TOPIK 2', category: 'Học tập & Công việc' },
  { id: 32, hangul: '응원', romanization: 'eungwon', meaningVi: 'Cổ vũ / ủng hộ', exampleKo: '서로의 꿈을 응원해요!', exampleVi: 'Hãy cùng cổ vũ ước mơ của nhau nhé!', level: 'TOPIK 2', category: 'Cảm xúc' },
  { id: 33, hangul: '여유', romanization: 'yeoyu', meaningVi: 'Sự thư thái / thong thả', exampleKo: '주말에는 커피 한 잔의 여유를 즐겨요.', exampleVi: 'Cuối tuần tận hưởng sự thư thái bên tách cà phê.', level: 'TOPIK 2', category: 'Cảm xúc' },
  { id: 34, hangul: '취미', romanization: 'chwimi', meaningVi: 'Sở thích', exampleKo: '제 취미는 한국 노래 듣기예요.', exampleVi: 'Sở thích của tôi là nghe nhạc Hàn Quốc.', level: 'TOPIK 2', category: 'Đời sống' },
  { id: 35, hangul: '초대', romanization: 'chodae', meaningVi: 'Lời mời', exampleKo: '대화에 초대해 주셔서 고마워요.', exampleVi: 'Cảm ơn vì đã mời mình vào cuộc trò chuyện.', level: 'TOPIK 2', category: 'Giao tiếp' },
  { id: 36, hangul: '실력', romanization: 'sillyeok', meaningVi: 'Thực lực / trình độ', exampleKo: '한국어 실력이 많이 늘었네요!', exampleVi: 'Trình độ tiếng Hàn của bạn tiến bộ nhiều quá!', level: 'TOPIK 2', category: 'Học tập & Công việc' },
  { id: 37, hangul: '경험', romanization: 'gyeongheom', meaningVi: 'Kinh nghiệm / trải nghiệm', exampleKo: '새로운 친구와 이야기하는 건 좋은 경험이에요.', exampleVi: 'Trò chuyện với bạn mới là trải nghiệm tuyệt vời.', level: 'TOPIK 2', category: 'Đời sống' },
  { id: 38, hangul: '설레다', romanization: 'seolleda', meaningVi: 'Bồi hồi / háo hức', exampleKo: '첫 만남이라 마음이 설레요.', exampleVi: 'Vì là lần gặp đầu nên lòng thấy bồi hồi.', level: 'TOPIK 2', category: 'Cảm xúc' },
  { id: 39, hangul: '익숙하다', romanization: 'iksukada', meaningVi: 'Quen thuộc', exampleKo: '이제 한글 타자가 많이 익숙해졌어요.', exampleVi: 'Giờ mình đã quen gõ tiếng Hàn hơn nhiều rồi.', level: 'TOPIK 2', category: 'Học tập & Công việc' },
  { id: 40, hangul: '추천', romanization: 'chucheon', meaningVi: 'Gợi ý / đề xuất', exampleKo: '좋은 노래 하나 추천해 주세요!', exampleVi: 'Hãy đề xuất cho mình một bài hát hay nhé!', level: 'TOPIK 2', category: 'Quán cà phê' },

  // === TOPIK 3 (10 words) ===
  { id: 41, hangul: '소통', romanization: 'sotong', meaningVi: 'Sự giao tiếp / kết nối', exampleKo: '진심 어린 소통이 관계를 가깝게 해요.', exampleVi: 'Giao tiếp chân thành giúp gắn kết mối quan hệ.', level: 'TOPIK 3', category: 'Giao tiếp' },
  { id: 42, hangul: '집중', romanization: 'jipjung', meaningVi: 'Sự tập trung', exampleKo: '잔잔한 빗소리가 집중에 도움이 돼요.', exampleVi: 'Tiếng mưa dịu nhẹ giúp tập trung tốt hơn.', level: 'TOPIK 3', category: 'Học tập & Công việc' },
  { id: 43, hangul: '습관', romanization: 'seupgwan', meaningVi: 'Thói quen', exampleKo: '매일 단어 열 개씩 외우는 습관을 들였어요.', exampleVi: 'Mình đã rèn thói quen học 10 từ mỗi ngày.', level: 'TOPIK 3', category: 'Học tập & Công việc' },
  { id: 44, hangul: '위로', romanization: 'wiro', meaningVi: 'Sự an ủi', exampleKo: '따뜻한 말 한마디가 큰 위로가 되었어요.', exampleVi: 'Một lời nói ấm áp đã trở thành niềm an ủi lớn.', level: 'TOPIK 3', category: 'Cảm xúc' },
  { id: 45, hangul: '일상', romanization: 'ilsang', meaningVi: 'Đời thường / nhịp sống', exampleKo: '소소한 일상 속에서 행복을 찾아요.', exampleVi: 'Tìm thấy niềm vui trong những điều bình dị thường ngày.', level: 'TOPIK 3', category: 'Đời sống' },
  { id: 46, hangul: '배려', romanization: 'baeryeo', meaningVi: 'Sự quan tâm / thấu hiểu', exampleKo: '서로를 배려하는 태도가 중요해요.', exampleVi: 'Thái độ quan tâm lẫn nhau rất quan trọng.', level: 'TOPIK 3', category: 'Giao tiếp' },
  { id: 47, hangul: '만족', romanization: 'manjok', meaningVi: 'Sự hài lòng', exampleKo: '오늘 공부 결과에 아주 만족해요.', exampleVi: 'Mình rất hài lòng với kết quả học hôm nay.', level: 'TOPIK 3', category: 'Cảm xúc' },
  { id: 48, hangul: '목표', romanization: 'mokpyo', meaningVi: 'Mục tiêu', exampleKo: '올해 목표는 토픽 4급 합격이에요.', exampleVi: 'Mục tiêu năm nay là đỗ TOPIK 4.', level: 'TOPIK 3', category: 'Học tập & Công việc' },
  { id: 49, hangul: '감성', romanization: 'gamseong', meaningVi: 'Cảm xúc / chất thơ', exampleKo: '감성적인 카페 음악이 흘러나와요.', exampleVi: 'Giai điệu cà phê đầy chất thơ vang lên.', level: 'TOPIK 3', category: 'Quán cà phê' },
  { id: 50, hangul: '공감', romanization: 'gonggam', meaningVi: 'Sự đồng cảm', exampleKo: '친구의 이야기에 깊이 공감했어요.', exampleVi: 'Mình đồng cảm sâu sắc với câu chuyện của bạn.', level: 'TOPIK 3', category: 'Cảm xúc' },

  // === TOPIK 4 (10 words) ===
  { id: 51, hangul: '성취감', romanization: 'seongchwigam', meaningVi: 'Cảm giác thành tựu', exampleKo: '어려운 문제를 풀면 큰 성취감을 느껴요.', exampleVi: 'Giải được câu khó mang lại cảm giác thành tựu lớn.', level: 'TOPIK 4', category: 'Học tập & Công việc' },
  { id: 52, hangul: '꾸준히', romanization: 'kkujunhi', meaningVi: 'Đều đặn / kiên trì', exampleKo: '외국어는 꾸준히 하는 것이 핵심이에요.', exampleVi: 'Học ngoại ngữ cốt lõi là sự kiên trì đều đặn.', level: 'TOPIK 4', category: 'Học tập & Công việc' },
  { id: 53, hangul: '유대감', romanization: 'yudaegam', meaningVi: 'Sự gắn kết', exampleKo: '함께 공부하며 유대감이 깊어졌어요.', exampleVi: 'Học cùng nhau làm sâu sắc thêm sự gắn kết.', level: 'TOPIK 4', category: 'Giao tiếp' },
  { id: 54, hangul: '효율적', romanization: 'hyoyuljeok', meaningVi: 'Có tính hiệu quả', exampleKo: '게임을 통해 단어를 효율적으로 복습해요.', exampleVi: 'Ôn tập từ vựng hiệu quả thông qua trò chơi.', level: 'TOPIK 4', category: 'Học tập & Công việc' },
  { id: 55, hangul: '취향', romanization: 'chwihyang', meaningVi: 'Gu / thị hiếu', exampleKo: '우리는 음악 취향이 아주 비슷하네요.', exampleVi: 'Gu âm nhạc của tụi mình giống nhau ghê.', level: 'TOPIK 4', category: 'Đời sống' },
  { id: 56, hangul: '여운', romanization: 'yeoun', meaningVi: 'Dư âm', exampleKo: '노래가 끝난 뒤에도 긴 여운이 남았어요.', exampleVi: 'Bài hát kết thúc mà dư âm vẫn còn lắng đọng.', level: 'TOPIK 4', category: 'Cảm xúc' },
  { id: 57, hangul: '자신감', romanization: 'jasingam', meaningVi: 'Sự tự tin', exampleKo: '말하기 연습 덕분에 자신감이 생겼어요.', exampleVi: 'Nhờ luyện nói mà mình đã có thêm tự tin.', level: 'TOPIK 4', category: 'Cảm xúc' },
  { id: 58, hangul: '다양성', romanization: 'dayangseong', meaningVi: 'Sự đa dạng', exampleKo: '문화의 다양성을 존중하며 배워요.', exampleVi: 'Tôn trọng sự đa dạng văn hóa khi học tập.', level: 'TOPIK 4', category: 'Đời sống' },

  // === TOPIK 5 (8 words) ===
  { id: 59, hangul: '몰입감', romanization: 'moripgam', meaningVi: 'Sự đắm chìm / nhập tâm', exampleKo: '조용한 공간이 높은 몰입감을 만들어 줍니다.', exampleVi: 'Không gian yên tĩnh tạo nên sự nhập tâm cao độ.', level: 'TOPIK 5', category: 'Học tập & Công việc' },
  { id: 60, hangul: '상호작용', romanization: 'sanghojagyeong', meaningVi: 'Sự tương tác qua lại', exampleKo: '실시간 상호작용이 학습 동기를 높여요.', exampleVi: 'Tương tác thời gian thực nâng cao động lực học.', level: 'TOPIK 5', category: 'Giao tiếp' },
  { id: 61, hangul: '정서적', romanization: 'jeongseojeok', meaningVi: 'Thuộc về tinh thần / cảm xúc', exampleKo: '음악은 정서적 안정을 주는 좋은 매개체예요.', exampleVi: 'Âm nhạc là chất xúc tác tuyệt vời cho sự bình yên tinh thần.', level: 'TOPIK 5', category: 'Cảm xúc' },
  { id: 62, hangul: '잠재력', romanization: 'jamjaeryeok', meaningVi: 'Tiềm năng', exampleKo: '꾸준한 연습이 숨은 잠재력을 깨워요.', exampleVi: 'Luyện tập bền bỉ đánh thức tiềm năng ẩn giấu.', level: 'TOPIK 5', category: 'Học tập & Công việc' },
  { id: 63, hangul: '조화롭다', romanization: 'johwaropda', meaningVi: 'Hài hòa', exampleKo: '나무 색감과 조명이 조화롭게 어우러져요.', exampleVi: 'Sắc gỗ và ánh đèn hòa quyện thật hài hòa.', level: 'TOPIK 5', category: 'Quán cà phê' },
  { id: 64, hangul: '지속성', romanization: 'jisokseong', meaningVi: 'Tính bền vững / duy trì', exampleKo: '학습의 지속성이 실력을 결정합니다.', exampleVi: 'Sự duy trì bền bỉ quyết định thực lực.', level: 'TOPIK 5', category: 'Học tập & Công việc' },

  // === TOPIK 6 (8 words) ===
  { id: 65, hangul: '유창성', romanization: 'yuchangseong', meaningVi: 'Sự lưu loát', exampleKo: '실전 대화를 통해 언어의 유창성을 기릅니다.', exampleVi: 'Rèn luyện sự lưu loát ngôn ngữ qua hội thoại thực tế.', level: 'TOPIK 6', category: 'Giao tiếp' },
  { id: 66, hangul: '통찰력', romanization: 'tongchallyeok', meaningVi: 'Sự thấu suốt / sâu sắc', exampleKo: '독서는 세상을 보는 통찰력을 넓혀 줍니다.', exampleVi: 'Đọc sách mở rộng góc nhìn sâu sắc về thế giới.', level: 'TOPIK 6', category: 'Học tập & Công việc' },
  { id: 67, hangul: '함축적', romanization: 'hamchukjeok', meaningVi: 'Hàm súc / cô đọng', exampleKo: '시적인 가사에는 함축적인 의미가 담겨 있어요.', exampleVi: 'Lời ca giàu chất thơ chứa đựng ý nghĩa hàm súc.', level: 'TOPIK 6', category: 'Cảm xúc' },
  { id: 68, hangul: '자발적', romanization: 'jabaljeok', meaningVi: 'Tự giác / tự nguyện', exampleKo: '자발적인 참여가 공동체를 따뜻하게 만듭니다.', exampleVi: 'Sự tham gia tự nguyện làm cộng đồng thêm ấm áp.', level: 'TOPIK 6', category: 'Giao tiếp' },
  { id: 69, hangul: '맥락', romanization: 'maengnak', meaningVi: 'Ngữ cảnh / mạch văn', exampleKo: '단어는 문장의 맥락 속에서 이해해야 해요.', exampleVi: 'Từ vựng cần được hiểu trong ngữ cảnh của câu.', level: 'TOPIK 6', category: 'Học tập & Công việc' },
  { id: 70, hangul: '공존', romanization: 'gongjon', meaningVi: 'Cùng tồn tại / giao thoa', exampleKo: '휴식과 배움이 공존하는 아늑한 카페입니다.', exampleVi: 'Một quán cà phê ấm cúng nơi nghỉ ngơi và học tập giao thoa.', level: 'TOPIK 6', category: 'Quán cà phê' },
]

export function getVocabForLevel(level: string): VocabItem[] {
  const exact = KOREAN_VOCABULARY.filter((w) => w.level === level)
  if (exact.length >= 12) return exact
  // Supplement smaller advanced decks with adjacent level words so 10-round games always have rich variety
  const idx = ['TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6'].indexOf(level)
  const fallbackLevel = idx > 0 ? `TOPIK ${idx}` : 'TOPIK 2'
  const extra = KOREAN_VOCABULARY.filter((w) => w.level === fallbackLevel)
  return [...exact, ...extra]
}

export const KOREAN_CAFE_MENU: CafeMenuItem[] = [
  {
    id: 'americano',
    hangul: '아이스 아메리카노',
    romanization: 'aiseu amerikano',
    nameVi: 'Americano đá chuẩn Hàn',
    orderPhraseKo: '아이스 아메리카노 한 잔 주세요!',
    orderPhraseVi: 'Cho mình một ly Americano đá nhé!',
    priceWon: '₩ 4,500',
    assetKey: 'item-americano',
  },
  {
    id: 'latte',
    hangul: '바닐라 카페라떼',
    romanization: 'banilla kaperatte',
    nameVi: 'Latte Vani ấm áp',
    orderPhraseKo: '따뜻한 바닐라 라떼 주세요!',
    orderPhraseVi: 'Cho mình một ly Latte Vani ấm nhé!',
    priceWon: '₩ 5,200',
    assetKey: 'item-latte',
  },
  {
    id: 'matcha',
    hangul: '딸기 말차라떼',
    romanization: 'ttalgi malcharatte',
    nameVi: 'Matcha Dâu sữa tươi',
    orderPhraseKo: '딸기 말차라떼 덜 달게 해 주세요!',
    orderPhraseVi: 'Cho mình Matcha Dâu ít ngọt nhé!',
    priceWon: '₩ 5,800',
    assetKey: 'item-matcha-latte',
  },
  {
    id: 'boba',
    hangul: '흑당 버블밀크티',
    romanization: 'heukdang beobeulmilkeuti',
    nameVi: 'Trà sữa trân châu đường đen',
    orderPhraseKo: '흑당 버블티 한 잔 포장해 주세요!',
    orderPhraseVi: 'Cho mình một trà sữa đường đen nhé!',
    priceWon: '₩ 5,500',
    assetKey: 'item-boba',
  },
  {
    id: 'shortcake',
    hangul: '생크림 딸기케이크',
    romanization: 'saengkeurim ttalgikeikeu',
    nameVi: 'Bánh kem dâu tươi Seoul',
    orderPhraseKo: '딸기케이크 한 조각 같이 주세요!',
    orderPhraseVi: 'Cho mình thêm một phần bánh kem dâu nhé!',
    priceWon: '₩ 6,500',
    assetKey: 'item-shortcake',
  },
  {
    id: 'bingsu',
    hangul: '인절미 팥빙수',
    romanization: 'injeolmi patbingsu',
    nameVi: 'Bingsu đậu đỏ Injeolmi',
    orderPhraseKo: '같이 먹을 팥빙수 하나 주문할게요!',
    orderPhraseVi: 'Mình gọi một phần Bingsu ăn chung nhé!',
    priceWon: '₩ 9,800',
    assetKey: 'item-bingsu',
  },
]

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  { code: 'first-order', title: 'Khách Quen K-CHILL', description: 'Gọi món đầu tiên bằng tiếng Hàn tại quầy menu.', xpReward: 15, badge: '☕' },
  { code: 'first-wave', title: 'Lời Chào Ấm Áp', description: 'Vẫy tay chào một người bạn ngồi cùng bàn.', xpReward: 15, badge: '👋' },
  { code: 'voice-talk', title: 'Trò Chuyện Riêng 1-1', description: 'Kết nối một cuộc trò chuyện giọng nói riêng tại bàn.', xpReward: 25, badge: '🎙️' },
  { code: 'vocab-5', title: 'Mầm Non Hangul', description: 'Đánh dấu thuộc 5 từ vựng tiếng Hàn trong sổ tay.', xpReward: 20, badge: '🌱' },
  { code: 'vocab-15', title: 'Chăm Chỉ Mỗi Ngày', description: 'Thuộc 15 từ vựng tiếng Hàn khác nhau.', xpReward: 40, badge: '📖' },
  { code: 'game-first', title: 'Khởi Động Sôi Nổi', description: 'Hoàn thành ván game tiếng Hàn đầu tiên (Korean Rain hoặc Word Battle).', xpReward: 25, badge: '🎮' },
  { code: 'game-winner', title: 'Cao Thủ Từ Vựng', description: 'Chiến thắng một trận đấu game 2 người tại bàn.', xpReward: 45, badge: '🏆' },
  { code: 'dj-vibe', title: 'Người Giữ Nhịp Chill', description: 'Đề xuất một bài hát mới vào phòng nhạc chung.', xpReward: 20, badge: '🎵' },
]

export const DEFAULT_MUSIC_TRACKS: MusicTrackDef[] = [
  {
    id: 'track-healing-playlist',
    title: '[Playlist] Nhạc Hàn Tâm Trạng Chữa Lành Mọi Nỗi Buồn',
    artist: 'K-Indie Healing Chill',
    mood: 'Chữa lành · Sưởi ấm tâm hồn',
    bpm: 72,
    style: 'lofi-rain',
    durationSec: 1397,
    audioUrl: 'https://www.youtube.com/watch?v=gWgHsJ4nHY8',
    suggestedBy: 'K-CHILL Radio',
    votes: 12,
  },
  {
    id: 'track-night-letter',
    title: '밤편지 · Through the Night',
    artist: 'IU (아이유)',
    mood: 'Ấm áp · Ghi-ta mộc đêm mưa',
    bpm: 70,
    style: 'acoustic-warm',
    durationSec: 283,
    audioUrl: 'https://www.youtube.com/watch?v=BzYnNdJhZQw',
    suggestedBy: 'K-CHILL',
    votes: 9,
  },
  {
    id: 'track-breathe',
    title: '한숨 · Breathe',
    artist: 'LEE HI (이하이)',
    mood: 'Thư thái · Thở phào nhẹ nhõm',
    bpm: 66,
    style: 'piano-study',
    durationSec: 294,
    audioUrl: 'https://www.youtube.com/watch?v=5iSlfF8TQ9k',
    suggestedBy: 'Minh Anh',
    votes: 7,
  },
  {
    id: 'track-morning-coffee',
    title: 'Morning Coffee Seoul ☕️ [Lo-Fi Study Beats]',
    artist: 'Seoul Beats Studio',
    mood: 'Tập trung học từ vựng',
    bpm: 74,
    style: 'lofi-rain',
    durationSec: 3867,
    audioUrl: 'https://www.youtube.com/watch?v=1fueZCTYkpA',
    suggestedBy: 'Hà Linh',
    votes: 8,
  },
  {
    id: 'track-twenty-three',
    title: '스물셋 · Twenty-three (Acoustic Chill Live)',
    artist: 'IU (아이유)',
    mood: 'Trong trẻo · Tươi mới',
    bpm: 80,
    style: 'spring-breeze',
    durationSec: 235,
    audioUrl: 'https://www.youtube.com/watch?v=42Gtm4-Ax2U',
    suggestedBy: 'Gia Huy',
    votes: 5,
  },
  {
    id: 'track-you-clouds-rain',
    title: '비도 오고 그래서 · You, Clouds, Rain',
    artist: 'Heize (헤이즈)',
    mood: 'Trầm lắng · Mưa rơi ngoài hiên',
    bpm: 68,
    style: 'latte-jazz',
    durationSec: 205,
    audioUrl: 'https://www.youtube.com/watch?v=afxLaQiLu-o',
    suggestedBy: 'Thảo Vy',
    votes: 6,
  },
]
