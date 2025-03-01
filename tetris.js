const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextPieceCanvas = document.getElementById('nextPiece');
const nextPieceCtx = nextPieceCanvas.getContext('2d');
const scoreElement = document.getElementById('score');

const BLOCK_SIZE = 32;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

// Tetromino shapes
const SHAPES = {
    'I': [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    'J': [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'L': [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'O': [
        [1, 1],
        [1, 1]
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
    ]
};

// Обновим цвета для более мягких оттенков
const COLORS = {
    'I': '#b4d7ff', // Нежно-голубой
    'O': '#ffd280', // Светло-оранжевый
    'T': '#e6c3ff', // Светло-фиолетовый
    'S': '#98ff98', // Светло-зеленый
    'Z': '#ffb6b6', // Светло-красный
    'J': '#add8e6', // Голубой
    'L': '#ffdab9'  // Персиковый
};

// Обновим константы звуков
const SOUNDS = {
    drop: new Audio('sounds/meow-short.mp3'),    // короткое мяу для падения
    clear: new Audio('sounds/wow-cat.mp3'),      // удивленное мяу для очистки линии
    gameOver: new Audio('sounds/sad-cat.mp3')    // грустное мяу для game over
};

// Добавим после констант
const EXPLOSION_PARTICLES = 20; // Количество частиц для взрыва

// Обновим стили фона в начале файла
document.body.style.backgroundColor = '#f0f0f0'; // Светлый фон

// Обновим класс Particle для более быстрого взрыва и использования лапок
class Particle {
    constructor(x, y, color) {
        // Пересчитываем координаты относительно реального положения блока на экране
        const realY = (BOARD_HEIGHT - y - 1) * BLOCK_SIZE; // Инвертируем Y координату
        
        this.x = x * BLOCK_SIZE + BLOCK_SIZE / 2;
        this.y = realY + BLOCK_SIZE / 2;  // Используем реальную Y координату
        this.color = color;
        this.size = BLOCK_SIZE / 4;
        
        // Случайный угол в диапазоне от 0 до 2π
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 40000 + 20000;
        
        // Теперь частицы разлетаются во всех направлениях
        this.speed = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        this.alpha = 1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 10;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Рисуем лапку
        const pawSize = this.size;
        ctx.fillStyle = this.color;
        
        // Создаем лапку с более четкими контурами
        ctx.beginPath();
        // Основная подушечка (сделаем больше)
        ctx.arc(0, 0, pawSize/2, 0, Math.PI * 2);
        // Пальчики (тоже увеличим)
        ctx.arc(-pawSize/2, -pawSize/2, pawSize/3, 0, Math.PI * 2);
        ctx.arc(0, -pawSize/1.8, pawSize/3, 0, Math.PI * 2);
        ctx.arc(pawSize/2, -pawSize/2, pawSize/3, 0, Math.PI * 2);
        ctx.fill();
        
        // Добавим контур для лучшей видимости
        ctx.strokeStyle = darkenColor(this.color, 20);
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }

    update() {
        this.x += this.speed.x * 0.016;
        this.y += this.speed.y * 0.016;
        this.rotation += this.rotationSpeed;
        this.alpha -= 0.005; // Замедлим исчезновение (было 0.01)
        this.size *= 0.99; // Замедлим уменьшение размера (было 0.98)
    }
}

let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
let score = 0;
let currentPiece = null;
let currentPiecePosition = { x: 0, y: 0 };
let nextPiece = null;

// Add new game state variables
let isPaused = false;
let gameLoop = null;

let particles = [];

// Добавим в начало файла
let soundsInitialized = false;

// Обновим функцию инициализации звуков
function initSounds() {
    if (soundsInitialized) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Загружаем и проигрываем все звуки с нулевой громкостью для инициализации
    Object.entries(SOUNDS).forEach(([key, sound]) => {
        sound.volume = 0;
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
            // Разная громкость для разных эффектов
            switch(key) {
                case 'drop':
                    sound.volume = 0.3;
                    break;
                case 'clear':
                    sound.volume = 0.4;
                    break;
                case 'gameOver':
                    sound.volume = 0.5;
                    break;
            }
        }).catch(e => console.log('Sound init failed:', e));
    });
    
    soundsInitialized = true;
    
    document.removeEventListener('click', initSounds);
    document.removeEventListener('keydown', initSounds);
}

// Добавим обработчик клика для инициализации звуков
document.addEventListener('click', initSounds);
document.addEventListener('keydown', initSounds);

function createPiece(type) {
    return {
        type: type,
        shape: SHAPES[type],
        color: COLORS[type]
    };
}

function getRandomPiece() {
    const pieces = 'IJLOSTZ';
    return createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
}

// Обновим функцию отрисовки блока, чтобы фигуры выглядели как стопки милых котиков в стиле изображения:
function drawBlock(ctx, x, y, color) {
    const blockX = x * BLOCK_SIZE;
    const blockY = y * BLOCK_SIZE;
    const size = BLOCK_SIZE - 1;

    ctx.save();
    
    // Основной силуэт котика
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    
    // Тело котика
    ctx.beginPath();
    
    // Нижняя часть (сидящая поза)
    ctx.moveTo(blockX + 5, blockY + size);
    ctx.lineTo(blockX + size - 5, blockY + size);
    
    // Правая сторона и хвост
    ctx.lineTo(blockX + size - 3, blockY + size * 0.7);
    ctx.lineTo(blockX + size + 2, blockY + size * 0.6); // хвост наружу
    ctx.lineTo(blockX + size - 2, blockY + size * 0.5); // хвост загибается
    
    // Спинка
    ctx.lineTo(blockX + size - 4, blockY + size * 0.3);
    
    // Голова
    ctx.lineTo(blockX + size - 6, blockY + 10);
    
    // Правое ухо (треугольное)
    ctx.lineTo(blockX + size - 8, blockY + 4);
    ctx.lineTo(blockX + size - 12, blockY);
    ctx.lineTo(blockX + size - 16, blockY + 4);
    
    // Левое ухо (треугольное)
    ctx.lineTo(blockX + 16, blockY + 4);
    ctx.lineTo(blockX + 12, blockY);
    ctx.lineTo(blockX + 8, blockY + 4);
    
    // Левая сторона
    ctx.lineTo(blockX + 6, blockY + 10);
    ctx.lineTo(blockX + 4, blockY + size * 0.3);
    ctx.lineTo(blockX + 5, blockY + size);
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Глазки (маленькие точки)
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(blockX + 12, blockY + 14, 1.5, 0, Math.PI * 2);
    ctx.arc(blockX + size - 12, blockY + 14, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Полоски на теле (если это полосатый котик)
    if (Math.random() > 0.5) {
        ctx.strokeStyle = darkenColor(color, 20);
        ctx.lineWidth = 1;
        
        // Горизонтальные полоски
        for (let i = 22; i < size - 2; i += 4) {
            ctx.beginPath();
            ctx.moveTo(blockX + 7, blockY + i);
            ctx.lineTo(blockX + size - 7, blockY + i);
            ctx.stroke();
        }
    }

    // Передние лапки
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    // Левая лапка
    ctx.beginPath();
    ctx.moveTo(blockX + 8, blockY + size);
    ctx.lineTo(blockX + 8, blockY + size - 3);
    ctx.stroke();
    // Правая лапка
    ctx.beginPath();
    ctx.moveTo(blockX + size - 8, blockY + size);
    ctx.lineTo(blockX + size - 8, blockY + size - 3);
    ctx.stroke();

    ctx.restore();
}

function drawPiece(ctx, piece, position) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(
                    ctx,
                    x + position.x,
                    y + position.y,
                    piece.color
                );
            }
        });
    });
}

