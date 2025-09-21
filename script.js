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
let krill = [];
let bubbles = [];
let initialOtherFishCount = 25;
let growthFactor = 0.50;
let baseSpeed = 0.8;
let animationId;
let gameState = 'running';

// --- Configuración de niveles ---
const levels = [
    {
        name: 'Nivel 1',
        description: 'Pocos peces y ninguno te persigue.',
        fishCount: 8,
        baseSpeed: 0.65,
        allowPursuit: false,
        krill: {
            initial: 12,
            min: 6,
            max: 14,
            respawnInterval: 4500,
            spawnBatch: 3,
            nutritionFactor: 0.9
        }
    },
    {
        name: 'Nivel 2',
        description: 'Más peces y se mueven un poco más rápido.',
        fishCount: 16,
        baseSpeed: 0.85,
        allowPursuit: false,
        krill: {
            initial: 10,
            min: 5,
            max: 12,
            respawnInterval: 5000,
            spawnBatch: 2,
            nutritionFactor: 0.75
        }
    },
    {
        name: 'Nivel 3',
        description: 'Muchos peces y los grandes te persiguen.',
        fishCount: 24,
        baseSpeed: 1.0,
        allowPursuit: true,
        krill: {
            initial: 8,
            min: 4,
            max: 10,
            respawnInterval: 6000,
            spawnBatch: 2,
            nutritionFactor: 0.65
        }
    }
];

let currentLevelIndex = 0;
let levelAllowsPursuit = true;
let levelTransitionTimeout = null;
let activeKrillConfig = null;
let lastKrillSpawnTime = 0;
const playerInitialSize = 15;

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

// --- NUEVO: Margen inferior para barras de tareas/navegación ---
const bottomMargin = 200; // Píxeles a dejar en la parte inferior

// --- NUEVO: Para animación de cola ---
let tailAnimationCounter = 0; // Contador global para sincronizar animación o individual por pez
const tailAnimationSpeed = 0.2; // Cuán rápido se mueve la cola
const tailMaxAngleOffset = Math.PI / 18; // Máximo ángulo de desviación de la cola (10 grados)


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
        this.tailAngleOffset = 0; // Para la animación de la cola
        this.tailAnimationPhase = Math.random() * Math.PI * 2; // Fase inicial aleatoria para que no todas las colas se muevan igual
    }

    // --- MÉTODO DRAW (MODIFICADO para animación de cola) ---
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Cuerpo (sin cambios)
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Aleta de cola (MODIFICADA para animar)
        // Calculamos el ángulo actual de la cola
        this.tailAngleOffset = Math.sin(this.tailAnimationPhase + tailAnimationCounter * tailAnimationSpeed) * tailMaxAngleOffset;

        ctx.save(); // Guardar estado antes de transformar para la cola
        ctx.rotate(this.tailAngleOffset); // Aplicar la rotación de la animación de la cola

        ctx.beginPath();
        ctx.moveTo(-this.size * 0.6, 0); // Un poco más cerca del cuerpo para mejor pivote
        ctx.lineTo(-this.size * 1.2, -this.size * 0.35); // Ajustar forma si es necesario
        ctx.lineTo(-this.size * 1.2, this.size * 0.35);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.restore(); // Restaurar estado después de dibujar la cola

        // Ojo (sin cambios)
        let eyeX = this.size * 0.4; let eyeY = -this.size * 0.15; let eyeRadius = this.size * 0.12; let pupilRadius = eyeRadius * 0.6;
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2); ctx.fillStyle = 'black'; ctx.fill();

        ctx.restore(); // Restaurar estado general del pez
    }

    update(playerFish) { // playerFish solo para Fish, no para PlayerFish
        let behavior = 'wander'; let desiredAngle = this.angle; let currentTurnSpeed = turnSpeedWander; let currentSpeedMultiplier = speedMultiplierWander;
        // ... (resto de la lógica de IA sin cambios) ...
        if (playerFish) { // Asegurarse que playerFish existe (no para la actualización del propio player)
            const distanceToPlayer = getDistance(this.x, this.y, playerFish.x, playerFish.y);
            const isPlayerDetected = distanceToPlayer < visionRadius + playerFish.size;
            if (isPlayerDetected) {
                const angleToPlayer = Math.atan2(playerFish.y - this.y, playerFish.x - this.x);
                if (playerFish.size > this.size + fleeMargin) {
                    behavior = 'flee'; desiredAngle = angleToPlayer + Math.PI; currentTurnSpeed = turnSpeedFleePursue; currentSpeedMultiplier = speedMultiplierFlee;
                    if (debugAI && this.currentBehavior !== 'flee') console.log(`Fish ${this.color} Fleeing!`);
                } else if (levelAllowsPursuit && this.size > playerFish.size + pursueMargin) {
                    behavior = 'pursue'; desiredAngle = angleToPlayer; currentTurnSpeed = turnSpeedFleePursue; currentSpeedMultiplier = speedMultiplierPursue;
                    if (debugAI && this.currentBehavior !== 'pursue') console.log(`Fish ${this.color} Pursuing!`);
                }
            }
        }
        if (behavior === 'wander') {
             if (debugAI && this.currentBehavior !== 'wander') console.log(`Fish ${this.color} Wandering...`);
             this.currentBehavior = 'wander'; let avoidingEdge = false;
            if (this.x < edgeBuffer) { desiredAngle = 0; avoidingEdge = true; }
            else if (this.x > canvasWidth - edgeBuffer) { desiredAngle = Math.PI; avoidingEdge = true; }
            if (this.y < edgeBuffer) { desiredAngle = Math.PI / 2; avoidingEdge = true; }
            else if (this.y > canvasHeight - edgeBuffer) { desiredAngle = -Math.PI / 2; avoidingEdge = true; } // Usa canvasHeight global
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
        this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y)); // Usa canvasHeight global
    }
}

