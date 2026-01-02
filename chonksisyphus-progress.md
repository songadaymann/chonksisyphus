# Chonk Sisyphus - Progress Notes

## Overview
A mobile-first Phaser 3 game where you blow into your microphone to push a boulder up endless hills. Sisyphus meets cute frog character!

## Current State

### Core Gameplay
- **Blow to push**: Microphone input moves the frog right and pushes the boulder
- **Physics-based boulder**: Uses Matter.js for realistic rolling/gravity with lumpy shape
- **Incline mechanics**: Boulder is harder to push uphill, easier downhill
- **Endless hills**: Procedurally generated terrain with varying hill lengths and inclines
- **Keyboard DISABLED**: Blow-only gameplay (no WASD/arrows)

### Title Screen
- Logo displayed with "Tap to Start" prompt
- Requests microphone permission on start
- Blue sky background

### HUD Elements
- **Hills counter**: Top-right, shows number of hills climbed
- **Clock**: Top-left, shows in-game time (5 real minutes = 1 day)
- **Season indicator**: Shows current season and day number
- **Weather indicator**: Shows current weather with emoji

### Time & Season System
- 5 real minutes = 1 in-game day
- 7 days = 1 season
- Seasons cycle: SPRING → SUMMER → FALL → WINTER
- Sky color changes based on time (dawn, day, dusk, night)

### Weather System
- **Clear**: No effects
- **Rain**: Light, medium, heavy variants with particle effects
- **Snow**: Light, medium, heavy (blizzard) variants
- **Wind**: Blows particles left or right
- Weather sound effects for each type

### Enemies (Mario 2 style, unlock by day)
| Day | Enemy | Behavior |
|-----|-------|----------|
| 0 | Pidgit | Flies across sky with bobbing motion |
| 0 | Shy Guy | Walks on ground, follows terrain |
| 1 | Autobomb | Drives fast on ground |
| 2 | Bob-omb | Walks on ground (5-frame animation) |
| 3 | Flurry | Runs fast on ground |
| 4 | Ninji | Jumps in place |
| 5 | Phanto | Flies erratically, changes direction randomly |
| 6 | Porcupo | Walks slowly on ground |
| 7 | Snift | Walks on ground |
| 8 | Subcon | Flies across screen with wave motion |

### Friends
- **Muscle Friend**: Pink muscular character that walks up the mountain
  - Spawns at game start
  - Randomly respawns (30% chance every 25 seconds)
  - 7-frame walk animation
  - Follows terrain

### Parallax Backgrounds
- 3 layers: Clouds, Mountains, Forest
- Different scroll speeds for depth effect
- Pixel art style with NEAREST filter for crispness

### Physics (Device-Specific)
| Device | Friction | FrictionStatic |
|--------|----------|----------------|
| Mobile | 0.5 | 0.6 |
| Desktop | 0.3 | 0.4 |

Desktop gets lower friction (Mac mics seem to need easier pushing)

### Microphone Setup
- Web Audio API with AnalyserNode
- Blow threshold: `0.009` (ultra sensitive)
- Smoothing applied for stability
- No visual meter (removed for clean UI)

### Sound Effects
- **Background music**: Loops continuously
- **Rolling stone**: Plays when boulder is moving
- **Weather sounds**: Light/heavy rain, light/heavy wind

### Stuck Detection
- If boulder doesn't move for 10 seconds, gets a gentle nudge
- Prevents frustrating gameplay halts

### Boulder
- 8-bit pixel art texture (procedurally generated)
- Lumpy polygon physics shape for more interesting rolling
- Circular mask applied to sprite

## Files
- `index.html` - Responsive mobile-ready HTML
- `game.js` - All game logic (~2000 lines)
- `blow-test.html` - Microphone sensitivity test page
- `assets/chonks/frog-chonk/` - Player sprite assets
- `assets/enemies/` - Enemy sprites organized by character
- `assets/friends/` - Friend sprites (muscle)
- `assets/parallax/` - Background layers
- `assets/sounds/` - Sound effects
- `assets/terrain/` - Ground tiles

## Debug Options
```javascript
const DEBUG = {
    showPhysics: false,
    logWeather: false,
    logEnemies: true
};
```

## Completed Features ✅
- [x] Endless procedural terrain
- [x] Hill variety (length and incline)
- [x] Time/day/season system
- [x] Weather with particle effects
- [x] Sound effects (weather, rolling stone, music)
- [x] Mario 2 enemies with day-based unlocking
- [x] Muscle friend character
- [x] Device-specific physics tuning
- [x] Title screen with mic permission
- [x] Parallax backgrounds
- [x] 8-bit procedural boulder
- [x] Stuck detection with auto-nudge

## Known Issues / TODO
- [ ] Rolling stone sound not playing (debugging)
- [ ] Could add more friend characters
- [ ] Possible win condition or milestones?

---
*Last updated: Jan 2, 2026*
