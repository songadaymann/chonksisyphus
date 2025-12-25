// Sisyphus Chonk - ENDLESS HILLS

// Debug options
const DEBUG = {
    showPhysics: false,
    showSegmentBounds: false
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
        this.flatWidthMin = 150;
        this.flatWidthMax = 350;
        this.inclineWidthMin = 250;
        this.inclineWidthMax = 500;
        this.inclineHeightMin = 120;
        this.inclineHeightMax = 250;
    }
    
    // Random number between min and max
    randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
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
        const inclineHeight = this.randomRange(this.inclineHeightMin, this.inclineHeightMax);
        
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
        
        // Fallback - use last segment's end Y
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
        
        this.ball = this.matter.add.fromVertices(180, this.baseGroundY - 70, this.lumpyVertices, {
            restitution: 0.1,
            friction: 0.5,
            frictionStatic: 0.6,
            density: 0.00025,
            label: 'ball'
        });
        
        // Boulder sprite with texture
        this.ballGraphic = this.add.sprite(180, this.baseGroundY - 70, 'boulder');
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
        this.blowThreshold = 0.15;
        
        // Track hills climbed
        this.hillsClimbed = 0;
        this.lastHillIndex = -1;

        // UI - fixed to camera (doesn't scroll)
        // Only hill counter in the HUD
        this.hillCounter = this.add.text(this.gameWidth - 20, 20, 'HILLS: 0', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(1, 0).setScrollFactor(0);  // Right-aligned
        
        // Intro instructions (centered, fades out)
        const centerX = this.gameWidth / 2;
        const centerY = this.gameHeight / 2 - 50;
        
        const introLine1 = this.add.text(centerX, centerY - 80, 'PUSH THE ROCK', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        const introLine2 = this.add.text(centerX, centerY - 40, 'UP THE HILL', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);
        
        const introLine3 = this.add.text(centerX, centerY + 10, '(blow)', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#ffffff'
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

    update() {
        // Generate terrain ahead and cleanup behind
        this.generateAhead();
        this.cleanupSegments();
        
        // Move left wall to prevent going too far back
        const minX = Math.max(0, this.playerX - 400);
        this.matter.body.setPosition(this.leftWall, { x: minX - 10, y: this.gameHeight / 2 });
        
        this.micLevel = this.getMicLevel();
        
        const leftPressed = this.cursors.left.isDown || this.wasd.left.isDown;
        const rightPressed = this.cursors.right.isDown || this.wasd.right.isDown;
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