class Krill {
    constructor(x, y, size) {
        this.x = x;
        this.baseY = y;
        this.size = size;
        this.floatAmplitude = Math.random() * 8 + 6;
        this.floatSpeed = Math.random() * 0.015 + 0.01;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.driftSpeedX = (Math.random() - 0.5) * 0.1;
        this.driftSpeedY = (Math.random() - 0.5) * 0.05;
        this.hue = Math.random() * 40 + 180;
        this.saturation = Math.random() * 20 + 60;
        this.lightness = Math.random() * 20 + 70;
        this.y = y;
    }

    update() {
        this.floatPhase += this.floatSpeed;
        const floatOffset = Math.sin(this.floatPhase) * this.floatAmplitude;
        this.x += this.driftSpeedX;
        this.baseY += this.driftSpeedY;

        if (this.x < this.size) {
            this.x = this.size;
            this.driftSpeedX *= -1;
        } else if (this.x > canvasWidth - this.size) {
            this.x = canvasWidth - this.size;
            this.driftSpeedX *= -1;
        }

        if (this.baseY < this.size) {
            this.baseY = this.size;
            this.driftSpeedY *= -1;
        } else if (this.baseY > canvasHeight - this.size) {
            this.baseY = canvasHeight - this.size;
            this.driftSpeedY *= -1;
        }

        this.y = this.baseY + floatOffset;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, 0.85)`;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, 0, this.size * 0.5, this.size * 0.25, Math.PI / 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue + 20}, ${Math.min(100, this.saturation + 10)}%, ${Math.min(95, this.lightness + 5)}%, 0.6)`;
        ctx.fill();
        ctx.restore();
    }
}

class PlayerFish extends Fish {
    constructor(x, y, size, color) {
        super(x, y, size, color); // Llama al constructor de Fish
        this.targetX = x;
        this.targetY = y;
        this.lerpFactor = 0.08;
    }
    update() { // Sobrescribe el update de Fish para el movimiento del jugador
        let dxT = this.targetX - this.x;
        let dyT = this.targetY - this.y;
        this.x += dxT * this.lerpFactor;
        this.y += dyT * this.lerpFactor;
        this.x = Math.max(this.size * 0.6, Math.min(canvasWidth - this.size * 0.6, this.x));
        this.y = Math.max(this.size * 0.6, Math.min(canvasHeight - this.size * 0.6, this.y)); // Usa canvasHeight global

        // Actualizar ángulo del jugador para que mire hacia donde se mueve
        if (Math.abs(dxT) > 0.1 || Math.abs(dyT) > 0.1) { // Solo si hay movimiento significativo
            this.angle = Math.atan2(dyT, dxT);
        }
    }
    grow(eatenFishSize) { let cArea = Math.PI*this.size*this.size; let eArea = Math.PI*eatenFishSize*eatenFishSize; let nArea = cArea + eArea * growthFactor; this.size = Math.sqrt(nArea / Math.PI); console.log(`Player grew to size: ${this.size.toFixed(2)}`); }
    setTarget(x, y) { this.targetX = x; this.targetY = y; }
    // PlayerFish usará el método draw() heredado de Fish, que ahora incluye la animación de cola.
    // Si quieres que el PlayerFish tenga una animación de cola diferente o un control de ángulo diferente
    // para la cola, podrías sobrescribir draw() aquí también. Por ahora, hereda.
}

