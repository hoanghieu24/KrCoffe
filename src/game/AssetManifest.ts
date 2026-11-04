export const SPRITE_FRAME_W = 96
export const SPRITE_FRAME_H = 120

export type CharacterAssetEntry = {
  sheetKey: string
  sheetUrl: string
  avatarUrl: string
  fullBodyUrl: string
}

export const CHARACTER_ASSETS: Record<string, CharacterAssetEntry> = {
  'look-01': {
    sheetKey: 'char-sheet-look-01',
    sheetUrl: '/assets/characters/animations/anim-minh-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-male-minh.png',
    fullBodyUrl: '/assets/characters/male/male-minh-hoodie.png',
  },
  'look-02': {
    sheetKey: 'char-sheet-look-02',
    sheetUrl: '/assets/characters/animations/anim-hana-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-female-hana.png',
    fullBodyUrl: '/assets/characters/female/female-hana-cardigan.png',
  },
  'look-03': {
    sheetKey: 'char-sheet-look-03',
    sheetUrl: '/assets/characters/animations/anim-nari-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-female-nari.png',
    fullBodyUrl: '/assets/characters/female/female-nari-bob.png',
  },
  'look-04': {
    sheetKey: 'char-sheet-look-04',
    sheetUrl: '/assets/characters/animations/anim-joon-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-male-joon.png',
    fullBodyUrl: '/assets/characters/male/male-joon-glasses.png',
  },
  'look-05': {
    sheetKey: 'char-sheet-look-05',
    sheetUrl: '/assets/characters/animations/anim-dae-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-male-dae.png',
    fullBodyUrl: '/assets/characters/male/male-dae-sweater.png',
  },
  'look-06': {
    sheetKey: 'char-sheet-look-06',
    sheetUrl: '/assets/characters/animations/anim-yuna-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-female-yuna.png',
    fullBodyUrl: '/assets/characters/female/female-yuna-overalls.png',
  },
  'look-07': {
    sheetKey: 'char-sheet-look-07',
    sheetUrl: '/assets/characters/animations/anim-soo-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-female-soo.png',
    fullBodyUrl: '/assets/characters/female/female-soo-bun.png',
  },
  'look-08': {
    sheetKey: 'char-sheet-look-08',
    sheetUrl: '/assets/characters/animations/anim-jun-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-male-jun.png',
    fullBodyUrl: '/assets/characters/male/male-jun-cardigan.png',
  },
  'look-barista': {
    sheetKey: 'char-sheet-look-07',
    sheetUrl: '/assets/characters/animations/anim-soo-spritesheet.png?v=expressive-3',
    avatarUrl: '/assets/ui/avatars/avatar-female-soo.png',
    fullBodyUrl: '/assets/characters/female/female-soo-bun.png',
  },
}

