// ============================================================================
// 全局變量和常量
// ============================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

let hands;
let camera;
let gameState = 'idle'; // idle, playing, won, lost
let currentShape = null;
let currentLevel = 1; // 1 = square, 2 = star, 3 = organic shape
let selectedLevel = 1; // User's level selection
let targetPercent = 10;
let swipeStart = null;
let swipeEnd = null;
let tracking = false;
let redLineCollisionCooldown = 0; // 防止重複觸發碰撞

// 切割狀態追蹤
let cuttingState = {
    isInside: false,
    entryPoint: null,
    currentPath: [],
    lastPosition: null
};

// 掉落的圖形碎片
let fallingPieces = [];

// 火花粒子
let sparks = [];

// 碰撞音效
let collisionSound = null;
let explosionSound = null;

// 炸彈
let bombs = [];

// ============================================================================
// 初始化畫布尺寸
// ============================================================================
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================================
// Polygon 類別 - 表示多邊形
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

    // 計算多邊形面積（使用鞋帶公式）
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

    // 繪製多邊形
    draw(color = '#4ECDC4', lineWidth = 4, strokeColor = '#000000') {
        if (this.vertices.length < 3) return;

        // 填充
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // 繪製邊緣（每條邊可能有不同顏色）
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

    // 檢查點是否在多邊形內（射線投射算法）
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

    // 檢查點是否碰撞到任何邊緣
    checkPointEdgeCollision(point, threshold = 20) {
        const n = this.vertices.length;
        const collisions = [];

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = this.vertices[i];
            const v2 = this.vertices[j];

            // 計算點到線段的距離
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

    // 檢查切割線是否穿過不可切割的邊緣（紅線）
    checkCutThroughUncuttableEdge(lineStart, lineEnd) {
        const n = this.vertices.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;

            // 如果這條邊不可切割
            if (!this.edgeProperties[i].cuttable) {
                const v1 = this.vertices[i];
                const v2 = this.vertices[j];

                // 檢查切割線是否與這條紅線相交
                const intersection = getLineIntersection(lineStart, lineEnd, v1, v2);

                if (intersection) {
                    console.log('🚫 切割線穿過紅線！', {
                        edgeIndex: i,
                        intersection: intersection
                    });
                    return true; // 找到交點，表示穿過紅線
                }
            }
        }

        return false; // 沒有穿過任何紅線
    }

    // 找到從外部點到內部點穿過邊緣的交點
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

    // 用線段切割多邊形
    slice(lineStart, lineEnd) {
        const intersections = [];
        const n = this.vertices.length;

        // 找到所有與多邊形邊相交的點
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

        // 需要恰好兩個交點才能切割
        if (intersections.length !== 2) return null;

        const [int1, int2] = intersections;
        const poly1 = [];
        const poly2 = [];

        // 構建第一個多邊形
        let idx = (int1.index + 1) % n;
        poly1.push({ x: int1.point.x, y: int1.point.y }); // 深拷貝交點

        let safetyCounter = 0;
        while (idx !== (int2.index + 1) % n) {
            // 深拷貝頂點防止引用共享
            poly1.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });
            idx = (idx + 1) % n;

            safetyCounter++;
            if (safetyCounter > n + 10) {
                console.error("無限循環檢測: Polygon 1 構建失敗");
                return null;
            }
        }
        poly1.push({ x: int2.point.x, y: int2.point.y }); // 深拷貝交點

        // 構建第二個多邊形
        idx = (int2.index + 1) % n;
        poly2.push({ x: int2.point.x, y: int2.point.y }); // 深拷貝交點

        safetyCounter = 0;
        while (idx !== (int1.index + 1) % n) {
            // 深拷貝頂點防止引用共享
            poly2.push({ x: this.vertices[idx].x, y: this.vertices[idx].y });
            idx = (idx + 1) % n;

            safetyCounter++;
            if (safetyCounter > n + 10) {
                console.error("無限循環檢測: Polygon 2 構建失敗");
                return null;
            }
        }
        poly2.push({ x: int1.point.x, y: int1.point.y }); // 深拷貝交點

        return [new Polygon(poly1), new Polygon(poly2)];
    }
}

// ============================================================================
// 數學工具函數
// ============================================================================

// ============================================================================
// 火花粒子類別
// ============================================================================
class Spark {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        // 隨機速度（向四周爆炸）
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        this.gravity = 0.3;
        this.lifetime = 30 + Math.floor(Math.random() * 20); // 30-50 幀
        this.age = 0;
        this.size = 3 + Math.random() * 3; // 3-6px

