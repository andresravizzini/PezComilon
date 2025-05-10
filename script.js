// --- (Mismo código inicial: canvas, ctx, messageEl, restartButton) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageEl = document.getElementById('message');
const restartButton = document.getElementById('restartButton');

// --- Configuración del Juego ---
let canvasWidth;
let canvasHeight;
let mouse = { x: 0, y: 0 };
let player;
let otherFish = [];
let bubbles = [];
let initialOtherFishCount = 18;
let growthFactor = 0.25;
let baseSpeed = 0.8;
let animationId;
let gameState = 'running'; // Por defecto, initGame lo establecerá

// --- Constantes para IA y Movimiento ---
const visionRadius = 160;
const fleeMargin = 1;
const pursueMargin = 1;
const edgeBuffer = 30;
const wanderStrength = 0.1;
const turnSpeedWander = 0.04;
const turnSpeedFleePursue = 0.15;
const speedMultiplierWander = 1.0;
const speedMultiplierFlee = 1.6;
const speedMultiplierPursue = 1.4;
const debugAI = false;

// --- Constantes para Burbujas ---
const numBubbles = 40;

// --- Clases y Objetos del Juego ---

class Bubble {
    constructor() { this.reset(); if (canvasHeight) this.y = Math.random() * canvasHeight; }
    reset() { this.radius = Math.random() * 3 + 2; if (canvasWidth) this.x = Math.random() * canvasWidth; if (canvasHeight) this.y = canvasHeight + this.radius + Math.random() * 30; this.speedY = Math.random() * 1.0 + 0.5; this.speedX = (Math.random() - 0.5) * 0.6; this.opacity = Math.random() * 0.5 + 0.2; }
    update() { this.y -= this.speedY; this.x += this.speedX; if (this.y < -this.radius) { this.reset(); } if (canvasWidth && (this.x < -this.radius || this.x > canvasWidth + this.radius)) { this.x = Math.random() * canvasWidth; } }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.fill(); ctx.closePath(); }
}

class Fish {
    constructor(x, y, size, color, speedMultiplier = 1) {
        this.x = x; this.y = y; this.size = size; this.color = color;
        this.baseSpeed = baseSpeed * speedMultiplier * (Math.random() * 0.5 + 0.75);
        this.angle = Math.random() * Math.PI * 2; this.targetAngle = this.angle; this.currentBehavior = 'wander';
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.beginPath(); ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-this.size * 0.7, 0); ctx.lineTo(-this.size * 1.2, -this.size * 0.4); ctx.lineTo(-this.size * 1.2, this.size * 0.4); ctx.closePath(); ctx.fillStyle = this.color; ctx.fill();
        let eyeX = this.size * 0.4; let eyeY = -this.size * 0.15; let eyeRadius = this.size * 0.12; let pupilRadius = eyeRadius * 0.6;
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2); ctx.fillStyle = 'black'; ctx.fill();
        ctx.restore();
    }
    update(playerFish) {
        let behavior = 'wander'; let desiredAngle = this.angle; let currentTurnSpeed = turnSpeedWander; let currentSpeedMultiplier = speedMultiplierWander;
        const distanceToPlayer = getDistance(this.x, this.y, playerFish.x, playerFish.y);
        const isPlayerDetected = distanceToPlayer < visionRadius + playerFish.size;
        if (isPlayerDetected) {
            const angleToPlayer = Math.atan2(playerFish.y - this.y, playerFish.x - this.x);
            if (playerFish.size > this.size + fleeMargin) {
                behavior = 'flee'; desiredAngle = angleToPlayer + Math.PI; currentTurnSpeed = turnSpeedFleePursue; currentSpeedMultiplier = speedMultiplierFlee;
                if (debugAI && this.currentBehavior !== 'flee') console.log(`Fish ${this.color} Fleeing!`);
            } else if (this.size > playerFish.size + pursueMargin) {
                behavior = 'pursue'; desiredAngle = angleToPlayer; currentTurnSpeed = turnSpeedFleePursue; currentSpeedMultiplier = speedMultiplierPursue;
                if (debugAI && this.currentBehavior !== 'pursue') console.log(`Fish ${this.color} Pursuing!`);
            }
        }
        if (behavior === 'wander') {
             if (debugAI && this.currentBehavior !== 'wander') console.log(`Fish ${this.color} Wandering...`);
             this.currentBehavior = 'wander'; let avoidingEdge = false;
            if (this.x < edgeBuffer) { desiredAngle = 0; avoidingEdge = true; }
            else if (this.x > canvasWidth - edgeBuffer) { desiredAngle = Math.PI; avoidingEdge = true; }
            if (this.y < edgeBuffer) { desiredAngle = Math.PI / 2; avoidingEdge = true; }
            else if (this.y > canvasHeight - edgeBuffer) { desiredAngle = -Math.PI / 2; avoidingEdge = true; }
             if(avoidingEdge) { currentTurnSpeed = turnSpeedWander * 1.5; }
             else { if (Math.random() < 0.05) { this.targetAngle = this.angle + (Math.random() - 0.5) * 2 * wanderStrength * 6; } desiredAngle = this.targetAngle; }
        } else { this.currentBehavior = behavior; }
        desiredAngle = Math.atan2(Math.sin(desiredAngle), Math.cos(desiredAngle));
        let angleDiff = desiredAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > currentTurnSpeed) { this.angle += Math.sign(angleDiff) * currentTurnSpeed; } else { this.angle = desiredAngle; }
        this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);
        const finalSpeed = this.baseSpeed * currentSpeedMultiplier;
        this.x += Math.cos(this.angle) * finalSpeed; this.y += Math.sin(this.angle) * finalSpeed;
        this.x = Math.max(this.size * 0.6, Math.min(canvasWidth - this.size * 0.6, this.x));
        this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y));
    }
}

