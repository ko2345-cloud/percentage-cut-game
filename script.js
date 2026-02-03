// ============================================================================
// Game: Percentage Cut - v3.13
// Description: Use hand gestures to cut shapes to target percentages
// ============================================================================

// ============================================================================
// Translations - Bilingual Support (Chinese/English)
// ============================================================================
const translations = {
    zh: {
        gameTitle: "切割遊戲 - Percentage Cut",
        gameInstructions: "用單手切割圖案，將面積減少到指定比例",
        level: "關卡",
        target: "目標",
        currentArea: "目前面積",
        timeRemaining: "剩餘時間",
        selectLevel: "選擇關卡：",
        level1: "關卡 1",
        level2: "關卡 2",
        level3: "關卡 3",
        level4: "關卡 4",
        startGame: "開始遊戲",
        hand1: "手1",
        placeHand: "請將一隻手放在鏡頭前",
        redLineBlock: "紅線阻擋切割",
        bombExplosion: "炸彈爆炸！遊戲失敗",
        timeUp: "時間到！遊戲失敗",
        areaTooSmall: "面積太小！低於{percent}%！遊戲失敗",
        levelComplete1: "第一關完成！進入五角星...",
        levelComplete2: "第二關完成！進入十字形狀...",
        levelComplete3: "第三關完成！進入最終挑戰計時戰...",
        gameComplete: "完成！面積在 {min}%-{max}% 範圍內！通關成功！",
        cameraError: "無法訪問攝像頭。請允許權限",

        // Two-player mode translations
        wins: "Win",
        selectMode: "選擇模式：",
        singlePlayer: "單人模式",
        twoPlayers: "雙人模式",
        player1Wins: "玩家1 獲勝！",
        player2Wins: "玩家2 獲勝！",
        draw: "平手！",
        gameOver: "遊戲結束",
        finalScore: "最終分數"
    },
    en: {
        gameTitle: "Percentage Cut",
        gameInstructions: "Use one hand to cut the shape to the target percentage!",
        level: "Level",
        target: "Target",
        currentArea: "Area",
        timeRemaining: "Time",
        selectLevel: "Select Level:",
        level1: "Level 1",
        level2: "Level 2",
        level3: "Level 3",
        level4: "Level 4",
        startGame: "Start Game",
        hand1: "Hand 1",
        placeHand: "Please place one hand in front of camera",
        redLineBlock: "Red line blocked!",
        bombExplosion: "Bomb exploded! Game Over!",
        timeUp: "Time's up! Game Over!",
        areaTooSmall: "Area too small! Below {percent}%! Game Over!",
        levelComplete1: "Level 1 Complete! Next: Star Shape...",
        levelComplete2: "Level 2 Complete! Next: Cross Shape...",
        levelComplete3: "Level 3 Complete! Next: Final Challenge...",
        gameComplete: "Perfect! Area between {min}%-{max}%! All Levels Cleared!",
        cameraError: "Camera access denied. Please allow permission.",

        // Two-player mode translations
        wins: "Win",
        selectMode: "Select Mode:",
        singlePlayer: "Single Player",
        twoPlayers: "Two Players",
        player1Wins: "Player 1 Wins!",
        player2Wins: "Player 2 Wins!",
        draw: "Draw!",
        gameOver: "Game Over",
        finalScore: "Final Score"
    }
};

let currentLanguage = 'zh';

function t(key, params = {}) {
    let text = translations[currentLanguage][key] || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function updateLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';

    // Update DOM elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
}

// ============================================================================
// Canvas and Game State Variables
// ============================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

let hands;
let camera;
let gameState = 'idle'; // idle, playing, won, lost, finished_level
let gameMode = 'single'; // 'single' or 'multi'
let players = []; // Array of PlayerState

let currentLevel = 1; // 1 = square, 2 = star, 3 = cross, 4 = circle
let selectedLevel = 1; // User's level selection
let targetPercent = 10;
let minTargetPercent = 10; // Level 4 min target
let maxTargetPercent = 20; // Level 4 max target

// Timer variables
let gameTimer = null;
let timeRemaining = 60; // Default 60s (multi), 30s (single level 4)
let timerActive = false;

// Two-player WIN tracking
let p1TotalWins = 0;
let p2TotalWins = 0;

// Sound effects (placeholders)
let collisionSound = null;
let explosionSound = null;

// ============================================================================
// PlayerState Class - Manages individual player state
// ============================================================================
class PlayerState {
    constructor(id, viewport) {
        this.id = id;
        this.viewport = viewport;

        // Anti-jitter smoothing
        this.smoothCursor = null;

        this.shape = null;
        this.fallingPieces = [];
        this.sparks = [];
        this.bombs = [];

        this.cuttingState = {
            isInside: false,
            entryPoint: null,
            currentPath: [],
            lastPosition: null
        };

        this.gestureTrail = [];
        this.initialArea = 0;

        // Two-player stats
        this.wins = 0;
        this.completed = false;
        this.completionTime = 0;
        this.finalPercent = 100;
    }

    reset() {
        this.shape = null;
        this.fallingPieces = [];
        this.sparks = [];
        this.bombs = [];
        this.cuttingState = {
            isInside: false,
            entryPoint: null,
            currentPath: [],
            lastPosition: null
        };
        this.gestureTrail = [];
        this.completed = false;
        this.completionTime = 0;
        this.wins = 0;
    }
}

// ============================================================================
// Canvas Resizing
// ============================================================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Update player viewports
    if (players.length > 0) {
        if (gameMode === 'multi' && players.length > 1) {
            const halfWidth = canvas.width / 2;
            players[0].viewport = { x: 0, y: 0, width: halfWidth, height: canvas.height };
            players[1].viewport = { x: halfWidth, y: 0, width: halfWidth, height: canvas.height };
        } else {
            players[0].viewport = { x: 0, y: 0, width: canvas.width, height: canvas.height };
        }
    }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


// ============================================================================
// Part 2: Polygon Class and Mathematical Utilities
// ============================================================================

// ============================================================================
// Polygon Class - Represents multi-sided shapes
// ============================================================================
class Polygon {
    constructor(vertices, edgeProperties = null) {
        this.vertices = vertices; // [{x, y}, ...]
        // edgeProperties: [{color: '#000000', cuttable: true}, ...] for each edge
        // If null, all edges are black and cuttable
        this.edgeProperties = edgeProperties || vertices.map(() => ({
            color: '#000000',
            cuttable: true
        }));
    }

