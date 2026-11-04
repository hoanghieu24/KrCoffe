# K-CHILL Café — Hướng Dẫn Thư Viện Hình Ảnh (`ASSET_GUIDE.md`)

Tài liệu này mô tả cấu trúc thư mục, quy chuẩn kỹ thuật và danh sách chi tiết toàn bộ **129 hình ảnh Asset PNG** trong thư mục `public/assets/` của dự án **K-CHILL Café** (quán cà phê trực tuyến 2D/2.5D Isometric dành cho người học tiếng Hàn).

---

## 1. Quy Chuẩn Chung

- **Phong cách mỹ thuật:** 2.5D Isometric kết hợp Chibi dễ thương, đường viền nâu ấm (`#4A3124`), bảng màu kem – gỗ sồi – xanh rêu – nâu espresso hài hòa, tối giản nhưng sắc nét, chuẩn không gian quán cà phê Hàn Quốc ấm cúng.
- **Định dạng file:** `PNG` chuẩn (`RGBA` nền trong suốt cho toàn bộ nhân vật, sprite sheet, nội thất, đồ vật, vật trang trí, tường/sàn/cửa và UI; `RGB` độ phân giải cao cho ảnh nền tổng thể `backgrounds/`).
- **Quy tắc đặt tên:** Tiếng Anh, chữ thường (`lowercase`), phân tách bằng dấu gạch ngang (`kebab-case`), không trùng tên file trên toàn bộ cây thư mục.
- **Tổng số lượng hiện có:** **129 file PNG** trên 22 thư mục, được khai báo tập trung tại `src/game/AssetManifest.ts`.

---

## 2. Cấu Trúc Thư Mục & Quy Chuẩn Kích Thước

```text
public/assets/                                (Tổng: 129 file PNG)
├── characters/                               (30 file)
│   ├── male/                                 (4 file · 256×320 px · RGBA)
│   ├── female/                               (4 file · 256×320 px · RGBA)
│   ├── hairstyles/                           (4 file · 256×256 px · RGBA)
│   ├── outfits/                              (4 file · 256×320 px · RGBA)
│   └── animations/                           (14 file: 8 sprite sheet 384×2400 px + 6 emote 128×128 px · RGBA)
├── environment/                              (19 file)
│   ├── floors/                               (6 file · 512×512 px · RGBA)
│   ├── walls/                                (6 file · 512×512 px · RGBA)
│   ├── doors/                                (2 file · 512×512 px · RGBA)
│   ├── windows/                              (2 file · 512×512 px · RGBA)
│   └── backgrounds/                          (3 file · 1024×576 px · RGB 16:9)
├── furniture/                                (18 file)
│   ├── tables/                               (5 file · 512×512 px · RGBA)
│   ├── chairs/                               (5 file · 256×256 px · RGBA)
│   ├── sofas/                                (3 file · 512×512 px · RGBA)
│   ├── counters/                             (2 file · 512×512 px · RGBA)
│   └── shelves/                              (3 file · 512×512 px · RGBA)
├── items/                                    (24 file)
│   ├── coffee/                               (6 file · 256×256 px · RGBA)
│   ├── food/                                 (6 file · 256×256 px · RGBA)
│   ├── books/                                (6 file · 256×256 px · RGBA)
│   └── electronics/                          (6 file · 256×256 px · RGBA)
├── decorations/                              (14 file · 384×384 px · RGBA)
├── ui/                                       (24 file)
│   ├── avatars/                              (8 file · 256×256 px · RGBA)
│   └── icons/                                (16 file · 128×128 px · RGBA)
└── ASSET_GUIDE.md
```

---

## 3. Chi Tiết Từng Nhóm Thư Mục

### A. `characters/` — Nhân vật Chibi, Trang phục & Chuyển động (30 file)

