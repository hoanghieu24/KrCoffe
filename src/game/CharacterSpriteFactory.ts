import Phaser from 'phaser'
import type { AvatarLook, CharacterAnimation, Direction } from '../domain/types'
import { CHARACTER_ASSETS, SPRITE_FRAME_H, SPRITE_FRAME_W } from './AssetManifest'

const FRAMES = 4
const STATES: CharacterAnimation[] = [
  'idle',
  'walk',
  'sit',
  'talk',
  'wave',
  'heart',
  'cheer',
  'coffee',
  'sit_wave',
  'sit_heart',
  'sit_cheer',
  'sit_coffee',
]
const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up']

export class CharacterSpriteFactory {
  static textureKey(look: AvatarLook): string {
    return CHARACTER_ASSETS[look.id]?.sheetKey ?? CHARACTER_ASSETS['look-01'].sheetKey
  }

  static frameIndex(state: CharacterAnimation, direction: Direction, frame: number): number {
    const sIdx = Math.max(0, STATES.indexOf(state))
    const dIdx = Math.max(0, DIRECTIONS.indexOf(direction))
    return (sIdx * DIRECTIONS.length + dIdx) * FRAMES + (frame % FRAMES)
  }

  static ensure(scene: Phaser.Scene, look: AvatarLook): string {
    const texKey = CharacterSpriteFactory.textureKey(look)
    if (!scene.textures.exists(texKey)) {
      const fallback = scene.textures.createCanvas(texKey, SPRITE_FRAME_W * FRAMES, SPRITE_FRAME_H * STATES.length * DIRECTIONS.length)
      fallback?.refresh()
    }

    for (const state of STATES) {
      for (const direction of DIRECTIONS) {
        const key = CharacterSpriteFactory.animationKey(look, state, direction)
        if (scene.anims.exists(key)) continue
        const startFrame = CharacterSpriteFactory.frameIndex(state, direction, 0)
        // idle / sit: slow breathing loop with a quick blink (frame 3 is the blink frame) every ~2.4s
        const isRestState = state === 'idle' || state === 'sit'
        const sequence = isRestState ? [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 3] : [0, 1, 2, 3]
        scene.anims.create({
          key,
          frames: sequence.map((i) => ({
            key: texKey,
            frame: startFrame + i,
          })),
          frameRate:
            state === 'walk' ? 8 :
            (state === 'cheer' || state === 'sit_cheer') ? 7 :
            (state === 'wave' || state === 'sit_wave') ? 6 :
            state === 'talk' ? 5 :
            (state === 'heart' || state === 'sit_heart') ? 4 :
            (state === 'coffee' || state === 'sit_coffee') ? 4 :
            isRestState ? 5 : 3,
          repeat: -1,
        })
      }
    }
    return texKey
  }

  static animationKey(look: AvatarLook, state: CharacterAnimation, direction: Direction): string {
    return `${look.id}__${state}__${direction}`
  }

  static firstFrame(look: AvatarLook, state: CharacterAnimation, direction: Direction): number {
    void look
    return CharacterSpriteFactory.frameIndex(state, direction, 0)
  }
}