function getRandomColor() { const h = Math.random()*360; const s = Math.random()*30+70; const l = Math.random()*20+60; return `hsl(${h}, ${s}%, ${l}%)`; }
function getDistance(x1, y1, x2, y2) { let dx = x2-x1; let dy = y2-y1; return Math.sqrt(dx*dx + dy*dy); }

function createKrillConfig(config = {}) {
    return {
        initial: Math.max(0, config.initial ?? 8),
        min: Math.max(0, config.min ?? 4),
        max: Math.max(config.max ?? 10, config.min ?? 4, config.initial ?? 8),
        respawnInterval: Math.max(1000, config.respawnInterval ?? 5000),
        spawnBatch: Math.max(1, config.spawnBatch ?? 2),
        nutritionFactor: Math.max(0.1, config.nutritionFactor ?? 0.75)
    };
}

function spawnKrill() {
    if (!activeKrillConfig || !canvasWidth || !canvasHeight) return null;
    if (krill.length >= activeKrillConfig.max) return null;
    let attempts = 0;
    while (attempts < 20) {
        const size = Math.random() * 4 + 4;
        const x = Math.random() * (canvasWidth - size * 4) + size * 2;
        const y = Math.random() * (canvasHeight - size * 4) + size * 2;
        const safeDistance = player ? player.size + size + 40 : size * 4;
        const tooCloseToPlayer = player && getDistance(x, y, player.x, player.y) < safeDistance;
        const tooCloseToFish = otherFish.some(fish => getDistance(x, y, fish.x, fish.y) < fish.size + size + 20);
        if (!tooCloseToPlayer && !tooCloseToFish) {
            const newKrill = new Krill(x, y, size);
            krill.push(newKrill);
            return newKrill;
        }
        attempts++;
    }
    return null;
}

function maintainKrillPopulation() {
    if (!activeKrillConfig || gameState !== 'running') return;
    if (krill.length < activeKrillConfig.min && krill.length < activeKrillConfig.max) {
        const spawned = spawnKrill();
        if (spawned) {
            lastKrillSpawnTime = Date.now();
        }
        return;
    }
    if (krill.length >= activeKrillConfig.max) return;
    const now = Date.now();
    if (now - lastKrillSpawnTime >= activeKrillConfig.respawnInterval && otherFish.length > 0) {
        const batch = Math.min(activeKrillConfig.spawnBatch, activeKrillConfig.max - krill.length);
        let spawnedAny = false;
        for (let i = 0; i < batch; i++) {
            const spawned = spawnKrill();
            if (spawned) {
                spawnedAny = true;
            }
        }
        if (spawnedAny) {
            lastKrillSpawnTime = now;
        }
    }
}

// --- Función para redimensionar el canvas (MODIFICADA para margen inferior) ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    // MODIFICADO: Restar el margen inferior
    canvas.height = window.innerHeight - bottomMargin;

    // Asegurarse de que la altura no sea negativa si la ventana es muy pequeña
    if (canvas.height < 0) canvas.height = 0;

    canvasWidth = canvas.width;
    canvasHeight = canvas.height;
    console.log(`Canvas resized to: ${canvasWidth}x${canvasHeight} (bottomMargin: ${bottomMargin})`);
    clearLevelTransitionTimer();
    initGame();
}

function initGame() {
    console.log("Initializing game...");
    if (typeof canvasWidth === 'undefined' || canvasWidth === 0) {
        canvasWidth = canvas.width || window.innerWidth;
        canvasHeight = (canvas.height || window.innerHeight) - bottomMargin;
        if (canvasHeight < 0) canvasHeight = 0;
        if (canvas.width === 0) canvas.width = canvasWidth;
        if (canvas.height === 0 || canvas.height === window.innerHeight) canvas.height = canvasHeight; // Ajustar si no se aplicó el margen
    }
    currentLevelIndex = 0;
    if (player) {
        player = null;
    }
    startLevel(currentLevelIndex, { resetPlayer: true, resetPlayerSize: true });
}

