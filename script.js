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
        let idx = int1.index + 1;
        poly1.push(int1.point);
        while (idx !== int2.index + 1) {
            poly1.push(this.vertices[idx % n]);
            idx++;
        }
        poly1.push(int2.point);

        // 構建第二個多邊形
        idx = int2.index + 1;
        poly2.push(int2.point);
        while (idx !== int1.index + 1) {
            poly2.push(this.vertices[idx % n]);
            idx++;
        }
        poly2.push(int1.point);

        return [new Polygon(poly1), new Polygon(poly2)];
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
        maxNumHands: 2,
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
        ctx.fillText('請將雙手放在鏡頭前', canvas.width / 2, canvas.height - 30);
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

// 執行切割
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

    // 檢查勝利條件
    const currentPercent = (currentShape.getArea() / window.initialArea) * 100;
    if (currentPercent <= targetPercent) {
        gameState = 'won';
        showMessage('🎉 你贏了！');
    }
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

    // 繪製手勢軌跡
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
        // 優先使用後置攝像頭
        camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 1280,
            height: 720,
            facingMode: 'environment' // 優先使用後置攝像頭
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
