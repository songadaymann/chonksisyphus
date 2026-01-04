// Sisyphus Chonk - ENDLESS HILLS

// Debug options
const DEBUG = {
    showPhysics: false,
    showSegmentBounds: false,
    logWeather: true,  // Log weather events to console
    logEnemies: true   // Log enemy spawn attempts
};

// ============================================
// TITLE SCENE
// ============================================
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }
    
    preload() {
        this.load.image('logo', 'assets/sisyphus-chonk.png');
    }
    
    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        
        // Blue sky background
        this.cameras.main.setBackgroundColor('#87CEEB');
        
        // Logo (scaled to fit, pixel perfect)
        const logo = this.add.sprite(centerX, centerY - 30, 'logo');
        logo.setScale(0.5);  // Scale down to fit screen
        this.textures.get('logo').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Tap to start (blinking)
        const tapText = this.add.text(centerX, centerY + 120, 'TAP TO START', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#333',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: tapText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1
        });
        
        // Click/tap to request mic and start game
        this.input.on('pointerdown', async () => {
            try {
                // Request microphone permission
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Store stream globally so GameScene can use it
                window.micStream = stream;
                // Start the game!
                this.scene.start('GameScene');
            } catch (err) {
                console.error('Microphone access denied:', err);
                // Start anyway, game will work with keyboard
                window.micStream = null;
                this.scene.start('GameScene');
            }
        });
    }
}