        // 顏色：橙色到黃色
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
// 掉落碎片類別
// ============================================================================
class FallingPiece {
    constructor(polygon) {
        this.polygon = polygon;
        this.velocity = 0;
        this.gravity = 0.5;
        this.opacity = 1;
        this.rotation = (Math.random() - 0.5) * 0.05; // 輕微旋轉
    }

    update() {
        this.velocity += this.gravity;
        // 移動所有頂點向下
        this.polygon.vertices.forEach(v => {
            v.y += this.velocity;
        });
        this.opacity -= 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        this.polygon.draw('#FFD700', 4, '#000000'); // 黃色碎片，黑色邊框
        ctx.restore();
    }

    isOffScreen() {
        return this.polygon.vertices.every(v => v.y > canvas.height + 100) || this.opacity <= 0;
    }
}

// ============================================================================
// 炸彈類別
// ============================================================================
class Bomb {
    constructor(x, y, vx, vy, speed = 2) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.speed = speed;
        this.radius = 12;
        this.fuseTime = 0; // 用於動畫效果
    }

    update() {
        // 計算下一個位置
        const nextX = this.x + this.vx * this.speed;
        const nextY = this.y + this.vy * this.speed;

        // 檢查下一個位置是否在圖案內
        const nextPos = { x: nextX, y: nextY };
        if (currentShape && currentShape.isPointInside(nextPos)) {
            // 在內部，正常移動
            this.x = nextX;
            this.y = nextY;
        }
        // 如果不在內部，不移動，等待gameLoop中的碰撞檢測來反彈

        // 更新引信動畫
        this.fuseTime += 0.1;
    }