export const SCENE_IMAGES: Record<string, string> = {
  // Environment
  'bg-warm-daylight': '/assets/environment/backgrounds/bg-warm-daylight-cafe.png',
  'floor-oak': '/assets/environment/floors/floor-honey-oak-planks.png',
  'floor-herringbone': '/assets/environment/floors/floor-walnut-herringbone.png',
  'floor-rug': '/assets/environment/floors/floor-sage-woven-rug.png',
  'wall-wainscot': '/assets/environment/walls/wall-cream-sage-wainscot.png',
  'wall-slats': '/assets/environment/walls/wall-oak-slats-string-lights.png',
  'wall-planter': '/assets/environment/walls/wall-wooden-planter-divider.png',
  'door-entrance': '/assets/environment/doors/door-wooden-glass-entrance.png',
  'window-rainy': '/assets/environment/windows/window-rainy-night-city.png',
  'window-day': '/assets/environment/windows/window-cherry-blossom-day.png',

  // Furniture
  'counter-l-shape': '/assets/furniture/counters/counter-barista-pastry-l-shape.png',
  'counter-straight': '/assets/furniture/counters/counter-bakery-espresso-straight.png',
  'counter-appliances': '/assets/furniture/counters/counter-appliances.png?v=clean-counter-5',
  'counter-front-bar': '/assets/furniture/counters/counter-front-bar.png?v=clean-counter-5',
  'bookshelf-tall': '/assets/furniture/shelves/bookshelf-tall-wooden-korean.png',
  'shelf-low': '/assets/furniture/shelves/shelf-low-wooden-display.png',
  'shelf-wall': '/assets/furniture/shelves/shelf-floating-oak-wall.png',
  'sofa-sage': '/assets/furniture/sofas/sofa-sage-green-loveseat.png',
  'sofa-caramel': '/assets/furniture/sofas/sofa-caramel-booth-bench.png',
  'table-round': '/assets/furniture/tables/table-round-bistro-oak.png',
  'table-square': '/assets/furniture/tables/table-square-cafe-oak.png',
  'table-cream': '/assets/furniture/tables/table-cream-minimal-round.png',
  'table-study': '/assets/furniture/tables/table-group-study-long.png',
  'table-low': '/assets/furniture/tables/table-low-lounge-round.png',
  'chair-sage': '/assets/furniture/chairs/chair-single-sage-cushion.png',
  'chair-terracotta': '/assets/furniture/chairs/chair-terracotta-cushion.png',
  'chair-stool': '/assets/furniture/chairs/chair-round-wooden-stool.png',
  'chair-bench': '/assets/furniture/chairs/chair-double-wooden-bench.png',
  'chair-armchair': '/assets/furniture/chairs/chair-cozy-beige-armchair.png',

  // Items (Coffee, Food, Books, Electronics)
  'item-latte': '/assets/items/coffee/coffee-hot-latte-mug.png',
  'item-americano': '/assets/items/coffee/coffee-iced-americano-glass.png',
  'item-boba': '/assets/items/coffee/drink-brown-sugar-milk-tea.png',
  'item-matcha-latte': '/assets/items/coffee/drink-strawberry-matcha-latte.png',
  'item-dalgona': '/assets/items/coffee/coffee-dalgona-iced-latte.png',
  'item-peach-tea': '/assets/items/coffee/drink-peach-iced-tea.png',
  'item-shortcake': '/assets/items/food/food-strawberry-shortcake.png',
  'item-croissant': '/assets/items/food/food-butter-croissant.png',
  'item-macaron': '/assets/items/food/food-korean-macaron-set.png',
  'item-roll-cake': '/assets/items/food/food-matcha-roll-cake.png',
  'item-bingsu': '/assets/items/food/food-korean-bingsu-bowl.png',
  'item-toast': '/assets/items/food/food-honey-butter-toast.png',
  'item-hangul-book': '/assets/items/books/book-korean-hangul-textbook.png',
  'item-book-stack': '/assets/items/books/book-korean-study-stack.png',
  'item-open-notebook': '/assets/items/books/notebook-open-spiral-pen.png',
  'item-bear-notebook': '/assets/items/books/notebook-mustard-bear-clip.png',
  'item-flashcards': '/assets/items/books/book-hangul-flashcards.png',
  'item-pen-holder': '/assets/items/books/book-wooden-pen-holder.png',
  'item-laptop': '/assets/items/electronics/electronics-study-laptop-open.png',
  'item-phone': '/assets/items/electronics/electronics-smartphone-sage.png',
  'item-headphones': '/assets/items/electronics/electronics-wireless-headphones.png',
  'item-tablet': '/assets/items/electronics/electronics-study-tablet-stylus.png',
  'item-lofi-radio': '/assets/items/electronics/electronics-retro-lofi-radio.png',
  'item-desk-lamp': '/assets/items/electronics/electronics-sage-desk-lamp.png',

  // Decorations
  'decor-monstera': '/assets/decorations/plant-monstera-ceramic-pot.png',
  'decor-cherry-vase': '/assets/decorations/flower-vase-cherry-blossom.png',
  'decor-succulents': '/assets/decorations/plant-succulent-trio-tray.png',
  'decor-hanok-art': '/assets/decorations/wall-art-hanok-painting.png',
  'decor-flag-art': '/assets/decorations/wall-art-korean-flag-frame.png',
  'decor-chalkboard-wall': '/assets/decorations/wall-art-hangul-chalkboard.png',
  'decor-clock': '/assets/decorations/clock-round-wooden-wall.png',
  'decor-floor-lamp': '/assets/decorations/lamp-standing-warm-shade.png',
  'decor-table-lantern': '/assets/decorations/lamp-wooden-table-lantern.png',
  'decor-pendant-lamp': '/assets/decorations/lamp-pendant-warm-dome.png',
  'decor-sign-kchill': '/assets/decorations/sign-k-chill-cafe-wood.png',
  'decor-easel': '/assets/decorations/sign-chalkboard-menu-easel.png',
  'decor-vinyl': '/assets/decorations/decor-vinyl-turntable.png',
  'decor-guitar': '/assets/decorations/decor-acoustic-guitar.png',

  // Overhead Emote Bubbles & Badges
  'emote-chat': '/assets/characters/animations/emote-bubble-chat.png',
  'emote-happy': '/assets/characters/animations/emote-bubble-happy.png',
  'emote-heart': '/assets/characters/animations/emote-bubble-heart.png',
  'emote-study': '/assets/characters/animations/emote-bubble-study.png',
  'emote-music': '/assets/characters/animations/emote-bubble-music.png',
  'emote-wave': '/assets/characters/animations/emote-bubble-wave.png',
  'badge-mic': '/assets/ui/icons/icon-microphone.png',
  'badge-game': '/assets/ui/icons/icon-game-controller.png',
}

export const UI_ICONS = {
  logo: '/assets/ui/icons/icon-coffee-logo.png',
  friends: '/assets/ui/icons/icon-friends-group.png',
  chat: '/assets/ui/icons/icon-chat-dialogue.png',
  games: '/assets/ui/icons/icon-game-controller.png',
  music: '/assets/ui/icons/icon-music-note.png',
  learn: '/assets/ui/icons/icon-korean-book.png',
  messages: '/assets/ui/icons/icon-mail-message.png',
  settings: '/assets/ui/icons/icon-settings-gear.png',
  mic: '/assets/ui/icons/icon-microphone.png',
  speaker: '/assets/ui/icons/icon-speaker-audio.png',
  speakerMuted: '/assets/ui/icons/icon-speaker-muted.png',
  quest: '/assets/ui/icons/icon-quest-checklist.png',
  heart: '/assets/ui/icons/icon-heart-favorite.png',
  bell: '/assets/ui/icons/icon-bell-notification.png',
  chair: '/assets/ui/icons/icon-chair-seat.png',
  star: '/assets/ui/icons/icon-star-level.png',
} as const