// ============================================
// GAME SCENE
// ============================================
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.micLevel = 0;
        this.micEnabled = false;
        
        // Terrain segments storage
        this.segments = [];
        this.segmentIndex = 0;
        
        // Terrain dimensions (will be set in create based on screen size)
        this.baseGroundY = 0;
        
        // Hill variety ranges - ADJUST THESE!
        this.flatWidthMin = 50;      // Can be very short flat sections
        this.flatWidthMax = 600;     // Or long flat stretches
        this.inclineWidthMin = 100;  // Short hills
        this.inclineWidthMax = 800;  // Or loooong hills
        // Slope angle varies (height = width * ratio)
        this.inclineAngleMin = 0.15; // ~8 degrees - gentle
        this.inclineAngleMax = 0.50; // ~27 degrees - steeper (50 degrees would be too hard!)
        
        // Time system - 5 real minutes = 1 in-game day (300 seconds)
        this.dayLengthMs = 5 * 60 * 1000;  // 5 minutes in milliseconds
        this.gameTime = 6 * 60;  // Start at 6:00 AM (minutes since midnight)
        this.lastTimeUpdate = 0;
        
        // Season system - 7 in-game days = 1 season
        this.daysPerSeason = 7;
        
        // Stuck detection - bump rock if it hasn't moved in 10 seconds
        this.lastBallX = 0;
        this.stuckTimer = 0;
        this.stuckThreshold = 10000;  // 10 seconds in ms
        this.stuckMoveThreshold = 5; // Must move at least 5 pixels
        this.dayCount = 1;
        this.seasons = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
        this.currentSeasonIndex = 0;
        
        // Weather system
        this.currentWeather = 'clear';  // clear, rain, snow, wind
        this.weatherTimer = 0;
        this.weatherDuration = 0;
        this.windStrength = 0;  // -1 to 1 (negative = left, positive = right)
        
        // Random enemy appearances
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 15000;  // Check every 15 seconds
        this.enemySpawnChance = 0.4;      // 40% chance
        this.activeEnemies = [];
        
        // Friends system - special characters that appear on certain days
        this.activeFriends = [];
        this.muscleSpawned = false;  // Spawn muscle once at start
        this.friendSpawnTimer = 0;
        this.friendSpawnInterval = 25000;  // Check every 25 seconds
        this.friendSpawnChance = 0.3;  // 30% chance when timer fires
    }
    
    // Random number between min and max
    randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Create an 8-bit style pixel art boulder texture
    createPixelBoulderTexture() {
        const size = 32;  // Small texture, will be scaled up (crispy pixels!)
        const graphics = this.make.graphics();
        
        // Boulder color palette (limited like NES/8-bit)
        const colors = {
            dark: 0x4a4a4a,      // Dark grey (shadows)
            mid: 0x7a7a7a,       // Mid grey (base)
            light: 0x9a9a9a,     // Light grey (highlights)
            highlight: 0xbababa  // Brightest (top highlights)
        };
        
        // Draw pixelated boulder shape
        const pixelSize = 2;  // Each "pixel" is 2x2
        const center = size / 2;
        const radius = size / 2 - 2;
        
        for (let y = 0; y < size; y += pixelSize) {
            for (let x = 0; x < size; x += pixelSize) {
                const dx = x + pixelSize/2 - center;
                const dy = y + pixelSize/2 - center;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Only draw within rough circle
                if (dist < radius + (Math.random() * 3 - 1.5)) {
                    // Choose color based on position (lighting from top-left)
                    let color;
                    const lightAngle = Math.atan2(dy, dx);
                    const lightValue = Math.cos(lightAngle + Math.PI * 0.75);  // Light from top-left
                    
                    // Add some noise for rocky texture
                    const noise = Math.random() * 0.3 - 0.15;
                    const finalLight = lightValue + noise;
                    
                    if (finalLight > 0.3) {
                        color = colors.highlight;
                    } else if (finalLight > 0) {
                        color = colors.light;
                    } else if (finalLight > -0.3) {
                        color = colors.mid;
                    } else {
                        color = colors.dark;
                    }
                    
                    graphics.fillStyle(color);
                    graphics.fillRect(x, y, pixelSize, pixelSize);
                }
            }
        }
        
        // Add some darker cracks/details
        graphics.fillStyle(colors.dark);
        graphics.fillRect(10, 14, 2, 4);
        graphics.fillRect(18, 10, 2, 6);
        graphics.fillRect(14, 20, 4, 2);
        
        graphics.generateTexture('pixel-boulder', size, size);
        graphics.destroy();
        
        // Make sure it scales with nearest neighbor
        this.textures.get('pixel-boulder').setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    preload() {
        this.load.image('walk1', 'assets/chonks/frog-chonk/frog-chonk-walk1.png');
        this.load.image('walk2', 'assets/chonks/frog-chonk/frog-chonk-walk2.png');
        this.load.image('walk3', 'assets/chonks/frog-chonk/frog-chonk-walk3.png');
        this.load.image('walk4', 'assets/chonks/frog-chonk/frog-chonk-walk4.png');
        this.load.image('push1', 'assets/chonks/frog-chonk/frog-chonk-push1.png');
        this.load.image('push2', 'assets/chonks/frog-chonk/frog-chonk-push2.png');
        this.load.image('push3', 'assets/chonks/frog-chonk/frog-chonk-push3.png');
        this.load.image('push4', 'assets/chonks/frog-chonk/frog-chonk-push4.png');
        this.load.image('ground', 'assets/terrain/ground1.png');
        this.load.image('boulder', 'assets/boulder-texture.png');
        
        // Parallax backgrounds
        this.load.image('sky-clouds', 'assets/parallax/sky-clouds.png');
        this.load.image('mountains', 'assets/parallax/mountains.png');
        this.load.image('forest', 'assets/parallax/forest.png');
        
        // Friend sprites
        for (let i = 1; i <= 7; i++) {
            this.load.image(`muscle-${i}`, `assets/friends/muscle-walk${i}.png`);
        }
        
        // Enemy sprites (for random appearances)
        // Day 0: Pidgit (flies) and Shy Guy (walks) - always available
        for (let i = 1; i <= 8; i++) {
            this.load.image(`pidgit-${i}`, `assets/enemies/pidgit/pidgit-${i}.png`);
        }
        for (let i = 1; i <= 8; i++) {
            this.load.image(`shyguy-${i}`, `assets/enemies/shyguy-red/shyguy-red-${i}.png`);
        }
        
        // Day 1: Autobomb (drives on ground)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`autobomb-${i}`, `assets/enemies/autobomb/autobomb${i}.png`);
        }
        
        // Day 2: Bob-omb (walks on ground)
        for (let i = 1; i <= 5; i++) {
            this.load.image(`bobomb-${i}`, `assets/enemies/bob-omb/bob-omb${i}.png`);
        }
        
        // Day 3: Flurry (runs on ground)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`flurry-${i}`, `assets/enemies/flurry/flurry${i}.png`);
        }
        
        // Day 4: Ninji (jumps in place)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`ninji-${i}`, `assets/enemies/ninji/ninji${i}.png`);
        }
        
        // Day 5: Phanto (flies erratically)
        for (let i = 1; i <= 10; i++) {
            this.load.image(`phanto-${i}`, `assets/enemies/phanto/phanto${i}.png`);
        }
        
        // Day 6: Porcupo Blue (walks on ground)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`porcupo-${i}`, `assets/enemies/porcupoBlue/porcupoBlue${i}.png`);
        }
        
        // Day 7: Snift Pink (walks on ground)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`snift-${i}`, `assets/enemies/snift-pink/snift-pink${i}.png`);
        }
        
        // Day 8: Subcon Red (flies across screen)
        for (let i = 1; i <= 2; i++) {
            this.load.image(`subcon-${i}`, `assets/enemies/subconRed/subconRed${i}.png`);
        }
        
        // Background music
        this.load.audio('bgm', 'assets/chonks-sysiphus.mp3');
        
        // Sound effects
        this.load.audio('sfx-light-rain', 'assets/sounds/light-rain.mp3');
        this.load.audio('sfx-heavy-rain', 'assets/sounds/heavy-rain.mp3');
        this.load.audio('sfx-light-wind', 'assets/sounds/light-wind.mp3');
        this.load.audio('sfx-heavy-wind', 'assets/sounds/heavy-wind.mp3');
        this.load.audio('sfx-rolling-stone', 'assets/sounds/rolling-stone.mp3');
    }

    setupMicrophone() {
        // Use stream from TitleScene
        const stream = window.micStream;
        if (!stream) {
            console.log('No mic stream available');
            return;
        }
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.3;
            this.microphone.connect(this.analyser);
            
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.micEnabled = true;
        } catch (err) {
            console.error('Microphone setup failed:', err);
        }
    }

    getMicLevel() {
        if (!this.micEnabled || !this.analyser) return 0;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        return (sum / this.dataArray.length) / 255;
    }

    // Create a terrain segment (flat → incline → flat top pattern)
    createSegment(startX, startY) {
        // Randomize this segment's dimensions
        const flatWidth = this.randomRange(this.flatWidthMin, this.flatWidthMax);
        const inclineWidth = this.randomRange(this.inclineWidthMin, this.inclineWidthMax);
        // Random slope angle within range
        const angleRatio = this.inclineAngleMin + Math.random() * (this.inclineAngleMax - this.inclineAngleMin);
        const inclineHeight = Math.floor(inclineWidth * angleRatio);
        
        const segment = {
            index: this.segmentIndex++,
            startX: startX,
            startY: startY,
            endX: 0,
            endY: 0,
            flatWidth: flatWidth,
            inclineWidth: inclineWidth,
            inclineHeight: inclineHeight,
            visuals: [],
            bodies: []
        };
        
        let currentX = startX;
        let currentY = startY;
        
        // Calculate how far down to extend the ground (to bottom of screen)
        const groundDepth = this.gameHeight - currentY + 500;
        
        // Part 1: Flat bottom section
        const flatBottomTiles = this.add.tileSprite(
            currentX, currentY,
            flatWidth, groundDepth,
            'ground'
        );
        flatBottomTiles.setOrigin(0, 0);
        segment.visuals.push(flatBottomTiles);
        
        const flatBottomBody = this.matter.add.rectangle(
            currentX + flatWidth / 2, 
            currentY + 75, 
            flatWidth, 150, 
            { isStatic: true, friction: 0.8, label: 'ground' }
        );
        segment.bodies.push(flatBottomBody);
        
        currentX += flatWidth;
        
        // Part 2: Incline section
        // Height needs to go from top of incline down to bottom of screen
        const inclineDepth = this.gameHeight - (currentY - inclineHeight) + 50;
        
        const inclineTiles = this.add.tileSprite(
            currentX, currentY - inclineHeight,
            inclineWidth, inclineDepth,
            'ground'
        );
        inclineTiles.setOrigin(0, 0);
        
        // Create mask for incline shape (triangle at top, solid below)
        const inclineMask = this.make.graphics();
        inclineMask.fillStyle(0xffffff);
        inclineMask.beginPath();
        inclineMask.moveTo(currentX, currentY);
        inclineMask.lineTo(currentX + inclineWidth, currentY - inclineHeight);
        inclineMask.lineTo(currentX + inclineWidth, this.gameHeight + 50);
        inclineMask.lineTo(currentX, this.gameHeight + 50);
        inclineMask.closePath();
        inclineMask.fillPath();
        inclineTiles.setMask(inclineMask.createGeometryMask());
        
        segment.visuals.push(inclineTiles);
        segment.visuals.push(inclineMask);
        
        // Incline physics - rotated rectangle
        const inclineLength = Math.sqrt(inclineWidth * inclineWidth + inclineHeight * inclineHeight);
        const inclineAngle = Math.atan2(-inclineHeight, inclineWidth);
        
        const inclineBody = this.matter.add.rectangle(
            currentX + inclineWidth / 2,
            currentY - inclineHeight / 2 + 40,
            inclineLength, 80,
            { isStatic: true, friction: 0.8, label: 'incline', angle: inclineAngle }
        );
        segment.bodies.push(inclineBody);
        
        // Fill under incline
        const inclineFillBody = this.matter.add.rectangle(
            currentX + inclineWidth / 2,
            currentY + 50,
            inclineWidth, 100,
            { isStatic: true, friction: 0.8, label: 'incline-fill' }
        );
        segment.bodies.push(inclineFillBody);
        
        currentX += inclineWidth;
        currentY -= inclineHeight;
        
        // Part 3: Flat top section - extend to bottom of screen
        const flatTopDepth = this.gameHeight - currentY + 50;
        
        const flatTopTiles = this.add.tileSprite(
            currentX, currentY,
            flatWidth, flatTopDepth,
            'ground'
        );
        flatTopTiles.setOrigin(0, 0);
        segment.visuals.push(flatTopTiles);
        
        const flatTopBody = this.matter.add.rectangle(
            currentX + flatWidth / 2 - 10,
            currentY + 75,
            flatWidth + 20, 150,
            { isStatic: true, friction: 0.8, label: 'ground' }
        );
        segment.bodies.push(flatTopBody);
        
        currentX += flatWidth;
        
        segment.endX = currentX;
        segment.endY = currentY;
        
        this.segments.push(segment);
        
        return segment;
    }
    
    // Remove old segments that are far behind the player
    cleanupSegments() {
        const playerX = this.playerX;
        // Use screen width to determine threshold (wider screens need more buffer)
        const cleanupThreshold = this.gameWidth + 400; // Remove segments more than this far behind
        
        this.segments = this.segments.filter(segment => {
            if (segment.endX < playerX - cleanupThreshold) {
                // Destroy visuals
                segment.visuals.forEach(v => {
                    if (v && v.destroy) v.destroy();
                });
                // Destroy physics bodies
                segment.bodies.forEach(b => {
                    if (b) this.matter.world.remove(b);
                });
                return false;
            }
            return true;
        });
    }
    
    // Generate new segments ahead of player
    generateAhead() {
        const playerX = this.playerX;
        // Use screen width to determine threshold (wider screens need more lookahead)
        const generateThreshold = this.gameWidth + 400; // Generate when player is this close to end
        
        if (this.segments.length === 0) return;
        
        const lastSegment = this.segments[this.segments.length - 1];
        
        if (lastSegment.endX - playerX < generateThreshold) {
            this.createSegment(lastSegment.endX, lastSegment.endY);
        }
    }
    
    // Get ground Y at any X position (works with multiple segments)
    getGroundY(x) {
        // If player is before the first segment (left of x=0), use base ground level
        if (x < 0 || (this.segments.length > 0 && x < this.segments[0].startX)) {
            return this.baseGroundY;
        }
        
        for (const segment of this.segments) {
            if (x >= segment.startX && x < segment.endX) {
                const localX = x - segment.startX;
                
                // Flat bottom
                if (localX < segment.flatWidth) {
                    return segment.startY;
                }
                // Incline
                else if (localX < segment.flatWidth + segment.inclineWidth) {
                    const inclineProgress = (localX - segment.flatWidth) / segment.inclineWidth;
                    return segment.startY - (inclineProgress * segment.inclineHeight);
                }
                // Flat top
                else {
                    return segment.startY - segment.inclineHeight;
                }
            }
        }
        
        // Fallback - use last segment's end Y (for positions beyond all segments)
        if (this.segments.length > 0) {
            return this.segments[this.segments.length - 1].endY;
        }
        return this.baseGroundY;
    }
    
    // Check if player is on an incline (for push force adjustment)
    isOnIncline(x) {
        for (const segment of this.segments) {
            if (x >= segment.startX && x < segment.endX) {
                const localX = x - segment.startX;
                return localX >= segment.flatWidth && localX < segment.flatWidth + segment.inclineWidth;
            }
        }
        return false;
    }

    create() {
        // Base sky color - nice blue!
        this.cameras.main.setBackgroundColor('#5b8cc9');
        
        // Get actual game dimensions
        this.gameWidth = this.scale.width;
        this.gameHeight = this.scale.height;
        
        // ============================================
        // PARALLAX LAYERS - ADJUST THESE VALUES!
        // ============================================
        
        // Force crisp pixel scaling (nearest neighbor) on parallax textures
        this.textures.get('sky-clouds').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('mountains').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('forest').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Clouds layer (slowest - furthest back)
        const cloudScale = 3;  // <-- CLOUD SIZE
        this.cloudsLayer = this.add.tileSprite(
            this.gameWidth / 2, 
            this.gameHeight * .2,      // <-- Y position
            4000,                        // Wide enough to never show seam
            256,                         // Height of your texture
            'sky-clouds'
        );
        this.cloudsLayer.setScrollFactor(0);
        this.cloudsLayer.setScale(cloudScale);
        this.cloudsLayer.setAlpha(0.9);
        
        // Mountains layer (medium speed)
        const mountainScale = 1;  // <-- MOUNTAIN SIZE
        this.mountainsLayer = this.add.tileSprite(
            this.gameWidth / 2,
            this.gameHeight * 0.4,       // <-- Y position
            4000,
            360,
            'mountains'
        );
        this.mountainsLayer.setScrollFactor(0);
        this.mountainsLayer.setScale(mountainScale);
        
        // Forest layer (faster - closest to player)
        const forestScale = 1;  // <-- FOREST SIZE
        this.forestLayer = this.add.tileSprite(
            this.gameWidth / 2,
            this.gameHeight * 0.5,       // <-- Y position
            4000,
            272,
            'forest'
        );
        this.forestLayer.setScrollFactor(0);
        this.forestLayer.setScale(forestScale);
        
        // Track camera position for parallax
        this.lastCameraX = 0;
        
        // ============================================
        
        // Position ground near bottom of screen
        // Lower number = ground starts higher on screen, higher number = ground starts lower
        this.baseGroundY = this.gameHeight - 400;  // Try adjusting this!

        // No fixed world bounds for endless scrolling!
        // Only set a floor and ceiling, but no left/right bounds
        this.matter.world.setBounds(undefined, 0, undefined, this.gameHeight + 200, 32, false, false, true, true);
        
        // Left wall only (player can't go back to start)
        this.leftWall = this.matter.add.rectangle(-10, this.gameHeight / 2, 20, this.gameHeight + 400, { isStatic: true, label: 'wall' });
        
        // Create initial ground behind player (extends off-screen to the left)
        const behindWidth = 1000;
        const behindGroundDepth = this.gameHeight - this.baseGroundY + 50;
        this.behindGround = this.add.tileSprite(
            -behindWidth, this.baseGroundY,
            behindWidth + 50, behindGroundDepth,  // +50 to overlap with first segment
            'ground'
        );
        this.behindGround.setOrigin(0, 0);
        
        // Physics for behind ground
        this.behindGroundBody = this.matter.add.rectangle(
            -behindWidth / 2 + 25, 
            this.baseGroundY + 75, 
            behindWidth + 50, 150, 
            { isStatic: true, friction: 0.8, label: 'ground' }
        );
        
        // Create initial segments
        this.createSegment(0, this.baseGroundY);
        this.createSegment(this.segments[0].endX, this.segments[0].endY);
        this.createSegment(this.segments[1].endX, this.segments[1].endY);

        // Boulder - lumpy irregular shape!
        this.ballRadius = 65;
        
        // Create lumpy vertices (irregular polygon approximating a rough circle)
        this.lumpyVertices = [];
        const numPoints = 12;  // Number of points around the circle
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            // Add randomness to radius for each point (between 0.75 and 1.0 of base radius)
            const lumpiness = 0.8 + Math.random() * 0.2;  // Adjust for more/less lumpy
            const r = this.ballRadius * lumpiness;
            this.lumpyVertices.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r
            });
        }
        
        // Detect mobile vs desktop for different physics
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Desktop gets LOWER friction (Mac mics seem to need easier pushing)
        const ballFriction = isMobile ? 0.5 : 0.3;
        const ballFrictionStatic = isMobile ? 0.6 : 0.4;
        
        console.log(`📱 Device: ${isMobile ? 'MOBILE' : 'DESKTOP'}, friction: ${ballFriction}, frictionStatic: ${ballFrictionStatic}`);
        
        this.ball = this.matter.add.fromVertices(180, this.baseGroundY - 70, this.lumpyVertices, {
            restitution: 0.1,
            friction: ballFriction,
            frictionStatic: ballFrictionStatic,
            density: 0.00025,
            label: 'ball'
        });
        
        // Create 8-bit style boulder texture procedurally
        this.createPixelBoulderTexture();
        
        // Boulder sprite with pixel art texture
        this.ballGraphic = this.add.sprite(180, this.baseGroundY - 70, 'pixel-boulder');
        this.ballGraphic.setDisplaySize(this.ballRadius * 2, this.ballRadius * 2);
        
        // Create lumpy mask matching the physics shape
        const maskGraphics = this.make.graphics();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.beginPath();
        maskGraphics.moveTo(180 + this.lumpyVertices[0].x, this.baseGroundY - 70 + this.lumpyVertices[0].y);
        for (let i = 1; i < this.lumpyVertices.length; i++) {
            maskGraphics.lineTo(180 + this.lumpyVertices[i].x, this.baseGroundY - 70 + this.lumpyVertices[i].y);
        }
        maskGraphics.closePath();
        maskGraphics.fillPath();
        this.boulderMask = maskGraphics.createGeometryMask();
        this.ballGraphic.setMask(this.boulderMask);

        // Player
        this.player = this.add.sprite(100, this.baseGroundY - 80, 'walk3');
        this.player.setScale(0.4);
        
        this.playerX = 100;
        this.playerY = this.baseGroundY - 80;
        this.facingRight = true;
        this.isWalking = false;
        this.isPushing = false;
        this.walkFrame = 3;
        this.pushFrame = 1;
        
        // CAMERA - follow player, no bounds!
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setDeadzone(100, 400);
        
        // Animation timers
        this.walkTimer = this.time.addEvent({
            delay: 150,
            callback: this.toggleWalkFrame,
            callbackScope: this,
            loop: true
        });
        
        this.pushTimer = this.time.addEvent({
            delay: 150,
            callback: this.togglePushFrame,
            callbackScope: this,
            loop: true
        });

        // Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.moveSpeed = 2;
        this.playerWidth = 40;
        this.blowThreshold = 0.009;  // Ultra sensitive for mobile!
        this.smoothedMicLevel = 0;  // Smoothed mic level for stability
        
        // Track hills climbed
        this.hillsClimbed = 0;
        this.lastHillIndex = -1;

        // UI - fixed to camera (doesn't scroll)
        // Only hill counter in the HUD
        // HUD text style with shadow for visibility
        const hudShadow = {
            offsetX: 2,
            offsetY: 2,
            color: '#000',
            blur: 4,
            fill: true
        };
        
        this.hillCounter = this.add.text(this.gameWidth - 20, 20, 'HILLS: 0', {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#fff',
            fontStyle: 'bold',
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setShadow(2, 2, '#000', 4);
        
        // Clock display (left side)
        this.clockText = this.add.text(20, 20, '6:00 AM', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#fff',
            fontStyle: 'bold',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 3
        }).setScrollFactor(0);
        
        // Season display (below clock)
        this.seasonText = this.add.text(20, 44, 'SPRING - Day 1', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#90EE90',  // Light green for spring
            fontStyle: 'bold',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 2
        }).setScrollFactor(0);
        
        // Intro instructions (centered, fades out)
        const centerX = this.gameWidth / 2;
        const centerY = this.gameHeight / 2 - 50;
        
        const introLine1 = this.add.text(centerX, centerY - 80, 'PUSH THE ROCK', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);
        
        const introLine2 = this.add.text(centerX, centerY - 40, 'UP THE HILL', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0);
        
        const introLine3 = this.add.text(centerX, centerY + 10, '(blow)', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#ffffff',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0);
        
        // Fade out intro after a few seconds
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [introLine1, introLine2, introLine3],
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    introLine1.destroy();
                    introLine2.destroy();
                    introLine3.destroy();
                }
            });
        });
        
        // Setup microphone (permission already granted in TitleScene)
                this.setupMicrophone();
        
        // Start background music (loops forever)
        this.bgMusic = this.sound.add('bgm', { loop: true, volume: 0.5 });
        this.bgMusic.play();
        
        // Weather sound effects (looping)
        this.sfxLightRain = this.sound.add('sfx-light-rain', { loop: true, volume: 0.4 });
        this.sfxHeavyRain = this.sound.add('sfx-heavy-rain', { loop: true, volume: 0.5 });
        this.sfxLightWind = this.sound.add('sfx-light-wind', { loop: true, volume: 0.3 });
        this.sfxHeavyWind = this.sound.add('sfx-heavy-wind', { loop: true, volume: 0.4 });
        
        // Rolling stone sound (looping, plays when ball moves)
        this.sfxRollingStone = this.sound.add('sfx-rolling-stone', { loop: true, volume: 0.5 });
        this.isRolling = false;  // Track if ball is currently rolling
        console.log('🔊 Sound effects loaded:', {
            rollingStone: this.sfxRollingStone,
            lightRain: this.sfxLightRain,
            heavyRain: this.sfxHeavyRain
        });
        
        // Weather particle system
        this.createWeatherParticles();
        
        // Weather indicator in HUD (below season)
        this.weatherText = this.add.text(20, 68, '', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#fff',
            fontStyle: 'bold',
            shadow: hudShadow,
            stroke: '#000',
            strokeThickness: 2
        }).setScrollFactor(0);
        
        // Listen for postMessage controls (for mann.cool integration)
        window.addEventListener('message', (event) => {
            const { type, key, eventType } = event.data || {};
            if (type === 'keyEvent' && key && eventType) {
                document.dispatchEvent(new KeyboardEvent(eventType, {
                    key: key,
                    code: key,
                    bubbles: true,
                    cancelable: true,
                }));
            }
        });
    }

    toggleWalkFrame() {
        if (this.isWalking && !this.isPushing) {
            this.walkFrame = (this.walkFrame % 4) + 1;
            this.player.setTexture(`walk${this.walkFrame}`);
        }
    }
    
    togglePushFrame() {
        if (this.isPushing) {
            this.pushFrame = (this.pushFrame % 4) + 1;
            this.player.setTexture(`push${this.pushFrame}`);
        }
    }

    checkBallCollision(direction) {
        const ballX = this.ball.position.x;
        const playerX = this.playerX;
        
        if (direction === 'right') {
            const distance = ballX - playerX;
            return distance > 0 && distance < (this.playerWidth + this.ballRadius + 10);
        } else if (direction === 'left') {
            const distance = playerX - ballX;
            return distance > 0 && distance < (this.playerWidth + this.ballRadius + 10);
        }
        return false;
    }

    // Check if ball is stuck and give it a nudge
    checkStuckBall(delta) {
        const currentBallX = this.ball.position.x;
        const moved = Math.abs(currentBallX - this.lastBallX);
        
        // Check ball velocity directly from physics - more reliable than position delta
        const ballSpeed = Math.abs(this.ball.velocity.x);
        const isCurrentlyMoving = ballSpeed > 0.3;  // Threshold for "moving"
        
        if (isCurrentlyMoving) {
            // Ball is moving, reset stuck timer
            this.stuckTimer = 0;
            
            // Start rolling sound if not already playing
            if (!this.isRolling) {
                console.log('🪨 Ball started rolling, playing sound...');
                this.sfxRollingStone.play();
                this.isRolling = true;
            }
        } else {
            // Ball is mostly stopped, increment stuck timer
            this.stuckTimer += delta;
            
            // Stop rolling sound if ball has been stopped for a bit (100ms debounce)
            if (this.isRolling && this.stuckTimer > 100) {
                console.log('🪨 Ball stopped, stopping sound...');
                this.sfxRollingStone.stop();
                this.isRolling = false;
            }
            
            if (this.stuckTimer >= this.stuckThreshold) {
                // Ball is stuck! Give it a nudge
                console.log('🪨 Ball stuck! Giving it a nudge...');
                this.matter.body.applyForce(this.ball, this.ball.position, { x: 0.015, y: -0.01 });
                this.stuckTimer = 0;
            }
        }
        
        // Always update lastBallX for stuck detection
        this.lastBallX = currentBallX;
    }
    
    // Track which hill the player is on
    updateHillCounter() {
        const ballX = this.ball.position.x;
        
        for (const segment of this.segments) {
            // Check if ball is past this segment's incline (on flat top or beyond)
            const inclineEndX = segment.startX + segment.flatWidth + segment.inclineWidth;
            
            if (ballX > inclineEndX && segment.index > this.lastHillIndex) {
                this.lastHillIndex = segment.index;
                this.hillsClimbed++;
                this.hillCounter.setText(`HILLS: ${this.hillsClimbed}`);
            }
        }
    }
    
    updateTimeSystem(delta) {
        // Convert delta (ms) to in-game minutes
        // 5 real minutes (300,000 ms) = 24 in-game hours (1440 minutes)
        // So 1 real ms = 1440 / 300000 = 0.0048 in-game minutes
        const timeScale = 1440 / this.dayLengthMs;
        this.gameTime += delta * timeScale;
        
        // Handle day rollover
        if (this.gameTime >= 1440) {  // 24 hours * 60 minutes
            this.gameTime -= 1440;
            this.dayCount++;
            
            if (DEBUG.logWeather) console.log(`🌅 New day! Day ${this.dayCount}`);
            
            // Check for season change
            if (this.dayCount > this.daysPerSeason) {
                this.dayCount = 1;
                this.currentSeasonIndex = (this.currentSeasonIndex + 1) % 4;
                if (DEBUG.logWeather) console.log(`🍂 Season changed to ${this.seasons[this.currentSeasonIndex]}!`);
            }
        }
        
        // Update clock display
        this.clockText.setText(this.formatTime(this.gameTime));
        
        // Update season display
        const season = this.seasons[this.currentSeasonIndex];
        this.seasonText.setText(`${season} - Day ${this.dayCount}`);
        
        // Set season color
        const seasonColors = {
            'SPRING': '#90EE90',  // Light green
            'SUMMER': '#FFD700',  // Gold
            'FALL': '#FF8C00',    // Dark orange
            'WINTER': '#87CEEB'   // Sky blue
        };
        this.seasonText.setColor(seasonColors[season]);
        
        // Update sky color based on time of day
        this.updateSkyColor();
    }
    
    formatTime(minutes) {
        const hours24 = Math.floor(minutes / 60) % 24;
        const mins = Math.floor(minutes % 60);
        const hours12 = hours24 % 12 || 12;
        const ampm = hours24 < 12 ? 'AM' : 'PM';
        return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
    }
    
    updateSkyColor() {
        const hour = this.gameTime / 60;  // Current hour (0-24)
        
        // Define sky colors for different times
        // Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
        let skyColor;
        
        if (hour >= 5 && hour < 7) {
            // Dawn - pink/orange transition
            const t = (hour - 5) / 2;
            skyColor = this.lerpColor(0x1a1a2e, 0xFFB6C1, t);  // Night to pink
        } else if (hour >= 7 && hour < 8) {
            // Early morning - pink to blue
            const t = hour - 7;
            skyColor = this.lerpColor(0xFFB6C1, 0x87CEEB, t);  // Pink to sky blue
        } else if (hour >= 8 && hour < 17) {
            // Day - bright blue
            skyColor = 0x87CEEB;
        } else if (hour >= 17 && hour < 18) {
            // Late afternoon - blue to orange
            const t = hour - 17;
            skyColor = this.lerpColor(0x87CEEB, 0xFF8C00, t);
        } else if (hour >= 18 && hour < 20) {
            // Dusk - orange to dark
            const t = (hour - 18) / 2;
            skyColor = this.lerpColor(0xFF8C00, 0x1a1a2e, t);
        } else {
            // Night
            skyColor = 0x1a1a2e;
        }
        
        this.cameras.main.setBackgroundColor(skyColor);
    }
    
    lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }
    
    createWeatherParticles() {
        // Create rain drop textures - small, medium, large
        const rainSmall = this.make.graphics();
        rainSmall.fillStyle(0x88CCFF, 0.5);
        rainSmall.fillRect(0, 0, 1, 6);
        rainSmall.generateTexture('raindrop_small', 1, 6);
        rainSmall.destroy();
        
        const rainMed = this.make.graphics();
        rainMed.fillStyle(0x88CCFF, 0.6);
        rainMed.fillRect(0, 0, 2, 12);
        rainMed.generateTexture('raindrop_med', 2, 12);
        rainMed.destroy();
        
        const rainLarge = this.make.graphics();
        rainLarge.fillStyle(0x88CCFF, 0.7);
        rainLarge.fillRect(0, 0, 3, 18);
        rainLarge.generateTexture('raindrop_large', 3, 18);
        rainLarge.destroy();
        
        // Create snowflake textures - small, medium, large
        const snowSmall = this.make.graphics();
        snowSmall.fillStyle(0xFFFFFF, 0.7);
        snowSmall.fillCircle(2, 2, 2);
        snowSmall.generateTexture('snowflake_small', 4, 4);
        snowSmall.destroy();
        
        const snowMed = this.make.graphics();
        snowMed.fillStyle(0xFFFFFF, 0.85);
        snowMed.fillCircle(4, 4, 4);
        snowMed.generateTexture('snowflake_med', 8, 8);
        snowMed.destroy();
        
        const snowLarge = this.make.graphics();
        snowLarge.fillStyle(0xFFFFFF, 0.95);
        snowLarge.fillCircle(6, 6, 6);
        snowLarge.generateTexture('snowflake_large', 12, 12);
        snowLarge.destroy();
        
        // Rain emitters - light, medium, heavy (all start inactive)
        this.rainEmitterLight = this.add.particles(0, -50, 'raindrop_small', {
            x: { min: 0, max: this.gameWidth + 200 },
            y: -50,
            lifespan: 1200,
            speedY: { min: 500, max: 700 },
            speedX: { min: -30, max: 30 },
            scale: { min: 0.8, max: 1.2 },
            quantity: 2,
            frequency: 40,
            emitting: false
        });
        this.rainEmitterLight.setScrollFactor(0);
        
        this.rainEmitterMed = this.add.particles(0, -50, 'raindrop_med', {
            x: { min: 0, max: this.gameWidth + 200 },
            y: -50,
            lifespan: 1400,
            speedY: { min: 450, max: 600 },
            speedX: { min: -40, max: 40 },
            scale: { min: 0.8, max: 1.2 },
            quantity: 3,
            frequency: 35,
            emitting: false
        });
        this.rainEmitterMed.setScrollFactor(0);
        
        this.rainEmitterHeavy = this.add.particles(0, -50, 'raindrop_large', {
            x: { min: 0, max: this.gameWidth + 200 },
            y: -50,
            lifespan: 1600,
            speedY: { min: 400, max: 550 },
            speedX: { min: -50, max: 50 },
            scale: { min: 0.8, max: 1.3 },
            quantity: 4,
            frequency: 25,
            emitting: false
        });
        this.rainEmitterHeavy.setScrollFactor(0);
        
        // Snow emitters - light, medium, heavy (all start inactive)
        this.snowEmitterLight = this.add.particles(0, -20, 'snowflake_small', {
            x: { min: 0, max: this.gameWidth + 100 },
            y: -20,
            lifespan: 5000,
            speedY: { min: 30, max: 60 },
            speedX: { min: -20, max: 20 },
            scale: { min: 0.6, max: 1 },
            quantity: 1,
            frequency: 80,
            rotate: { min: 0, max: 360 },
            emitting: false
        });
        this.snowEmitterLight.setScrollFactor(0);
        
        this.snowEmitterMed = this.add.particles(0, -20, 'snowflake_med', {
            x: { min: 0, max: this.gameWidth + 100 },
            y: -20,
            lifespan: 4500,
            speedY: { min: 50, max: 90 },
            speedX: { min: -25, max: 25 },
            scale: { min: 0.6, max: 1 },
            quantity: 2,
            frequency: 60,
            rotate: { min: 0, max: 360 },
            emitting: false
        });
        this.snowEmitterMed.setScrollFactor(0);
        
        this.snowEmitterHeavy = this.add.particles(0, -20, 'snowflake_large', {
            x: { min: 0, max: this.gameWidth + 100 },
            y: -20,
            lifespan: 4000,
            speedY: { min: 70, max: 120 },
            speedX: { min: -30, max: 30 },
            scale: { min: 0.6, max: 1.1 },
            quantity: 2,
            frequency: 50,
            rotate: { min: 0, max: 360 },
            emitting: false
        });
        this.snowEmitterHeavy.setScrollFactor(0);
        
        if (DEBUG.logWeather) console.log('🌦️ Weather particles created');
    }
    
    updateWeather(delta) {
        this.weatherTimer += delta;
        
        // Check if current weather should end
        if (this.weatherDuration > 0 && this.weatherTimer >= this.weatherDuration) {
            this.setWeather('clear');
            this.weatherTimer = 0;
            this.weatherDuration = 0;
        }
        
        // Random chance to start new weather (check every ~10 seconds of game time)
        if (this.currentWeather === 'clear' && this.weatherTimer > 10000) {
            this.weatherTimer = 0;
            
            // 30% chance of weather event
            if (Math.random() < 0.3) {
                this.startRandomWeather();
            }
        }
        
        // Update wind effect on particles
        if (this.windStrength !== 0) {
            const windSpeed = this.windStrength * 150;
            // Apply wind to rain
            if (this.rainEmitterLight.emitting) {
                this.rainEmitterLight.speedX = { min: windSpeed - 30, max: windSpeed + 30 };
            }
            if (this.rainEmitterMed.emitting) {
                this.rainEmitterMed.speedX = { min: windSpeed - 40, max: windSpeed + 40 };
            }
            if (this.rainEmitterHeavy.emitting) {
                this.rainEmitterHeavy.speedX = { min: windSpeed - 50, max: windSpeed + 50 };
            }
            // Apply wind to snow (more affected by wind)
            if (this.snowEmitterLight.emitting) {
                this.snowEmitterLight.speedX = { min: windSpeed - 40, max: windSpeed + 40 };
            }
            if (this.snowEmitterMed.emitting) {
                this.snowEmitterMed.speedX = { min: windSpeed - 50, max: windSpeed + 50 };
            }
            if (this.snowEmitterHeavy.emitting) {
                this.snowEmitterHeavy.speedX = { min: windSpeed - 60, max: windSpeed + 60 };
            }
        }
    }
    
    startRandomWeather() {
        const season = this.seasons[this.currentSeasonIndex];
        let possibleWeather = [];
        
        // Weather options by season (with intensity: light, medium, heavy)
        switch (season) {
            case 'SPRING':
                possibleWeather = ['rain_light', 'rain_medium', 'rain_heavy', 'wind'];
                break;
            case 'SUMMER':
                possibleWeather = ['clear', 'wind', 'rain_light'];
                break;
            case 'FALL':
                possibleWeather = ['rain_medium', 'rain_heavy', 'wind', 'wind'];
                break;
            case 'WINTER':
                possibleWeather = ['snow_light', 'snow_medium', 'snow_heavy', 'wind'];
                break;
        }
        
        const weather = possibleWeather[Math.floor(Math.random() * possibleWeather.length)];
        const duration = 15000 + Math.random() * 30000;  // 15-45 seconds
        
        if (DEBUG.logWeather) console.log(`🌦️ Starting ${weather} weather for ${Math.round(duration/1000)}s (Season: ${season})`);
        
        this.setWeather(weather);
        this.weatherDuration = duration;
        this.weatherTimer = 0;
    }
    
    setWeather(weather) {
        this.currentWeather = weather;
        
        // Stop all weather sounds first
        this.sfxLightRain.stop();
        this.sfxHeavyRain.stop();
        this.sfxLightWind.stop();
        this.sfxHeavyWind.stop();
        
        // Stop all emitters first
        this.rainEmitterLight.emitting = false;
        this.rainEmitterMed.emitting = false;
        this.rainEmitterHeavy.emitting = false;
        this.snowEmitterLight.emitting = false;
        this.snowEmitterMed.emitting = false;
        this.snowEmitterHeavy.emitting = false;
        this.windStrength = 0;
        
        // Update weather display
        let weatherIcon = '';
        
        switch (weather) {
            case 'rain_light':
                this.rainEmitterLight.emitting = true;
                this.sfxLightRain.play();
                weatherIcon = '🌧️ Light Rain';
                if (DEBUG.logWeather) console.log('🌧️ Light rain started');
                break;
            case 'rain_medium':
                this.rainEmitterLight.emitting = true;
                this.rainEmitterMed.emitting = true;
                this.sfxLightRain.play();
                weatherIcon = '🌧️ Rain';
                if (DEBUG.logWeather) console.log('🌧️ Medium rain started');
                break;
            case 'rain_heavy':
                this.rainEmitterLight.emitting = true;
                this.rainEmitterMed.emitting = true;
                this.rainEmitterHeavy.emitting = true;
                this.sfxHeavyRain.play();
                weatherIcon = '🌧️ Heavy Rain';
                if (DEBUG.logWeather) console.log('🌧️ Heavy rain started');
                break;
            case 'snow_light':
                this.snowEmitterLight.emitting = true;
                this.sfxLightWind.play();  // Light wind for snow
                weatherIcon = '❄️ Light Snow';
                if (DEBUG.logWeather) console.log('❄️ Light snow started');
                break;
            case 'snow_medium':
                this.snowEmitterLight.emitting = true;
                this.snowEmitterMed.emitting = true;
                this.sfxLightWind.play();
                weatherIcon = '❄️ Snow';
                if (DEBUG.logWeather) console.log('❄️ Medium snow started');
                break;
            case 'snow_heavy':
                this.snowEmitterLight.emitting = true;
                this.snowEmitterMed.emitting = true;
                this.snowEmitterHeavy.emitting = true;
                this.sfxHeavyWind.play();  // Heavy wind for blizzard
                weatherIcon = '❄️ Blizzard';
                if (DEBUG.logWeather) console.log('❄️ Heavy snow started');
                break;
            case 'wind':
                this.windStrength = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
                // Play wind sound based on strength
                if (Math.abs(this.windStrength) > 0.7) {
                    this.sfxHeavyWind.play();
                } else {
                    this.sfxLightWind.play();
                }
                weatherIcon = this.windStrength > 0 ? '💨 Wind →' : '💨 ← Wind';
                if (DEBUG.logWeather) console.log(`💨 Wind started (strength: ${this.windStrength.toFixed(2)})`);
                break;
            case 'clear':
                weatherIcon = '☀️ Clear';
                if (DEBUG.logWeather) console.log('☀️ Weather cleared');
                break;
        }
        
        this.weatherText.setText(weatherIcon);
    }
    
    // ============================================
    // RANDOM ENEMY APPEARANCES
    // ============================================
    
    updateEnemies(delta) {
        this.enemySpawnTimer += delta;
        
        // Check for new spawn
        if (this.enemySpawnTimer >= this.enemySpawnInterval) {
            this.enemySpawnTimer = 0;
            
            const roll = Math.random();
            if (DEBUG.logEnemies) console.log(`🎲 Enemy spawn check: rolled ${roll.toFixed(2)} (need < ${this.enemySpawnChance})`);
            
            if (roll < this.enemySpawnChance) {
                this.spawnRandomEnemy();
            } else {
                if (DEBUG.logEnemies) console.log(`❌ No enemy this time`);
            }
        }
        
        // Update active enemies
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const enemy = this.activeEnemies[i];
            this.updateEnemy(enemy);
            
            // Remove if off screen
            if (enemy.sprite.x < this.cameras.main.scrollX - 100 || 
                enemy.sprite.x > this.cameras.main.scrollX + this.gameWidth + 100) {
                enemy.sprite.destroy();
                this.activeEnemies.splice(i, 1);
            }
        }
    }
    
    spawnRandomEnemy() {
        // Build list of available enemies based on day count
        // Day 0: pidgit, shyguy (always available)
        // Each subsequent day adds one more enemy type
        const allEnemyTypes = [
            { type: 'pidgit', unlockDay: 0 },
            { type: 'shyguy', unlockDay: 0 },
            { type: 'autobomb', unlockDay: 1 },
            { type: 'bobomb', unlockDay: 2 },
            { type: 'flurry', unlockDay: 3 },
            { type: 'ninji', unlockDay: 4 },
            { type: 'phanto', unlockDay: 5 },
            { type: 'porcupo', unlockDay: 6 },
            { type: 'snift', unlockDay: 7 },
            { type: 'subcon', unlockDay: 8 }
        ];
        
        // Filter to only enemies unlocked by current day
        const availableTypes = allEnemyTypes
            .filter(e => e.unlockDay <= this.dayCount)
            .map(e => e.type);
        
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        
        if (DEBUG.logEnemies) console.log(`🎯 Spawning ${type} (Day ${this.dayCount}, ${availableTypes.length} enemy types available)`);
        
        switch(type) {
            case 'pidgit': this.spawnPidgit(); break;
            case 'shyguy': this.spawnShyGuy(); break;
            case 'autobomb': this.spawnAutobomb(); break;
            case 'bobomb': this.spawnBobomb(); break;
            case 'flurry': this.spawnFlurry(); break;
            case 'ninji': this.spawnNinji(); break;
            case 'phanto': this.spawnPhanto(); break;
            case 'porcupo': this.spawnPorcupo(); break;
            case 'snift': this.spawnSnift(); break;
            case 'subcon': this.spawnSubcon(); break;
        }
    }
    
    spawnPidgit() {
        // Pidgit flies across the sky
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const startY = 80 + Math.random() * 150;  // Upper portion of screen
        
        const sprite = this.add.sprite(startX, startY, 'pidgit-1');
        sprite.setScale(3);  // Scale up the pixel art
        sprite.setScrollFactor(1);
        sprite.setFlipX(fromLeft);  // Face direction of movement (flipped)
        
        // Make it crisp
        this.textures.get('pidgit-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'pidgit',
            sprite: sprite,
            speed: fromLeft ? 2 + Math.random() : -(2 + Math.random()),
            frame: 1,
            frameTimer: 0,
            maxFrames: 8,
            animSpeed: 120  // ms per frame
        };
        
        this.activeEnemies.push(enemy);
        
        if (DEBUG.logEnemies) console.log('🐦 Pidgit appeared!');
    }
    
    spawnShyGuy() {
        // Shy Guy walks across the ground in the foreground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        
        // Walk on the ground level
        const groundY = this.baseGroundY - 30;
        
        const sprite = this.add.sprite(startX, groundY, 'shyguy-1');
        sprite.setScale(3);  // Scale up to match Pidgit
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);  // Face direction of movement
        sprite.setDepth(5);  // In front of ground, behind player
        
        this.textures.get('shyguy-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'shyguy',
            sprite: sprite,
            speed: fromLeft ? 1.5 + Math.random() * 0.5 : -(1.5 + Math.random() * 0.5),
            frame: 1,
            frameTimer: 0,
            maxFrames: 6,  // Walking frames (1-6)
            animSpeed: 150
        };
        
        this.activeEnemies.push(enemy);
        
        if (DEBUG.logEnemies) console.log(`😳 Shy Guy appeared at x:${startX.toFixed(0)}, y:${groundY}!`);
    }
    
    spawnAutobomb() {
        // Autobomb drives along on the ground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const groundY = this.baseGroundY - 45;
        
        const sprite = this.add.sprite(startX, groundY, 'autobomb-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('autobomb-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'autobomb',
            sprite: sprite,
            speed: fromLeft ? 2.5 + Math.random() * 0.5 : -(2.5 + Math.random() * 0.5),
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 100
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('🚗 Autobomb appeared!');
    }
    
    spawnBobomb() {
        // Bob-omb walks on ground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const groundY = this.baseGroundY - 25;
        
        const sprite = this.add.sprite(startX, groundY, 'bobomb-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('bobomb-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'bobomb',
            sprite: sprite,
            speed: fromLeft ? 1 + Math.random() * 0.5 : -(1 + Math.random() * 0.5),
            frame: 1,
            frameTimer: 0,
            maxFrames: 5,
            animSpeed: 140
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('💣 Bob-omb appeared!');
    }
    
    spawnFlurry() {
        // Flurry runs fast on the ground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const groundY = this.baseGroundY - 25;
        
        const sprite = this.add.sprite(startX, groundY, 'flurry-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('flurry-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'flurry',
            sprite: sprite,
            speed: fromLeft ? 3 + Math.random() : -(3 + Math.random()),  // Fast runner!
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 80
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('❄️ Flurry appeared!');
    }
    
    spawnNinji() {
        // Ninji jumps in place - spawns on screen and jumps
        const startX = this.cameras.main.scrollX + 100 + Math.random() * (this.gameWidth - 200);
        const groundY = this.getGroundY(startX) - 20;
        
        const sprite = this.add.sprite(startX, groundY, 'ninji-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setDepth(5);
        
        this.textures.get('ninji-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'ninji',
            sprite: sprite,
            speed: 0,  // Doesn't move horizontally
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 200,
            baseY: groundY,
            jumpPhase: 0  // For tracking jump animation
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('🥷 Ninji appeared!');
    }
    
    spawnPhanto() {
        // Phanto flies erratically on and off screen
        const startX = this.cameras.main.scrollX + Math.random() * this.gameWidth;
        const startY = 50 + Math.random() * 100;
        
        const sprite = this.add.sprite(startX, startY, 'phanto-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setDepth(5);
        
        this.textures.get('phanto-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'phanto',
            sprite: sprite,
            speed: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 3,
            frame: 1,
            frameTimer: 0,
            maxFrames: 10,
            animSpeed: 100,
            erraticTimer: 0
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('👻 Phanto appeared!');
    }
    
    spawnPorcupo() {
        // Porcupo Blue walks on ground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const groundY = this.baseGroundY - 25;
        
        const sprite = this.add.sprite(startX, groundY, 'porcupo-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('porcupo-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'porcupo',
            sprite: sprite,
            speed: fromLeft ? 1.2 + Math.random() * 0.5 : -(1.2 + Math.random() * 0.5),
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 180
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('🦔 Porcupo appeared!');
    }
    
    spawnSnift() {
        // Snift Pink walks on ground
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const groundY = this.baseGroundY - 30;
        
        const sprite = this.add.sprite(startX, groundY, 'snift-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(!fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('snift-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'snift',
            sprite: sprite,
            speed: fromLeft ? 1.5 + Math.random() * 0.5 : -(1.5 + Math.random() * 0.5),
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 150
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('🔥 Snift appeared!');
    }
    
    spawnSubcon() {
        // Subcon Red flies across the screen
        const fromLeft = Math.random() > 0.5;
        const startX = fromLeft ? 
            this.cameras.main.scrollX - 50 : 
            this.cameras.main.scrollX + this.gameWidth + 50;
        const startY = 60 + Math.random() * 120;
        
        const sprite = this.add.sprite(startX, startY, 'subcon-1');
        sprite.setScale(3);
        sprite.setScrollFactor(1);
        sprite.setFlipX(fromLeft);
        sprite.setDepth(5);
        
        this.textures.get('subcon-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const enemy = {
            type: 'subcon',
            sprite: sprite,
            speed: fromLeft ? 2 + Math.random() : -(2 + Math.random()),
            frame: 1,
            frameTimer: 0,
            maxFrames: 2,
            animSpeed: 120
        };
        
        this.activeEnemies.push(enemy);
        if (DEBUG.logEnemies) console.log('👹 Subcon appeared!');
    }
    
    updateEnemy(enemy) {
        // Move (unless stationary like ninji)
        enemy.sprite.x += enemy.speed;
        
        // Animate
        enemy.frameTimer += this.game.loop.delta;
        if (enemy.frameTimer >= enemy.animSpeed) {
            enemy.frameTimer = 0;
            enemy.frame = (enemy.frame % enemy.maxFrames) + 1;
            enemy.sprite.setTexture(`${enemy.type}-${enemy.frame}`);
        }
        
        // Type-specific behaviors
        switch(enemy.type) {
            case 'pidgit':
                // Gentle bobbing motion
                enemy.sprite.y += Math.sin(enemy.sprite.x * 0.02) * 0.3;
                break;
                
            case 'shyguy':
            case 'autobomb':
            case 'bobomb':
            case 'flurry':
            case 'porcupo':
            case 'snift':
                // Ground-following enemies
                const groundY = this.getGroundY(enemy.sprite.x);
                enemy.sprite.y = groundY - 25;
                break;
                
            case 'ninji':
                // Jumps in place
                enemy.jumpPhase += 0.08;
                const jumpHeight = Math.abs(Math.sin(enemy.jumpPhase)) * 60;
                enemy.sprite.y = enemy.baseY - jumpHeight;
                // Update base position to follow terrain
                enemy.baseY = this.getGroundY(enemy.sprite.x) - 20;
                break;
                
            case 'phanto':
                // Erratic flying movement
                enemy.erraticTimer += this.game.loop.delta;
                if (enemy.erraticTimer > 500 + Math.random() * 1000) {
                    enemy.erraticTimer = 0;
                    enemy.speed = (Math.random() - 0.5) * 4;
                    enemy.speedY = (Math.random() - 0.5) * 3;
                }
                enemy.sprite.y += enemy.speedY;
                // Keep within screen bounds vertically
                if (enemy.sprite.y < 30) enemy.speedY = Math.abs(enemy.speedY);
                if (enemy.sprite.y > this.baseGroundY - 100) enemy.speedY = -Math.abs(enemy.speedY);
                break;
                
            case 'subcon':
                // Gentle wave motion while flying
                enemy.sprite.y += Math.sin(enemy.sprite.x * 0.03) * 0.4;
                break;
        }
    }
    
    // ============================================
    // FRIENDS SYSTEM
    // ============================================
    
    updateFriends(delta) {
        // Spawn muscle friend at the very start (once)
        if (!this.muscleSpawned) {
            console.log('🎯 Game start, spawning muscle friend...');
            this.spawnMuscle();
            this.muscleSpawned = true;
        }
        
        // Random friend spawns (like enemies)
        this.friendSpawnTimer += delta;
        if (this.friendSpawnTimer >= this.friendSpawnInterval) {
            this.friendSpawnTimer = 0;
            if (Math.random() < this.friendSpawnChance) {
                this.spawnMuscle();
                if (DEBUG.logEnemies) console.log('💪 Random muscle friend spawned!');
            }
        }
        
        // Update active friends
        for (let i = this.activeFriends.length - 1; i >= 0; i--) {
            const friend = this.activeFriends[i];
            this.updateFriend(friend);
            
            // Remove if way off screen behind player
            if (friend.sprite.x < this.cameras.main.scrollX - 300) {
                friend.sprite.destroy();
                this.activeFriends.splice(i, 1);
            }
        }
    }
    
    spawnMuscle() {
        // Muscle friend walks ahead of the player up the mountain
        const startX = this.playerX + 150;  // Start ahead of player
        const groundY = this.getGroundY(startX);
        
        console.log(`💪 Spawning muscle at x:${startX}, groundY:${groundY}, final y:${groundY - 50}`);
        
        const sprite = this.add.sprite(startX, groundY - 80, 'muscle-1');
        sprite.setScale(0.3);  // Bigger! Scale down from high-res to game size
        sprite.setScrollFactor(1);
        sprite.setDepth(6);  // In front of enemies
        
        console.log(`💪 Sprite created:`, sprite, `visible:${sprite.visible}, alpha:${sprite.alpha}`);
        
        // Make it crisp
        this.textures.get('muscle-1').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        const friend = {
            type: 'muscle',
            sprite: sprite,
            speed: 0.6,  // Slower, leisurely walk
            frame: 1,
            frameTimer: 0,
            maxFrames: 7,  // 7 walk frames now!
            animSpeed: 180  // Slower animation to match slower walk
        };
        
        this.activeFriends.push(friend);
        
        console.log('💪 Muscle friend appeared!');
    }
    
    updateFriend(friend) {
        // Move forward (always walking right/up the mountain)
        friend.sprite.x += friend.speed;
        
        // Animate
        friend.frameTimer += this.game.loop.delta;
        if (friend.frameTimer >= friend.animSpeed) {
            friend.frameTimer = 0;
            friend.frame = (friend.frame % friend.maxFrames) + 1;
            friend.sprite.setTexture(`${friend.type}-${friend.frame}`);
        }
        
        // Follow terrain
        const groundY = this.getGroundY(friend.sprite.x);
        friend.sprite.y = groundY - 80;  // Offset to stand on ground (bigger sprite)
    }

    update(time, delta) {
        // Update time system
        this.updateTimeSystem(delta);
        
        // Update weather
        this.updateWeather(delta);
        
        // Update random enemies
        this.updateEnemies(delta);
        
        // Update friends
        this.updateFriends(delta);
        
        // Generate terrain ahead and cleanup behind
        this.generateAhead();
        this.cleanupSegments();
        
        // Move left wall to prevent going too far back
        const minX = Math.max(0, this.playerX - 400);
        this.matter.body.setPosition(this.leftWall, { x: minX - 10, y: this.gameHeight / 2 });
        
        // Get raw mic level and apply smoothing for stability
        const rawMicLevel = this.getMicLevel();
        this.smoothedMicLevel = this.smoothedMicLevel * 0.7 + rawMicLevel * 0.3;  // Smooth but responsive
        this.micLevel = this.smoothedMicLevel;
        
        
        // Keyboard disabled - blow only!
        const leftPressed = false;
        const rightPressed = false;
        const blowing = this.micLevel > this.blowThreshold;

        this.isWalking = false;
        this.isPushing = false;

        const ballX = this.ball.position.x;
        let pushForce = 0.002;
        
        // Adjust push force on inclines
        if (this.isOnIncline(ballX)) {
            if (rightPressed || blowing) {
                pushForce = 0.0015; // Harder to push uphill
            } else {
                pushForce = 0.0025; // Rolls down easier
            }
        }

        if (leftPressed) {
            const touchingBall = this.checkBallCollision('left');
            if (touchingBall) {
                this.isPushing = true;
                this.matter.body.applyForce(this.ball, this.ball.position, { x: -pushForce, y: 0 });
                this.playerX = this.ball.position.x + this.ballRadius + this.playerWidth;
            } else {
                this.playerX -= this.moveSpeed;
            }
            this.player.setFlipX(true);
            this.facingRight = false;
            this.isWalking = true;
            
        } else if (rightPressed || blowing) {
            const touchingBall = this.checkBallCollision('right');
            if (touchingBall) {
                this.isPushing = true;
                const blowForce = blowing ? pushForce * (1 + this.micLevel * 2) : pushForce;
                this.matter.body.applyForce(this.ball, this.ball.position, { x: blowForce, y: 0 });
                this.playerX = this.ball.position.x - this.ballRadius - this.playerWidth;
            } else {
                this.playerX += this.moveSpeed;
            }
            this.player.setFlipX(false);
            this.facingRight = true;
            this.isWalking = true;
        }

        const targetY = this.getGroundY(this.playerX) - 80;
        this.playerY = targetY;
        
        this.player.x = this.playerX;
        this.player.y = this.playerY;

        if (!this.isWalking) {
            this.player.setTexture('walk3');
            this.walkFrame = 3;
            this.pushFrame = 1;
        }

        // Player can't go too far left (the moving wall handles this via physics)
        if (this.playerX < minX + 50) this.playerX = minX + 50;
        
        // Player must ALWAYS stay to the LEFT of the ball
        const minDistanceFromBall = this.ballRadius + this.playerWidth;
        const currentBallX = this.ball.position.x;
        if (this.playerX > currentBallX - minDistanceFromBall) {
            this.playerX = currentBallX - minDistanceFromBall;
            this.playerY = this.getGroundY(this.playerX) - 80;
            this.player.x = this.playerX;
            this.player.y = this.playerY;
        }
        
        // Update boulder graphics (position and rotation)
        this.ballGraphic.x = this.ball.position.x;
        this.ballGraphic.y = this.ball.position.y;
        this.ballGraphic.rotation = this.ball.angle;  // Rotate with physics!
        
        // Update lumpy mask position to follow boulder (with rotation!)
        const bx = this.ball.position.x;
        const by = this.ball.position.y;
        const angle = this.ball.angle;
        
        this.boulderMask.geometryMask.clear();
        this.boulderMask.geometryMask.fillStyle(0xffffff);
        this.boulderMask.geometryMask.beginPath();
        
        // Rotate each vertex by the boulder's angle
        const firstVert = this.lumpyVertices[0];
        const fx = firstVert.x * Math.cos(angle) - firstVert.y * Math.sin(angle);
        const fy = firstVert.x * Math.sin(angle) + firstVert.y * Math.cos(angle);
        this.boulderMask.geometryMask.moveTo(bx + fx, by + fy);
        
        for (let i = 1; i < this.lumpyVertices.length; i++) {
            const v = this.lumpyVertices[i];
            const rx = v.x * Math.cos(angle) - v.y * Math.sin(angle);
            const ry = v.x * Math.sin(angle) + v.y * Math.cos(angle);
            this.boulderMask.geometryMask.lineTo(bx + rx, by + ry);
        }
        
        this.boulderMask.geometryMask.closePath();
        this.boulderMask.geometryMask.fillPath();
        
        // Update hill counter
        this.updateHillCounter();
        
        // Stuck detection - bump rock if it hasn't moved in 10 seconds
        this.checkStuckBall(delta);
        
        // Update parallax backgrounds based on camera movement
        const cameraX = this.cameras.main.scrollX;
        const cameraDelta = cameraX - this.lastCameraX;
        
        // Move layers at different speeds (slower = further away)
        this.cloudsLayer.tilePositionX += cameraDelta * 0.1;   // Slowest
        this.mountainsLayer.tilePositionX += cameraDelta * 0.3; // Medium
        this.forestLayer.tilePositionX += cameraDelta * 0.5;    // Fastest
        
        this.lastCameraX = cameraX;
    }
}

// Detect if mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Calculate dimensions based on screen
function getGameDimensions() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    if (isMobile) {
        // Mobile: use full screen, portrait orientation
        return {
            width: screenWidth,
            height: screenHeight
        };
    } else {
        // Desktop: use a nice landscape/square ratio that fills well
        // Keep height reasonable, expand width
        const aspectRatio = screenWidth / screenHeight;
        
        if (aspectRatio > 1.5) {
            // Wide screen - use more of the width
            return {
                width: Math.min(screenWidth, 1200),
                height: Math.min(screenHeight, 800)
            };
        } else {
            // Narrower screen
            return {
                width: screenWidth,
                height: Math.min(screenHeight, 900)
            };
        }
    }
}

const dims = getGameDimensions();

// Responsive config
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scene: [TitleScene, GameScene],
    pixelArt: true,
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: DEBUG.showPhysics
        }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: dims.width,
        height: dims.height
    },
    input: {
        activePointers: 3
    }
};

const game = new Phaser.Game(config);
