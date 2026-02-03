// ============================================================================
// ?��?變�??�常??
// ============================================================================
const translations = {
    zh: {
        gameTitle: "?�割?�戲 - Percentage Cut",
        gameInstructions: "?�單?��??��?案�?將面積�?少到?��??��?比�?",
        level: "?�卡",
        target: "?��?",
        currentArea: "?��??��?",
        timeRemaining: "?��??��?",
        selectLevel: "?��??�卡�?,
        level1: "?�卡 1",
        level2: "?�卡 2",
        level3: "?�卡 3",
        level4: "?�卡 4",
        startGame: "?��??�戲",
        hand1: "??1",
        placeHand: "請�?一?��??�在?�頭??,
        redLineBlock: "?�� 紅�??��??�割�?,
        bombExplosion: "?�� ?��??�炸！�??�失?��?",
        timeUp: "???��??��??�戲失�?�?,
        areaTooSmall: "???��?太�?！�???{percent}%！�??�失?��?",
        levelComplete1: "?? 第�??��??��??�入五�??��???..",
        levelComplete2: "?? 第�??��??��??�入?��??��???..",
        levelComplete3: "?? 第�??��??��??�入?�終�??��?計�??�戰�?..",
        gameComplete: "?? 完�?！面積在 {min}%-{max}% 範�??��??��??�?��??��?",
        cameraError: "?��? ?��?訪�??��??��?請�?許�???
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
        redLineBlock: "?�� Red line blocked!",
        bombExplosion: "?�� Bomb exploded! Game Over!",
        timeUp: "??Time's up! Game Over!",
        areaTooSmall: "??Area too small! Below {percent}%! Game Over!",
        levelComplete1: "?? Level 1 Complete! Next: Star Shape...",
        levelComplete2: "?? Level 2 Complete! Next: Cross Shape...",
        levelComplete3: "?? Level 3 Complete! Next: Final Challenge...",
        gameComplete: "?? Perfect! Area between {min}%-{max}%! All Levels Cleared!",
        cameraError: "?��? Camera access denied. Please allow permission."
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

    // Update specific button text if needed (handled by data-i18n above)
}
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
let minTargetPercent = 10; // ?�卡4?��?小目�?
let maxTargetPercent = 20; // ?�卡4?��?大目�?

// 計�??�相?��???
let gameTimer = null; // 計�??�ID
let timeRemaining = 60; // 默�? 60�?(?�人), 30�?(?�人?�卡4)
let timerActive = false; // 計�??�是?��???

// 碰�??��?
let collisionSound = null;
let explosionSound = null;

// ============================================================================
// PlayerState 類別 - 管�??�個玩家�??�??
// ============================================================================
class PlayerState {
    constructor(id, viewport) {
        this.id = id; // 0 or 1
        this.viewport = viewport; // {x, y, width, height}

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

        // ?�人模�?統�?
        this.wins = 0;
        this.completed = false; // ?�否完�??��??�卡
        this.completionTime = 0; // ?��??��?
        this.finalPercent = 100; // ?�終百?��?
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
    }
}

// ============================================================================
// ?��??�畫布尺�?
// ============================================================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // update player viewports
    if (players.length > 0) {
        if (gameMode === 'multi') {
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
// Polygon 類別 - 表示多�?�?
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

    // 計�?多�?形面積�?使用?�帶?��?�?
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

    // 繪製多�?�?
    draw(color = '#4ECDC4', lineWidth = 4, strokeColor = '#000000') {
        if (this.vertices.length < 3) return;

        // 填�?
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // 繪製?�緣（�?條�??�能?��??��??��?
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

    // 檢查點是?�在多�?形內（�?線�?射�?法�?
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

    // 檢查點是?�碰?�到任�??�緣
    checkPointEdgeCollision(point, threshold = 20) {
        const n = this.vertices.length;
        const collisions = [];

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = this.vertices[i];
            const v2 = this.vertices[j];

            // 計�?點到線段?��???
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

    // 檢查?�割線是?�穿?��??��??��??�緣（�?線�?
    checkCutThroughUncuttableEdge(lineStart, lineEnd) {
        const n = this.vertices.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;

            // 如�??��??��??��???
            if (!this.edgeProperties[i].cuttable) {
                const v1 = this.vertices[i];
                const v2 = this.vertices[j];

                // 檢查?�割線是?��??��?紅�??�交
                const intersection = getLineIntersection(lineStart, lineEnd, v1, v2);

                if (intersection) {
                    console.log('?�� ?�割線穿?��?線�?', {
                        edgeIndex: i,
                        intersection: intersection
                    });
                    return true; // ?�到交�?，表示穿?��?�?
                }
            }
        }

        return false; // 沒�?穿�?任�?紅�?
    }

    // ?�到從�??��??�內?��?穿�??�緣?�交�?
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

    // ?��?段�??��??�形
    slice(lineStart, lineEnd) {
        const intersections = [];
        const n = this.vertices.length;

        // ?�到?�?��?多�?形�??�交?��?
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

        // ?�要恰好兩?�交點�??��???
        if (intersections.length !== 2) return null;

        const [int1, int2] = intersections;
        const poly1 = [];
        const poly2 = [];

        // 構建第�??��??�形
        let idx = (int1.index + 1) % n;
        poly1.push({ x: int1.point.x, y: int1.point.y }); // 深拷貝交�?

        let safetyCounter = 0;
        while (idx !== (int2.index + 1) % n) {
            // 深拷貝�?點防止�??�共�?
            poly1.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });
            idx = (idx + 1) % n;

            safetyCounter++;
            if (safetyCounter > n + 10) {
                console.error("?��?循環檢測: Polygon 1 構建失�?");
                return null;
            }
        }
        poly1.push({ x: int2.point.x, y: int2.point.y }); // 深拷貝交�?

        // 構建第�??��??�形
        idx = (int2.index + 1) % n;
        poly2.push({ x: int2.point.x, y: int2.point.y }); // 深拷貝交�?

        safetyCounter = 0;
        while (idx !== (int1.index + 1) % n) {
            // 深拷貝�?點防止�??�共�?
            poly2.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });
            idx = (idx + 1) % n;

            safetyCounter++;
            if (safetyCounter > n + 10) {
                console.error("?��?循環檢測: Polygon 2 構建失�?");
                return null;
            }
        }
        poly2.push({ x: int1.point.x, y: int1.point.y }); // 深拷貝交�?

        return [new Polygon(poly1), new Polygon(poly2)];
    }
}