class PlayerFish extends Fish {
    constructor(x, y, size, color) { super(x, y, size, color); this.targetX = x; this.targetY = y; this.lerpFactor = 0.08; }
    update() { let dxT = this.targetX - this.x; let dyT = this.targetY - this.y; this.x += dxT * this.lerpFactor; this.y += dyT * this.lerpFactor; this.x = Math.max(this.size * 0.6, Math.min(canvasWidth - this.size * 0.6, this.x)); this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y)); }
    grow(eatenFishSize) { let cArea = Math.PI*this.size*this.size; let eArea = Math.PI*eatenFishSize*eatenFishSize; let nArea = cArea + eArea * growthFactor; this.size = Math.sqrt(nArea / Math.PI); console.log(`Player grew to size: ${this.size.toFixed(2)}`); }
    setTarget(x, y) { this.targetX = x; this.targetY = y; }
    draw() { ctx.save(); ctx.translate(this.x, this.y); let angleToTarget = Math.atan2(this.targetY - this.y, this.targetX - this.x); ctx.rotate(angleToTarget); ctx.beginPath();ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);ctx.fillStyle = this.color;ctx.fill();ctx.beginPath();ctx.moveTo(-this.size * 0.7, 0);ctx.lineTo(-this.size * 1.2, -this.size * 0.4);ctx.lineTo(-this.size * 1.2, this.size * 0.4);ctx.closePath();ctx.fillStyle = this.color;ctx.fill();let eyeX = this.size * 0.4;let eyeY = -this.size * 0.15;let eyeRadius = this.size * 0.12;let pupilRadius = eyeRadius * 0.6;ctx.beginPath();ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);ctx.fillStyle = 'white';ctx.fill();ctx.beginPath();ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);ctx.fillStyle = 'black';ctx.fill(); ctx.restore(); }
}

function getRandomColor() { const h = Math.random()*360; const s = Math.random()*30+70; const l = Math.random()*20+60; return `hsl(${h}, ${s}%, ${l}%)`; }
function getDistance(x1, y1, x2, y2) { let dx = x2-x1; let dy = y2-y1; return Math.sqrt(dx*dx + dy*dy); }

// --- Función para redimensionar el canvas (MODIFICADA) ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    console.log(`Canvas resized to: ${canvasWidth}x${canvasHeight}`);

    // Siempre llama a initGame después de redimensionar para que el juego se adapte.
    initGame();
}

// --- Función initGame (MODIFICADA) ---
function initGame() {
    console.log("Initializing game...");

    // Asegurarse de que canvasWidth y canvasHeight estén definidos
    // (resizeCanvas ya debería haberlo hecho, pero es una salvaguarda)
    if (typeof canvasWidth === 'undefined' || canvasWidth === 0) {
        canvasWidth = canvas.width || window.innerWidth;
        canvasHeight = canvas.height || window.innerHeight;
        if (canvas.width === 0) canvas.width = canvasWidth; // Forzar si aún es 0
        if (canvas.height === 0) canvas.height = canvasHeight; // Forzar si aún es 0
    }

    // Cancelar cualquier animación existente ANTES de reconfigurar.
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null; // Muy importante para evitar loops duplicados
    }

    mouse.x = canvasWidth / 2;
    mouse.y = canvasHeight / 2;

    gameState = 'running'; // Establecer el estado del juego
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    restartButton.style.display = 'none';

    player = new PlayerFish(canvasWidth / 2, canvasHeight / 2, 15, 'orange');
    player.setTarget(mouse.x, mouse.y); // Apuntar al centro inicialmente

    otherFish = [];
    for (let i = 0; i < initialOtherFishCount; i++) {
        let size = Math.random() * 35 + 5;
        let x = Math.random() * (canvasWidth - size * 2) + size;
        let y = Math.random() * (canvasHeight - size * 2) + size;
        let color = getRandomColor();
        // Asegurarse de que player está definido antes de acceder a player.x, player.y
        if (player && getDistance(x, y, player.x, player.y) > player.size + size + 60) {
            otherFish.push(new Fish(x, y, size, color));
        } else {
            i--;
        }
    }
    console.log(`Created ${otherFish.length} NPC fish.`);

    bubbles = [];
    for (let i = 0; i < numBubbles; i++) {
        bubbles.push(new Bubble());
    }
    console.log(`Created ${bubbles.length} bubbles.`);

    // Iniciar el game loop
    gameLoop();
}