// Обновим функцию drawBoard для светлой темы
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Используем максимально светлый оттенок
    ctx.fillStyle = '#FFFDF5';  // почти белый с едва заметным оранжевым оттенком
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Сделаем сетку чуть заметнее на очень светлом фоне
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.15)'; // очень светлая оранжевая сетка
    ctx.lineWidth = 1;

    // Вертикальные линии
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, canvas.height);
    }

    // Горизонтальные линии
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(canvas.width, y * BLOCK_SIZE);
    }
    
    ctx.stroke();
    
    // Draw board
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(ctx, x, y, value);
            }
        });
    });

    // Draw current piece
    if (currentPiece) {
        drawPiece(ctx, currentPiece, currentPiecePosition);
    }

    // Draw particles
    particles = particles.filter(particle => particle.alpha > 0);
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
}

function drawNextPiece() {
    nextPieceCtx.clearRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    if (nextPiece) {
        const position = {
            x: Math.floor((nextPieceCanvas.width / BLOCK_SIZE - nextPiece.shape[0].length) / 2),
            y: Math.floor((nextPieceCanvas.height / BLOCK_SIZE - nextPiece.shape.length) / 2)
        };
        drawPiece(nextPieceCtx, nextPiece, position);
    }
}

function isValidMove(piece, position) {
    return piece.shape.every((row, dy) => {
        return row.every((value, dx) => {
            let newX = position.x + dx;
            let newY = position.y + dy;
            return (
                value === 0 ||
                (newX >= 0 &&
                 newX < BOARD_WIDTH &&
                 newY < BOARD_HEIGHT &&
                 (newY < 0 || board[newY][newX] === 0))
            );
        });
    });
}