| Thư mục con | Kích thước | Số lượng | Danh sách file | Mô tả nội dung |
| :--- | :---: | :---: | :--- | :--- |
| `characters/male/` | `256×320` | 4 | `male-minh-hoodie.png`<br>`male-joon-glasses.png`<br>`male-dae-sweater.png`<br>`male-jun-cardigan.png` | 4 nhân vật nam Chibi Isometric gốc (Minh hoodie kem, Joon áo khoác xanh đeo kính, Dae áo len vàng gấu nhỏ, Jun cardigan nâu đỏ). |
| `characters/female/` | `256×320` | 4 | `female-hana-cardigan.png`<br>`female-nari-bob.png`<br>`female-yuna-overalls.png`<br>`female-soo-bun.png` | 4 nhân vật nữ Chibi Isometric gốc (Hana cardigan xanh rêu, Nari áo hồng tóc bob, Yuna yếm jean tóc dài, Soo áo tím búi tóc). |
| `characters/hairstyles/` | `256×256` | 4 | `hairstyle-fluffy-parted-dark.png`<br>`hairstyle-high-ponytail-brown.png`<br>`hairstyle-short-bob-chestnut.png`<br>`hairstyle-long-wavy-espresso.png` | 4 mẫu tóc rời góc nhìn 3/4 Isometric phục vụ tùy biến ngoại hình. |
| `characters/outfits/` | `256×320` | 4 | `outfit-barista-sage-apron.png`<br>`outfit-cream-oversized-hoodie.png`<br>`outfit-preppy-vest-plaid-skirt.png`<br>`outfit-lavender-bow-sweater.png` | 4 bộ trang phục Chibi (tạp dề barista xanh rêu, hoodie kem, đồng phục học sinh, áo len tím gắn nơ). |
| `characters/animations/` *(Sprite Sheets)* | `384×2400`<br>*(96×120 / frame)* | 8 | `anim-minh-spritesheet.png`<br>`anim-hana-spritesheet.png`<br>`anim-nari-spritesheet.png`<br>`anim-joon-spritesheet.png`<br>`anim-dae-spritesheet.png`<br>`anim-yuna-spritesheet.png`<br>`anim-soo-spritesheet.png`<br>`anim-jun-spritesheet.png` | 8 sprite sheet đồng bộ 4 cột frame × 20 hàng (`5 trạng thái: idle, walk, sit, talk, wave` × `4 hướng: down, left, right, up`) dùng trực tiếp cho Phaser `CharacterSpriteFactory`. |
| `characters/animations/` *(Emote Bubbles)* | `128×128` | 6 | `emote-bubble-chat.png`<br>`emote-bubble-happy.png`<br>`emote-bubble-heart.png`<br>`emote-bubble-study.png`<br>`emote-bubble-music.png`<br>`emote-bubble-wave.png` | 6 bong bóng biểu cảm nổi trên đầu nhân vật khi trò chuyện, học bài, nghe nhạc, vẫy tay chào hỏi và thả tim. |

---

### B. `environment/` — Không gian kiến trúc quán (19 file)

| Thư mục con | Kích thước | Số lượng | Danh sách file | Mô tả nội dung |
| :--- | :---: | :---: | :--- | :--- |
| `environment/floors/` | `512×512` | 6 | `floor-honey-oak-planks.png`<br>`floor-walnut-herringbone.png`<br>`floor-cream-terrazzo-tile.png`<br>`floor-sage-woven-rug.png`<br>`floor-checkered-mocha-cream.png`<br>`floor-light-birch-planks.png` | Sàn gỗ sồi mật ong, sàn gỗ xương cá, gạch terrazzo kem, thảm dệt xanh rêu, gạch caro mocha–kem và sàn gỗ bạch dương sáng. |
| `environment/walls/` | `512×512` | 6 | `wall-cream-sage-wainscot.png`<br>`wall-oak-slats-string-lights.png`<br>`wall-pastel-brick-wood-base.png`<br>`wall-wooden-planter-divider.png`<br>`wall-sage-mint-panel.png`<br>`wall-warm-arch-niche.png` | Tường kem ốp lam xanh, tường nan gỗ dây đèn, tường gạch pastel, vách ngăn bồn cây, tường pano xanh bạc hà và tường hốc vòm trưng bày. |
| `environment/doors/` | `512×512` | 2 | `door-wooden-glass-entrance.png`<br>`door-cozy-wood-panel.png` | Cửa kính khung gỗ lối vào chính và cửa gỗ nội thất ô kính tròn. |
| `environment/windows/` | `512×512` | 2 | `window-rainy-night-city.png`<br>`window-cherry-blossom-day.png` | Cửa sổ lớn cảnh đêm mưa thành phố hoa anh đào kèm dây đèn ấm và cửa sổ ban ngày mùa xuân. |
| `environment/backgrounds/` | `1024×576` | 3 | `bg-cafe-interior-night-rain.png`<br>`bg-warm-daylight-cafe.png`<br>`bg-golden-sunset-cafe.png` | 3 phông nền không gian quán (đêm mưa chill, nắng sớm dịu ấm và hoàng hôn vàng). |