    checkEdgeCollision(polygon) {
        if (!polygon) return null;

        const n = polygon.vertices.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const v1 = polygon.vertices[i];
            const v2 = polygon.vertices[j];

            // 計算炸彈到邊緣的距離
            const distance = pointToSegmentDistance({ x: this.x, y: this.y }, v1, v2);

            if (distance < this.radius + 2) {
                // 碰撞！計算反彈
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

        // 計算邊緣向量
        const edgeVx = v2.x - v1.x;
        const edgeVy = v2.y - v1.y;
        const edgeLength = Math.sqrt(edgeVx * edgeVx + edgeVy * edgeVy);

        // 標準化邊緣向量
        const edgeNormX = edgeVx / edgeLength;
        const edgeNormY = edgeVy / edgeLength;

        // 計算法向量（垂直於邊緣）
        const normalX = -edgeNormY;
        const normalY = edgeNormX;

        // 計算速度向量與法向量的點積
        const dotProduct = this.vx * normalX + this.vy * normalY;

        // 反射向量公式: V' = V - 2(V·N)N
        this.vx = this.vx - 2 * dotProduct * normalX;
        this.vy = this.vy - 2 * dotProduct * normalY;

        // 微調位置，防止卡在邊緣
        this.x += normalX * 3;
        this.y += normalY * 3;
    }

    draw() {
        // 繪製炸彈本體（深灰色圓球）
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

        // 繪製炸彈高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        // 繪製引信（閃爍效果）
        const fuseFlicker = Math.sin(this.fuseTime * 10) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 140, 0, ${0.5 + fuseFlicker * 0.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.radius - 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // 火花效果
        if (fuseFlicker > 0.7) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.radius - 3, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 檢查炸彈是否與切割線相交
    checkCutLineCollision(lineStart, lineEnd) {
        // 計算點到線段的距離
        const distance = pointToSegmentDistance({ x: this.x, y: this.y }, lineStart, lineEnd);
        const isCollision = distance < this.radius + 15; // 增加容差使碰撞更容易檢測

        if (isCollision) {
            console.log(`💣 炸彈碰撞！距離: ${distance.toFixed(2)}, 炸彈位置: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
        }

        return isCollision;
    }
}


// ============================================================================
// 數學工具函數
// ============================================================================

// 計算兩條線段的交點
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

// 計算點到線段的最短距離
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
        // 線段退化為點
        return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // 計算投影參數 t
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // 限制在 [0, 1]

    // 最近點
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
        maxNumHands: 1,  // 只偵測一隻手

        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandsResults);
}

// MediaPipe 結果回調
let previousIndexTip = null;
let gestureTrail = [];
let handPositions = []; // 儲存所有手的位置

function onHandsResults(results) {
    // 清空之前的手部位置
    handPositions = [];

    // 繪製所有檢測到的手部追蹤點
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // 顯示調試信息：檢測到的手部數量
        const debugText = `檢測到 ${results.multiHandLandmarks.length} 隻手`;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(debugText, 20, canvas.height - 20);

        // 處理每一隻手 (只處理第一隻檢測到的手，忽略其他)
        const primaryHand = results.multiHandLandmarks[0];
        if (primaryHand) {
            const index = 0; // 強制使用 index 0
            const indexTip = primaryHand[8]; // 食指尖端

            // 轉換到畫布坐標
            const x = (1 - indexTip.x) * canvas.width; // 鏡像翻轉
            const y = indexTip.y * canvas.height;

            // 儲存手部位置
            handPositions.push({ x, y, handIndex: index });

            // 繪製光點
            const color = '#FF6B6B'; // 始終使用紅色

            // 繪製光點外圈（發光效果）
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30);
            gradient.addColorStop(0, color);
            gradient.addColorStop(0.5, color + '80'); // 半透明
            gradient.addColorStop(1, color + '00'); // 完全透明

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, 30, 0, Math.PI * 2);
            ctx.fill();

            // 繪製光點核心
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 15, 0, Math.PI * 2);
            ctx.fill();

            // 繪製光點白色中心點
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();

            // 在光點旁邊顯示標籤
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`手 1`, x + 25, y + 5);

            // 檢查邊緣穿越
            if (gameState === 'playing') {
                checkEdgeCrossing({ x, y });

                // 檢查紅線碰撞
                if (currentShape && redLineCollisionCooldown <= 0) {
                    const collisions = currentShape.checkPointEdgeCollision({ x, y }, 25);

                    // 尋找是否碰撞到紅線
                    const redLineCollision = collisions.find(c => !c.edgeProperty.cuttable);

                    if (redLineCollision) {
                        console.log('💥 碰撞紅線！', redLineCollision);

                        // 播放音效
                        if (collisionSound) {
                            collisionSound();
                        }

                        // 創建火花
                        for (let i = 0; i < 10; i++) {
                            sparks.push(new Spark(x, y));
                        }

                        // 設置冷卻時間（500ms）
                        redLineCollisionCooldown = 30; // 約 500ms (assuming 60fps)
                    }
                }
            }

            // 減少碰撞冷卻
            if (redLineCollisionCooldown > 0) {
                redLineCollisionCooldown--;
            }

            // 記錄軌跡（舊的滑動手勢）
            gestureTrail.push({ x, y, time: Date.now() });

            // 只保留最近 30 幀的軌跡
            if (gestureTrail.length > 30) {
                gestureTrail.shift();
            }
        }

        // 檢測滑動手勢
        detectSwipe();
    } else {
        // 沒有檢測到手部時顯示提示
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('請將一隻手放在鏡頭前', canvas.width / 2, canvas.height - 30);
        ctx.textAlign = 'left'; // 恢復默認對齊
    }
}

// 檢測滑動手勢
function detectSwipe() {
    if (gestureTrail.length < 15) return;

    const start = gestureTrail[0];
    const end = gestureTrail[gestureTrail.length - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = end.time - start.time;
    const speed = distance / duration;

    // 如果速度夠快且距離夠長，視為滑動
    if (speed > 0.3 && distance > 100) {
        performSlice(start, end);
        gestureTrail = []; // 清空軌跡
    }
}

// ============================================================================
// 遊戲邏輯
// ============================================================================

// 創建五角星
function createStarPolygon(centerX, centerY, outerRadius, innerRadius) {
    const vertices = [];
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2; // 從頂部開始
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        vertices.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }

    // 創建邊緣屬性（根據上傳的新圖片，標記紅線）
    // 五角星有10個頂點，編號0-9（從頂部順時針）
    // 邊緣 i 連接頂點 i 到頂點 i+1
    // 根據新圖片，紅線覆蓋右側的多條邊：邊緣 1, 2, 3, 4, 5
    const edgeProperties = vertices.map((_, i) => {
        // 紅線邊緣：1(右上), 2(右內), 3(右下內), 4(右下), 5(底部右)
        const isRedLine = (i === 1 || i === 2 || i === 3 || i === 4 || i === 5);
        return {
            color: isRedLine ? '#FF0000' : '#000000',
            cuttable: !isRedLine
        };
    });

    return new Polygon(vertices, edgeProperties);
}

// 創建關卡 3 的十字架形狀 (v2.2)
function createLevel3Shape(centerX, centerY, size) {
    const scale = size / 180;
    const vertices = [
        // === 上方尖端 (8個頂點) ===
        { x: centerX, y: centerY - 140 * scale },
        { x: centerX + 15 * scale, y: centerY - 138 * scale },
        { x: centerX + 22 * scale, y: centerY - 130 * scale },
        { x: centerX + 25 * scale, y: centerY - 118 * scale },
        { x: centerX + 22 * scale, y: centerY - 106 * scale },
        { x: centerX + 15 * scale, y: centerY - 98 * scale },
        { x: centerX + 8 * scale, y: centerY - 95 * scale },
        { x: centerX, y: centerY - 93 * scale },
        { x: centerX - 8 * scale, y: centerY - 95 * scale },
        { x: centerX - 15 * scale, y: centerY - 98 * scale },
        { x: centerX - 22 * scale, y: centerY - 106 * scale },
        { x: centerX - 25 * scale, y: centerY - 118 * scale },
        { x: centerX - 22 * scale, y: centerY - 130 * scale },
        { x: centerX - 15 * scale, y: centerY - 138 * scale },
        // === 右上到右臂 (5個頂點) ===
        { x: centerX - 10 * scale, y: centerY - 60 * scale },
        { x: centerX - 8 * scale, y: centerY - 40 * scale },
        { x: centerX - 5 * scale, y: centerY - 20 * scale },
        { x: centerX, y: centerY },
        { x: centerX + 5 * scale, y: centerY + 15 * scale },
        // === 右手臂 (7個頂點) ===
        { x: centerX + 15 * scale, y: centerY + 18 * scale },
        { x: centerX + 30 * scale, y: centerY + 20 * scale },
        { x: centerX + 50 * scale, y: centerY + 18 * scale },
        { x: centerX + 75 * scale, y: centerY + 12 * scale },
        { x: centerX + 95 * scale, y: centerY + 2 * scale },
        { x: centerX + 108 * scale, y: centerY - 12 * scale },
        { x: centerX + 115 * scale, y: centerY - 28 * scale },
        { x: centerX + 108 * scale, y: centerY - 42 * scale },
        { x: centerX + 95 * scale, y: centerY - 52 * scale },
        { x: centerX + 75 * scale, y: centerY - 58 * scale },
        { x: centerX + 50 * scale, y: centerY - 60 * scale },
        { x: centerX + 30 * scale, y: centerY - 58 * scale },
        { x: centerX + 15 * scale, y: centerY - 55 * scale },
        // === 右側身體到下方 (8個頂點) ===
        { x: centerX + 10 * scale, y: centerY - 45 * scale },
        { x: centerX + 8 * scale, y: centerY - 20 * scale },
        { x: centerX + 5 * scale, y: centerY + 10 * scale },
        { x: centerX + 3 * scale, y: centerY + 40 * scale },
        { x: centerX + 2 * scale, y: centerY + 70 * scale },
        { x: centerX + 1 * scale, y: centerY + 100 * scale },
        { x: centerX, y: centerY + 130 * scale },
        { x: centerX - 5 * scale, y: centerY + 150 * scale },
        // === 下方尖端 (5個頂點) ===
        { x: centerX - 8 * scale, y: centerY + 160 * scale },
        { x: centerX - 10 * scale, y: centerY + 165 * scale },
        { x: centerX - 8 * scale, y: centerY + 160 * scale },
        { x: centerX - 5 * scale, y: centerY + 150 * scale },
        // === 左側身體 (8個頂點) ===
        { x: centerX, y: centerY + 130 * scale },
        { x: centerX - 1 * scale, y: centerY + 100 * scale },
        { x: centerX - 2 * scale, y: centerY + 70 * scale },
        { x: centerX - 3 * scale, y: centerY + 40 * scale },
        { x: centerX - 5 * scale, y: centerY + 10 * scale },
        { x: centerX - 8 * scale, y: centerY - 20 * scale },
        { x: centerX - 10 * scale, y: centerY - 45 * scale },
        // === 左手臂 (13個頂點) ===
        { x: centerX - 15 * scale, y: centerY - 55 * scale },
        { x: centerX - 30 * scale, y: centerY - 58 * scale },
        { x: centerX - 50 * scale, y: centerY - 60 * scale },
        { x: centerX - 75 * scale, y: centerY - 58 * scale },
        { x: centerX - 95 * scale, y: centerY - 52 * scale },
        { x: centerX - 108 * scale, y: centerY - 42 * scale },
        { x: centerX - 115 * scale, y: centerY - 28 * scale },
        { x: centerX - 108 * scale, y: centerY - 12 * scale },
        { x: centerX - 95 * scale, y: centerY + 2 * scale },
        { x: centerX - 75 * scale, y: centerY + 12 * scale },
        { x: centerX - 50 * scale, y: centerY + 18 * scale },
        { x: centerX - 30 * scale, y: centerY + 20 * scale },
        { x: centerX - 15 * scale, y: centerY + 18 * scale },
        // === 回到頂部 (5個頂點) ===
        { x: centerX - 5 * scale, y: centerY + 15 * scale },
        { x: centerX, y: centerY },
        { x: centerX + 5 * scale, y: centerY - 20 * scale },
        { x: centerX + 8 * scale, y: centerY - 40 * scale },
        { x: centerX + 10 * scale, y: centerY - 60 * scale }
    ];
    // 所有線都是黑色，無紅線保護區
    const edgeProperties = vertices.map(() => ({
        color: '#000000',
        cuttable: true
    }));
    console.log('✨ 關卡3形狀v2.2：十字架，共', vertices.length, '個頂點');
    return new Polygon(vertices, edgeProperties);
}


// 創建音效
function initAudio() {
    // 使用 Web Audio API 創建簡單的碰撞音效
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    collisionSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 400; // "噹"聲的頻率
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };

    // 爆炸音效 "BOOM"
    explosionSound = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();

        oscillator.connect(gainNode);
        oscillator2.connect(gainNode2);
        gainNode.connect(audioContext.destination);
        gainNode2.connect(audioContext.destination);

        // 低頻爆炸聲
        oscillator.frequency.value = 50;
        oscillator.type = 'sawtooth';

        // 高頻爆炸聲
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


// 初始化遊戲
function initGame() {
    const size = Math.min(canvas.width, canvas.height) * 0.55;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    if (currentLevel === 1) {
        // 關卡 1: 正方形
        currentShape = new Polygon([
            { x: cx - size / 2, y: cy - size / 2 },
            { x: cx + size / 2, y: cy - size / 2 },
            { x: cx + size / 2, y: cy + size / 2 },
            { x: cx - size / 2, y: cy + size / 2 }
        ]);
    } else if (currentLevel === 2) {
        // 關卡 2: 五角星（有紅線）
        const outerRadius = size / 2;
        const innerRadius = outerRadius * 0.38; // 標準五角星比例
        currentShape = createStarPolygon(cx, cy, outerRadius, innerRadius);
    } else if (currentLevel === 3) {
        // 關卡 3: 有機形狀（有紅線）
        currentShape = createLevel3Shape(cx, cy, size);
    }

    // 初始化原始面積
    window.initialArea = currentShape.getArea();
    console.log(`🎮 遊戲初始化！關卡 ${currentLevel}，原始面積:`, window.initialArea);

    targetPercent = 10;
    gameState = 'playing';
    fallingPieces = [];
    sparks = [];

    // 只在關卡3初始化炸彈
    bombs = [];
    if (currentLevel === 3) {
        spawnBomb();
        console.log('💣 關卡3：已生成炸彈');
    }

    updateUI();
}

// 生成炸彈
function spawnBomb() {
    if (!currentShape) return;

    // 計算形狀的中心點
    let centerX = 0, centerY = 0;
    currentShape.vertices.forEach(v => {
        centerX += v.x;
        centerY += v.y;
    });
    centerX /= currentShape.vertices.length;
    centerY /= currentShape.vertices.length;

    // 隨機方向
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);

    // 根據關卡調整炸彈速度
    let speed = 1.5;
    if (currentLevel === 2) speed = 2.0;
    if (currentLevel === 3) speed = 2.5;

    bombs.push(new Bomb(centerX, centerY, vx, vy, speed));
    console.log(`💣 炸彈已生成！速度: ${speed}`);
}


// 檢查邊緣穿越並執行切割
function checkEdgeCrossing(point) {
    if (!currentShape || gameState !== 'playing') return;

    const wasInside = cuttingState.isInside;
    const isInside = currentShape.isPointInside(point);

    if (!wasInside && isInside) {
        // 進入圖形 - 找到進入點
        let entryPoint = null;

        if (cuttingState.lastPosition) {
            entryPoint = currentShape.findEdgeIntersection(cuttingState.lastPosition, point);
        }

        // 如果找不到精確交點，使用當前點
        if (!entryPoint) {
            entryPoint = { x: point.x, y: point.y };
        }

        cuttingState.entryPoint = entryPoint;
        cuttingState.isInside = true;
        cuttingState.currentPath = [entryPoint];

        console.log('✅ 進入圖形！', entryPoint);

    } else if (wasInside && !isInside) {
        // 離開圖形 - 找到離開點並執行切割
        if (cuttingState.entryPoint) {
            let exitPoint = null;

            if (cuttingState.lastPosition) {
                exitPoint = currentShape.findEdgeIntersection(cuttingState.lastPosition, point);
            }

            // 如果找不到精確交點，使用最後一個內部點
            if (!exitPoint && cuttingState.currentPath.length > 0) {
                exitPoint = cuttingState.currentPath[cuttingState.currentPath.length - 1];
            }

            if (exitPoint) {
                console.log('✂️ 離開圖形！', exitPoint);
                performEdgeBasedCut(cuttingState.entryPoint, exitPoint);
            }
        }

        // 重置狀態
        cuttingState.isInside = false;
        cuttingState.entryPoint = null;
        cuttingState.currentPath = [];

    } else if (isInside && cuttingState.entryPoint) {
        // 還在圖形內，追蹤路徑
        cuttingState.currentPath.push({ x: point.x, y: point.y });

        // 限制路徑長度
        if (cuttingState.currentPath.length > 100) {
            cuttingState.currentPath.shift();
        }
    }

    cuttingState.lastPosition = { x: point.x, y: point.y };
}

// 執行基於邊緣的切割
function performEdgeBasedCut(entryPoint, exitPoint) {
    if (!currentShape || gameState !== 'playing') return;

    console.log('🔪 開始切割...', { entry: entryPoint, exit: exitPoint });

    // 檢查切割線是否碰到炸彈
    for (let bomb of bombs) {
        if (bomb.checkCutLineCollision(entryPoint, exitPoint)) {
            console.log('💥 切割線碰到炸彈！');
            triggerExplosion(bomb.x, bomb.y);
            return; // 遊戲失敗，不執行切割
        }
    }

    // 檢查切割線是否穿過紅線（不可切割的邊緣）
    if (currentShape.checkCutThroughUncuttableEdge(entryPoint, exitPoint)) {
        console.log('❌ 切割被紅線阻擋！');
        showMessage('🚫 紅線無法切割！');
        return; // 阻止切割
    }

    const result = currentShape.slice(entryPoint, exitPoint);
    if (!result) {
        console.log('❌ 切割失敗 - 無法找到兩個交點');
        return;
    }

    const [poly1, poly2] = result;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    console.log('✅ 切割成功！面積:', { area1: Math.round(area1), area2: Math.round(area2) });

    // 確定哪個是較小的部分（保留較大的，讓較小的掉落）
    let keepPoly, discardPoly;
    if (area1 < area2) {
        keepPoly = poly1;
        discardPoly = poly2;
    } else {
        keepPoly = poly2;
        discardPoly = poly1;
    }

    // 移除在被捨棄區域內的炸彈
    bombs = bombs.filter(bomb => {
        const bombPos = { x: bomb.x, y: bomb.y };
        const isInDiscarded = discardPoly.isPointInside(bombPos);
        if (isInDiscarded) {
            console.log('💥 炸彈跟隨切掉的部分消失');
        }
        return !isInDiscarded; // 保留不在被捨棄區域的炸彈
    });

    // 更新當前圖形為較大的部分
    currentShape = keepPoly;

    // 添加較小的部分到掉落動畫
    fallingPieces.push(new FallingPiece(discardPoly));

    // 立即更新UI顯示百分比
    updateUI();

    console.log('📊 切割後面積:', Math.round(currentShape.getArea()), '原始面積:', Math.round(window.initialArea), '百分比:', ((currentShape.getArea() / window.initialArea) * 100).toFixed(1) + '%');

    checkWinCondition();
}

// 觸發爆炸
function triggerExplosion(x, y) {
    console.log('💥💥💥 爆炸！遊戲失敗！');

    // 播放爆炸音效
    if (explosionSound) {
        explosionSound();
    }

    // 創建大量火花
    for (let i = 0; i < 50; i++) {
        sparks.push(new Spark(x, y));
    }

    // 創建閃光效果
    const flash = document.createElement('div');
    flash.className = 'explosion-flash';
    document.querySelector('.game-container').appendChild(flash);

    // 移除閃光效果
    setTimeout(() => {
        flash.remove();
    }, 500);

    // 設置遊戲失敗
    gameState = 'lost';
    showMessage('💥 炸彈爆炸！遊戲失敗！');

    // 3秒後重新開始當前關卡
    setTimeout(() => {
        initGame();
    }, 3000);
}


// 檢查勝利條件
function checkWinCondition() {
    if (!currentShape || !window.initialArea) return;

    const currentPercent = (currentShape.getArea() / window.initialArea) * 100;
    if (currentPercent <= targetPercent) {
        if (currentLevel === 1) {
            // 進入第二關
            currentLevel = 2;
            showMessage('🎉 第一關完成！進入五角星關卡...');

            setTimeout(() => {
                initGame();
            }, 2000);
        } else if (currentLevel === 2) {
            // 進入第三關
            currentLevel = 3;
            showMessage('🎉 第二關完成！進入最終關卡...');

            setTimeout(() => {
                initGame();
            }, 2000);
        } else {
            // 已完成所有關卡
            gameState = 'won';
            showMessage('🎊 恭喜！通關所有關卡！');
        }
    }
}

// 執行切割（保留舊的滑動手勢功能）
function performSlice(start, end) {
    if (!currentShape || gameState !== 'playing') return;

    // 檢查切割線是否碰到炸彈
    for (let bomb of bombs) {
        if (bomb.checkCutLineCollision(start, end)) {
            console.log('💥 滑動切割碰到炸彈！');
            triggerExplosion(bomb.x, bomb.y);
            return; // 遊戲失敗，不執行切割
        }
    }

    // 檢查切割線是否穿過紅線
    if (currentShape.checkCutThroughUncuttableEdge(start, end)) {
        console.log('❌ 滑動切割被紅線阻擋！');
        showMessage('🚫 紅線無法切割！');
        return;
    }

    const result = currentShape.slice(start, end);
    if (!result) return;

    const [poly1, poly2] = result;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    console.log('✂️ 滑動手勢切割！面積:', { area1: Math.round(area1), area2: Math.round(area2) });

    // 確定哪個是較小的部分（保留較小的，讓較大的掉落）
    let keepPoly, discardPoly;
    if (area1 < area2) {
        keepPoly = poly1;
        discardPoly = poly2;
    } else {
        keepPoly = poly2;
        discardPoly = poly1;
    }

    // 移除在被捨棄區域內的炸彈
    bombs = bombs.filter(bomb => {
        const bombPos = { x: bomb.x, y: bomb.y };
        const isInDiscarded = discardPoly.isPointInside(bombPos);
        if (isInDiscarded) {
            console.log('💥 炸彈跟隨切掉的部分消失（滑動）');
        }
        return !isInDiscarded;
    });

    // 保留較大的部分
    currentShape = keepPoly;

    // 添加較小的部分到掉落動畫
    fallingPieces.push(new FallingPiece(discardPoly));

    // 立即更新UI
    updateUI();

    console.log('📊 滑動切割後面積:', Math.round(currentShape.getArea()), '原始面積:', Math.round(window.initialArea), '百分比:', ((currentShape.getArea() / window.initialArea) * 100).toFixed(1) + '%');

    checkWinCondition();
}

// 更新 UI
function updateUI() {
    if (!currentShape) {
        console.warn('⚠️ updateUI: currentShape 不存在');
        return;
    }

    if (!window.initialArea) {
        console.warn('⚠️ updateUI: window.initialArea 不存在');
        return;
    }

    const currentArea = currentShape.getArea();
    const currentPercent = (currentArea / window.initialArea) * 100;

    console.log('🔄 更新UI - 當前面積:', Math.round(currentArea), '原始面積:', Math.round(window.initialArea), '百分比:', currentPercent.toFixed(1) + '%');

    document.getElementById('currentPercent').textContent = currentPercent.toFixed(1) + '%';
    document.getElementById('targetPercent').textContent = targetPercent + '%';

    // 更新關卡顯示
    const levelDisplay = document.getElementById('levelDisplay');
    if (levelDisplay) {
        levelDisplay.textContent = `關卡 ${currentLevel}`;
    }
}

// 顯示訊息
function showMessage(text) {
    const messageEl = document.getElementById('gameMessage');
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');

    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
}

// ============================================================================
// 遊戲循環
// ============================================================================
function gameLoop() {
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製圖形
    if (currentShape && gameState === 'playing') {
        // 新的顏色方案
        let shapeColor = '#3B82F6'; // 藍色 - Level 1
        if (currentLevel === 2) shapeColor = '#EC4899'; // 粉紅色 - Level 2
        if (currentLevel === 3) shapeColor = '#F97316'; // 橙色 - Level 3

        currentShape.draw(shapeColor, 4, '#000000');
    }

    // 更新並繪製炸彈
    if (gameState === 'playing') {
        bombs.forEach(bomb => {
            bomb.update();

            // 檢查炸彈是否碰到邊緣
            const collision = bomb.checkEdgeCollision(currentShape);
            if (collision) {
                bomb.bounce(collision);
            }

            bomb.draw();
        });
    }

    // 更新並繪製掉落的碎片
    fallingPieces = fallingPieces.filter(piece => {
        piece.update();
        piece.draw();
        return !piece.isOffScreen();
    });

    // 更新並繪製火花
    sparks = sparks.filter(spark => {
        spark.update();
        spark.draw();
        return !spark.isDead();
    });

    // 繪製進入點指示器
    if (cuttingState.entryPoint && cuttingState.isInside) {
        // 外圈（發光效果）
        const gradient = ctx.createRadialGradient(
            cuttingState.entryPoint.x, cuttingState.entryPoint.y, 0,
            cuttingState.entryPoint.x, cuttingState.entryPoint.y, 20
        );
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#FFD70080');
        gradient.addColorStop(1, '#FFD70000');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cuttingState.entryPoint.x, cuttingState.entryPoint.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 核心點
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cuttingState.entryPoint.x, cuttingState.entryPoint.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // 白色中心
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cuttingState.entryPoint.x, cuttingState.entryPoint.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // 標籤 A
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('A', cuttingState.entryPoint.x + 15, cuttingState.entryPoint.y - 15);
    }

    // 繪製切割路徑預覽
    if (cuttingState.isInside && cuttingState.currentPath.length > 1) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(cuttingState.currentPath[0].x, cuttingState.currentPath[0].y);
        for (let i = 1; i < cuttingState.currentPath.length; i++) {
            ctx.lineTo(cuttingState.currentPath[i].x, cuttingState.currentPath[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 繪製手勢軌跡（舊功能，保留）
    if (gestureTrail.length > 1) {
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gestureTrail[0].x, gestureTrail[0].y);
        for (let i = 1; i < gestureTrail.length; i++) {
            ctx.lineTo(gestureTrail[i].x, gestureTrail[i].y);
        }
        ctx.stroke();
    }

    requestAnimationFrame(gameLoop);
}

// ============================================================================
// 啟動遊戲
// ============================================================================

// 關卡選擇按鈕
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        // 移除其他按鈕的選中狀態
        document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));

        // 添加當前按鈕的選中狀態
        this.classList.add('selected');

        // 設置選擇的關卡
        selectedLevel = parseInt(this.dataset.level);
        console.log(`已選擇關卡 ${selectedLevel}`);
    });
});

// 默認選中關卡 1
document.querySelector('.level-btn[data-level="1"]').classList.add('selected');

document.getElementById('startButton').addEventListener('click', async () => {
    console.log("Game Version: v1.9");
    try {
        document.getElementById('startScreen').classList.add('hidden');

        // 使用選擇的關卡
        currentLevel = selectedLevel;
        console.log(`開始遊戲，當前關卡: ${currentLevel}`);

        // 初始化音效
        initAudio();

        // 設置 MediaPipe
        setupMediaPipe();

        // 啟動攝像頭（移動設備優化）
        // 使用前置攝像頭，讓玩家可以看到自己
        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 1280,
            height: 720,
            facingMode: 'user' // 使用前置攝像頭
        });

        await camera.start();

        // 初始化遊戲
        initGame();

        // 開始遊戲循環
        gameLoop();
    } catch (error) {
        console.error('啟動失敗:', error);
        showMessage('⚠️ 無法訪問攝像頭，請允許權限');
        document.getElementById('startScreen').classList.remove('hidden');
    }
});