function clearLevelTransitionTimer() {
    if (levelTransitionTimeout) {
        clearTimeout(levelTransitionTimeout);
        levelTransitionTimeout = null;
    }
}

function showTemporaryMessage(text, duration = 2000) {
    messageEl.textContent = text;
    messageEl.style.display = 'block';
    restartButton.style.display = 'none';
    if (duration > 0) {
        setTimeout(() => {
            if (gameState === 'running') {
                messageEl.style.display = 'none';
            }
        }, duration);
    }
}

function startLevel(levelIndex, { resetPlayer = false, resetPlayerSize = false } = {}) {
    clearLevelTransitionTimer();
    currentLevelIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
    const levelConfig = levels[currentLevelIndex];

    baseSpeed = levelConfig.baseSpeed;
    levelAllowsPursuit = levelConfig.allowPursuit;
    initialOtherFishCount = levelConfig.fishCount;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    mouse.x = canvasWidth / 2;
    mouse.y = canvasHeight / 2;

    if (!player || resetPlayer) {
        const startingSize = resetPlayerSize ? playerInitialSize : (player ? player.size : playerInitialSize);
        player = new PlayerFish(canvasWidth / 2, canvasHeight / 2, startingSize, 'orange');
    } else {
        player.x = canvasWidth / 2;
        player.y = canvasHeight / 2;
    }

    if (resetPlayerSize && player) {
        player.size = playerInitialSize;
    }

    if (player) {
        player.setTarget(mouse.x, mouse.y);
        player.angle = 0;
    }

    otherFish = [];
    krill = [];
    activeKrillConfig = createKrillConfig(levelConfig.krill || {});
    lastKrillSpawnTime = Date.now();
    for (let i = 0; i < initialOtherFishCount; i++) {
        let size = Math.random() * 35 + 5;
        let x = Math.random() * (canvasWidth - size * 2) + size;
        let y = Math.random() * (canvasHeight - size * 2) + size;
        let color = getRandomColor();
        if (player && getDistance(x, y, player.x, player.y) > player.size + size + 60) {
            otherFish.push(new Fish(x, y, size, color));
        } else {
            i--;
        }
    }
    console.log(`Created ${otherFish.length} NPC fish for ${levelConfig.name}.`);

    if (activeKrillConfig.initial > 0) {
        for (let i = 0; i < activeKrillConfig.initial && krill.length < activeKrillConfig.max; i++) {
            spawnKrill();
        }
    }
    console.log(`Created ${krill.length} krill.`);

    bubbles = [];
    for (let i = 0; i < numBubbles; i++) {
        bubbles.push(new Bubble());
    }
    console.log(`Created ${bubbles.length} bubbles.`);

    gameState = 'running';
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    restartButton.style.display = 'none';

    gameLoop();
    showTemporaryMessage(`${levelConfig.name}: ${levelConfig.description}`);
}

function handleLevelClear() {
    if (gameState !== 'running') return;
    if (currentLevelIndex >= levels.length - 1) {
        winGame();
        return;
    }

    gameState = 'transition';
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    messageEl.textContent = `¡${levels[currentLevelIndex].name} completado!`;
    messageEl.style.display = 'block';
    restartButton.style.display = 'none';

    levelTransitionTimeout = setTimeout(() => {
        messageEl.style.display = 'none';
        startLevel(currentLevelIndex + 1);
    }, 2000);
}

function checkCollisions() {
    if (!player) return;
    if (activeKrillConfig) {
        for (let i = krill.length - 1; i >= 0; i--) {
            const item = krill[i];
            const dist = getDistance(player.x, player.y, item.x, item.y);
            if (dist < player.size + item.size * 0.6) {
                player.grow(item.size * activeKrillConfig.nutritionFactor);
                krill.splice(i, 1);
            }
        }
    }
    for (let i = otherFish.length - 1; i >= 0; i--) {
        const fish = otherFish[i];
        const dist = getDistance(player.x, player.y, fish.x, fish.y);
        const collThr = (player.size + fish.size) * 0.7;
        if (dist < collThr) {
            const szDiff = 0.1;
            if (player.size > fish.size + szDiff) {
                player.grow(fish.size);
                otherFish.splice(i, 1);
                console.log(`Ate fish! Remaining: ${otherFish.length}`);
                if (otherFish.length === 0) {
                    handleLevelClear();
                    return;
                }
            } else if (fish.size > player.size + szDiff) {
                gameOver();
                return;
            }
        }
    }
}

