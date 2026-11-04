# K-CHILL Cafe

A Vietnamese-first Korean-learning cafe built with React, TypeScript, and Phaser 3. Phase 1 provides a playable local 2.5D room with the existing React sidebar and chat interface.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` type-checks the app and creates the deployable bundle in `dist/`.

## Phase 1

- Fixed isometric cafe with low-poly furniture, counter, rainy windows, plants, and study area.
- Fifteen tables and exactly thirty named seats. Free seats can be reserved by walking over; the player sits on arrival and can stand from the sidebar.
- Continuous WASD and arrow-key movement, click-to-walk pathfinding, static and occupied-player collision, and Y-based depth sorting.
- Chibi sprite animations for idle, walk, sit, talk, and wave, with four facing directions and four frames per animation.
- Separate local and demo remote players using a shared player data shape (`userId`, `username`, `avatar`, `position`, `direction`, `animation`, `seatId`, `onlineStatus`).
- The existing sidebar, friend list, profile/avatar picker, seat status, chat preview, music controls, and level card remain React UI.

## Architecture

```text
src/
  App.tsx                       React HUD and room interactions
  data/demoData.ts              Avatar looks and seeded demo visitors
  domain/types.ts               Shared player, seat, and event types
  game/CafeScene.ts             Phaser scene and local/remote player orchestration
  game/CafeMap.ts               Isometric room, furniture, seat and obstacle geometry
  game/CharacterController.ts   Per-player movement, animation and collision response
  game/CharacterSpriteFactory.ts Chibi frame atlas and directional animation definitions
  game/CollisionMap.ts          Walkable area, obstacle checks and click-path routing
  game/SeatManager.ts           Thirty seat records, reservations and occupancy
  styles.css                    Existing responsive React interface
```

Demo visitors and initial occupied seats are seeded in `src/data/demoData.ts`; the Phaser scene keeps local room state. This phase does not connect clients through Socket.IO or a server, so other browser sessions do not synchronize yet. The player and seat types are separated from the scene so a later Socket.IO phase can add server-authoritative presence and reservations.