// ============================================================================
// ?�學工具?�數
// ============================================================================

// ============================================================================
// ?�花粒�?類別
// ============================================================================
class Spark {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // ?��??�度（�??�周?�炸�?
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.gravity = 0.3;
        this.lifetime = 30 + Math.floor(Math.random() * 20); // 30-50 幀
        this.age = 0;
        this.size = 3 + Math.random() * 3; // 3-6px

        // 顏色：�??�到黃色
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
// ?�落碎�?類別
// ============================================================================
class FallingPiece {
    constructor(polygon) {
        this.polygon = polygon;
        this.velocity = 0;
        this.gravity = 0.5;
        this.opacity = 1;
        this.rotation = (Math.random() - 0.5) * 0.05; // 輕微?��?
    }

    update() {
        this.velocity += this.gravity;
        // 移�??�?��?點�?�?
        this.polygon.vertices.forEach(v => {
            v.y += this.velocity;
        });
        this.opacity -= 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        this.polygon.draw('#FFD700', 4, '#000000'); // 黃色碎�?，�??��?�?
        ctx.restore();
    }

    isOffScreen() {
        return this.polygon.vertices.every(v => v.y > canvas.height + 100) || this.opacity <= 0;
    }
}

// ============================================================================
// ?��?類別
// ============================================================================
class Bomb {
    constructor(x, y, vx, vy, speed = 2) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.speed = speed;
        this.radius = 12;
        this.fuseTime = 0; // ?�於?�畫?��?
    }

    update() {
        // ?�接移�??��?
        this.x += this.vx * this.speed;
        this.y += this.vy * this.speed;

        // ?�新引信?�畫
        this.fuseTime += 0.1;
    }