function rotatePiece(piece) {
    const newShape = piece.shape[0].map((_, i) =>
        piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: newShape };
}

function mergePiece() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const newY = y + currentPiecePosition.y;
                if (newY >= 0) {
                    board[newY][x + currentPiecePosition.x] = currentPiece.color;
                }
            }
        });
    });

    // Проверяем окончание игры после слияния фигуры
    if (checkGameOver()) {
        gameOver();
    }
}

// Обновим функцию clearLines для создания эффекта взрыва
function clearLines() {
    let linesCleared = 0;
    let linesToClear = [];
    
    // Находим заполненные линии снизу вверх
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            linesToClear.push(y);
            linesCleared++;
        }
    }
    
    if (linesCleared > 0) {
        // Сначала создаем частицы для всех линий
        linesToClear.forEach(y => {
            const lineColors = board[y].map(color => color || '#fff');
            
            // Создаем частицы для каждой клетки в линии
            for (let x = 0; x < BOARD_WIDTH; x++) {
                for (let i = 0; i < 100; i++) {
                    particles.push(new Particle(x, y, lineColors[x]));
                }
            }
            
            playSound(SOUNDS.clear);
        });

        // Затем удаляем линии, начиная с нижней
        linesToClear.sort((a, b) => b - a).forEach(y => {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
        });

        score += [0, 100, 300, 500, 800][linesCleared];
        scoreElement.textContent = score;
    }
}

function spawnPiece() {
    if (!nextPiece) {
        nextPiece = getRandomPiece();
    }
    
    currentPiece = nextPiece;
    nextPiece = getRandomPiece();
    currentPiecePosition = {
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(currentPiece.shape[0].length / 2),
        y: -2
    };
    
    drawNextPiece();
    
    // Проверяем, может ли новая фигура быть размещена
    if (!isValidMove(currentPiece, currentPiecePosition)) {
        gameOver();
    }
}

function resetGame() {
    // Clear existing game loop if any
    if (gameLoop) {
        clearInterval(gameLoop);
    }
    
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
    score = 0;
    scoreElement.textContent = '0';
    currentPiece = null;
    nextPiece = null;
    isPaused = false;
    
    spawnPiece();
    drawBoard();
    
    // Start new game loop
    gameLoop = setInterval(update, 1000);
}

function moveDown() {
    const newPosition = { ...currentPiecePosition, y: currentPiecePosition.y + 1 };
    
    if (isValidMove(currentPiece, newPosition)) {
        currentPiecePosition = newPosition;
        return true;
    }
    
    playSound(SOUNDS.drop);
    mergePiece();
    clearLines();
    spawnPiece();
    return false;
}

function update() {
    if (!isPaused) {
        moveDown();
        drawBoard();
    }
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        // Draw "PAUSED" text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    } else {
        drawBoard();
    }
}

// Создадим пул звуков для одновременного воспроизведения
const SOUND_POOLS = {};
const POOL_SIZE = 5;

// Инициализация пулов звуков
Object.entries(SOUNDS).forEach(([key, sound]) => {
    SOUND_POOLS[key] = Array(POOL_SIZE).fill(null).map(() => {
        const audio = new Audio(sound.src);
        audio.volume = 0.3;
        return audio;
    });
});

// Обновленная функция воспроизведения звука
function playSound(sound) {
    try {
        // Создаем новый экземпляр звука
        const newSound = new Audio(sound.src);
        newSound.volume = 0.3;
        
        // Воспроизводим звук
        const playPromise = newSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Sound play failed:', error);
                // Пробуем альтернативный метод воспроизведения
                sound.currentTime = 0;
                sound.play().catch(e => console.log('Alternative play failed:', e));
            });
        }
    } catch (error) {
        console.log('Sound creation failed:', error);
    }
}

// Предзагрузка звуков
Object.values(SOUNDS).forEach((sound, index) => {
    sound.dataset.soundId = Object.keys(SOUNDS)[index];
    sound.load();
});