    // Calculate polygon area using shoelace formula
    getArea() {
        let area = 0;
        const n = this.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.vertices[i].x * this.vertices[j].y;
            area -= this.vertices[j].x * this.vertices[i].y;
        }
        return Math.abs(area / 2);
    }

    // Draw the polygon
    draw(color = '#4ECDC4', lineWidth = 4, strokeColor = '#000000') {
        if (this.vertices.length < 3) return;

        // Fill
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Draw edges (each edge may have different color)
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';

        const n = this.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const edgeColor = this.edgeProperties[i].color;

            ctx.strokeStyle = edgeColor;
            ctx.beginPath();
            ctx.moveTo(this.vertices[i].x, this.vertices[i].y);
            ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
            ctx.stroke();
        }
    }

    // Check if point is inside polygon (ray casting algorithm)
    isPointInside(point) {
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x, yi = this.vertices[i].y;
            const xj = this.vertices[j].x, yj = this.vertices[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Check if point collides with any edge
    checkPointEdgeCollision(point, threshold = 20) {
        const n = this.vertices.length;
        const collisions = [];

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = this.vertices[i];
            const v2 = this.vertices[j];

            // Calculate distance from point to line segment
            const distance = pointToSegmentDistance(point, v1, v2);

            if (distance < threshold) {
                collisions.push({
                    edgeIndex: i,
                    distance: distance,
                    edgeProperty: this.edgeProperties[i]
                });
            }
        }

        return collisions;
    }

    // Check if cut line passes through uncuttable edge (red line)
    checkCutThroughUncuttableEdge(lineStart, lineEnd) {
        const n = this.vertices.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;

            // If edge is uncuttable
            if (!this.edgeProperties[i].cuttable) {
                const v1 = this.vertices[i];
                const v2 = this.vertices[j];

                // Check if cut line intersects with red line
                const intersection = getLineIntersection(lineStart, lineEnd, v1, v2);

                if (intersection) {
                    console.log('[CUT BLOCKED] Cut line crosses red line', {
                        edgeIndex: i,
                        intersection: intersection
                    });
                    return true; // Found intersection, cut blocked
                }
            }
        }

        return false; // No red line violations
    }

    // Find edge intersection point from outside to inside
    findEdgeIntersection(outsidePoint, insidePoint) {
        const n = this.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const intersection = getLineIntersection(
                outsidePoint, insidePoint,
                this.vertices[i], this.vertices[j]
            );
            if (intersection) {
                return intersection;
            }
        }
        return null;
    }

    // Slice polygon with a line segment
    slice(lineStart, lineEnd) {
        const intersections = [];
        const n = this.vertices.length;

        // Find all intersections with polygon edges
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const intersection = getLineIntersection(
                lineStart, lineEnd,
                this.vertices[i], this.vertices[j]
            );
            if (intersection) {
                intersections.push({ point: intersection, index: i });
            }
        }

        // Need exactly 2 intersection points to slice
        if (intersections.length !== 2) return null;

        const [int1, int2] = intersections;
        const poly1Vertices = [];
        const poly1Edges = [];
        const poly2Vertices = [];
        const poly2Edges = [];

        // --- Build Polygon 1 ---
        // Start from intersection 1
        poly1Vertices.push({ x: int1.point.x, y: int1.point.y });

        // Traverse vertices from int1.index + 1 to int2.index
        let idx = (int1.index + 1) % n;

        // The first edge goes from int1 to vertices[idx]
        // It inherits properties from edge[int1.index]
        poly1Edges.push(this.edgeProperties[int1.index]);

        let safetyCounter = 0;
        while (idx !== (int2.index + 1) % n) {
            poly1Vertices.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });

            // The edge starting from this vertex
            // If the next vertex is the exit point, it's part of edge[int2.index]
            // Otherwise it's a full original edge
            if (idx === int2.index) {
                // This edge goes to the exit point, so it's part of edge[int2.index]
                poly1Edges.push(this.edgeProperties[idx]);
            } else {
                // Full original edge
                poly1Edges.push(this.edgeProperties[idx]);
            }

            idx = (idx + 1) % n;
            safetyCounter++;
            if (safetyCounter > n + 10) { console.error("Poly1 loop"); return null; }
        }

        poly1Vertices.push({ x: int2.point.x, y: int2.point.y });

        // Closing edge: from int2 back to int1 (THE CUT LINE)
        // This is a NEW edge, so it should be cuttable and black (default)
        poly1Edges.push({ color: '#000000', cuttable: true });

        // --- Build Polygon 2 ---
        // Start from intersection 2
        poly2Vertices.push({ x: int2.point.x, y: int2.point.y });

        // Traverse vertices from int2.index + 1 to int1.index
        idx = (int2.index + 1) % n;

        // Inheritance from edge[int2.index]
        poly2Edges.push(this.edgeProperties[int2.index]);

        safetyCounter = 0;
        while (idx !== (int1.index + 1) % n) {
            poly2Vertices.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });

            if (idx === int1.index) {
                poly2Edges.push(this.edgeProperties[idx]);
            } else {
                poly2Edges.push(this.edgeProperties[idx]);
            }

            idx = (idx + 1) % n;
            safetyCounter++;
            if (safetyCounter > n + 10) { console.error("Poly2 loop"); return null; }
        }

        poly2Vertices.push({ x: int1.point.x, y: int1.point.y });

        // Closing edge: from int1 back to int2 (THE CUT LINE)
        poly2Edges.push({ color: '#000000', cuttable: true });

        return [
            new Polygon(poly1Vertices, poly1Edges),
            new Polygon(poly2Vertices, poly2Edges)
        ];
    }
}

// ============================================================================
// Mathematical Utility Functions
// ============================================================================