---

### C. `furniture/` — Nội thất quán cà phê (18 file)

| Thư mục con | Kích thước | Số lượng | Danh sách file | Mô tả nội dung |
| :--- | :---: | :---: | :--- | :--- |
| `furniture/tables/` | `512×512` | 5 | `table-round-bistro-oak.png`<br>`table-square-cafe-oak.png`<br>`table-cream-minimal-round.png`<br>`table-group-study-long.png`<br>`table-low-lounge-round.png` | Bàn tròn bistro gỗ sồi, bàn vuông cà phê, bàn tròn mặt kem tối giản kiểu Hàn, bàn dài học nhóm và bàn trà thấp khu sofa. |
| `furniture/chairs/` | `256×256` | 5 | `chair-single-sage-cushion.png`<br>`chair-terracotta-cushion.png`<br>`chair-round-wooden-stool.png`<br>`chair-double-wooden-bench.png`<br>`chair-cozy-beige-armchair.png` | Ghế đơn đệm xanh rêu, ghế đơn đệm cam đất ấm, ghế đôn tròn gỗ, ghế băng đôi và ghế bành bọc nỉ kem. |
| `furniture/sofas/` | `512×512` | 3 | `sofa-sage-green-loveseat.png`<br>`sofa-caramel-booth-bench.png`<br>`sofa-cream-cloud-loveseat.png` | Sofa đôi xanh rêu khung gỗ, ghế băng nâu caramel và sofa mây kem bo tròn. |
| `furniture/counters/` | `512×512` | 2 | `counter-barista-pastry-l-shape.png`<br>`counter-bakery-espresso-straight.png` | Quầy pha chế chữ L và quầy thẳng tích hợp tủ bánh ngọt, máy pha espresso và máy xay hạt. |
| `furniture/shelves/` | `512×512` | 3 | `bookshelf-tall-wooden-korean.png`<br>`shelf-low-wooden-display.png`<br>`shelf-floating-oak-wall.png` | Kệ sách gỗ cao nhiều tầng, kệ trưng bày thấp 2 tầng và kệ gỗ treo tường trang trí lọ gốm & cây rủ. |

---

### D. `items/` — Đồ uống, Bánh ngọt & Đồ dùng học tập (24 file)

| Thư mục con | Kích thước | Số lượng | Danh sách file | Mô tả nội dung |
| :--- | :---: | :---: | :--- | :--- |
| `items/coffee/` | `256×256` | 6 | `coffee-hot-latte-mug.png`<br>`coffee-iced-americano-glass.png`<br>`coffee-dalgona-iced-latte.png`<br>`drink-brown-sugar-milk-tea.png`<br>`drink-strawberry-matcha-latte.png`<br>`drink-peach-iced-tea.png` | Latte nóng vẽ tim, Iced Americano, Dalgona cà phê bọt kem Hàn Quốc, trà sữa đường đen, dâu matcha latte và trà đào cam sả. |
| `items/food/` | `256×256` | 6 | `food-strawberry-shortcake.png`<br>`food-butter-croissant.png`<br>`food-korean-macaron-set.png`<br>`food-matcha-roll-cake.png`<br>`food-korean-bingsu-bowl.png`<br>`food-honey-butter-toast.png` | Bánh kem dâu tây, bánh sừng bò bơ, set macaron pastel, bánh cuộn trà xanh, Patbingsu dâu Hàn Quốc và bánh mì nướng bơ mật ong. |
| `items/books/` | `256×256` | 6 | `book-korean-hangul-textbook.png`<br>`book-korean-study-stack.png`<br>`notebook-open-spiral-pen.png`<br>`notebook-mustard-bear-clip.png`<br>`book-hangul-flashcards.png`<br>`book-wooden-pen-holder.png` | Giáo trình `한글`, chồng sách ôn tập TOPIK, vở lò xo mở sẵn kèm bút, sổ tay gấu vàng, bộ thẻ từ vựng Hangul (`가나다`) và ống cắm bút gỗ. |
| `items/electronics/` | `256×256` | 6 | `electronics-study-laptop-open.png`<br>`electronics-smartphone-sage.png`<br>`electronics-wireless-headphones.png`<br>`electronics-study-tablet-stylus.png`<br>`electronics-retro-lofi-radio.png`<br>`electronics-sage-desk-lamp.png` | Laptop học từ vựng, điện thoại xanh rêu, tai nghe chụp tai không dây, máy tính bảng kèm bút, loa/radio lofi cổ điển và đèn bàn học xanh rêu. |

