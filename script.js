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
let jellyfish = [];
let mines = [];
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
        description: 'Más peces grandes comienzan a perseguirte.',
        fishCount: 20,
        baseSpeed: 0.9,
        allowPursuit: true,
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
        description: 'Muchos peces, persecución y medusas peligrosas.',
        fishCount: 28,
        baseSpeed: 1.05,
        allowPursuit: true,
        krill: {
            initial: 8,
            min: 4,
            max: 10,
            respawnInterval: 6000,
            spawnBatch: 2,
            nutritionFactor: 0.65
        },
        jellyfish: {
            count: 14,
            minSize: 24,
            maxSize: 36
        }
    }
];

const bossLevel = {
    name: 'Nivel Final',
    description: 'Activa minas y hazlas explotar cerca del tiburón.',
    playerSize: 55,
    sharkSize: 90,
    baseSpeed: 1.1,
    sharkSpeedMultiplier: 1.45,
    sharkHealth: 3,
    mines: {
        initial: 4,
        min: 3,
        max: 6,
        respawnInterval: 5000,
        spawnBatch: 1,
        minSize: 18,
        maxSize: 26,
        idleLifetime: 12000,
        explosionDelay: 3000,
        explosionDuration: 900,
        explosionRadiusFactor: 3.2
    }
};

let currentLevelIndex = 0;
let levelAllowsPursuit = true;
let levelTransitionTimeout = null;
let activeKrillConfig = null;
let lastKrillSpawnTime = 0;
const playerInitialSize = 15;
let bossBattleActive = false;
let bossShark = null;
let activeMineConfig = null;
let lastMineSpawnTime = 0;

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

class Shark extends Fish {
    constructor(x, y, size, color, speedMultiplier = 1.2, maxHealth = 3) {
        super(x, y, size, color, speedMultiplier);
        this.baseSpeed = baseSpeed * speedMultiplier;
        this.turnRate = turnSpeedFleePursue * 1.3;
        this.huntSpeedMultiplier = 1.3;
        this.maxHealth = Math.max(1, maxHealth);
        this.health = this.maxHealth;
        this.lastDamageTime = 0;
        this.damageCooldown = 250;
    }

