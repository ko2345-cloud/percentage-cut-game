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
let targetPercent = 10;
let swipeStart = null;
let swipeEnd = null;
let tracking = false;

// 切割狀態追蹤
let cuttingState = {
    isInside: false,
    entryPoint: null,
    currentPath: [],
    lastPosition: null
};

// 掉落的圖形碎片
let fallingPieces = [];

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
    constructor(vertices) {
        this.vertices = vertices; // [{x, y}, ...]
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
    draw(color = '#4ECDC4', lineWidth = 4) {
        if (this.vertices.length < 3) return;

        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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
        poly1.push(int1.point);
        while (idx !== (int2.index + 1) % n) {
            poly1.push(this.vertices[idx]);
            idx = (idx + 1) % n;
        }
        poly1.push(int2.point);

        // 構建第二個多邊形
        idx = (int2.index + 1) % n;
        poly2.push(int2.point);
        while (idx !== (int1.index + 1) % n) {
            poly2.push(this.vertices[idx]);
            idx = (idx + 1) % n;
        }
        poly2.push(int1.point);

        return [new Polygon(poly1), new Polygon(poly2)];
    }
}

// ============================================================================
// 數學工具函數
// ============================================================================

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
        this.polygon.draw('#FFD700'); // 黃色表示被切掉的部分
        ctx.restore();
    }

    isOffScreen() {
        return this.polygon.vertices.every(v => v.y > canvas.height + 100) || this.opacity <= 0;
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

        // 處理每一隻手
        results.multiHandLandmarks.forEach((hand, index) => {
            const indexTip = hand[8]; // 食指尖端

            // 轉換到畫布坐標
            const x = (1 - indexTip.x) * canvas.width; // 鏡像翻轉
            const y = indexTip.y * canvas.height;

            // 儲存手部位置
            handPositions.push({ x, y, handIndex: index });

            // 為不同的手使用不同顏色
            const colors = ['#FF6B6B', '#4ECDC4']; // 紅色、青色
            const color = colors[index % colors.length];

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
            ctx.fillText(`手 ${index + 1}`, x + 25, y + 5);

            // 記錄第一隻手的軌跡用於切割
            if (index === 0) {
                // 檢查邊緣穿越（新的切割方式）
                if (gameState === 'playing') {
                    checkEdgeCrossing({ x, y });
                }

                // 記錄軌跡（舊的滑動手勢）
                gestureTrail.push({ x, y, time: Date.now() });

                // 只保留最近 30 幀的軌跡
                if (gestureTrail.length > 30) {
                    gestureTrail.shift();
                }
            }
        });

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

// 初始化遊戲
function initGame() {
    // 創建正方形
    const size = Math.min(canvas.width, canvas.height) * 0.4;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    currentShape = new Polygon([
        { x: cx - size / 2, y: cy - size / 2 },
        { x: cx + size / 2, y: cy - size / 2 },
        { x: cx + size / 2, y: cy + size / 2 },
        { x: cx - size / 2, y: cy + size / 2 }
    ]);

    targetPercent = 10;
    gameState = 'playing';
    updateUI();
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

    const result = currentShape.slice(entryPoint, exitPoint);
    if (!result) {
        console.log('❌ 切割失敗 - 無法找到兩個交點');
        return;
    }

    const [poly1, poly2] = result;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    console.log('✅ 切割成功！面積:', { area1: Math.round(area1), area2: Math.round(area2) });

    // 確定哪個是較大的部分
    let keepPoly, discardPoly;
    if (area1 > area2) {
        keepPoly = poly1;
        discardPoly = poly2;
    } else {
        keepPoly = poly2;
        discardPoly = poly1;
    }

    // 更新當前圖形為較大的部分
    currentShape = keepPoly;

    // 添加較小的部分到掉落動畫
    fallingPieces.push(new FallingPiece(discardPoly));

    updateUI();
    checkWinCondition();
}

// 檢查勝利條件
function checkWinCondition() {
    if (!currentShape || !window.initialArea) return;

    const currentPercent = (currentShape.getArea() / window.initialArea) * 100;
    if (currentPercent <= targetPercent) {
        gameState = 'won';
        showMessage('🎉 你贏了！');
    }
}

// 執行切割（保留舊的滑動手勢功能）
const initialArea = 0;
function performSlice(start, end) {
    if (!currentShape || gameState !== 'playing') return;

    const result = currentShape.slice(start, end);
    if (!result) return;

    const [poly1, poly2] = result;
    const area1 = poly1.getArea();
    const area2 = poly2.getArea();

    // 保留較大的部分
    currentShape = area1 > area2 ? poly1 : poly2;

    // 計算當前面積百分比
    const originalArea = initialArea || currentShape.getArea();
    if (!initialArea) {
        window.initialArea = originalArea;
    }

    updateUI();
    checkWinCondition();
}

// 更新 UI
function updateUI() {
    if (!currentShape) return;

    const originalArea = window.initialArea || currentShape.getArea();
    const currentPercent = (currentShape.getArea() / originalArea) * 100;

    document.getElementById('currentPercent').textContent = currentPercent.toFixed(1) + '%';
    document.getElementById('targetPercent').textContent = targetPercent + '%';
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
        currentShape.draw('#4ECDC4');
    }

    // 更新並繪製掉落的碎片
    fallingPieces = fallingPieces.filter(piece => {
        piece.update();
        piece.draw();
        return !piece.isOffScreen();
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
document.getElementById('startButton').addEventListener('click', async () => {
    try {
        document.getElementById('startScreen').classList.add('hidden');

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
