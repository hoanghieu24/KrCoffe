// Bộ lọc từ ngữ và kiểm duyệt nội dung an toàn cho K-CHILL CAFÉ
// Tuân thủ thuần phong mỹ tục, bảo vệ cộng đồng học tập văn minh & an toàn
// Sử dụng Unicode lookaround (?<![\p{L}\p{N}]) ... (?![\p{L}\p{N}]) để hỗ trợ tiếng Việt & tiếng Hàn chuẩn xác

const BAD_WORDS_REGEX_LIST: RegExp[] = [
  // 1. Tiếng Việt thô tục / chửi bậy / xúc phạm
  /(?<![\p{L}\p{N}])(đ[ụịm]|đ\.m|d\.m|dcm|đcm|đcl|vcl|vl|vkl|đmm|dmm|dkm|đkm|đb|địt|đụ|lồn|cặc|buồi|chó\s*đẻ|chó\s*chết|mẹ\s*mày|mẹ\s*kiếp|óc\s*chó|óc\s*lợn|ngu\s*như\s*bò)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(djt|dcm|dcl|vcl|vlon|clon|loz|cac|cu|buoi|ditme|dume|ditconme|duconme)(?![\p{L}\p{N}])/giu,

  // 2. Nội dung khiêu dâm / đồi trụy / cờ bạc
  /(?<![\p{L}\p{N}])(sex|porn|nude|gái\s*gọi|gái\s*bao|cá\s*độ|kèo\s*bóng|lô\s*đề|tài\s*xỉu|casino|đánh\s*bạc)(?![\p{L}\p{N}])/giu,

  // 3. Thù ghét / phân biệt chủng tộc / vi phạm an ninh
  /(?<![\p{L}\p{N}])(bắc\s*kỳ\s*chó|nam\s*kỳ\s*chó|phản\s*động|khủng\s*bố)(?![\p{L}\p{N}])/giu,

  // 4. Tiếng Anh thô tục phổ biến
  /(?<![\p{L}\p{N}])(fuck|fucking|bitch|bastard|asshole|dick|pussy|whore|slut|cunt|nigger|faggot)(?![\p{L}\p{N}])/giu,

  // 5. Tiếng Hàn chửi tục phổ biến
  /(?<![\p{L}\p{N}])(시발|씨발|개새끼|지랄|병신|좆|꺼져|죽어)(?![\p{L}\p{N}])/giu,
]

export function containsBadWords(rawText: string): boolean {
  if (!rawText) return false
  const text = rawText.trim()
  return BAD_WORDS_REGEX_LIST.some((reg) => {
    reg.lastIndex = 0
    return reg.test(text)
  })
}

export function sanitizeText(rawText: string): string {
  if (!rawText) return ''
  let cleaned = rawText
  for (const reg of BAD_WORDS_REGEX_LIST) {
    reg.lastIndex = 0
    cleaned = cleaned.replace(reg, '***')
  }
  return cleaned
}

export function validateUsername(rawName: string): { valid: boolean; reason?: string } {
  const name = rawName.trim()
  if (!name) {
    return { valid: false, reason: 'Tên hiển thị không được để trống.' }
  }
  if (name.length < 2) {
    return { valid: false, reason: 'Tên hiển thị cần ít nhất 2 ký tự.' }
  }
  if (name.length > 20) {
    return { valid: false, reason: 'Tên hiển thị không được vượt quá 20 ký tự.' }
  }
  if (containsBadWords(name)) {
    return { valid: false, reason: 'Tên hiển thị chứa từ ngữ không phù hợp với văn hóa quán.' }
  }
  return { valid: true }
}