    update(playerFish) {
        if (!playerFish) return;
        const target = { x: playerFish.x, y: playerFish.y };
        let desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
        desiredAngle = Math.atan2(Math.sin(desiredAngle), Math.cos(desiredAngle));
        let angleDiff = desiredAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > this.turnRate) {
            this.angle += Math.sign(angleDiff) * this.turnRate;
        } else {
            this.angle = desiredAngle;
        }
        const finalSpeed = this.baseSpeed * this.huntSpeedMultiplier;
        this.x += Math.cos(this.angle) * finalSpeed;
        this.y += Math.sin(this.angle) * finalSpeed;
        this.x = Math.max(this.size * 0.75, Math.min(canvasWidth - this.size * 0.75, this.x));
        this.y = Math.max(this.size * 0.75, Math.min(canvasHeight - this.size * 0.75, this.y));
    }

    takeDamage(amount = 1) {
        const now = Date.now();
        if (now - this.lastDamageTime < this.damageCooldown) {
            return false;
        }
        this.lastDamageTime = now;
        this.health = Math.max(0, this.health - amount);
        return this.health <= 0;
    }

    getHealthRatio() {
        return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const bodyLength = this.size * 1.8;
        const bodyHeight = this.size * 0.75;
        const tailWidth = this.size;
        const healthRatio = this.getHealthRatio();
        const bodyColor = healthRatio < 1 ? `rgba(109, 169, 210, ${0.7 + 0.3 * healthRatio})` : '#6da9d2';
        const accentColor = '#5c8db3';

        ctx.beginPath();
        ctx.ellipse(0, 0, bodyLength * 0.5, bodyHeight * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        ctx.save();
        this.tailAngleOffset = Math.sin(this.tailAnimationPhase + tailAnimationCounter * tailAnimationSpeed) * tailMaxAngleOffset * 0.65;
        ctx.rotate(this.tailAngleOffset);
        ctx.beginPath();
        ctx.moveTo(-bodyLength * 0.45, 0);
        ctx.lineTo(-bodyLength * 0.45 - tailWidth * 0.6, -bodyHeight * 0.6);
        ctx.lineTo(-bodyLength * 0.45 - tailWidth * 0.6, bodyHeight * 0.6);
        ctx.closePath();
        ctx.fillStyle = accentColor;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(0, -bodyHeight * 0.65);
        ctx.lineTo(-bodyLength * 0.08, -bodyHeight * 1.25);
        ctx.lineTo(bodyLength * 0.12, -bodyHeight * 0.65);
        ctx.closePath();
        ctx.fillStyle = accentColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.38, 0);
        ctx.lineTo(bodyLength * 0.53, -bodyHeight * 0.35);
        ctx.lineTo(bodyLength * 0.65, 0);
        ctx.fillStyle = '#aac9e1';
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(bodyLength * 0.32, 0, bodyLength * 0.2, bodyHeight * 0.65, 0, -Math.PI / 7, Math.PI / 7);
        ctx.fillStyle = accentColor;
        ctx.fill();

        const eyeX = bodyLength * 0.22;
        const eyeY = -bodyHeight * 0.28;
        const eyeRadius = this.size * 0.13;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f5ff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyeRadius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#12273d';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(bodyLength * 0.47, bodyHeight * 0.18);
        ctx.lineTo(bodyLength * 0.63, bodyHeight * 0.22);
        ctx.lineTo(bodyLength * 0.5, bodyHeight * 0.38);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
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

        const bodyWidth = this.size;
        const bodyHeight = this.size * 0.7;

        ctx.beginPath();
        ctx.ellipse(0, 0, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 40, 40, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bodyWidth * 0.2, -bodyHeight * 0.2, bodyHeight * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 80, 80, 0.95)';
        ctx.fill();

        const legCount = 4;
        const legSpacing = (bodyWidth * 1.6) / (legCount - 1);
        const startX = -bodyWidth * 0.8;
        for (let i = 0; i < legCount; i++) {
            const legX = startX + i * legSpacing;
            ctx.beginPath();
            ctx.moveTo(legX, bodyHeight * 0.5);
            ctx.quadraticCurveTo(
                legX + bodyWidth * 0.05,
                bodyHeight * 1.0,
                legX + bodyWidth * 0.1,
                bodyHeight * 1.5
            );
            ctx.strokeStyle = 'rgba(180, 20, 20, 0.9)';
            ctx.lineWidth = Math.max(1, this.size * 0.12);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Jellyfish {
    constructor(x, y, size) {
        this.x = x;
        this.baseY = y;
        this.size = size;
        this.floatAmplitude = Math.random() * 12 + 10;
        this.floatSpeed = Math.random() * 0.01 + 0.008;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.driftSpeedX = (Math.random() - 0.5) * 0.15;
        this.y = y;
        this.tentacleCount = 6 + Math.floor(Math.random() * 4);
    }

    update() {
        this.floatPhase += this.floatSpeed;
        const floatOffset = Math.sin(this.floatPhase) * this.floatAmplitude;
        this.x += this.driftSpeedX;

        if (this.x < this.size) {
            this.x = this.size;
            this.driftSpeedX *= -1;
        } else if (this.x > canvasWidth - this.size) {
            this.x = canvasWidth - this.size;
            this.driftSpeedX *= -1;
        }

        this.y = this.baseY + floatOffset;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        const headRadius = this.size * 0.7;
        const baseHeight = headRadius * 0.4;

        ctx.beginPath();
        ctx.arc(0, 0, headRadius, Math.PI, 0, false);
        ctx.lineTo(headRadius * 0.8, baseHeight);
        ctx.quadraticCurveTo(0, baseHeight * 1.2, -headRadius * 0.8, baseHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 160, 255, 0.88)';
        ctx.fill();

        ctx.strokeStyle = 'rgba(170, 130, 230, 0.75)';
        ctx.lineWidth = Math.max(1.4, this.size * 0.07);
        for (let i = 0; i < this.tentacleCount; i++) {
            const spread = (i - (this.tentacleCount - 1) / 2);
            const startX = spread * headRadius * 0.18;
            const startY = baseHeight * 0.9;
            const controlX = startX * 0.6;
            const controlY = baseHeight * 2.0;
            const endX = startX * 0.8;
            const endY = baseHeight * 2.8 + this.size * 0.6;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(controlX, controlY, endX, endY);
            ctx.stroke();
        }

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

function getHeadPosition(fish, distanceFactor = 1) {
    return {
        x: fish.x + Math.cos(fish.angle) * fish.size * distanceFactor,
        y: fish.y + Math.sin(fish.angle) * fish.size * distanceFactor
    };
}

function getTailPosition(fish, distanceFactor = 1) {
    return {
        x: fish.x - Math.cos(fish.angle) * fish.size * distanceFactor,
        y: fish.y - Math.sin(fish.angle) * fish.size * distanceFactor
    };
}

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

function createMineConfig(config = {}) {
    const minSize = Math.max(8, config.minSize ?? 16);
    const maxSize = Math.max(minSize, config.maxSize ?? 24);
    return {
        initial: Math.max(0, config.initial ?? 3),
        min: Math.max(0, config.min ?? 2),
        max: Math.max(config.max ?? 5, config.min ?? 2, config.initial ?? 3),
        respawnInterval: Math.max(1000, config.respawnInterval ?? 5000),
        spawnBatch: Math.max(1, config.spawnBatch ?? 1),
        minSize,
        maxSize,
        idleLifetime: Math.max(2000, config.idleLifetime ?? 10000),
        explosionDelay: Math.max(500, config.explosionDelay ?? 3000),
        explosionDuration: Math.max(200, config.explosionDuration ?? 900),
        explosionRadiusFactor: Math.max(1.5, config.explosionRadiusFactor ?? 3.0)
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
    if (bossBattleActive || !activeKrillConfig || gameState !== 'running') return;
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

function spawnMine() {
    if (!activeMineConfig || !canvasWidth || !canvasHeight) return null;
    if (mines.length >= activeMineConfig.max) return null;
    let attempts = 0;
    while (attempts < 30) {
        const size = Math.random() * (activeMineConfig.maxSize - activeMineConfig.minSize) + activeMineConfig.minSize;
        const x = Math.random() * (canvasWidth - size * 2) + size;
        const y = Math.random() * (canvasHeight - size * 2) + size;
        const tooCloseToPlayer = player && getDistance(x, y, player.x, player.y) < player.size + size + 80;
        const tooCloseToShark = bossShark && getDistance(x, y, bossShark.x, bossShark.y) < bossShark.size + size + 120;
        const tooCloseToMine = mines.some(existing => getDistance(x, y, existing.x, existing.y) < (existing.size + size) * 1.3);
        if (!tooCloseToPlayer && !tooCloseToShark && !tooCloseToMine) {
            const mine = new Mine(x, y, size, activeMineConfig);
            mines.push(mine);
            return mine;
        }
        attempts++;
    }
    return null;
}

function maintainMinePopulation() {
    if (!bossBattleActive || !activeMineConfig || gameState !== 'running') return;
    mines = mines.filter(mine => !mine.isExpired());
    if (mines.length < activeMineConfig.min) {
        let spawnedAny = false;
        while (mines.length < activeMineConfig.min && mines.length < activeMineConfig.max) {
            const spawned = spawnMine();
            if (!spawned) break;
            spawnedAny = true;
        }
        if (spawnedAny) {
            lastMineSpawnTime = Date.now();
        }
        return;
    }
    if (mines.length >= activeMineConfig.max) return;
    const now = Date.now();
    if (now - lastMineSpawnTime >= activeMineConfig.respawnInterval) {
        const batch = Math.min(activeMineConfig.spawnBatch, activeMineConfig.max - mines.length);
        let spawnedAny = false;
        for (let i = 0; i < batch; i++) {
            const spawned = spawnMine();
            if (spawned) {
                spawnedAny = true;
            }
        }
        if (spawnedAny) {
            lastMineSpawnTime = now;
        }
    }
}

class Mine {
    constructor(x, y, size, config = {}) {
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.size = size;
        this.config = config;
        this.state = 'idle';
        this.spawnTime = Date.now();
        this.triggerTime = 0;
        this.explosionStart = 0;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.floatSpeed = Math.random() * 0.015 + 0.01;
        this.floatAmplitude = Math.random() * 6 + 4;
        this.driftSpeedX = (Math.random() - 0.5) * 0.08;
        this.explosionRadius = size * (config.explosionRadiusFactor ?? 3.2);
        this.idleLifetime = Math.max(2000, config.idleLifetime ?? 10000);
        this.explosionDelay = Math.max(500, config.explosionDelay ?? 3000);
        this.explosionDuration = Math.max(200, config.explosionDuration ?? 900);
        this.hasDamagedShark = false;
    }

    update() {
        const now = Date.now();
        this.floatPhase += this.floatSpeed;
        this.y = this.baseY + Math.sin(this.floatPhase) * this.floatAmplitude;
        this.x += this.driftSpeedX;
        if (this.x < this.size * 0.8 || this.x > canvasWidth - this.size * 0.8) {
            this.driftSpeedX *= -1;
            this.x = Math.max(this.size * 0.8, Math.min(canvasWidth - this.size * 0.8, this.x));
        }

        if (this.state === 'idle' && now - this.spawnTime >= this.idleLifetime) {
            this.state = 'spent';
        } else if (this.state === 'armed' && now - this.triggerTime >= this.explosionDelay) {
            this.state = 'exploding';
            this.explosionStart = now;
            this.hasDamagedShark = false;
        } else if (this.state === 'exploding' && now - this.explosionStart >= this.explosionDuration) {
            this.state = 'spent';
        }
    }

    arm() {
        if (this.state === 'idle') {
            this.state = 'armed';
            this.triggerTime = Date.now();
        }
    }

    getExplosionRadius() {
        return this.explosionRadius;
    }

    isExpired() {
        return this.state === 'spent';
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'exploding') {
            const elapsed = Date.now() - this.explosionStart;
            const progress = Math.min(1, elapsed / this.explosionDuration);
            const radius = this.explosionRadius * (0.7 + 0.3 * progress);
            const alpha = 0.7 - 0.5 * progress;
            const gradient = ctx.createRadialGradient(0, 0, this.size * 0.2, 0, 0, radius);
            gradient.addColorStop(0, `rgba(255, 220, 120, ${alpha})`);
            gradient.addColorStop(0.4, `rgba(255, 120, 0, ${alpha * 0.8})`);
            gradient.addColorStop(1, 'rgba(40, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        const spikes = 8;
        const spikeLength = this.size * 0.65;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = this.size * 0.15;
        for (let i = 0; i < spikes; i++) {
            const angle = (Math.PI * 2 * i) / spikes;
            const sx = Math.cos(angle) * (this.size * 0.6);
            const sy = Math.sin(angle) * (this.size * 0.6);
            const ex = Math.cos(angle) * (this.size * 0.6 + spikeLength);
            const ey = Math.sin(angle) * (this.size * 0.6 + spikeLength);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0b0b';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#1c1c1c';
        ctx.fill();

        if (this.state === 'armed') {
            const pulse = 0.5 + Math.sin(Date.now() / 120) * 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 70, 70, ${0.5 + pulse * 0.5})`;
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#050505';
            ctx.fill();
        }

        ctx.restore();
    }
}

function spawnJellyfish(count, minSize, maxSize) {
    jellyfish = [];
    let attempts = 0;
    while (jellyfish.length < count && attempts < count * 10) {
        const size = Math.random() * (maxSize - minSize) + minSize;
        const x = Math.random() * (canvasWidth - size * 2) + size;
        const y = Math.random() * (canvasHeight - size * 2) + size;
        const tooCloseToPlayer = player && getDistance(x, y, player.x, player.y) < player.size + size + 80;
        const tooCloseToOthers = jellyfish.some(existing => getDistance(x, y, existing.x, existing.y) < existing.size + size + 40);
        if (!tooCloseToPlayer && !tooCloseToOthers) {
            jellyfish.push(new Jellyfish(x, y, size));
        }
        attempts++;
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
    bossBattleActive = false;
    bossShark = null;
    activeMineConfig = null;
    lastMineSpawnTime = 0;
    mines = [];
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
    jellyfish = [];
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

    if (levelConfig.jellyfish && levelConfig.jellyfish.count > 0) {
        spawnJellyfish(
            levelConfig.jellyfish.count,
            levelConfig.jellyfish.minSize || 20,
            levelConfig.jellyfish.maxSize || 32
        );
        console.log(`Created ${jellyfish.length} jellyfish.`);
    }

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

function startBossBattle() {
    console.log('Starting boss battle...');
    clearLevelTransitionTimer();
    bossBattleActive = true;
    levelAllowsPursuit = true;
    activeKrillConfig = null;
    activeMineConfig = createMineConfig(bossLevel.mines || {});
    lastMineSpawnTime = Date.now();
    krill = [];
    jellyfish = [];
    mines = [];
    otherFish = [];
    baseSpeed = bossLevel.baseSpeed;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    const desiredPlayerSize = Math.max(player ? player.size : playerInitialSize, bossLevel.playerSize);
    if (!player) {
        player = new PlayerFish(canvasWidth / 3, canvasHeight / 2, desiredPlayerSize, 'orange');
    }
    player.size = desiredPlayerSize;
    player.x = canvasWidth / 3;
    player.y = canvasHeight / 2;
    player.setTarget(player.x, player.y);

    mouse.x = player.x;
    mouse.y = player.y;

    bossShark = new Shark(
        canvasWidth * 0.7,
        canvasHeight / 2,
        bossLevel.sharkSize,
        '#5fa3d7',
        bossLevel.sharkSpeedMultiplier,
        bossLevel.sharkHealth
    );
    otherFish.push(bossShark);

    if (activeMineConfig.initial > 0) {
        for (let i = 0; i < activeMineConfig.initial && mines.length < activeMineConfig.max; i++) {
            spawnMine();
        }
    }

    bubbles = [];
    for (let i = 0; i < numBubbles; i++) {
        bubbles.push(new Bubble());
    }

    gameState = 'running';
    messageEl.textContent = '';
    messageEl.style.display = 'none';
    restartButton.style.display = 'none';

    gameLoop();
    showTemporaryMessage(`${bossLevel.name}: ${bossLevel.description}. ¡Haz que las minas exploten cerca del tiburón!`, 4200);
}

function handleLevelClear() {
    if (gameState !== 'running') return;
    if (currentLevelIndex >= levels.length - 1) {
        gameState = 'transition';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        messageEl.textContent = `¡${levels[currentLevelIndex].name} completado! Se acerca el tiburón gigante...`;
        messageEl.style.display = 'block';
        restartButton.style.display = 'none';

        levelTransitionTimeout = setTimeout(() => {
            messageEl.style.display = 'none';
            startBossBattle();
        }, 2300);
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
        startLevel(currentLevelIndex + 1, { resetPlayerSize: true });
    }, 2000);
}

function checkCollisions() {
    if (!player) return;
    if (bossBattleActive) {
        checkBossBattleCollisions();
        return;
    }
    if (jellyfish.length > 0) {
        for (let i = 0; i < jellyfish.length; i++) {
            const jelly = jellyfish[i];
            const dist = getDistance(player.x, player.y, jelly.x, jelly.y);
            if (dist < player.size + jelly.size * 0.4) {
                gameOver();
                return;
            }
        }
    }
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

function checkBossBattleCollisions() {
    if (!bossBattleActive || !bossShark || !player) return;

    const distanceToShark = getDistance(player.x, player.y, bossShark.x, bossShark.y);
    const sharkBiteRange = (player.size + bossShark.size) * 0.5;
    if (distanceToShark < sharkBiteRange) {
        loseBossBattle('¡El tiburón te alcanzó! Mantente lejos y usa las minas.');
        return;
    }

    for (let i = 0; i < mines.length; i++) {
        const mine = mines[i];
        const distToPlayer = getDistance(player.x, player.y, mine.x, mine.y);
        if (mine.state === 'idle' && distToPlayer < player.size + mine.size * 0.6) {
            mine.arm();
        }

        if (mine.state === 'exploding') {
            const radius = mine.getExplosionRadius();
            if (distToPlayer < radius) {
                loseBossBattle('¡La explosión te alcanzó! Aléjate después de activar una mina.');
                return;
            }

            if (!mine.hasDamagedShark) {
                const distToShark = getDistance(bossShark.x, bossShark.y, mine.x, mine.y);
                if (distToShark < radius) {
                    mine.hasDamagedShark = true;
                    const defeated = bossShark.takeDamage(1);
                    if (defeated) {
                        winBossBattle();
                        return;
                    } else {
                        showTemporaryMessage('¡Impacto directo! El tiburón perdió vida.', 1400);
                    }
                }
            }
        }
    }
}

function winBossBattle() {
    bossBattleActive = false;
    bossShark = null;
    activeMineConfig = null;
    mines = [];
    lastMineSpawnTime = 0;
    otherFish = [];
    winGame('¡Venciste al tiburón! Las minas salvaron el día.');
}

function loseBossBattle(customMessage) {
    bossBattleActive = false;
    bossShark = null;
    activeMineConfig = null;
    mines = [];
    lastMineSpawnTime = 0;
    otherFish = [];
    gameOver(customMessage || '¡El tiburón te derrotó! Inténtalo de nuevo.');
}

function updateGame() {
    if (gameState !== 'running' || !player) return;
    tailAnimationCounter++; // Incrementar el contador para la animación de la cola
    bubbles.forEach(b => b.update());
    krill.forEach(k => k.update());
    jellyfish.forEach(j => j.update());
    if (bossBattleActive) {
        mines.forEach(m => m.update());
        maintainMinePopulation();
    } else {
        maintainKrillPopulation();
    }
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
    jellyfish.forEach(j => j.draw());
    otherFish.forEach(f => f.draw());
    player.draw();
    mines.forEach(m => m.draw());

    if (bossBattleActive && bossShark) {
        const barMargin = 16;
        const barHeight = 18;
        const barWidth = canvasWidth - barMargin * 2;
        const healthRatio = Math.max(0, Math.min(1, bossShark.getHealthRatio())) || 0;
        ctx.fillStyle = 'rgba(5, 15, 35, 0.7)';
        ctx.fillRect(barMargin, barMargin, barWidth, barHeight);
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(barMargin + 2, barMargin + 2, (barWidth - 4) * healthRatio, barHeight - 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barMargin, barMargin, barWidth, barHeight);
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('Vida del Tiburón', canvasWidth / 2, barMargin + barHeight - 5);
        ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Tamaño: ${player.size.toFixed(1)}`, 10, 20);
    let hudY = 40;
    if (bossBattleActive) {
        ctx.fillText('Final: activa minas y aléjate antes de que exploten', 10, hudY);
        hudY += 20;
        ctx.fillText('Las explosiones cerca del tiburón le quitan vida', 10, hudY);
        hudY += 20;
        ctx.fillText(`Minas flotando: ${mines.length}`, 10, hudY);
        hudY += 20;
    } else {
        ctx.fillText(`Peces restantes: ${otherFish.length}`, 10, hudY);
        hudY += 20;
        if (activeKrillConfig) {
            ctx.fillText(`Krill disponibles: ${krill.length}`, 10, hudY);
            hudY += 20;
        }
        if (jellyfish.length > 0) {
            ctx.fillText(`Medusas: ${jellyfish.length}`, 10, hudY);
            hudY += 20;
        }
    }
    const levelInfo = bossBattleActive ? bossLevel : levels[currentLevelIndex];
    if (levelInfo) {
        const label = bossBattleActive ? 'Desafío' : 'Nivel';
        ctx.fillText(`${label}: ${levelInfo.name}`, 10, hudY);
    }
}
function gameLoop() { /* ... sin cambios ... */ if (gameState !== 'running') { if (animationId) { cancelAnimationFrame(animationId); animationId = null; } return; } updateGame(); drawGame(); animationId = requestAnimationFrame(gameLoop); }
function gameOver(customMessage) { /* ... sin cambios ... */ console.log("Game Over!"); clearLevelTransitionTimer(); gameState = 'gameOver'; messageEl.textContent = customMessage || '¡HAS SIDO COMIDO! GAME OVER'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }
function winGame(customMessage) { /* ... sin cambios ... */ console.log("You Win!"); clearLevelTransitionTimer(); gameState = 'win'; messageEl.textContent = customMessage || '¡FELICIDADES! ¡TE LOS COMISTE A TODOS!'; messageEl.style.display = 'block'; restartButton.style.display = 'block'; if (animationId) cancelAnimationFrame(animationId); animationId = null; }

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