// --- (Mismo código inicial: canvas, ctx, messageEl, restartButton, config) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const messageEl = document.getElementById('message');
const restartButton = document.getElementById('restartButton');

// --- Configuración del Juego ---
let canvasWidth = 800;
let canvasHeight = 600;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

let mouse = { x: canvasWidth / 2, y: canvasHeight / 2 };
let player;
let otherFish = [];
let bubbles = [];
let initialOtherFishCount = 25;
let growthFactor = 0.25;
let baseSpeed = 0.8;
let animationId;
let gameState = 'running';

// --- Constantes para IA y Movimiento ---
const visionRadius = 160;    // Radio de visión ajustado
const fleeMargin = 1;        // Huir si es > 1 más grande
const pursueMargin = 1;      // Perseguir si es > 1 más grande
const edgeBuffer = 30;       // Menor buffer para reaccionar antes cerca del borde
const wanderStrength = 0.1;  // Fuerza del cambio de ángulo al deambular
const turnSpeedWander = 0.04; // <-- Velocidad de giro normal (lenta)
const turnSpeedFleePursue = 0.15; // <-- Velocidad de giro RÁPIDA para huir/perseguir
const speedMultiplierWander = 1.0; // Multiplicador de velocidad normal
const speedMultiplierFlee = 1.6;   // <-- Multiplicador de velocidad ALTA al huir
const speedMultiplierPursue = 1.4; // <-- Multiplicador de velocidad ALTA al perseguir
const debugAI = false; // Poner a true para ver logs de IA en la consola

// --- Constantes para Burbujas ---
const numBubbles = 40;

// --- Clases y Objetos del Juego ---