    checkEdgeCollision(polygon) {
        if (!polygon) return null;

        const n = polygon.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = polygon.vertices[i];
            const v2 = polygon.vertices[j];

            // 計�??��??��?�??距離
            const distance = pointToSegmentDistance({ x: this.x, y: this.y }, v1, v2);

            if (distance < this.radius + 2) {
                // 碰�?！�?算�?�?
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

        // 計�??�緣?��?
        const edgeVx = v2.x - v1.x;
        const edgeVy = v2.y - v1.y;
        const edgeLength = Math.sqrt(edgeVx * edgeVx + edgeVy * edgeVy);

        // 標�??��?�????
        const edgeNormX = edgeVx / edgeLength;
        const edgeNormY = edgeVy / edgeLength;

        // 計�?法�??��??�直?��?�??
        const normalX = -edgeNormY;
        const normalY = edgeNormX;

        // 計�??�度?��??��??��??��?�?
        const dotProduct = this.vx * normalX + this.vy * normalY;

        // ?��??��??��?: V' = V - 2(V·N)N
        this.vx = this.vx - 2 * dotProduct * normalX;
        this.vy = this.vy - 2 * dotProduct * normalY;

        // 微調位置，防止卡?��?�?
        this.x += normalX * 3;
        this.y += normalY * 3;
    }

    draw() {
        // 繪製?��??��?（深?�色?��?�?
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

        // 繪製?��?高�?
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        // 繪製引信（�??��??��?
        const fuseFlicker = Math.sin(this.fuseTime * 10) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 140, 0, ${0.5 + fuseFlicker * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.radius - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // ?�花?��?
        if (fuseFlicker > 0.7) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.radius - 3, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 檢查?��??�否?��??��??�交
    checkCutLineCollision(lineStart, lineEnd) {
        // 計�?點到線段?��???
        const distance = pointToSegmentDistance({ x: this.x, y: this.y }, lineStart, lineEnd);
        const isCollision = distance < this.radius + 15; // 增�?容差使碰?�更容�?檢測

        if (isCollision) {
            console.log(`?�� ?��?碰�?！�??? ${distance.toFixed(2)}, ?��?位置: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
        }

        return isCollision;
    }
}


// ============================================================================
// ?�學工具?�數
// ============================================================================

// 計�??��?線段?�交�?
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

// 計�?點到線段?��??��???
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
        // 線段?�?�為�?
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // 計�??�影?�數 t
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // ?�制??[0, 1]

    // ?�近�?
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
}

// ============================================================================
// MediaPipe Hands 設置
// ============================================================================
function setupMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,  // ?��??�人模�? (?�人模�??��?使用第�??��?)
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);
}

// MediaPipe 結�??�調
function onHandsResults(results) {
    // 繪製?�?�檢測到?��??�追蹤�?
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // 顯示調試信息
        // const debugText = `檢測??${results.multiHandLandmarks.length} ?��?`;
        // ctx.fillStyle = '#FFFFFF';
        // ctx.font = 'bold 20px Arial';
        // ctx.fillText(debugText, 20, canvas.height - 20);

        // ?��?每�??��?
        results.multiHandLandmarks.forEach((handLandmarks, index) => {
            const indexTip = handLandmarks[8]; // 食�?尖端

            // 轉�??�通用?��??��? (0-1 -> px)
            // 注�?：MediaPipe 輸出?�常?�鏡?��?，這裡 (1 - x)
            const x = (1 - indexTip.x) * canvas.width;
            const y = indexTip.y * canvas.height;

            // ?�斷?�屬?�哪?�玩�?
            let targetPlayer = null;
            if (gameMode === 'multi') {
                // 簡單?��?: 屏�?左�??�是 P1, ?��??�是 P2
                // 但是 handLandmarks.x ??normalized coordinates. 
                // MediaPipe coordinates: x=0 is left of camera view (right of mirrored display)
                // ?�裡?�們用計�?後�? canvas x
                if (x < canvas.width / 2) {
                    targetPlayer = players[0];
                } else {
                    targetPlayer = players[1];
                }
            } else {
                targetPlayer = players[0];
            }

            if (targetPlayer && !targetPlayer.completed) {
                // 繪製?��? (Visual only)
                const color = targetPlayer.id === 0 ? '#FF6B6B' : '#4ECDC4'; // P1 �? P2 ??

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, Math.PI * 2);
                ctx.fill();

                // ?��?輸入?�輯 (?��?給特定玩�?
                handlePlayerInput({ x, y }, targetPlayer);
            }
        });
    }
}

function handlePlayerInput(point, player) {
    if (gameState !== 'playing') return;

    // 檢查?�緣穿�?
    checkEdgeCrossing(point, player);

    // 檢查紅�?碰�?
    if (player.shape) { // check redLineCollisionCooldown? keeping it simple for now or move cooldown to player
        const collisions = player.shape.checkPointEdgeCollision(point, 25);
        const redLineCollision = collisions.find(c => !c.edgeProperty.cuttable);

        if (redLineCollision) {
            // 簡單?��?：�??�放?��?，�??�?��? cooldown (?��???player)
            if (collisionSound) collisionSound();
        }
    }

    // 檢查?�部?�否碰到?��?
    if (player.bombs.length > 0) {
        for (let bomb of player.bombs) {
            const distance = Math.sqrt((point.x - bomb.x) ** 2 + (point.y - bomb.y) ** 2);
            if (distance < bomb.radius + 25) {
                triggerExplosion(bomb.x, bomb.y, player);
                return;
            }
        }
    }
}

// 檢測滑�??�勢 (Deprecated / Removed for simplicity in this refactor unless needed)
function detectSwipe() { }

// ============================================================================
// ?�戲?�輯
// ============================================================================

// ?�建五�???
function createStarPolygon(centerX, centerY, outerRadius, innerRadius) {
    const vertices = [];
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2; // 從�??��?�?
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    // ?�建?�緣屬性�??��?上傳?�新?��?，�?記�?線�?
    // 五�??��?10?��?點�?編�?0-9（�??�部?��??��?
    // ?�緣 i ??��?��? i ?��?�?i+1
    // ?��??��??��?紅�?覆�??�側?��?條�?：�?�?1, 2, 3, 4, 5
    const edgeProperties = vertices.map((_, i) => {
        // 紅�??�緣�?(?��?), 2(?�內), 3(?��???, 4(?��?), 5(底部??
        const isRedLine = (i === 1 || i === 2 || i === 3 || i === 4 || i === 5);
        return {
            color: isRedLine ? '#FF0000' : '#000000',
            cuttable: !isRedLine
        };
    });

    return new Polygon(vertices, edgeProperties);
}

// ?�建?�卡 3 ?��?字架形�? (v2.4 - 簡單空�??��?)
function createLevel3Shape(centerX, centerY, size) {
    const scale = size / 400; // ?��?尺寸 400
    const thickness = 40 * scale; // ?��??��??�度
    const armLength = 200 * scale; // ?�長

    // 空�??��??��?輪�?（�??��?�?
    const outerVertices = [
        // 上�? - 從左上�??��??��???
        { x: centerX - thickness, y: centerY - armLength },
        { x: centerX + thickness, y: centerY - armLength },
        { x: centerX + thickness, y: centerY - thickness },

        // ?��?
        { x: centerX + armLength, y: centerY - thickness },
        { x: centerX + armLength, y: centerY + thickness },
        { x: centerX + thickness, y: centerY + thickness },

        // 下�?
        { x: centerX + thickness, y: centerY + armLength },
        { x: centerX - thickness, y: centerY + armLength },
        { x: centerX - thickness, y: centerY + thickness },

        // 左�?
        { x: centerX - armLength, y: centerY + thickness },
        { x: centerX - armLength, y: centerY - thickness },
        { x: centerX - thickness, y: centerY - thickness }
    ];

    // ?�?��??�是黑色，無紅�?保護?�
    const edgeProperties = outerVertices.map(() => ({
        color: '#000000',
        cuttable: true
    }));

    console.log('???�卡3形�?v2.4：空心�?字�???, outerVertices.length, ' ?��?�?);
    return new Polygon(outerVertices, edgeProperties);
}

// ?�建?�卡 4 ?��?�?(v2.6)
function createCircleShape(centerX, centerY, radius, segments = 64) {
    const vertices = [];

    // ?��??�形?��?
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    // ?�?��??�是黑色，�??�可?�割
    const edgeProperties = vertices.map(() => ({
        color: '#000000',
        cuttable: true
    }));

    console.log('???�卡4形�?v2.6：�?形�???, vertices.length, '?��?�?);
    return new Polygon(vertices, edgeProperties);
}


// ?�建?��?
function initAudio() {
    // 使用 Web Audio API ?�建簡單?�碰?�音??
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    collisionSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 400; // "???��??��?
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };

    // ?�炸?��? "BOOM"
    explosionSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();

        oscillator.connect(gainNode);
        oscillator2.connect(gainNode2);
        gainNode.connect(audioContext.destination);
        gainNode2.connect(audioContext.destination);

        // 低頻?�炸??
        oscillator.frequency.value = 50;
        oscillator.type = 'sawtooth';

        // 高頻?�炸??
        oscillator2.frequency.value = 150;
        oscillator2.type = 'square';

        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.3);
    };
}

// 顯示?�戲消息
function showMessage(message, duration = 3000) {
    // ?�畫布中央顯示�???
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // ?��?多�??�本
    const lines = message.split('\n');
    const lineHeight = 60;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    ctx.restore();
}


// ?��??��???
// ?��??�數記�?
let p1TotalWins = 0;
let p2TotalWins = 0;

function initGame() {
    console.log(`?�� initGame called - Level: ${currentLevel}, Mode: ${gameMode}`);

    // 如�??�第一?��??�置總�?
    if (currentLevel === 1) {
        p1TotalWins = 0;
        p2TotalWins = 0;
    }

    // 設置?�卡?�數
    if (gameMode === 'multi') {
        timeRemaining = 60; // ?�人模�?每�? 60 �?
        targetPercent = 10; // 默�??��?
        // ?��??�卡微調?��?? ?��?統�?
        if (currentLevel === 4) {
            minTargetPercent = 10;
            maxTargetPercent = 20;
            targetPercent = 15;
        }
    } else {
        // ?�人模�??��??�輯
        if (currentLevel === 4) {
            minTargetPercent = 10;
            maxTargetPercent = 20;
            targetPercent = 15;
            timeRemaining = 30;
        } else {
            targetPercent = 10;
            minTargetPercent = 10;
            maxTargetPercent = 10;
            timeRemaining = 0; // ?��???
        }
    }

    // ?��??�玩�?
    players = [];
    if (gameMode === 'multi') {
        const halfWidth = canvas.width / 2;
        players.push(new PlayerState(0, { x: 0, y: 0, width: halfWidth, height: canvas.height }));
        players.push(new PlayerState(1, { x: halfWidth, y: 0, width: halfWidth, height: canvas.height }));

        // 顯示?��?線�??�家信息
        const splitLine = document.querySelector('.split-screen-line');
        if (splitLine) splitLine.style.display = 'block';

        document.querySelectorAll('.player-info').forEach(el => el.style.display = 'block');
    } else {
        players.push(new PlayerState(0, { x: 0, y: 0, width: canvas.width, height: canvas.height }));

        // ?��??��?�?
        const splitLine = document.querySelector('.split-screen-line');
        if (splitLine) splitLine.style.display = 'none';
        document.querySelectorAll('.player-info').forEach(el => el.style.display = 'none');
    }

    // ?��??�玩家�??��?形�??�件
    players.forEach(player => {
        setupPlayerLevel(player);
    });

    gameState = 'playing';

    // ?��?計�???(?�人模�??�是?�人?�卡4)
    stopTimer();
    if (gameMode === 'multi' || currentLevel === 4) {
        timerActive = true;
        startTimer();
        document.getElementById('timerBox').style.display = 'block';
    } else {
        timerActive = false;
        document.getElementById('timerBox').style.display = 'none';
    }

    updateUI();
}

function setupPlayerLevel(player) {
    player.reset();

    // 計�??��??�玩家�????中�?
    const cx = player.viewport.x + player.viewport.width / 2;
    const cy = player.viewport.y + player.viewport.height / 2;

    // 調整大�?：�?人模式�?稍微縮�?一點以?��?
    const sizeFactor = gameMode === 'multi' ? 0.45 : 0.55;
    const size = Math.min(canvas.width, canvas.height) * sizeFactor;

    if (currentLevel === 1) {
        player.shape = new Polygon([
            { x: cx - size / 2, y: cy - size / 2 },
            { x: cx + size / 2, y: cy - size / 2 },
            { x: cx + size / 2, y: cy + size / 2 },
            { x: cx - size / 2, y: cy + size / 2 }
        ]);
    } else if (currentLevel === 2) {
        const outerRadius = size / 2;
        const innerRadius = outerRadius * 0.38;
        player.shape = createStarPolygon(cx, cy, outerRadius, innerRadius);
    } else if (currentLevel === 3) {
        player.shape = createLevel3Shape(cx, cy, size);
    } else if (currentLevel === 4) {
        const radius = size / 2;
        player.shape = createCircleShape(cx, cy, radius, 64);
    }

    player.initialArea = player.shape.getArea();
    console.log(`?�� Player ${player.id} Init Level ${currentLevel}, Area: ${player.initialArea}`);

    // ?��??��?
    if (currentLevel === 3) {
        spawnBomb(player);
    } else if (currentLevel === 4) {
        spawnBombForLevel4(player, 1.5);
        spawnBombForLevel4(player, 3.5);
    }
}

// ?��??��? (Updated for PlayerState)
function spawnBomb(player) {
    if (!player.shape) return;

    let centerX = 0, centerY = 0;
    player.shape.vertices.forEach(v => {
        centerX += v.x;
        centerY += v.y;
    });
    centerX /= player.shape.vertices.length;
    centerY /= player.shape.vertices.length;

    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    let speed = 1.5;
    if (currentLevel === 2) speed = 2.0;
    if (currentLevel === 3) speed = 2.5;

    player.bombs.push(new Bomb(centerX, centerY, vx, vy, speed));
}


// 顯�??��? player ?�件?��??�函??
function spawnBombForLevel4(player, speed) {
    if (!player.shape) return;

    // 計�?形�??�中心�?
    let centerX = 0, centerY = 0;
    player.shape.vertices.forEach(v => {
        centerX += v.x;
        centerY += v.y;
    });
    centerX /= player.shape.vertices.length;
    centerY /= player.shape.vertices.length;

    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    player.bombs.push(new Bomb(centerX, centerY, vx, vy, speed));
}

// ?��?計�???
function startTimer() {
    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        if (!timerActive || gameState !== 'playing') {
            stopTimer();
            return;
        }

        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            stopTimer();
            // ?��???
            if (gameMode === 'multi') {
                endLevel();
            } else {
                // ?�人模�?：�??�失??
                gameState = 'lost';
                showMessage(t('timeUp'));

                setTimeout(() => {
                    initGame(); // ?�新?��??�卡4 (?�當?��???
                }, 3000);
            }
        }
    }, 1000); // 每�??�新
}

// ?�止計�???
function stopTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    timerActive = false;
}

// ?�新計�??�顯�?
function updateTimerDisplay() {
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) {
        timerEl.textContent = timeRemaining;

        // ?��?少於10秒�?變�???
        if (timeRemaining <= 10) {
            timerEl.style.color = '#EF4444';
        } else {
            timerEl.style.color = '#FFFFFF';
        }
    }
}

// 檢查?�緣穿�?並執行�???(Refactored)
function checkEdgeCrossing(point, player) {
    if (!player.shape) return;

    const wasInside = player.cuttingState.isInside;
    const isInside = player.shape.isPointInside(point);

    if (!wasInside && isInside) {
        // ?�入?�形
        let entryPoint = null;
        if (player.cuttingState.lastPosition) {
            entryPoint = player.shape.findEdgeIntersection(player.cuttingState.lastPosition, point);
        }
        if (!entryPoint) entryPoint = { x: point.x, y: point.y };

        player.cuttingState.entryPoint = entryPoint;
        player.cuttingState.isInside = true;
        player.cuttingState.currentPath = [entryPoint];

    } else if (wasInside && !isInside) {
        // ?��??�形
        if (player.cuttingState.entryPoint) {
            let exitPoint = null;
            if (player.cuttingState.lastPosition) {
                exitPoint = player.shape.findEdgeIntersection(player.cuttingState.lastPosition, point);
            }
            if (!exitPoint && player.cuttingState.currentPath.length > 0) {
                exitPoint = player.cuttingState.currentPath[player.cuttingState.currentPath.length - 1];
            }

            if (exitPoint) {
                performEdgeBasedCut(player.cuttingState.entryPoint, exitPoint, player);
            }
        }
        player.cuttingState.isInside = false;
        player.cuttingState.entryPoint = null;
        player.cuttingState.currentPath = [];

    } else if (isInside && player.cuttingState.entryPoint) {
        // ?�在?�形??
        player.cuttingState.currentPath.push({ x: point.x, y: point.y });
        if (player.cuttingState.currentPath.length > 100) {
            player.cuttingState.currentPath.shift();
        }
    }
    player.cuttingState.lastPosition = { x: point.x, y: point.y };
}

// ?��??�於?�緣?��???(Refactored)
function performEdgeBasedCut(entryPoint, exitPoint, player) {
    if (!player.shape) return;

    // 檢查紅�?
    if (player.shape.checkCutThroughUncuttableEdge(entryPoint, exitPoint)) {
        // showMessage(t('redLineBlock')); // Only for single player or handle specific UI?
        // simple toast or sound
        if (collisionSound) collisionSound();
        return;
    }

    const result = player.shape.slice(entryPoint, exitPoint);
    if (!result) return;

    const [poly1, poly2] = result;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    let keepPoly, discardPoly;
    if (area1 < area2) {
        keepPoly = poly1;
        discardPoly = poly2;
    } else {
        keepPoly = poly2;
        discardPoly = poly1;
    }

    // ?��??��?跟隨?�落
    player.bombs = player.bombs.filter(bomb => {
        const bombPos = { x: bomb.x, y: bomb.y };
        return !discardPoly.isPointInside(bombPos);
    });

    player.shape = keepPoly;
    player.fallingPieces.push(new FallingPiece(discardPoly));

    updateUI(player);
    checkWinCondition(player);
}

// 觸發?�炸 (Refactored)
function triggerExplosion(x, y, player) {
    if (explosionSound) explosionSound();

    for (let i = 0; i < 50; i++) {
        player.sparks.push(new Spark(x, y));
    }

    // 該玩家失??(?�扣?? ?�人模�?規�?: "?�多�?2 WIN")
    // ?�裡?�們�?設�???= 失�??��?，WIN = 0
    // ?�者�?置單�?

    // 如�??�單人模式�??�新?��?
    // 如�??��?人模式�?該玩家�??�無法繼�?
    // 簡單?��?：�?置該?�家?��???shape

    setTimeout(() => {
        setupPlayerLevel(player); // 3秒�??��?
        updateUI(player);
    }, 2000);
}

// 檢查?�利條件 (Refactored)
function checkWinCondition(player) {
    if (!player.shape || player.completed) return;

    const currentPercent = (player.shape.getArea() / player.initialArea) * 100;

    // ?�人模�??��? (?��??��?)
    // ?�裡?��?�?finalPercent，�?�???�利條件?��??��??��?比�?
    player.finalPercent = currentPercent;

    if (currentPercent <= targetPercent) {
        // ?�到?��?�?
        player.completed = true;
        player.completionTime = timeRemaining;

        // ?�放?��??��?/?�示
        // ?�人模�?：�?待另一人�??��???
        if (gameMode === 'multi') {
            // Check if all players completed
            if (players.every(p => p.completed)) {
                endLevel();
            }
        } else {
            // ?�人模�??��??�輯
            if (currentLevel < 4) {
                gameState = 'won';
                currentLevel++;
                // showMessage(t('levelComplete' + (currentLevel-1))); 
                // Using generic win message for now or restore specific level messages if possible, 
                // but let's keep it simple and safe.
                console.log("Level Complete");

                setTimeout(() => {
                    initGame();
                }, 2000);
            } else {
                gameState = 'won'; // ?�通�?
                showMessage(t('gameComplete', { min: 10, max: 20 }));
            }
        }
    }
}


// ?�卡結�? (?�人模�?)
function endLevel() {
    stopTimer();
    gameState = 'finished_level'; // ?��??�新

    // 比�? WINs
    // 規�?1: ?��??��?比�??��??��? (差值�?小�?且�???<= targetPercent? ?�者是?��?比�?誰�?�?)
    // 規�?�? "?�玩家剩餘�??��?比�??��??��??��?比�?一?��??��?1 WIN"
    // 規�?2: "?�玩家�??��?多�??��??��?1 WIN" 

    let p1 = players[0];
    let p2 = players[1];

    // P1 vs P2
    // ?��?: 10% (targetPercent)
    // 差�? abs(final - target)
    let p1Diff = Math.abs(p1.finalPercent - targetPercent);
    let p2Diff = Math.abs(p2.finalPercent - targetPercent);

    // 1. ?��?程度
    if (p1Diff < p2Diff) p1.wins++;
    else if (p2Diff < p1Diff) p2.wins++;
    // equal -> no point or both? "?��??��??? (draw -> no point usually)

    // 2. ?��?
    if (p1.completionTime > p2.completionTime) p1.wins++;
    else if (p2.completionTime > p1.completionTime) p2.wins++;

    // 顯示結�?
    let msg = `P1 WINs: ${p1TotalWins} (+${p1.wins}) | P2 WINs: ${p2TotalWins} (+${p2.wins})\n`;

    // ?�新總�?
    p1TotalWins += p1.wins;
    p2TotalWins += p2.wins;

    if (p1Diff < p2Diff) msg += "P1 Closer! "; else if (p2Diff < p1Diff) msg += "P2 Closer! ";
    if (p1.completionTime > p2.completionTime) msg += "P1 Faster!"; else if (p2.completionTime > p1.completionTime) msg += "P2 Faster!";

    showMessage(msg);

    // 下�???
    setTimeout(() => {
        if (currentLevel < 4) {
            currentLevel++;
            initGame();
        } else {
            // ?�終�???
            let finalMsg = "DRAW!";
            if (p1TotalWins > p2TotalWins) finalMsg = "PLAYER 1 WINS THE GAME!";
            else if (p2TotalWins > p1TotalWins) finalMsg = "PLAYER 2 WINS THE GAME!";

            showMessage(`GAME OVER\n${finalMsg}\nFinal Score: ${p1TotalWins} - ${p2TotalWins}`);

            // 返�?主選??
            setTimeout(() => {
                document.getElementById('startScreen').classList.remove('hidden');
                // Reset?
            }, 5000);
        }
    }, 4000);
}

// ?�新UI (Refactored)
function updateUI(player) {
    // 如�?沒傳 player，更?��???(for init)
    if (!player) {
        players.forEach(p => updateUI(p));
        return;
    }

    const prefix = player.id === 0 ? 'p1-' : 'p2-';

    const currentArea = player.shape ? player.shape.getArea() : 0;
    const currentPercent = player.initialArea ? (currentArea / player.initialArea) * 100 : 0;

    const percentEl = document.getElementById(prefix + 'currentPercent');
    if (percentEl) percentEl.textContent = currentPercent.toFixed(1) + '%';

    const targetEl = document.getElementById(prefix + 'targetPercent');
    if (targetEl) targetEl.textContent = targetPercent + '%';

    const levelEl = document.getElementById(prefix + 'levelDisplay');
    if (levelEl) levelEl.textContent = currentLevel;
}

// ============================================================================
// ?�戲循環 (Refactored)
// ============================================================================
function gameLoop() {
    // 清空?��?
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製每個玩�?
    players.forEach(player => {
        ctx.save();

        // ?�制繪製?�??(Clipping)
        ctx.beginPath();
        ctx.rect(player.viewport.x, player.viewport.y, player.viewport.width, player.viewport.height);
        ctx.clip();

        // ?�移?��??��? (?�選，這裡?�們直?�用世�??��?，�??�物件�?置已經是?�該?�?�內?��??��?)
        // 注�?：spawnBomb, setupPlayerLevel ?�是?�於 canvas.width 計�??�中�?
        // 如�? setupPlayerLevel 使用�?player.viewport 來�?算中心�???��?�件?��?就是絕�??��?
        // -> setupPlayerLevel 已更?�為使用 player.viewport.x + width/2

        // 繪製?�形
        if (player.shape) {
            let shapeColor = '#10B981';
            if (currentLevel === 2) shapeColor = '#8B5CF6';
            if (currentLevel === 3) shapeColor = '#EF4444';
            if (currentLevel === 4) shapeColor = '#F59E0B';

            player.shape.draw(shapeColor, 4, '#000000');
        }

        // ?��?
        player.bombs.forEach(bomb => {
            bomb.update();
            const collision = bomb.checkEdgeCollision(player.shape);
            if (collision) bomb.bounce(collision);
            bomb.draw();
        });

        // 碎�?
        player.fallingPieces = player.fallingPieces.filter(piece => {
            piece.update();
            piece.draw();
            return !piece.isOffScreen();
        });

        // ?�花
        player.sparks = player.sparks.filter(spark => {
            spark.update();
            spark.draw();
            return !spark.isDead();
        });

        // ?�割?�覽
        if (player.cuttingState.isInside && player.cuttingState.currentPath.length > 1) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(player.cuttingState.currentPath[0].x, player.cuttingState.currentPath[0].y);
            for (let i = 1; i < player.cuttingState.currentPath.length; i++) {
                ctx.lineTo(player.cuttingState.currentPath[i].x, player.cuttingState.currentPath[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();

        // ?��?線繪�?(Canvas or DOM? DOM is handled in initGame logic css)
    });

    requestAnimationFrame(gameLoop);
}

// ============================================================================
// ?��??�戲
// ============================================================================

// ?�卡?��??��?
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        selectedLevel = parseInt(this.dataset.level);
    });
});
document.querySelector('.level-btn[data-level="1"]').classList.add('selected');

// 模�??��??��?
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        gameMode = this.dataset.mode;
        console.log(`已選?�模�? ${gameMode}`);
    });
});
// 默�??�人
gameMode = 'single';
document.querySelector('.mode-btn[data-mode="single"]').classList.add('selected');

// Language Switch Event
document.getElementById('langSwitch').addEventListener('click', () => {
    const newLang = currentLanguage === 'zh' ? 'en' : 'zh';
    updateLanguage(newLang);
});

console.log('??Script loaded successfully');
console.log('Canvas:', canvas);
console.log('Video element:', video);

// 等�? DOM 完全?��?
if (document.readyState === 'loading') {
    console.log('??Waiting for DOM to load...');
    document.addEventListener('DOMContentLoaded', initStartButton);
} else {
    console.log('??DOM already loaded');
    initStartButton();
}

function initStartButton() {
    console.log('?? Looking for start button...');
    const startBtn = document.getElementById('startButton');

    if (!startBtn) {
        console.error('??Start button not found!');
        console.log('Available buttons:', document.querySelectorAll('button'));
        return;
    }

    console.log('??Start button found:', startBtn);
    console.log('Button text:', startBtn.textContent);

    // 移除任�??��??��?件監?�器（�??�並?��?�?
    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);

    console.log('?�� Adding click event listener...');

    newStartBtn.addEventListener('click', handleStartGame);

    // 額�??��??�方�?
    newStartBtn.onclick = function (e) {
        console.log('?�� onclick triggered (backup method)');
        handleStartGame(e);
    };

    console.log('??Event listeners attached successfully');
    console.log('Try clicking the button now!');
}

async function handleStartGame(event) {
    if (event) event.preventDefault();

    console.log("========================================");
    console.log("START BUTTON CLICKED! Game Version: v2.8");
    console.log("========================================");

    console.log('Step 1: Hiding start screen...');
    document.getElementById('startScreen').classList.add('hidden');
    console.log('Start screen hidden');

    console.log('Step 2: Setting current level...');
    currentLevel = selectedLevel;
    console.log(`Current level: ${currentLevel}`);

    console.log('Step 3: Resizing canvas...');
    resizeCanvas();
    console.log('Canvas resized');

    console.log('Step 4: Setting up camera...');
    if (!camera) {

        try {
            camera = new Camera(video, {
                onFrame: async () => {
                    await hands.send({ image: video });
                },
                width: 1280,
                height: 720
            });
            await camera.start();
            console.log('Camera started!');
        } catch (e) {
            console.error('Camera error:', e);
            alert('Cannot access webcam! Please allow camera permission.');
            return;
        }
    } else {
        console.log('Camera already initialized');
    }

    
    console.log('Step 5: Calling initGame()...');
    try {
        initGame();
        console.log('initGame() completed');
    } catch (e) {
        console.error('Error in initGame():', e);
    }
    
    console.log('========================================');
    console.log('GAME START COMPLETE!');
    console.log('========================================');
}



// ============================================================================
// ?��???
// ============================================================================

console.log('?? Initializing game systems...');

// 設置 MediaPipe
console.log('1️⃣ Setting up MediaPipe...');
setupMediaPipe();
console.log('??MediaPipe setup complete');

// ?��??�音??
console.log('2️⃣ Initializing audio...');
initAudio();
console.log('??Audio initialized');

// ?��??�戲循環
console.log('3️⃣ Starting game loop...');
gameLoop();
console.log('??Game loop started');

console.log('?? All systems initialized! Ready to play.');