// Get intersection point of two line segments
function getLineIntersection(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    return null;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(point, segStart, segEnd) {
    const px = point.x;
    const py = point.y;
    const x1 = segStart.x;
    const y1 = segStart.y;
    const x2 = segEnd.x;
    const y2 = segEnd.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        // Segment degenerates to a point
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // Calculate projection parameter t
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

    // Closest point
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}

function isPointInPolygon(p, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;

        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}


// ============================================================================
// Part 3: Particle Effects (Sparks, Falling Pieces, Bombs)
// ============================================================================

// ============================================================================
// Spark Class - Particle effects
// ============================================================================
class Spark {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // Random velocity (explode outward)
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.gravity = 0.3;
        this.lifetime = 30 + Math.floor(Math.random() * 20); // 30-50 frames
        this.age = 0;
        this.size = 3 + Math.random() * 3; // 3-6px

        // Color: Orange to yellow
        const colors = ['#FFD700', '#FF6B35', '#FFA500', '#FF8C00'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.age++;
    }

    draw() {
        const opacity = 1 - (this.age / this.lifetime);
        const currentSize = this.size * opacity;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.age >= this.lifetime;
    }
}

// ============================================================================
// FallingPiece Class - Cut-off pieces that fall
// ============================================================================
class FallingPiece {
    constructor(polygon) {
        this.polygon = polygon;
        this.velocity = 0;
        this.gravity = 0.5;
        this.opacity = 1;
        this.rotation = (Math.random() - 0.5) * 0.05; // Slight rotation
    }

    update() {
        this.velocity += this.gravity;
        // Move all vertices downward
        this.polygon.vertices.forEach(v => {
            v.y += this.velocity;
        });
        this.opacity -= 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        this.polygon.draw('#FFD700', 4, '#000000'); // Yellow piece, black outline
        ctx.restore();
    }

    isOffScreen() {
        return this.polygon.vertices.every(v => v.y > canvas.height + 100) || this.opacity <= 0;
    }
}

// ============================================================================
// Bomb Class - Dangerous obstacles
// ============================================================================
class Bomb {
    constructor(x, y, vx, vy, speed = 2) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.speed = speed;
        this.radius = 12;
        this.fuseTime = 0; // For animation
    }

    update() {
        // Direct movement
        this.x += this.vx * this.speed;
        this.y += this.vy * this.speed;

        // Update fuse animation
        this.fuseTime += 0.1;
    }

    checkEdgeCollision(polygon) {
        if (!polygon) return null;

        const n = polygon.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = polygon.vertices[i];
            const v2 = polygon.vertices[j];

            // Calculate distance from bomb center to edge
            const distance = pointToSegmentDistance({ x: this.x, y: this.y }, v1, v2);

            if (distance < this.radius + 2) {
                // Collision! Return edge info
                return {
                    edgeIndex: i,
                    v1: v1,
                    v2: v2
                };
            }
        }
        return null;
    }

    bounce(edge) {
        const { v1, v2 } = edge;

        // Calculate edge direction
        const edgeVx = v2.x - v1.x;
        const edgeVy = v2.y - v1.y;
        const edgeLength = Math.sqrt(edgeVx * edgeVx + edgeVy * edgeVy);

        // Normalize edge vector
        const edgeNormX = edgeVx / edgeLength;
        const edgeNormY = edgeVy / edgeLength;

        // Calculate normal vector (perpendicular to edge)
        const normalX = -edgeNormY;
        const normalY = edgeNormX;

        // Calculate velocity dot product with normal
        const dotProduct = this.vx * normalX + this.vy * normalY;

        // Reflection formula: V' = V - 2(V·N)N
        this.vx = this.vx - 2 * dotProduct * normalX;
        this.vy = this.vy - 2 * dotProduct * normalY;

        // Adjust position to prevent stuck inside edge
        this.x += normalX * 3;
        this.y += normalY * 3;
    }

    draw() {
        // Draw bomb (dark gray sphere)
        const gradient = ctx.createRadialGradient(
            this.x - 4, this.y - 4, 2,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#555555');
        gradient.addColorStop(1, '#222222');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw fuse (flickering)
        const fuseFlicker = Math.sin(this.fuseTime * 10) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 140, 0, ${0.5 + fuseFlicker * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.radius - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spark effect
        if (fuseFlicker > 0.7) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.radius - 3, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Check if bomb collides with cut line
    checkCutLineCollision(lineStart, lineEnd) {
        // Calculate distance from bomb center to line segment
        const distance = pointToSegmentDistance({ x: this.x, y: this.y }, lineStart, lineEnd);
        const isCollision = distance < this.radius + 15; // Increased tolerance for easier detection

        if (isCollision) {
            console.log(`[BOMB HIT] Distance: ${distance.toFixed(2)}, Bomb position: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
        }

        return isCollision;
    }
}


// ============================================================================
// Part 4: Shape Creation Functions for Each Level
// ============================================================================

// Create Level 1 Shape - Simple Square
function createLevel1Shape(centerX, centerY, size) {
    const halfSize = size / 2;
    const vertices = [
        { x: centerX - halfSize, y: centerY - halfSize },
        { x: centerX + halfSize, y: centerY - halfSize },
        { x: centerX + halfSize, y: centerY + halfSize },
        { x: centerX - halfSize, y: centerY + halfSize }
    ];

    // All edges are black and cuttable
    return new Polygon(vertices);
}

// Create Level 2 Shape - 5-Point Star with Red Line Protection
function createStarPolygon(centerX, centerY, outerRadius, innerRadius) {
    const vertices = [];
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2; // Start from top
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    // Define edge properties - red lines on inner sides
    // Star has 10 vertices (indexed 0-9, from outer points)
    // Edge i connects vertex i to i+1
    // Red lines cover inner edges: indices 1, 2, 3, 4, 5
    const edgeProperties = vertices.map((_, i) => {
        // Red line edges based on user's latest correction (swap 0 for 1)
        // 1: TR Inner -> TR Tip (Arrow pointed here)
        // 3: BR Inner -> BR Tip
        // 5: Bottom Inner -> Bottom Left Tip
        // 7: Bottom Left Inner -> Left Tip
        // 9: Top Left Inner -> Top
        const redIndices = [1, 3, 5, 7, 9];
        const isRedLine = redIndices.includes(i);
        return {
            color: isRedLine ? '#FF0000' : '#000000',
            cuttable: !isRedLine
        };
    });

    return new Polygon(vertices, edgeProperties);
}

// Create Level 3 Shape - Cross/Plus Sign (Empty Center)
function createLevel3Shape(centerX, centerY, size) {
    const scale = size / 400; // Base size 400
    const thickness = 40 * scale; // Arm thickness
    const armLength = 200 * scale; // Arm length

    // Empty cross outline (clockwise from top-left)
    const outerVertices = [
        // Top arm - from top-left corner clockwise
        { x: centerX - thickness, y: centerY - armLength },
        { x: centerX + thickness, y: centerY - armLength },
        { x: centerX + thickness, y: centerY - thickness },

        // Right arm
        { x: centerX + armLength, y: centerY - thickness },
        { x: centerX + armLength, y: centerY + thickness },
        { x: centerX + thickness, y: centerY + thickness },

        // Bottom arm
        { x: centerX + thickness, y: centerY + armLength },
        { x: centerX - thickness, y: centerY + armLength },
        { x: centerX - thickness, y: centerY + thickness },

        // Left arm
        { x: centerX - armLength, y: centerY + thickness },
        { x: centerX - armLength, y: centerY - thickness },
        { x: centerX - thickness, y: centerY - thickness }
    ];

    // Define edge properties - specific red lines
    // Edge i connects vertex i to i+1
    // Red lines based on user request:
    // 1: Top Arm Right Edge
    // 7: Bottom Arm Left Edge
    // 8: Left Arm Bottom Edge
    const edgeProperties = outerVertices.map((_, i) => {
        const redIndices = [1, 7, 8];
        const isRedLine = redIndices.includes(i);
        return {
            color: isRedLine ? '#FF0000' : '#000000',
            cuttable: !isRedLine
        };
    });

    return new Polygon(outerVertices, edgeProperties);
}

// Create Level 4 Shape - Circle (approximated with many vertices)
function createLevel4Shape(centerX, centerY, radius) {
    const vertices = [];
    const segments = 64; // 64-sided polygon approximates circle

    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    // All edges are black and cuttable
    return new Polygon(vertices);
}

// ============================================================================
// MediaPipe Hands Setup and Tracking
// ============================================================================
function setupMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,  // Support two-player mode (single-player uses only first hand)
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);
}

// MediaPipe results callback
function onHandsResults(results) {
    // Draw all detected hands for tracking
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Debug text (commented out for performance)
        // const debugText = `Detected ${results.multiHandLandmarks.length} hand(s)`;
        // ctx.fillStyle = '#FFFFFF';
        // ctx.font = 'bold 20px Arial';
        // ctx.fillText(debugText, 20, canvas.height - 20);

        // Process each hand
        results.multiHandLandmarks.forEach((handLandmarks, index) => {
            const indexTip = handLandmarks[8]; // Index finger tip

            // Convert to canvas coordinates (0-1 -> px)
            // Note: MediaPipe output is usually mirrored, so (1 - x)
            const x = (1 - indexTip.x) * canvas.width;
            const y = indexTip.y * canvas.height;

            // Determine which player this hand belongs to
            let targetPlayer = null;

            // Split screen logic ONLY applies during gameplay
            if (gameMode === 'multi' && gameState === 'playing') {
                // Simple rule: screen left half = P1, right half = P2
                if (x < canvas.width / 2) {
                    targetPlayer = players[0];
                } else {
                    targetPlayer = players[1];
                }
            } else {
                // In single player OR menu (idle), only use the first detected hand
                // This allows P1 to control the full screen in menu even if 'multi' is selected
                if (index === 0) targetPlayer = players[0];
            }

            if (targetPlayer && !targetPlayer.completed) {
                // Draw hand indicator (visual only)
                const color = targetPlayer.id === 0 ? '#FF6B6B' : '#4ECDC4'; // P1 red, P2 cyan

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, Math.PI * 2);
                ctx.fill();

                // Process input logic (assign to specific player)
                handlePlayerInput({ x, y }, targetPlayer);
            }
        });
    }
}

function handlePlayerInput(point, player) {
    // Smoothing Logic (Exponential Moving Average)
    // Alpha factor: 0.2 (strong smoothing) to 0.8 (responsive)
    const alpha = 0.5;

    // Initialize smooth cursor if not present
    if (!player.smoothCursor) {
        player.smoothCursor = { x: point.x, y: point.y };
    }

    // Apply smoothing
    player.smoothCursor.x = player.smoothCursor.x * (1 - alpha) + point.x * alpha;
    player.smoothCursor.y = player.smoothCursor.y * (1 - alpha) + point.y * alpha;

    const smoothPoint = {
        x: player.smoothCursor.x,
        y: player.smoothCursor.y
    };

    // Always update gesture trail for visual feedback and menu interaction
    updateGestureTrail(smoothPoint, player);

    if (gameState !== 'playing') return;

    // Check edge crossing
    checkEdgeCrossing(smoothPoint, player);

    // Check red line collision
    if (player.shape) {
        const collisions = player.shape.checkPointEdgeCollision(smoothPoint, 25);
        const redLineCollision = collisions.find(c => !c.edgeProperty.cuttable);

        if (redLineCollision) {
            // Simple feedback: play sound, could add cooldown (applied to player)
            if (collisionSound) collisionSound();
        }
    }

    // Check if hand touches bomb
    if (player.bombs.length > 0) {
        for (let bomb of player.bombs) {
            const distance = Math.sqrt((smoothPoint.x - bomb.x) ** 2 + (smoothPoint.y - bomb.y) ** 2);
            if (distance < bomb.radius + 25) {
                triggerExplosion(bomb.x, bomb.y, player);
                return;
            }
        }
    }
}

function updateGestureTrail(point, player) {
    player.gestureTrail.push(point);
    if (player.gestureTrail.length > 20) {
        player.gestureTrail.shift();
    }
}

// ============================================================================
// Edge Crossing Detection and Cutting Logic
// ============================================================================
function checkEdgeCrossing(point, player) {
    if (!player.shape) return;

    const isInside = player.shape.isPointInside(point);
    const state = player.cuttingState;

    if (!state.isInside && isInside) {
        // Entering shape from outside
        const entryPoint = player.shape.findEdgeIntersection(state.lastPosition || point, point);
        if (entryPoint) {
            state.isInside = true;
            state.entryPoint = entryPoint;
            state.currentPath = [entryPoint, point];
            console.log('[ENTER SHAPE] Entry point:', entryPoint);
        }
    } else if (state.isInside && isInside) {
        // Inside shape, continue path
        state.currentPath.push(point);
    } else if (state.isInside && !isInside) {
        // Exiting shape to outside
        const exitPoint = player.shape.findEdgeIntersection(state.lastPosition || point, point);
        if (exitPoint) {
            state.currentPath.push(exitPoint);
            console.log('[EXIT SHAPE] Exit point:', exitPoint);

            // Attempt to cut
            attemptCut(state.entryPoint, exitPoint, player);

            // Reset cutting state
            state.isInside = false;
            state.entryPoint = null;
            state.currentPath = [];
        }
    } else if (!state.isInside && !isInside) {
        // Fast Swipe check: Start and End are both outside, but might have crossed through
        // Try slicing with the line segment directly
        if (state.lastPosition) {
            // Check if this segment intersects twice (meaning it went through)
            // We can use the slice method directly, as it handles intersection checking
            const pieces = player.shape.slice(state.lastPosition, point);

            if (pieces) {
                console.log('[FAST SWIPE] Detected cut through shape!');

                // Check for red line crossing
                if (player.shape.checkCutThroughUncuttableEdge(state.lastPosition, point)) {
                    console.log('[CUT BLOCKED] Fast swipe crossed red line!');
                    if (audioCtrl) audioCtrl.playBlocked();
                    showMessage(t('redLineBlock'));
                    return;
                }

                // Check for BOMB collision (Fast Swipe)
                if (player.bombs.length > 0) {
                    for (let bomb of player.bombs) {
                        if (bomb.checkCutLineCollision(state.lastPosition, point)) {
                            triggerExplosion(bomb.x, bomb.y, player);
                            return;
                        }
                    }
                }

                // Resolving the cut
                resolveCut(pieces, state.lastPosition, point, player);
            }
        }
    }

    state.lastPosition = point;
}

function resolveCut(pieces, startPt, endPt, player) {
    if (!pieces) return;

    const [poly1, poly2] = pieces;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    console.log(`[CUT SUCCESS] Area 1: ${area1.toFixed(2)}, Area 2: ${area2.toFixed(2)}`);

    // Smaller piece falls away
    if (area1 < area2) {
        player.shape = poly2;
        player.fallingPieces.push(new FallingPiece(poly1));
    } else {
        player.shape = poly1;
        player.fallingPieces.push(new FallingPiece(poly2));
    }

    // Create sparks
    for (let i = 0; i < 10; i++) {
        const midX = (startPt.x + endPt.x) / 2;
        const midY = (startPt.y + endPt.y) / 2;
        player.sparks.push(new Spark(midX, midY));
    }

    // Play sound
    if (audioCtrl) audioCtrl.playCut();

    // Update display
    updateUI();
}

function attemptCut(entryPoint, exitPoint, player) {
    if (!entryPoint || !exitPoint || !player.shape) return;

    console.log('[ATTEMPTING CUT] From entry to exit...');

    // Check if cut crosses red lines
    if (player.shape.checkCutThroughUncuttableEdge(entryPoint, exitPoint)) {
        console.log('[CUT BLOCKED] Cannot cut through red line!');
        showMessage(t('redLineBlock'));
        return;
    }

    // Check if cut hits bomb
    if (player.bombs.length > 0) {
        for (let bomb of player.bombs) {
            if (bomb.checkCutLineCollision(entryPoint, exitPoint)) {
                triggerExplosion(bomb.x, bomb.y, player);
                return;
            }
        }
    }

    // Slice the polygon
    const pieces = player.shape.slice(entryPoint, exitPoint);

    if (!pieces) {
        console.log('[CUT FAILED] Could not slice polygon');
        return;
    }

    // Reuse resolve logic
    resolveCut(pieces, entryPoint, exitPoint, player);
}


// ============================================================================
// Part 5: Game Initialization, UI Updates, and Core Game Logic
// ============================================================================

// ============================================================================
// Game Initialization
// ============================================================================
function initGame() {
    console.log('[INIT GAME] Mode:', gameMode, 'Level:', currentLevel);

    // Reset game state
    gameState = 'playing';
    p1TotalWins = gameMode === 'multi' ? p1TotalWins : 0; // Preserve wins in multi-player
    p2TotalWins = gameMode === 'multi' ? p2TotalWins : 0;

    // Set target percentage based on level
    if (currentLevel === 4) {
        targetPercent = minTargetPercent; // Level 4 has range 10-20%
    } else {
        targetPercent = 10; // All other levels: 10%
    }

    // Setup timer
    if (gameMode === 'multi') {
        timeRemaining = 60; // All two-player levels: 60 seconds
        timerActive = true;
    } else {
        if (currentLevel === 4) {
            timeRemaining = 30; // Single-player level 4: 30 seconds
            timerActive = true;
        } else {
            timerActive = false; // Other single-player levels: no timer
        }
    }

    // Initialize players based on game mode
    // Ensure P1 UI is visible (might be hidden by reset)
    const p1UI = document.getElementById('p1UI');
    if (p1UI) p1UI.style.display = 'flex';

    if (gameMode === 'multi') {
        const halfWidth = canvas.width / 2;
        players = [
            new PlayerState(0, { x: 0, y: 0, width: halfWidth, height: canvas.height }),
            new PlayerState(1, { x: halfWidth, y: 0, width: halfWidth, height: canvas.height })
        ];

        // Show P2 UI and WIN boxes
        document.getElementById('p2UI').style.display = 'flex';
        document.getElementById('p1-winsBox').style.display = 'block';
        document.getElementById('p2-winsBox').style.display = 'block';

        // Show split-screen divider
        const splitLine = document.getElementById('splitLine');
        if (splitLine) splitLine.style.display = 'block';

    } else {
        players = [
            new PlayerState(0, { x: 0, y: 0, width: canvas.width, height: canvas.height })
        ];

        // Hide P2 UI and WIN boxes
        document.getElementById('p2UI').style.display = 'none';
        document.getElementById('p1-winsBox').style.display = 'none';
        document.getElementById('p2-winsBox').style.display = 'none';

        // Hide split-screen divider
        const splitLine = document.getElementById('splitLine');
        if (splitLine) splitLine.style.display = 'none';
    }

    // Create shapes for each player
    players.forEach(player => {
        player.reset(); // Reset before creating shape to avoid clearing it!

        const centerX = player.viewport.x + player.viewport.width / 2;
        const centerY = player.viewport.y + player.viewport.height / 2;
        const size = Math.min(player.viewport.width, player.viewport.height) * 0.6;

        createShapeForPlayer(player);

        player.initialArea = player.shape.getArea();

        // Level 3: Add Bomb
        // Level 3: Add Bomb
        if (currentLevel === 3) {
            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const speed = 2; // pixel speed
            const vx = Math.cos(angle);
            const vy = Math.sin(angle);

            player.bombs.push(new Bomb(centerX, centerY, vx, vy, speed));
        }

        // Level 4: Add TWO Bombs (Different Speeds)
        if (currentLevel === 4) {
            // Bomb 1: Slow (Speed 2)
            let angle = Math.random() * Math.PI * 2;
            let speed = 2;
            let vx = Math.cos(angle);
            let vy = Math.sin(angle);
            player.bombs.push(new Bomb(centerX, centerY, vx, vy, speed));

            // Bomb 2: Fast (Speed 5)
            angle = Math.random() * Math.PI * 2;
            speed = 5;
            vx = Math.cos(angle);
            vy = Math.sin(angle);
            player.bombs.push(new Bomb(centerX, centerY, vx, vy, speed));
        }
    });

    // Update UI
    updateUI();

    // Start timer if active
    if (timerActive) {
        startTimer();
    }

    console.log('[INIT GAME] Complete. Players:', players.length);
}

// ============================================================================
// Update UI Display
// ============================================================================
function updateUI() {
    players.forEach(player => {
        const prefix = `p${player.id + 1}-`;

        // Update level display
        const levelEl = document.getElementById(prefix + 'levelDisplay');
        if (levelEl) levelEl.textContent = currentLevel;

        // Update target display
        const targetEl = document.getElementById(prefix + 'targetPercent');
        if (currentLevel === 4 && targetEl) {
            targetEl.textContent = `${minTargetPercent}-${maxTargetPercent}%`;
        } else if (targetEl) {
            targetEl.textContent = `${targetPercent}%`;
        }

        // Update current area percentage
        const areaEl = document.getElementById(prefix + 'currentPercent');
        if (player.shape && player.initialArea > 0) {
            const currentArea = player.shape.getArea();
            const percent = (currentArea / player.initialArea) * 100;
            if (areaEl) areaEl.textContent = `${percent.toFixed(1)}%`;
        } else if (areaEl) {
            areaEl.textContent = '100%';
        }

        // Update WIN count for two-player mode
        if (gameMode === 'multi') {
            const winsEl = document.getElementById(prefix + 'wins');
            const totalWins = player.id === 0 ? p1TotalWins : p2TotalWins;
            if (winsEl) winsEl.textContent = totalWins;
        }
    });

    // Update timer display
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBox = document.getElementById('timerBox');

    if (timerDisplay && timerBox) {
        if (timerActive) {
            timerBox.style.display = 'block';
            timerDisplay.textContent = `${timeRemaining}`;
            timerDisplay.style.color = timeRemaining <= 10 ? '#FF6B6B' : '#FFFFFF';
        } else {
            timerBox.style.display = 'none';
        }
    }
}

// ============================================================================
// Timer Management
// ============================================================================
function startTimer() {
    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        if (gameState !== 'playing') {
            clearInterval(gameTimer);
            return;
        }

        timeRemaining--;
        updateUI();

        if (timeRemaining <= 10 && timeRemaining > 0) {
            // Ticking sound for last 10 seconds
            if (audioCtrl) audioCtrl.playTone(880, 'sine', 0.05);
        }

        if (timeRemaining <= 0) {
            clearInterval(gameTimer);
            timerActive = false;

            // Time's up - end level
            console.log('[TIMER] Times up!');
            if (audioCtrl) audioCtrl.playBlocked(); // Fail sound
            endLevel();
        }
    }, 1000);
}

// ============================================================================
// Part 6: Main Game Loop
// ============================================================================

// --- Menu System ---
class MenuButton {
    constructor(x, y, width, height, label, color, action) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.label = label;
        this.color = color;
        this.action = action;

        // Create polygon for collision detection and drawing
        this.polygon = new Polygon([
            { x: x, y: y },
            { x: x + width, y: y },
            { x: x + width, y: y + height },
            { x: x, y: y + height }
        ]);

        this.baseColor = color;
        this.highlightColor = '#FFFFFF';
        this.isHovered = false;
        this.lastTriggerTime = 0; // Debounce cooldown
        this.hoverStartTime = 0;  // Dwell time tracker
        this.requiredHoverTime = 500; // 0.5s dwell required for tap
    }

    draw(ctx) {
        // Draw Button Background
        ctx.save();
        ctx.fillStyle = this.isHovered ? this.highlightColor : this.baseColor;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 15);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw Label
        ctx.fillStyle = this.isHovered ? this.baseColor : '#FFFFFF';
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(this.t(this.label), this.x + this.width / 2, this.y + this.height / 2);

        ctx.restore();
    }

    t(key) {
        // Simple translation helper or return key if not found
        return translations[currentLanguage][key] || key;
    }

    checkCut(p1, p2) {
        // Debounce check (500ms cooldown)
        if (Date.now() - this.lastTriggerTime < 500) return false;

        let triggered = false;

        // 1. Check if either point is INSIDE the button (Tap/Hover interaction)
        // REQUIRE DWELL TIME: Must hover for 0.5s to trigger
        const isInside = isPointInPolygon(p1, this.polygon.vertices) || isPointInPolygon(p2, this.polygon.vertices);

        if (isInside) {
            if (this.hoverStartTime === 0) this.hoverStartTime = Date.now();
            this.isHovered = true; // Visual feedback

            if (Date.now() - this.hoverStartTime > this.requiredHoverTime) {
                triggered = true;
                this.hoverStartTime = 0; // Reset after trigger
            }
        } else {
            this.hoverStartTime = 0;
            this.isHovered = false;
        }

        // 2. Check if cut line intersects the button polygon
        if (!triggered) {
            const intersections = [];
            const n = this.polygon.vertices.length;

            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                const intersection = getLineIntersection(
                    p1, p2,
                    this.polygon.vertices[i], this.polygon.vertices[j]
                );
                if (intersection) {
                    intersections.push(intersection);
                }
            }
            if (intersections.length >= 2) triggered = true;
        }

        if (triggered) {
            this.lastTriggerTime = Date.now();
            return true;
        }
        return false;
    }
}

let menuButtons = [];
let startButton = null;

function initMenu() {
    menuButtons = [];

    const centerY = canvas.height * 0.75;
    const sectionY = canvas.height * 0.65;

    // Calculate column centers
    const col1X = canvas.width * 0.20; // Mode
    const col2X = canvas.width * 0.50; // Level
    const col3X = canvas.width * 0.80; // Start

    // --- Mode Selection (Left) ---
    const modeBtnWidth = 140;
    const modeBtnHeight = 50;
    const modeGap = 10;

    // Single Player
    menuButtons.push(new MenuButton(col1X - modeBtnWidth - modeGap / 2, sectionY, modeBtnWidth, modeBtnHeight, 'singlePlayer', '#4ECDC4', () => {
        gameMode = 'single';
        console.log("Selected Single Player");
    }));

    // Two Players
    menuButtons.push(new MenuButton(col1X + modeGap / 2, sectionY, modeBtnWidth, modeBtnHeight, 'twoPlayers', '#FF6B6B', () => {
        gameMode = 'multi';
        console.log("Selected Multi Player");
    }));


    // --- Level Selection (Center) ---
    const lvlBtnSize = 60;
    const lvlGap = 15;
    const lvlTotalWidth = (lvlBtnSize * 4) + (lvlGap * 3);
    let lvlStartX = col2X - lvlTotalWidth / 2;

    for (let i = 1; i <= 4; i++) {
        menuButtons.push(new MenuButton(lvlStartX + (i - 1) * (lvlBtnSize + lvlGap), sectionY, lvlBtnSize, lvlBtnSize, i.toString(), '#FFD700', () => {
            currentLevel = i;
            console.log("Selected Level", i);
        }));
    }

    // --- Start Game (Right) ---
    const startBtnWidth = 200;
    const startBtnHeight = 80;
    menuButtons.push(new MenuButton(col3X - startBtnWidth / 2, sectionY - 10, startBtnWidth, startBtnHeight, 'startGame', '#FFFFFF', () => {
        startGame(currentLevel);
    }));
}

function updateMenu() {
    // Check for cuts on menu buttons using player hand trails
    // We can reuse the player's cutting logic concept but applied to menu buttons

    // Use the first player's hand for menu interaction (or both if available?)
    // Let's iterate all active hands/players

    // Since we don't have initialized 'players' array in idle state fully set up for game logic,
    // we need to rely on the tracking data coming from 'hands.onResults'.
    // BUT, 'onResults' calls 'draw' loop.
    // Let's implement a simple cut detector here using the global 'players' array if strictly managed,
    // or better, pass the detected landmarks to a tailored menu updater.

    // Actually, 'players' array handles the trail logic in 'update()'.
    // We just need to ensure 'update()' calls 'updateMenu()' and passes necessary info if state is 'idle'.

    // NOTE: In 'idle' state, we need at least one "PlayerState" to track the hand trail for the menu.
    // Let's ensure we have a temporary player state for menu interaction.
    if (players.length === 0) {
        players.push(new PlayerState(0, { x: 0, y: 0, width: canvas.width, height: canvas.height }));
    }

    players.forEach(player => {
        // We need to feed landmark data to player.
        // This happens in onHandsResults -> update -> but we need to ensure inputs reach here.
        // For now preventing logic duplication, let's assume 'player.gestureTrail' is populated.

        if (player.gestureTrail.length < 2) return;

        const p1 = player.gestureTrail[player.gestureTrail.length - 2];
        const p2 = player.gestureTrail[player.gestureTrail.length - 1];

        // Check cuts
        menuButtons.forEach(btn => {
            if (btn.checkCut(p1, p2)) {
                // Action triggered!
                // Add some visual effect?
                createExplosion(btn.x + btn.width / 2, btn.y + btn.height / 2, player);
                btn.action();
            }
        });
    });
}

function drawMenu() {
    // Draw Section Titles
    ctx.font = '20px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';

    // Helper to check selection for styling
    menuButtons.forEach(btn => {
        // Highlight logic
        if (btn.label === 'singlePlayer' && gameMode === 'single') btn.baseColor = '#4ECDC4';
        else if (btn.label === 'singlePlayer') btn.baseColor = '#333';

        if (btn.label === 'twoPlayers' && gameMode === 'multi') btn.baseColor = '#FF6B6B';
        else if (btn.label === 'twoPlayers') btn.baseColor = '#333';

        if (['1', '2', '3', '4'].includes(btn.label)) {
            if (parseInt(btn.label) === currentLevel) btn.baseColor = '#FFD700';
            else btn.baseColor = '#555';
        }

        if (btn.label === 'startGame') {
            btn.baseColor = '#FFFFFF';
            // Start button text color flip
        }

        btn.draw(ctx);

        // Custom text color for buttons if needed
        // (Handled effectively by draw method logic, but Start button needs black text if white bg)
        if (btn.label === 'startGame') {
            ctx.fillStyle = '#000000';
            ctx.fillText(t(btn.label), btn.x + btn.width / 2, btn.y + btn.height / 2);
        }
    });

    const col1X = canvas.width * 0.20;
    const col2X = canvas.width * 0.50;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(t('selectMode'), col1X, canvas.height * 0.65 - 40);
    ctx.fillText(t('selectLevel'), col2X, canvas.height * 0.65 - 40);

    // Draw cursor/trail for feedback
    players.forEach(p => {
        if (p.gestureTrail.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 5;
            ctx.moveTo(p.gestureTrail[0].x, p.gestureTrail[0].y);
            for (let i = 1; i < p.gestureTrail.length; i++) {
                ctx.lineTo(p.gestureTrail[i].x, p.gestureTrail[i].y);
            }
            ctx.stroke();
        }
    });
}

function startGame(level) {
    // Start Level
    console.log(`Starting Level ${level} in ${gameMode} mode`);
    currentLevel = parseInt(level);

    // Hide start screen (if we still had one, now it's all canvas)
    const startScreen = document.getElementById('startScreen');
    if (startScreen) startScreen.classList.add('hidden');

    // Show UI overlays
    document.getElementById('p1UI').style.display = 'flex';
    if (gameMode === 'multi') {
        document.getElementById('p2UI').style.display = 'flex';
    }

    // Setup camera if not already done
    if (!camera) {
        setupCamera(); // Await not needed here, initGame will wait for camera to be ready
    }

    // Initialize game
    initGame();
}

function update() {
    if (gameState === 'idle') {
        // Ensure menu is initialized
        if (menuButtons.length === 0) initMenu();
        updateMenu();

        // Update particles (explosions from buttons)
        players.forEach(p => {
            p.sparks.forEach(s => s.update());
            p.sparks = p.sparks.filter(s => !s.isDead());
        });

    } else if (gameState === 'playing') {
        // Update and render each player
        players.forEach(player => {
            // Update falling pieces
            player.fallingPieces = player.fallingPieces.filter(piece => {
                piece.update();
                return !piece.isOffScreen();
            });

            // Update sparks
            player.sparks = player.sparks.filter(spark => {
                spark.update();
                return !spark.isDead();
            });

            // Update bombs
            player.bombs.forEach(bomb => {
                bomb.update();

                // Check collision with shape edges
                if (player.shape) {
                    const collision = bomb.checkEdgeCollision(player.shape);
                    if (collision) {
                        bomb.bounce(collision);
                    }
                }

                // Check if bomb goes off-screen
                if (bomb.x < player.viewport.x || bomb.x > player.viewport.x + player.viewport.width ||
                    bomb.y < player.viewport.y || bomb.y > player.viewport.y + player.viewport.height) {
                    // Wrap around or remove
                    // For simplicity, just keep it (it will bounce back)
                }
            });
        });

        // Check win conditions periodically
        checkWinConditions();
    }
}

// ============================================================================
// End Level Logic
// ============================================================================
function endLevel() {
    gameState = 'finished_level';
    timerActive = false;
    if (gameTimer) clearInterval(gameTimer);

    console.log('[END LEVEL] Evaluating results...');

    if (gameMode === 'multi') {
        // Two-player mode: Calculate WINs
        const p1 = players[0];
        const p2 = players[1];

        // Calculate final percentages
        p1.finalPercent = p1.shape ? (p1.shape.getArea() / p1.initialArea) * 100 : 100;
        p2.finalPercent = p2.shape ? (p2.shape.getArea() / p2.initialArea) * 100 : 100;

        // Reset per-level wins
        p1.wins = 0;
        p2.wins = 0;

        // WIN Criterion 1: Closer to target percentage
        const p1Diff = Math.abs(p1.finalPercent - targetPercent);
        const p2Diff = Math.abs(p2.finalPercent - targetPercent);

        if (p1Diff < p2Diff) {
            p1.wins += 1;
            console.log('[WIN] P1 +1 (closer to target)');
        } else if (p2Diff < p1Diff) {
            p2.wins += 1;
            console.log('[WIN] P2 +1 (closer to target)');
        }
        // If equal, no one gets the WIN

        // WIN Criterion 2: More time remaining (completion time)
        // If both completed, whoever has lower completionTime wins
        // If one didn't complete, other gets WIN
        if (p1.completed && !p2.completed) {
            p1.wins += 1;
            console.log('[WIN] P1 +1 (completed, P2 did not)');
        } else if (p2.completed && !p1.completed) {
            p2.wins += 1;
            console.log('[WIN] P2 +1 (completed, P1 did not)');
        } else if (p1.completed && p2.completed) {
            // Both completed, check who was faster
            if (p1.completionTime < p2.completionTime) {
                p2.wins += 1; // Lower time = more time remaining = WIN
                console.log('[WIN] P2 +1 (more time remaining)');
            } else if (p2.completionTime < p1.completionTime) {
                p1.wins += 1;
                console.log('[WIN] P1 +1 (more time remaining)');
            }
        }

        // Update total WINs
        p1TotalWins += p1.wins;
        p2TotalWins += p2.wins;

        console.log(`[WINS] P1: +${p1.wins} (Total: ${p1TotalWins}), P2: +${p2.wins} (Total: ${p2TotalWins})`);

        // Update WIN displays immediately
        updateUI();

        // Show WIN message
        let message = `Level ${currentLevel} Complete!\\n`;
        message += `P1: ${p1.finalPercent.toFixed(1)}% (+${p1.wins} WIN)\\n`;
        message += `P2: ${p2.finalPercent.toFixed(1)}% (+${p2.wins} WIN)`;
        showMessage(message);

        if (audioCtrl) audioCtrl.playWin();

        // After level 4: Show final results
        if (currentLevel === 4) {
            setTimeout(() => {
                showFinalResults();
            }, 3000);
        } else {
            // Proceed to next level
            setTimeout(() => {
                currentLevel++;
                initGame();
            }, 3000);
        }

    } else {
        // Single-player mode
        const player = players[0];
        const currentArea = player.shape ? player.shape.getArea() : 0;
        const percent = player.initialArea > 0 ? (currentArea / player.initialArea) * 100 : 100;

        let success = false;
        let message = '';

        if (currentLevel === 4) {
            // Level 4: Must be within range
            if (percent >= minTargetPercent && percent <= maxTargetPercent) {
                success = true;
                message = t('gameComplete', { min: minTargetPercent, max: maxTargetPercent });
            } else {
                message = t('timeUp');
            }
        } else {
            // Other levels: Must reach target
            if (percent <= targetPercent) {
                success = true;
                const levelKey = `levelComplete${currentLevel}`;
                message = t(levelKey);
            } else {
                message = t('timeUp');
            }
        }

        if (success && audioCtrl) audioCtrl.playWin();
        if (!success && audioCtrl) audioCtrl.playExplosion(); // Fail sound

        showMessage(message);

        if (success) {
            if (currentLevel === 4) {
                // Game complete
                setTimeout(() => {
                    resetToStartScreen();
                }, 3000);
            } else {
                // Next level
                setTimeout(() => {
                    currentLevel++;
                    initGame();
                }, 3000);
            }
        } else {
            // Game over
            setTimeout(() => {
                resetToStartScreen();
            }, 3000);
        }
    }
}

// ============================================================================
// Final Results Screen (Two-Player Mode)
// ============================================================================
function showFinalResults() {
    let message = `${t('gameOver')}\\n\\n`;

    if (p1TotalWins > p2TotalWins) {
        message += t('player1Wins') + '\\n';
    } else if (p2TotalWins > p1TotalWins) {
        message += t('player2Wins') + '\\n';
    } else {
        message += t('draw') + '\\n';
    }

    message += `${t('finalScore')}: ${p1TotalWins} - ${p2TotalWins}`;

    showMessage(message);

    // Return to start screen after 5 seconds
    setTimeout(() => {
        resetToStartScreen();
    }, 5000);
}

// ============================================================================
// Helper Functions
// ============================================================================
function showMessage(text) {
    console.log('[MESSAGE]', text);
    const msgEl = document.getElementById('gameMessage');
    if (msgEl) {
        msgEl.innerText = text; // Use innerText to handle \n newlines
        msgEl.classList.remove('hidden');

        // Auto-hide after 2.5 seconds (slightly longer for reading)
        setTimeout(() => {
            msgEl.classList.add('hidden');
        }, 2500);
    }
}

function resetToStartScreen() {
    console.log('[RESET] Returning to start screen');
    gameState = 'idle';
    currentLevel = 1;
    p1TotalWins = 0;
    p2TotalWins = 0;
    players = [];
    timerActive = false;

    // Stop any active timer
    if (gameTimer) clearInterval(gameTimer);

    // Hide In-Game UI
    const p1UI = document.getElementById('p1UI');
    if (p1UI) p1UI.style.display = 'none'; // Check css if this should be hidden or just empty

    const p2UI = document.getElementById('p2UI');
    if (p2UI) p2UI.style.display = 'none';

    const timerBox = document.getElementById('timerBox');
    if (timerBox) timerBox.style.display = 'none';

    const splitLine = document.getElementById('splitLine');
    if (splitLine) splitLine.style.display = 'none';

    // Ensure message is hidden
    const msgEl = document.getElementById('gameMessage');
    if (msgEl) msgEl.classList.add('hidden');

    // Show start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) startScreen.classList.remove('hidden'); // Use remove('hidden') to show

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function createExplosion(x, y, player) {
    // Visual explosion effect only (does not end game)
    for (let i = 0; i < 20; i++) {
        player.sparks.push(new Spark(x, y));
    }
    if (audioCtrl) audioCtrl.playCut();
}

function triggerExplosion(x, y, player) {
    console.log('[EXPLOSION] Bomb exploded!');

    // Create explosion sparks
    for (let i = 0; i < 30; i++) {
        player.sparks.push(new Spark(x, y));
    }

    // Play explosion sound
    if (audioCtrl) audioCtrl.playExplosion();

    if (gameMode === 'multi') {
        // Two-player mode: Reset ONLY the player who hit the bomb
        console.log(`[BOMB] Player ${player.id + 1} hit bomb! Resetting shape...`);

        // Reset shape
        createShapeForPlayer(player);

        // Reset cutting state
        player.cuttingState = {
            isInside: false,
            entryPoint: null,
            currentPath: [],
            lastPosition: null
        };

        // Show warning message
        showMessage(t('bombExplosion')); // "Bomb exploded!"

    } else {
        // Single-player mode: Game Over
        gameState = 'lost';
        showMessage(t('bombExplosion'));

        setTimeout(() => {
            resetToStartScreen();
        }, 2000);
    }
}

function createShapeForPlayer(player) {
    const centerX = player.viewport.x + player.viewport.width / 2;
    const centerY = player.viewport.y + player.viewport.height / 2;
    const size = Math.min(player.viewport.width, player.viewport.height) * 0.6;

    switch (currentLevel) {
        case 1:
            player.shape = createLevel1Shape(centerX, centerY, size);
            break;
        case 2:
            player.shape = createStarPolygon(centerX, centerY, size / 2, size / 4);
            break;
        case 3:
            player.shape = createLevel3Shape(centerX, centerY, size);
            break;
        case 4:
            player.shape = createLevel4Shape(centerX, centerY, size / 2);
            break;
    }

    // Update initial area for percentage calculation
    // Note: If resetting, do we reset the initial area reference? 
    // Usually yes, if we want them to start over completely.
    player.initialArea = player.shape.getArea();
}

// ============================================================================
// Audio Controller - Synthesized Sounds (Web Audio API)
// ============================================================================
class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = false;
        this.enabled = true;
    }

    init() {
        if (!this.initialized) {
            this.ctx.resume().then(() => {
                this.initialized = true;
                console.log('[AUDIO] Context resumed');
            });
        }
    }

    // Helper: Create oscillator tone
    playTone(freq, type, duration, startTime = 0, vol = 0.1) {
        if (!this.enabled) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    // Helper: Create noise buffer (for explosions)
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Sound: Cut (High pitch swipe)
    playCut() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Sound: Blocked/Error (Low thud)
    playBlocked() {
        this.playTone(150, 'square', 0.15, 0, 0.1);
    }

    // Sound: Explosion (Noise burst)
    playExplosion() {
        if (!this.enabled) return;

        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    // Sound: Level Complete (Victory jingle)
    playWin() {
        // C Major Arpeggio: C4, E4, G4, C5
        this.playTone(261.63, 'sine', 0.1, 0.0);
        this.playTone(329.63, 'sine', 0.1, 0.1);
        this.playTone(392.00, 'sine', 0.1, 0.2);
        this.playTone(523.25, 'sine', 0.4, 0.3, 0.2);
    }
}

let audioCtrl;

// Initialize audio system
function initAudio() {
    audioCtrl = new AudioController();

    // Add interaction listener to resume context
    document.body.addEventListener('click', () => {
        audioCtrl.init();
    }, { once: true });

    // Map legacy functions to new system
    collisionSound = () => audioCtrl.playBlocked();
    explosionSound = () => audioCtrl.playExplosion();

    console.log('[AUDIO] AudioController initialized');
}


// ============================================================================
// Part 6: Game Loop, Rendering, and Startup
// ============================================================================

// ============================================================================
// Render Player Viewport
// ============================================================================
function renderPlayerViewport(player) {
    // Clip rendering to player's viewport
    ctx.save();
    ctx.beginPath();
    ctx.rect(player.viewport.x, player.viewport.y, player.viewport.width, player.viewport.height);
    ctx.clip();

    // Draw shape
    if (player.shape) {
        const shapeColor = player.id === 0 ? '#4ECDC4' : '#A78BFA'; // P1 cyan, P2 purple
        player.shape.draw(shapeColor, 4, '#000000');
    }

    // Draw cutting path preview
    if (player.cuttingState.currentPath.length > 1) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(player.cuttingState.currentPath[0].x, player.cuttingState.currentPath[0].y);
        for (let i = 1; i < player.cuttingState.currentPath.length; i++) {
            ctx.lineTo(player.cuttingState.currentPath[i].x, player.cuttingState.currentPath[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw entry point marker
        if (player.cuttingState.entryPoint) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('A', player.cuttingState.entryPoint.x - 8, player.cuttingState.entryPoint.y + 8);
        }
    }

    // Draw falling pieces
    player.fallingPieces.forEach(piece => piece.draw());

    // Draw sparks
    player.sparks.forEach(spark => spark.draw());

    // Draw bombs
    player.bombs.forEach(bomb => bomb.draw());

    // Draw FINISH overlay if completed
    if (player.completed) {
        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(player.viewport.x, player.viewport.y, player.viewport.width, player.viewport.height);

        // FINISH text
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText("FINISH", player.viewport.x + player.viewport.width / 2, player.viewport.y + player.viewport.height / 2);
        ctx.restore();
    }

    ctx.restore();
}

// ============================================================================
// Main Draw Function
// ============================================================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'idle') {
        drawMenu();
        // Draw particles
        players.forEach(p => {
            p.sparks.forEach(s => s.draw());
        });
    } else {
        // Draw split line if multi
        if (gameMode === 'multi') {
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 0);
            ctx.lineTo(canvas.width / 2, canvas.height);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw players
        players.forEach(p => renderPlayerViewport(p));
    }
}

// ============================================================================
// Game Loop - Main Update and Render
// ============================================================================
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================================================
// Check Win Conditions
// ============================================================================
function checkWinConditions() {
    if (gameMode === 'multi') {
        // Two-player: check if both completed or timer expired
        // Timer is handled separately in startTimer()

        // Check if individual player reached target
        players.forEach(player => {
            if (!player.completed && player.shape && player.initialArea > 0) {
                const currentArea = player.shape.getArea();
                const percent = (currentArea / player.initialArea) * 100;

                if (percent <= targetPercent) {
                    player.completed = true;
                    player.completionTime = 60 - timeRemaining; // Time taken
                    console.log(`[PLAYER ${player.id + 1}] Completed! Time: ${player.completionTime}s, Percent: ${percent.toFixed(1)}%`);
                }
            }
        });

        // If both completed, end level immediately
        if (players.every(p => p.completed)) {
            console.log('[TWO-PLAYER] Both players completed!');
            endLevel();
        }

    } else {
        // Single-player: check target reached
        const player = players[0];
        if (!player.shape || player.initialArea === 0) return;

        const currentArea = player.shape.getArea();
        const percent = (currentArea / player.initialArea) * 100;

        let shouldEnd = false;

        if (currentLevel === 4) {
            // Level 4: Within range
            if (percent >= minTargetPercent && percent <= maxTargetPercent) {
                shouldEnd = true;
            }
        } else {
            // Other levels: Below target
            if (percent <= targetPercent) {
                shouldEnd = true;
            }
        }

        if (shouldEnd) {
            player.completed = true;
            endLevel();
        }

        // Check if area too small
        if (percent < 1) {
            gameState = 'lost';
            showMessage(t('areaTooSmall', { percent: percent.toFixed(1) }));
            setTimeout(() => resetToStartScreen(), 2000);
        }
    }
}

// ============================================================================
// Camera Setup
// ============================================================================
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Use back camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;
        await video.play();

        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 1280,
            height: 720
        });

        await camera.start();
        console.log('[CAMERA] Started successfully');
    } catch (error) {
        console.error('[CAMERA ERROR]', error);
        showMessage(t('cameraError'));
    }
}

// ============================================================================
// Event Handlers for UI Buttons
// ============================================================================

// Mode selection
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        gameMode = e.target.dataset.mode;
        console.log('[MODE] Selected:', gameMode);

        // Update UI selection
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
    });
});

// Level selection
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedLevel = parseInt(e.target.dataset.level);
        currentLevel = selectedLevel;
        console.log('[LEVEL] Selected level:', currentLevel);

        // Highlight selected button
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
    });
});

// Permission Button Logic
document.getElementById('permissionBtn')?.addEventListener('click', async () => {
    console.log('[PERMISSION] User clicked start...');

    // Hide overlay
    document.getElementById('permissionOverlay').style.display = 'none';

    // Initialize Audio (requires interaction)
    initAudio();
    if (audioCtrl) audioCtrl.init();

    // Initialize Camera
    if (!camera) {
        await setupCamera();
    }
});

// Start game button (legacy or internal use)
document.getElementById('startButton')?.addEventListener('click', async () => {
    console.log('[START] Starting game...');

    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';

    // Initialize game
    initGame();
});

// Language toggle
document.getElementById('langSwitch')?.addEventListener('click', () => {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateLanguage(currentLanguage);
    console.log('[LANGUAGE] Switched to:', currentLanguage);
});

// ============================================================================
// Startup Initialization
// ============================================================================
console.log('[STARTUP] Initializing game systems...');

// Setup MediaPipe
console.log('[1] Setting up MediaPipe...');
setupMediaPipe();
console.log('[MEDIAPIPE] Setup complete');

// Initialize audio
console.log('[2] Initializing audio...');
initAudio();
console.log('[AUDIO] Initialized');

// Start game loop
console.log('[3] Starting game loop...');
gameLoop();
console.log('[GAME LOOP] Started');

console.log('[STARTUP] All systems initialized! Ready to play.');