// --- Clase Bubble (Sin cambios) ---
class Bubble {
    constructor() { this.reset(); this.y = Math.random() * canvasHeight; }
    reset() { this.radius = Math.random() * 3 + 2; this.x = Math.random() * canvasWidth; this.y = canvasHeight + this.radius + Math.random() * 30; this.speedY = Math.random() * 1.0 + 0.5; this.speedX = (Math.random() - 0.5) * 0.6; this.opacity = Math.random() * 0.5 + 0.2; }
    update() { this.y -= this.speedY; this.x += this.speedX; if (this.y < -this.radius) { this.reset(); } if (this.x < -this.radius || this.x > canvasWidth + this.radius) { this.x = Math.random() * canvasWidth; } }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`; ctx.fill(); ctx.closePath(); }
}


// --- Clase Fish (CON IA MEJORADA) ---
class Fish {
    constructor(x, y, size, color, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.baseSpeed = baseSpeed * speedMultiplier * (Math.random() * 0.5 + 0.75);
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle; // Usado solo para wander
        this.currentBehavior = 'wander'; // Para debug
    }

    // --- MÉTODO DRAW (Sin cambios respecto a la versión anterior) ---
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        // Cuerpo
        ctx.beginPath(); ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
        // Aleta
        ctx.beginPath(); ctx.moveTo(-this.size * 0.7, 0); ctx.lineTo(-this.size * 1.2, -this.size * 0.4); ctx.lineTo(-this.size * 1.2, this.size * 0.4); ctx.closePath(); ctx.fillStyle = this.color; ctx.fill();
        // Ojo
        let eyeX = this.size * 0.4; let eyeY = -this.size * 0.15; let eyeRadius = this.size * 0.12; let pupilRadius = eyeRadius * 0.6;
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2); ctx.fillStyle = 'black'; ctx.fill();
        ctx.restore();
    }

    // --- MÉTODO UPDATE (IA REFORZADA) ---
    update(playerFish) {
        let behavior = 'wander'; // Por defecto
        let desiredAngle = this.angle; // Inicialmente, mantener dirección actual
        let currentTurnSpeed = turnSpeedWander; // Velocidad de giro por defecto
        let currentSpeedMultiplier = speedMultiplierWander; // Velocidad por defecto

        // 1. Detección del Jugador y Decisión de Comportamiento Principal
        const distanceToPlayer = getDistance(this.x, this.y, playerFish.x, playerFish.y);
        const isPlayerDetected = distanceToPlayer < visionRadius + playerFish.size; // Ajustar visión si es necesario

        if (isPlayerDetected) {
            const angleToPlayer = Math.atan2(playerFish.y - this.y, playerFish.x - this.x);

            if (playerFish.size > this.size + fleeMargin) {
                // *** ¡HUIR! ***
                behavior = 'flee';
                desiredAngle = angleToPlayer + Math.PI; // Dirección opuesta al jugador
                currentTurnSpeed = turnSpeedFleePursue; // Giro RÁPIDO
                currentSpeedMultiplier = speedMultiplierFlee; // Nado RÁPIDO
                if (debugAI && this.currentBehavior !== 'flee') console.log(`Fish ${this.color} Fleeing!`);

            } else if (this.size > playerFish.size + pursueMargin) {
                // *** ¡PERSEGUIR! ***
                behavior = 'pursue';
                desiredAngle = angleToPlayer; // Dirección hacia el jugador
                currentTurnSpeed = turnSpeedFleePursue; // Giro RÁPIDO
                currentSpeedMultiplier = speedMultiplierPursue; // Nado RÁPIDO
                if (debugAI && this.currentBehavior !== 'pursue') console.log(`Fish ${this.color} Pursuing!`);
            }
             // Si son de tamaño similar o el jugador es más pequeño (y yo no persigo), 'behavior' sigue siendo 'wander'.
        }

        // 2. Si NO está Huyendo ni Persiguiendo -> Considerar Bordes y Deambular
        if (behavior === 'wander') {
             if (debugAI && this.currentBehavior !== 'wander') console.log(`Fish ${this.color} Wandering...`);
             this.currentBehavior = 'wander'; // Actualiza estado para debug

            let avoidingEdge = false;
            // Evitar Bordes (Tiene prioridad sobre deambular)
            if (this.x < edgeBuffer) { desiredAngle = 0; avoidingEdge = true; } // Derecha
            else if (this.x > canvasWidth - edgeBuffer) { desiredAngle = Math.PI; avoidingEdge = true; } // Izquierda
            if (this.y < edgeBuffer) { desiredAngle = Math.PI / 2; avoidingEdge = true; } // Abajo
            else if (this.y > canvasHeight - edgeBuffer) { desiredAngle = -Math.PI / 2; avoidingEdge = true; } // Arriba

             // Si estamos evitando un borde, usamos la velocidad de giro normal
             if(avoidingEdge) {
                 currentTurnSpeed = turnSpeedWander * 1.5; // Un poco más rápido para salir del borde
             } else {
                // Deambular (Wander) - Solo si no estamos huyendo/persiguiendo NI evitando borde
                if (Math.random() < 0.05) { // Cambiar objetivo de deambular
                    this.targetAngle = this.angle + (Math.random() - 0.5) * 2 * wanderStrength * 6; // Un cambio de dirección más notable
                }
                desiredAngle = this.targetAngle; // El objetivo es el ángulo de deambular
             }
        } else {
            // Actualiza estado para debug si estamos huyendo o persiguiendo
            this.currentBehavior = behavior;
        }


        // 3. Girar Suavemente hacia el Ángulo Deseado (Usando la velocidad de giro adecuada)
        // Normalizar desiredAngle para estar entre -PI y PI para calcular diferencia corta
        desiredAngle = Math.atan2(Math.sin(desiredAngle), Math.cos(desiredAngle));
        let angleDiff = desiredAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Aplicar giro limitado por currentTurnSpeed
        if (Math.abs(angleDiff) > currentTurnSpeed) {
            this.angle += Math.sign(angleDiff) * currentTurnSpeed;
        } else {
            this.angle = desiredAngle; // Ajustar directamente si la diferencia es pequeña
        }
        // Normalizar ángulo actual (0 a 2PI)
        this.angle = (this.angle + Math.PI * 2) % (Math.PI * 2);


        // 4. Calcular Velocidad Final y Mover
        const finalSpeed = this.baseSpeed * currentSpeedMultiplier;
        const dx = Math.cos(this.angle) * finalSpeed;
        const dy = Math.sin(this.angle) * finalSpeed;

        this.x += dx;
        this.y += dy;

        // 5. Mantener estrictamente dentro de los límites
        this.x = Math.max(this.size * 0.6, Math.min(canvasWidth - this.size * 0.6, this.x));
        this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y));
    }
}

// --- Clase PlayerFish (Sin cambios) ---
class PlayerFish extends Fish {
    constructor(x, y, size, color) { super(x, y, size, color); this.targetX = x; this.targetY = y; this.lerpFactor = 0.08; }
    update() { let dxT = this.targetX - this.x; let dyT = this.targetY - this.y; this.x += dxT * this.lerpFactor; this.y += dyT * this.lerpFactor; this.x = Math.max(this.size * 0.6, Math.min(canvasWidth - this.size * 0.6, this.x)); this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y)); }
    grow(eatenFishSize) { let cArea = Math.PI*this.size*this.size; let eArea = Math.PI*eatenFishSize*eatenFishSize; let nArea = cArea + eArea * growthFactor; this.size = Math.sqrt(nArea / Math.PI); console.log(`Player grew to size: ${this.size.toFixed(2)}`); }
    setTarget(x, y) { this.targetX = x; this.targetY = y; }
    draw() { ctx.save(); ctx.translate(this.x, this.y); let angleToTarget = Math.atan2(this.targetY - this.y, this.targetX - this.x); ctx.rotate(angleToTarget); /* ... resto del dibujo igual ... */ ctx.beginPath();ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);ctx.fillStyle = this.color;ctx.fill();ctx.beginPath();ctx.moveTo(-this.size * 0.7, 0);ctx.lineTo(-this.size * 1.2, -this.size * 0.4);ctx.lineTo(-this.size * 1.2, this.size * 0.4);ctx.closePath();ctx.fillStyle = this.color;ctx.fill();let eyeX = this.size * 0.4;let eyeY = -this.size * 0.15;let eyeRadius = this.size * 0.12;let pupilRadius = eyeRadius * 0.6;ctx.beginPath();ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);ctx.fillStyle = 'white';ctx.fill();ctx.beginPath();ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);ctx.fillStyle = 'black';ctx.fill(); ctx.restore(); }
}


// --- Funciones Auxiliares (getRandomColor, getDistance - sin cambios) ---
function getRandomColor() { const h = Math.random()*360; const s = Math.random()*30+70; const l = Math.random()*20+60; return `hsl(${h}, ${s}%, ${l}%)`; }
function getDistance(x1, y1, x2, y2) { let dx = x2-x1; let dy = y2-y1; return Math.sqrt(dx*dx + dy*dy); }

// --- Función initGame (Inicializa burbujas también - sin cambios) ---
function initGame() {
    console.log("Initializing game...");
    gameState = 'running'; messageEl.textContent = ''; messageEl.style.display = 'none'; restartButton.style.display = 'none';
    player = new PlayerFish(canvasWidth / 2, canvasHeight / 2, 15, 'orange');
    otherFish = [];
    for (let i = 0; i < initialOtherFishCount; i++) { let size = Math.random() * 35 + 5; let x = Math.random() * (canvasWidth - size * 2) + size; let y = Math.random() * (canvasHeight - size * 2) + size; let color = getRandomColor(); if (getDistance(x, y, player.x, player.y) > player.size + size + 60) { otherFish.push(new Fish(x, y, size, color)); } else { i--; } }
    console.log(`Created ${otherFish.length} NPC fish.`);
    bubbles = []; for (let i = 0; i < numBubbles; i++) { bubbles.push(new Bubble()); } console.log(`Created ${bubbles.length} bubbles.`);
    if (animationId) { cancelAnimationFrame(animationId); } gameLoop();
}

// --- Lógica del Juego (checkCollisions, updateGame, drawGame, gameLoop - sin cambios estructurales) ---
function checkCollisions() {
    for (let i = otherFish.length - 1; i >= 0; i--) { const fish = otherFish[i]; const dist = getDistance(player.x, player.y, fish.x, fish.y); const collThr = (player.size + fish.size) * 0.7; if (dist < collThr) { const szDiff = 0.1; if (player.size > fish.size + szDiff) { player.grow(fish.size); otherFish.splice(i, 1); console.log(`Ate fish! Remaining: ${otherFish.length}`); if (otherFish.length === 0) { winGame(); return; } } else if (fish.size > player.size + szDiff) { gameOver(); return; } } }
}
function updateGame() { if (gameState !== 'running') return; bubbles.forEach(b => b.update()); player.update(); otherFish.forEach(f => f.update(player)); checkCollisions(); }
function drawGame() { ctx.fillStyle = '#004070'; ctx.fillRect(0, 0, canvasWidth, canvasHeight); bubbles.forEach(b => b.draw()); otherFish.forEach(f => f.draw()); player.draw(); ctx.fillStyle = 'white'; ctx.font = '16px Arial'; ctx.fillText(`Tamaño: ${player.size.toFixed(1)}`, 10, 20); ctx.fillText(`Peces restantes: ${otherFish.length}`, 10, 40); }
function gameLoop() { if (gameState === 'gameOver' || gameState === 'win') return; updateGame(); drawGame(); animationId = requestAnimationFrame(gameLoop); }

// --- (Funciones gameOver, winGame, Event Listeners, Inicio - sin cambios) ---
function gameOver() { console.log("Game Over!"); gameState = 'gameOver'; messageEl.textContent = '¡HAS SIDO COMIDO! GAME OVER'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; cancelAnimationFrame(animationId); }
function winGame() { console.log("You Win!"); gameState = 'win'; messageEl.textContent = '¡FELICIDADES! ¡TE LOS COMISTE A TODOS!'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; cancelAnimationFrame(animationId); }
canvas.addEventListener('mousemove', (event) => { const rect = canvas.getBoundingClientRect(); mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top; if (player) { player.setTarget(mouse.x, mouse.y); } });
restartButton.addEventListener('click', () => { initGame(); });
initGame(); // Iniciar el juego