function updateGame() {
    if (gameState !== 'running' || !player) return;
    tailAnimationCounter++; // Incrementar el contador para la animación de la cola
    bubbles.forEach(b => b.update());
    krill.forEach(k => k.update());
    maintainKrillPopulation();
    player.update();
    otherFish.forEach(f => f.update(player)); // Pasar player para la IA
    checkCollisions();
}

function drawGame() { /* ... sin cambios en la estructura, pero usa canvasHeight ajustado ... */
    if (!player) return;
    ctx.fillStyle = '#004070';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    bubbles.forEach(b => b.draw());
    krill.forEach(k => k.draw());
    otherFish.forEach(f => f.draw());
    player.draw();
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Tamaño: ${player.size.toFixed(1)}`, 10, 20);
    ctx.fillText(`Peces restantes: ${otherFish.length}`, 10, 40);
    if (activeKrillConfig) {
        ctx.fillText(`Krill disponibles: ${krill.length}`, 10, 60);
    }
    const levelInfo = levels[currentLevelIndex];
    if (levelInfo) {
        const levelTextY = activeKrillConfig ? 80 : 60;
        ctx.fillText(`Nivel: ${levelInfo.name}`, 10, levelTextY);
    }
}
function gameLoop() { /* ... sin cambios ... */ if (gameState !== 'running') { if (animationId) { cancelAnimationFrame(animationId); animationId = null; } return; } updateGame(); drawGame(); animationId = requestAnimationFrame(gameLoop); }
function gameOver() { /* ... sin cambios ... */ console.log("Game Over!"); clearLevelTransitionTimer(); gameState = 'gameOver'; messageEl.textContent = '¡HAS SIDO COMIDO! GAME OVER'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }
function winGame() { /* ... sin cambios ... */ console.log("You Win!"); clearLevelTransitionTimer(); gameState = 'win'; messageEl.textContent = '¡FELICIDADES! ¡TE LOS COMISTE A TODOS!'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }

// --- Event Listeners (sin cambios respecto a la versión anterior funcional) ---
window.addEventListener('resize', () => { if (animationId) { cancelAnimationFrame(animationId); animationId = null; } resizeCanvas(); });
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let touchIdentifier = null;
if (isTouchDevice) { /* ... sin cambios ... */ console.log("Touch device detected. Using touch controls."); canvas.addEventListener('touchstart', (event) => { if (gameState !== 'running' || !player) return; event.preventDefault(); if (touchIdentifier === null && event.changedTouches.length > 0) { touchIdentifier = event.changedTouches[0].identifier; const rect = canvas.getBoundingClientRect(); const touch = event.changedTouches[0]; mouse.x = touch.clientX - rect.left; mouse.y = touch.clientY - rect.top; player.setTarget(mouse.x, mouse.y); } }, { passive: false }); canvas.addEventListener('touchmove', (event) => { if (gameState !== 'running' || !player) return; event.preventDefault(); for (let i = 0; i < event.changedTouches.length; i++) { const touch = event.changedTouches[i]; if (touch.identifier === touchIdentifier) { const rect = canvas.getBoundingClientRect(); mouse.x = touch.clientX - rect.left; mouse.y = touch.clientY - rect.top; player.setTarget(mouse.x, mouse.y); break; } } }, { passive: false }); const touchEndOrCancel = (event) => { if (gameState !== 'running' || !player) return; for (let i = 0; i < event.changedTouches.length; i++) { const touch = event.changedTouches[i]; if (touch.identifier === touchIdentifier) { touchIdentifier = null; break; } } }; canvas.addEventListener('touchend', touchEndOrCancel); canvas.addEventListener('touchcancel', touchEndOrCancel);
} else { /* ... sin cambios ... */ console.log("Desktop device detected. Using mouse controls."); canvas.addEventListener('mousemove', (event) => { if (gameState !== 'running' || !player) return; const rect = canvas.getBoundingClientRect(); mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top; player.setTarget(mouse.x, mouse.y); });
}
restartButton.addEventListener('click', () => { resizeCanvas(); });

// --- Inicio ---
resizeCanvas();
console.log("Script loaded. resizeCanvas and initGame should run.");