function checkCollisions() {
    if (!player) return; // Salvaguarda
    for (let i = otherFish.length - 1; i >= 0; i--) {
        const fish = otherFish[i];
        const dist = getDistance(player.x, player.y, fish.x, fish.y);
        const collThr = (player.size + fish.size) * 0.7;
        if (dist < collThr) {
            const szDiff = 0.1;
            if (player.size > fish.size + szDiff) {
                player.grow(fish.size); otherFish.splice(i, 1);
                console.log(`Ate fish! Remaining: ${otherFish.length}`);
                if (otherFish.length === 0) { winGame(); return; }
            } else if (fish.size > player.size + szDiff) {
                gameOver(); return;
            }
        }
    }
}

function updateGame() {
    if (gameState !== 'running' || !player) return;
    bubbles.forEach(b => b.update());
    player.update();
    otherFish.forEach(f => f.update(player));
    checkCollisions();
}

function drawGame() {
    if (!player) return; // Salvaguarda
    ctx.fillStyle = '#004070'; // Color de fondo del juego
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    bubbles.forEach(b => b.draw());
    otherFish.forEach(f => f.draw());
    player.draw();
    ctx.fillStyle = 'white'; ctx.font = '16px Arial';
    ctx.fillText(`Tamaño: ${player.size.toFixed(1)}`, 10, 20);
    ctx.fillText(`Peces restantes: ${otherFish.length}`, 10, 40);
}

function gameLoop() {
    if (gameState !== 'running') {
        // Si el estado no es 'running', asegurarse de que la animación se detenga.
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    updateGame();
    drawGame();
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() { console.log("Game Over!"); gameState = 'gameOver'; messageEl.textContent = '¡HAS SIDO COMIDO! GAME OVER'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }
function winGame() { console.log("You Win!"); gameState = 'win'; messageEl.textContent = '¡FELICIDADES! ¡TE LOS COMISTE A TODOS!'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }

// --- Event Listeners ---
window.addEventListener('resize', () => {
    // Si hay una animación en curso, cancelarla. initGame se encargará de reiniciarla.
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    resizeCanvas(); // resizeCanvas ahora siempre llama a initGame
});

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let touchIdentifier = null;

if (isTouchDevice) {
    console.log("Touch device detected. Using touch controls.");
    canvas.addEventListener('touchstart', (event) => {
        if (gameState !== 'running' || !player) return;
        event.preventDefault();
        if (touchIdentifier === null && event.changedTouches.length > 0) {
            touchIdentifier = event.changedTouches[0].identifier;
            const rect = canvas.getBoundingClientRect();
            const touch = event.changedTouches[0];
            mouse.x = touch.clientX - rect.left;
            mouse.y = touch.clientY - rect.top;
            player.setTarget(mouse.x, mouse.y);
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (event) => {
        if (gameState !== 'running' || !player) return;
        event.preventDefault();
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === touchIdentifier) {
                const rect = canvas.getBoundingClientRect();
                mouse.x = touch.clientX - rect.left;
                mouse.y = touch.clientY - rect.top;
                player.setTarget(mouse.x, mouse.y);
                break;
            }
        }
    }, { passive: false });
    const touchEndOrCancel = (event) => {
        if (gameState !== 'running' || !player) return;
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            if (touch.identifier === touchIdentifier) {
                touchIdentifier = null; break;
            }
        }
    };
    canvas.addEventListener('touchend', touchEndOrCancel);
    canvas.addEventListener('touchcancel', touchEndOrCancel);
} else {
    console.log("Desktop device detected. Using mouse controls.");
    canvas.addEventListener('mousemove', (event) => {
        if (gameState !== 'running' || !player) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        player.setTarget(mouse.x, mouse.y);
    });
}

restartButton.addEventListener('click', () => {
    // resizeCanvas se encargará de llamar a initGame
    resizeCanvas();
});

// --- Inicio (SIMPLIFICADO) ---
// Llamar a resizeCanvas en la carga inicial.
// resizeCanvas se encargará de establecer las dimensiones y luego llamar a initGame.
resizeCanvas();

console.log("Script loaded. resizeCanvas and initGame should run.");