---

### E. `decorations/` — Cây cảnh, Đèn, Tranh tường & Biển hiệu (14 file)

- **Kích thước chuẩn:** `384×384 px` (`RGBA` nền trong suốt)
- **Danh sách 14 file:**
  1. `plant-monstera-ceramic-pot.png` — Chậu cây Monstera gốm kem kê chân gỗ.
  2. `flower-vase-cherry-blossom.png` — Bình gốm cắm cành hoa anh đào hồng.
  3. `plant-succulent-trio-tray.png` — Khay gỗ 3 chậu sen đá nhỏ trang trí bàn/kệ.
  4. `wall-art-hanok-painting.png` — Tranh treo tường mái ngói cổ Hanok và hoa anh đào.
  5. `wall-art-korean-flag-frame.png` — Khung tranh gỗ biểu tượng Taegeukgi Hàn Quốc tối giản.
  6. `wall-art-hangul-chalkboard.png` — Bảng phấn treo tường viết chữ `한국어 화이팅!`.
  7. `clock-round-wooden-wall.png` — Đồng hồ tròn khung gỗ treo tường góc Isometric.
  8. `lamp-standing-warm-shade.png` — Đèn cây đứng chụp vải xếp ly tỏa sáng ấm.
  9. `lamp-wooden-table-lantern.png` — Đèn lồng nến khung gỗ nhỏ đặt bàn cà phê.
  10. `lamp-pendant-warm-dome.png` — Đèn thả trần chụp vòm ấm áp dọc khung cửa sổ.
  11. `sign-k-chill-cafe-wood.png` — Biển hiệu gỗ phát sáng **K-CHILL Café**.
  12. `sign-chalkboard-menu-easel.png` — Bảng phấn menu chữ A đặt sàn.
  13. `decor-vinyl-turntable.png` — Đầu đĩa than gỗ phát nhạc lofi.
  14. `decor-acoustic-guitar.png` — Đàn guitar gỗ mộc dựng trên giá góc âm nhạc.

---

### F. `ui/` — Hình ảnh giao diện người dùng (24 file)

| Thư mục con | Kích thước | Số lượng | Danh sách file | Mô tả nội dung |
| :--- | :---: | :---: | :--- | :--- |
| `ui/avatars/` | `256×256` | 8 | `avatar-male-minh.png`<br>`avatar-male-joon.png`<br>`avatar-male-dae.png`<br>`avatar-male-jun.png`<br>`avatar-female-hana.png`<br>`avatar-female-nari.png`<br>`avatar-female-yuna.png`<br>`avatar-female-soo.png` | 8 huy hiệu ảnh đại diện tròn viền kem–espresso đồng bộ 1:1 với 8 nhân vật Chibi trong game. |
| `ui/icons/` | `128×128` | 16 | `icon-coffee-logo.png`, `icon-friends-group.png`, `icon-chat-dialogue.png`, `icon-game-controller.png`, `icon-music-note.png`, `icon-korean-book.png`, `icon-mail-message.png`, `icon-settings-gear.png`, `icon-microphone.png`, `icon-speaker-audio.png`, `icon-speaker-muted.png`, `icon-quest-checklist.png`, `icon-heart-favorite.png`, `icon-bell-notification.png`, `icon-chair-seat.png`, `icon-star-level.png` | Bộ 16 icon giao diện hoàn chỉnh dùng trên thanh điều hướng, thanh trạng thái ghế ngồi, dock âm thanh/micro, thông báo và thẻ cấp độ TOPIK. |

---

## 4. Quy Tắc Mở Rộng Thêm Asset Trong Tương Lai

1. Chỉ lưu định dạng `.png` chuẩn (`RGBA` sạch viền trắng cho vật thể/nhân vật/icon).
2. Đặt tên tiếng Anh, chữ thường, phân tách bằng dấu gạch ngang (`kebab-case`) và đăng ký key tại `src/game/AssetManifest.ts`.
3. Giữ đúng kích thước khung chuẩn của từng thư mục; với nhân vật mới, tạo thêm 1 sprite sheet `384×2400 px` (`96×120 px/frame`, 4 cột × 20 hàng) để tương thích tức thì với `CharacterSpriteFactory`.
