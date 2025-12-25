# Chonk Sisyphus - Progress Notes

## Overview
A mobile-first Phaser 3 game where you blow into your microphone to push a boulder up a hill. Sisyphus meets cute frog character!

## Current State

### Core Gameplay
- **Blow to push**: Microphone input moves the frog right and pushes the boulder
- **Physics-based boulder**: Uses Matter.js for realistic rolling/gravity
- **Incline mechanics**: Boulder is harder to push uphill, easier downhill
- **Keyboard backup**: Arrow keys / WASD still work

### Sprites (in `frog-chonk/` folder)
- `frog-chonk-walk1.png` through `walk4.png` - 4-frame walk cycle
- `frog-chonk-push1.png` through `push4.png` - 4-frame push cycle
- Walking animation when moving freely
- Push animation when pressing against boulder

### Level Layout
- Flat bottom section (250px)
- Gentle incline (400px wide, 200px height)
- Flat top section (250px)
- Total world width: 900px (scrolls horizontally)

### Physics Tuning (the sweet spot!)
- Ball density: `0.0006`
- Ball friction: `0.4`
- Ball frictionStatic: `0.5`
- Push force (flat): `0.002`
- Push force (uphill): `0.0015`
- Push force (downhill): `0.0025`
- Blow harder = push harder (force scales with mic volume)

### Mobile Optimizations
- Portrait aspect ratio: 440×780 (roughly 9:16)
- `Phaser.Scale.FIT` with auto-center
- Camera follows player with smooth lerp
- UI elements fixed to screen (don't scroll)
- Touch-friendly, disabled pinch-zoom
- iOS "Add to Home Screen" ready

### Collision Rules
- Player can ONLY be to the LEFT of the ball
- Ball can push player backward when rolling down
- Player can't pass through ball in either direction

### Microphone Setup
- Web Audio API with AnalyserNode
- Blow threshold: `0.15` (normalized 0-1)
- Visual mic meter on screen
- Tap/click to enable (browser security requirement)

## Files
- `index.html` - Responsive mobile-ready HTML
- `game.js` - All game logic (single file for simplicity)
- `frog-chonk/` - Sprite assets

## Next Ideas?
- [ ] Win condition when boulder reaches the top?
- [ ] The boulder rolls back if you stop blowing?
- [ ] Multiple hills/levels?
- [ ] Leaderboard for fastest time?
- [ ] Sound effects?
- [ ] Particle effects when pushing?

---
*Last updated: Dec 17, 2025*