document.addEventListener('keydown', event => {
    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }
    
    if (event.key === 'r' || event.key === 'R') {
        resetGame();
        return;
    }
    
    if (isPaused || !currentPiece) return;

    switch (event.key) {
        case 'ArrowLeft':
            if (isValidMove(currentPiece, { ...currentPiecePosition, x: currentPiecePosition.x - 1 })) {
                currentPiecePosition.x--;
                drawBoard();
            }
            break;
            
        case 'ArrowRight':
            if (isValidMove(currentPiece, { ...currentPiecePosition, x: currentPiecePosition.x + 1 })) {
                currentPiecePosition.x++;
                drawBoard();
            }
            break;
            
        case 'ArrowDown':
            if (moveDown()) {
                playSound(SOUNDS.drop);
            }
            drawBoard();
            break;
            
        case 'ArrowUp':
            const rotated = rotatePiece(currentPiece);
            if (isValidMove(rotated, currentPiecePosition)) {
                currentPiece = rotated;
                drawBoard();
            }
            break;
            
        case ' ':
            while (moveDown()) {}
            playSound(SOUNDS.drop);
            drawBoard();
            break;
    }
});

// Добавим функцию проверки окончания игры
function checkGameOver() {
    // Проверяем, есть ли блоки в первых двух рядах
    for (let x = 0; x < BOARD_WIDTH; x++) {
        if (board[0][x] !== 0 || board[1][x] !== 0) {
            return true;
        }
    }
    return false;
}

// Добавим отдельную функцию для окончания игры
function gameOver() {
    playSound(SOUNDS.gameOver);
    
    // Создаем и загружаем изображение кошки
    const catImage = new Image();
    catImage.src = 'public/images/game-over-cat.png';
    
    // Ждем загрузки изображения перед началом анимации
    catImage.onload = () => {
        let alpha = 0;
        const gameOverAnimation = setInterval(() => {
            // Сначала очищаем канвас
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Рисуем последнее состояние игры
            board.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        drawBlock(ctx, x, y, value);
                    }
                });
            });
            
            // Затемняем фон
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.5})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Рисуем изображение кошки
            ctx.globalAlpha = alpha;
            const scale = Math.min(
                canvas.width / catImage.width,
                canvas.height / catImage.height
            ) * 0.8;
            
            const scaledWidth = catImage.width * scale;
            const scaledHeight = catImage.height * scale;
            const x = (canvas.width - scaledWidth) / 2;
            const y = (canvas.height - scaledHeight) / 2;
            
            ctx.drawImage(catImage, x, y, scaledWidth, scaledHeight);
            
            // Рисуем текст
            if (alpha >= 0.5) {
                clearInterval(gameOverAnimation);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#FFF'; // Белый цвет для текста
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width / 2, y - 40);
                ctx.font = 'bold 24px Arial';
                ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height - 100);
                ctx.fillText('Press R to restart', canvas.width / 2, canvas.height - 60);
            }
            
            ctx.globalAlpha = 1;
            alpha += 0.02;
        }, 30);
    };
    
    // Если изображение не загрузилось, показываем просто текст
    catImage.onerror = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2);
        ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 40);
    };

    isPaused = true;
    if (gameLoop) {
        clearInterval(gameLoop);
    }
}

// Вспомогательные функции для работы с цветом
function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (
        0x1000000 +
        (R > 0 ? R : 0) * 0x10000 +
        (G > 0 ? G : 0) * 0x100 +
        (B > 0 ? B : 0)
    ).toString(16).slice(1);
}

// Добавим в начало файла после определения констант
function createPawBackground() {
    const pawBackground = document.querySelector('.paw-background');
    // Создаем 50 лапок
    for (let i = 0; i < 50; i++) {
        const paw = document.createElement('div');
        paw.className = 'paw';
        paw.style.cssText = `
            position: absolute;
            width: 30px;
            height: 30px;
            background-image: url('public/images/pow.png');
            background-size: contain;
            background-repeat: no-repeat;
            opacity: 0.1;
            left: ${Math.random() * 100}vw;
            top: ${Math.random() * 100}vh;
            transform: rotate(${Math.random() * 360}deg);
        `;
        pawBackground.appendChild(paw);
    }
}

// Вызываем функцию после загрузки страницы
window.addEventListener('load', createPawBackground);

// Remove the setInterval call at the bottom since it's now in resetGame
resetGame(); 