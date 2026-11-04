export type StoryLine = {
  speaker: 'A' | 'B'
  roleLabel: string
  ko: string
  rom: string
  vi: string
}

export type ConversationStory = {
  id: string
  titleKo: string
  titleVi: string
  level: 'TOPIK I' | 'TOPIK II'
  durationHint: string
  summaryVi: string
  lines: StoryLine[]
}

export const CONVERSATION_STORIES: ConversationStory[] = [
  {
    id: 'story-rainy-meet',
    titleKo: '비 오는 날의 첫 만남',
    titleVi: 'Cuộc gặp gỡ ngày mưa tại K-CHILL',
    level: 'TOPIK I',
    durationHint: '3 phút đọc · 6 lượt thoại',
    summaryVi: 'Hai người bạn mới ngồi chung bàn bên khung cửa sổ mưa rơi, làm quen và hỏi thăm việc học tiếng Hàn.',
    lines: [
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '안녕하세요! 여기 옆자리에 앉아도 괜찮을까요?',
        rom: 'Annyeonghaseyo! Yeogi yeopjarie anjado gwaenchaneulkkayo?',
        vi: 'Xin chào! Mình ngồi ở ghế đối diện này có được không ạ?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '네, 물론이죠! 편하게 앉으세요. 밖에 비가 많이 오네요.',
        rom: 'Ne, mullonijyo! Pyeonhage anjeuseyo. Bakke biga mani oneyo.',
        vi: 'Vâng, tất nhiên rồi! Bạn cứ ngồi tự nhiên nhé. Ngoài trời đang mưa to ghê.',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '맞아요. 비 오는 날에는 따뜻한 카페에서 공부하는 게 제일 좋아요.',
        rom: 'Majayo. Bi oneun nareneun ttatteutan kape-eseo gongbuhaneun ge jeil joayo.',
        vi: 'Đúng vậy đó. Ngày mưa ngồi học trong quán cà phê ấm áp là thích nhất.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '혹시 한국어를 배운 지 얼마나 되셨어요?',
        rom: 'Hoksi hangugeoreul baeun ji eolmana doesyeosseoyo?',
        vi: 'Không biết bạn đã học tiếng Hàn được bao lâu rồi?',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '이제 육 개월쯤 되었어요. 아직 말하기가 조금 떨려요.',
        rom: 'Ije yuk gaewoljjeum doeeosseoyo. Ajik malhagiga jogeum tteollyeoyo.',
        vi: 'Mình học được khoảng 6 tháng rồi. Lúc nói vẫn còn hơi hồi hộp một chút.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '천천히 이야기해도 괜찮아요! 우리 같이 재미있게 연습해요.',
        rom: 'Cheoncheonhi iyagihaedo gwaenchanayo! Uri gachi jaemiitge yeonseupaeyo.',
        vi: 'Cứ nói chậm rãi cũng không sao đâu! Tụi mình cùng luyện tập thật vui nhé.',
      },
    ],
  },
  {
    id: 'story-order-latte',
    titleKo: '따뜻한 라떼와 딸기 케이크',
    titleVi: 'Gọi Latte ấm & Bánh kem dâu',
    level: 'TOPIK I',
    durationHint: '3 phút đọc · 6 lượt thoại',
    summaryVi: 'Cùng nhau chọn đồ uống và món tráng miệng yêu thích tại quầy Barista Hàn Quốc.',
    lines: [
      {
        speaker: 'A',
        roleLabel: 'Khách',
        ko: '메뉴판이 정말 예뻐요! 이 카페에서 뭐가 제일 맛있어요?',
        rom: 'Menyupani jeongmal yeppeoyo! I kape-eseo mwoga jeil masisseoyo?',
        vi: 'Bảng thực đơn xinh quá! Ở quán này món nào là ngon nhất vậy bạn?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn cùng bàn',
        ko: '바닐라 라떼하고 생크림 딸기케이크가 정말 유명해요.',
        rom: 'Banilla rattehago saengkeurim ttalgikeikeuga jeongmal yumyeonghaeyo.',
        vi: 'Latte Vani và bánh kem dâu tươi ở đây nổi tiếng lắm đó.',
      },
      {
        speaker: 'A',
        roleLabel: 'Khách',
        ko: '와, 좋네요! 저는 덜 단 음료를 좋아하는데 괜찮을까요?',
        rom: 'Wa, jonneyo! Jeoneun deol dan eumnyoreul joahaneunde gwaenchaneulkkayo?',
        vi: 'Ồ thích thế! Mình thích đồ uống ít ngọt thì có ổn không nhỉ?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn cùng bàn',
        ko: '주문할 때 “덜 달게 해 주세요”라고 말하면 돼요!',
        rom: 'Jumunhal ttae “deol dalge hae juseyo”rago malhamyeon dwaeyo!',
        vi: 'Lúc gọi món bạn chỉ cần nói “Cho mình ít ngọt nhé” là được ngay!',
      },
      {
        speaker: 'A',
        roleLabel: 'Khách',
        ko: '고마워요! 그럼 우리 케이크도 하나 시켜서 같이 먹어요.',
        rom: 'Gomawoyo! Geureom uri keikeudo hana sikyeoseo gachi meogeoyo.',
        vi: 'Cảm ơn cậu! Vậy tụi mình gọi thêm một phần bánh kem ăn chung nhé.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn cùng bàn',
        ko: '좋아요! 달콤한 케이크를 먹으면 단어도 더 잘 외워질 거예요.',
        rom: 'Joayo! Dalkomhan keikeureul meogeumyeon daneodo deo jal oewojil geoyeyo.',
        vi: 'Tuyệt luôn! Ăn bánh ngọt xong chắc chắn sẽ nhớ từ vựng tốt hơn đấy.',
      },
    ],
  },
  {
    id: 'story-weekend-hongdae',
    titleKo: '주말에 홍대 책방에 갈래요?',
    titleVi: 'Cuối tuần đi hiệu sách Hongdae nhé?',
    level: 'TOPIK I',
    durationHint: '4 phút đọc · 6 lượt thoại',
    summaryVi: 'Luyện từ vựng chủ đề Địa điểm, Giao thông và đặt lịch hẹn cuối tuần.',
    lines: [
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '이번 주말에 특별한 계획이 있어요?',
        rom: 'Ibeon jumare teukbyeolhan gyehoegi isseoyo?',
        vi: 'Cuối tuần này cậu có kế hoạch gì đặc biệt không?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '아직 없어요. 집에서 쉬거나 서점에 가려고 해요.',
        rom: 'Ajik eopseoyo. Jibeseo swigeona seojeome garyeogo haeyo.',
        vi: 'Mình chưa có. Mình định nghỉ ở nhà hoặc ghé hiệu sách.',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '홍대 근처에 새로 생긴 작은 책방이 있는데 같이 갈래요?',
        rom: 'Hongdae geuncheoe saero saenggin jageun chaekbangi inneunde gachi gallaeyo?',
        vi: 'Gần Hongdae có một tiệm sách nhỏ mới mở, tụi mình đi cùng nhau không?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '정말요? 거기까지 버스하고 지하철 중에 뭐가 더 빨라요?',
        rom: 'Jeongmallyo? Geogikkaji beoseuhago jihacheol junge mwoga deo ppallayo?',
        vi: 'Thật hả? Đến đó đi xe buýt hay tàu điện ngầm thì nhanh hơn?',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '주말에는 길이 막히니까 지하철 이호선을 타는 게 제일 빨라요.',
        rom: 'Jumareneun giri makinikka jihacheol ihoseoneul taneun ge jeil ppallayo.',
        vi: 'Cuối tuần đường hay đông nên đi tàu điện ngầm tuyến số 2 là nhanh nhất.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '좋아요! 토요일 오후 두 시에 홍대입구역 앞에서 만나요!',
        rom: 'Joayo! Toyoil ohu du sie Hongdaeipgu-yeok apeseo mannayo!',
        vi: 'Nhất trí! Hẹn gặp lúc 2 giờ chiều thứ Bảy trước ga Đại học Hongik nhé!',
      },
    ],
  },
  {
    id: 'story-music-drama',
    titleKo: '좋아하는 한국 노래 이야기',
    titleVi: 'Câu chuyện bài hát tiếng Hàn yêu thích',
    level: 'TOPIK II',
    durationHint: '4 phút đọc · 6 lượt thoại',
    summaryVi: 'Tâm sự về cách học từ vựng tự nhiên qua âm nhạc Lofi, Acoustic và phim Hàn.',
    lines: [
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '지금 카페에서 나오는 이 노래 분위기가 참 잔잔하네요.',
        rom: 'Jigeum kape-eseo naoneun i norae bunwigiga cham janjanhaneyo.',
        vi: 'Bài hát đang phát trong quán lúc này có giai điệu thật êm dịu nhỉ.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '네, 저도 어쿠스틱 음악을 들으면 마음이 편안해져요.',
        rom: 'Ne, jeodo eokuseutik eumageul deureumyeon maeumi pyeonanhaejyeoyo.',
        vi: 'Ừ, mình cũng thấy lòng bình yên hẳn khi nghe nhạc Acoustic.',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '평소에 한국 노래 가사로도 공부를 자주 하세요?',
        rom: 'Pyeongsoe hanguk norae gasarodo gongbureul jaju haseyo?',
        vi: 'Thường ngày bạn có hay học tiếng Hàn qua lời bài hát không?',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '네! 좋아하는 가사를 공책에 적어 두면 오래 기억에 남아요.',
        rom: 'Ne! Joahaneun gasareul gongchaege jeogeo dumyeon orae gieoge namayo.',
        vi: 'Có chứ! Chép lại lời ca yêu thích vào sổ tay giúp nhớ từ rất lâu.',
      },
      {
        speaker: 'A',
        roleLabel: 'Bạn A',
        ko: '좋은 방법이네요! 저에게도 따라 부르기 쉬운 곡 하나 추천해 주세요.',
        rom: 'Joeun bangbeobineyo! Jeoegedo ttara bureugi swiun gok hana chucheonhae juseyo.',
        vi: 'Cách hay quá! Hãy gợi ý cho mình một bài dễ hát theo với nhé.',
      },
      {
        speaker: 'B',
        roleLabel: 'Bạn B',
        ko: '아이유의 ‘밤편지’를 추천해요. 발음도 또렷하고 가사가 시처럼 아름다워요.',
        rom: 'Aiyuui “Bampyeonji”reul chucheonhaeyo. Bareumdo ttoryeotago gasaga sicheoreom areumdawoyo.',
        vi: 'Mình gợi ý bài “Through the Night” của IU nhé. Phát âm rõ ràng mà lời ca đẹp như thơ vậy.',
      },
    ],
  },
]
