import './style.css'

// Constantes del juego
const ANIMATION_DURATION = 600;
const CHECK_MATCH_DELAY = 1600;
const GAME_STATES = {
    IDLE: 'idle',
    PLAYING: 'playing',
    CHECKING: 'checking',
    FINISHED: 'finished'
};

const LEVELS = {
    EASY: '2x2',
    MEDIUM: '4x3',
    HARD: '4x4',
    EXPERT: '4x5',
    MASTER: '4x6'
};

/**
 * Gestor de audio para el juego de memoria
 * @class AudioManager
 * @description Maneja la carga y reproducción de efectos de sonido del juego.
 * Implementa precarga de audio y manejo de errores.
 */
class AudioManager {
    constructor() {
        this.sounds = {
            match: new Audio('/src/sound/success.mp3'),
            win: new Audio('/src/sound/win.mp3'),
            fail: new Audio('/src/sound/lose.mp3')
        };

        // Precarga de sonidos
        Object.entries(this.sounds).forEach(([name, sound]) => {
            sound.load();
            sound.preload = 'auto';
            sound.onerror = () => console.warn(`No se pudo cargar el sonido: ${name}`);
        });
    }

    play(soundName) {
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => {
                console.warn(`No se pudo reproducir el sonido ${soundName}:`, e);
            });
        }
    }
}

/**
 * @class MemoryGame
 * @description Clase principal del juego de memoria.
 * Gestiona la lógica del juego, el estado, la interfaz de usuario y las interacciones.
 */
class MemoryGame {
    constructor() {
        this.audioManager = new AudioManager();
        this.selectedCards = [];
        this.allowClick = true;
        this.timer = null;
        this.seconds = 0;
        this.turns = 0;
        this.gameState = GAME_STATES.IDLE;

        // Array de símbolos para las cartas con validación
        if (!Array.isArray(this.symbols) || this.symbols.length === 0) {
            this.symbols = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
                "A", "B", "C", "L", "W", "X", "Y", "Z", "M", "N", "O", "P", "Q",
                "R", "S", "T", "U", "V"];
        }

        // Cache de elementos DOM con validación
        this.elements = this.initializeDOMElements();

        if (!this.validateDOMElements()) {
            console.error('No se pudieron encontrar todos los elementos necesarios del DOM');
            return;
        }

        this.bindEvents();
    }

    /**
     * @private
     * @method initializeDOMElements
     * @description Inicializa y valida los elementos del DOM necesarios
     * @returns {Object} Objeto con referencias a elementos del DOM
     */
    initializeDOMElements() {
        return {
            gameBoard: document.querySelector('.game-board'),
            timerDisplay: document.getElementById('timerDisplay'),
            turnsDisplay: document.getElementById('turnsDisplay'),
            themeSelect: document.getElementById('theme'),
            levelSelect: document.getElementById('level'),
            message: document.querySelector('.message')
        };
    }

    /**
     * @private
     * @method validateDOMElements
     * @description Valida que todos los elementos del DOM necesarios existan
     * @returns {boolean} true si todos los elementos existen, false en caso contrario
     */
    validateDOMElements() {
        return Object.values(this.elements).every(element => element !== null);
    }

    bindEvents() {
        this.elements.themeSelect.addEventListener('change', () => this.changeTheme());
        this.elements.levelSelect.addEventListener('change', () => this.startGame());
        document.querySelector('.message button').addEventListener('click', () => this.startGame());
    }

    /**
     * @method getDimensions
     * @description Determina las dimensiones del tablero según el nivel seleccionado
     * @param {string} level - Nivel de dificultad seleccionado
     * @returns {Array<number>} Array con [filas, columnas]
     */
    getDimensions(level) {
        const dimensions = {
            '2x2': [2, 2],
            '4x3': [4, 3],
            '4x4': [4, 4],
            '4x5': [4, 5],
            '4x6': [4, 6]
        };
        return dimensions[level] || [4, 4];
    }

    /**
     * @method createGameBoard
     * @description Genera el tablero de juego dinámicamente según el nivel seleccionado.
     * Inicializa la cuadrícula y crea las cartas con sus respectivos símbolos.
     */
    createGameBoard() {
        this.elements.gameBoard.innerHTML = '';
        const [rows, cols] = this.getDimensions(this.elements.levelSelect.value);

        this.elements.gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        this.elements.gameBoard.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

        const totalCards = rows * cols;
        const gameCards = this.shuffleCards(totalCards);

        gameCards.forEach(card => this.createCard(card));
    }

    shuffleCards(totalCards) {
        const halfDeck = this.symbols.slice(0, totalCards / 2);
        return [...halfDeck, ...halfDeck]
            .sort(() => Math.random() - 0.5)
            .map((symbol, id) => ({ symbol, id }));
    }

    createCard({ symbol, id }) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face card-front">${symbol}</div>
                <div class="card-face card-back">?</div>
            </div>
        `;
        card.addEventListener('click', () => this.handleCardClick(card, symbol));
        this.elements.gameBoard.appendChild(card);
    }

    /**
     * @method handleCardClick
     * @description Gestiona la lógica cuando un jugador hace clic en una carta
     * Controla el estado del juego, animaciones y validaciones
     * @param {HTMLElement} cardElement - Elemento DOM de la carta
     * @param {string} symbol - Símbolo de la carta
     */
    handleCardClick(cardElement, symbol) {
        if (!this.allowClick ||
            cardElement.classList.contains('flipped') ||
            cardElement.classList.contains('matched')) {
            return;
        }

        cardElement.classList.add('flipped');
        this.selectedCards.push({ element: cardElement, symbol });

        if (this.selectedCards.length === 2) {
            this.allowClick = false;
            this.updateTurns();
            setTimeout(() => this.checkMatch(), ANIMATION_DURATION);
        }
    }

    /**
     * @method checkMatch
     * @description Verifica si las dos cartas seleccionadas son iguales
     * Gestiona las animaciones y efectos de sonido correspondientes
     */
    checkMatch() {
        const [card1, card2] = this.selectedCards;
        const isMatch = card1.symbol === card2.symbol;

        if (isMatch) {
            this.handleMatch(card1, card2);
        } else {
            this.handleMismatch(card1, card2);
        }

        this.selectedCards = [];
        setTimeout(() => {
            this.allowClick = true;
            this.checkGameOver();
        }, CHECK_MATCH_DELAY);
    }

    /**
     * @method handleMatch
     * @description Gestiona el comportamiento cuando se encuentra un par de cartas coincidentes
     * @param {Object} card1 - Primera carta seleccionada
     * @param {Object} card2 - Segunda carta seleccionada
     */
    handleMatch(card1, card2) {
        this.gameState = GAME_STATES.CHECKING;
        this.audioManager.play('match');

        requestAnimationFrame(() => {
            setTimeout(() => {
                card1.element.classList.add('matched');
                card2.element.classList.add('matched');
                this.gameState = GAME_STATES.PLAYING;
            }, ANIMATION_DURATION);
        });
    }

    handleMismatch(card1, card2) {
        [card1, card2].forEach(card => {
            card.element.classList.add('shake-horizontal');
        });

        this.audioManager.play('fail');

        setTimeout(() => {
            [card1, card2].forEach(card => {
                card.element.classList.remove('flipped', 'shake-horizontal');
            });
        }, ANIMATION_DURATION * 2);
    }

    updateTurns() {
        this.turns++;
        this.elements.turnsDisplay.textContent = `Turnos: ${this.turns}`;
    }

    /**
     * @method startTimer
     * @description Inicia o reinicia el temporizador del juego
     */
    startTimer() {
        clearInterval(this.timer);
        this.seconds = 0;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.seconds++;
            this.updateTimerDisplay();
        }, 1000);
    }

    /**
     * @private
     * @method updateTimerDisplay
     * @description Actualiza la visualización del tiempo en formato mm:ss
     */
    updateTimerDisplay() {
        const minutes = Math.floor(this.seconds / 60);
        const seconds = this.seconds % 60;
        this.elements.timerDisplay.textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * @method checkGameOver
     * @description Verifica si el juego ha terminado y gestiona el estado final
     * Actualiza la UI, detiene el timer y reproduce efectos de sonido
     * @returns {boolean} true si el juego ha terminado, false en caso contrario
     */
    checkGameOver() {
        const remainingCards = document.querySelectorAll('.card:not(.matched)');
        if (remainingCards.length === 0) {
            this.gameState = GAME_STATES.FINISHED;
            this.finishGame();
            return true;
        }
        return false;
    }

    /**
     * @private
     * @method finishGame
     * @description Gestiona la finalización del juego
     * Guarda la puntuación, muestra mensaje y prepara para nuevo juego
     */
    finishGame() {
        clearInterval(this.timer);
        this.audioManager.play('win');
        this.saveGameStats();
        this.elements.message.style.display = 'block';
    }

    /**
     * @private
     * @method saveGameStats
     * @description Guarda las estadísticas del juego actual
     */
    saveGameStats() {
        const stats = {
            level: this.elements.levelSelect.value,
            turns: this.turns,
            time: this.seconds,
            date: new Date().toISOString()
        };

        const savedStats = JSON.parse(localStorage.getItem('memoryGameStats') || '[]');
        savedStats.push(stats);
        localStorage.setItem('memoryGameStats', JSON.stringify(savedStats));
    }

    checkGameOver() {
        const remainingCards = document.querySelectorAll('.card:not(.matched)');
        if (remainingCards.length === 0) {
            clearInterval(this.timer);
            this.audioManager.play('win');
            this.elements.message.style.display = 'block';
        }
    }

    changeTheme() {
        const theme = this.elements.themeSelect.value;
        document.body.className = theme;
        document.querySelector('.header').className = `header ${theme}`;
        this.elements.message.className = `message ${theme}`;
        document.querySelectorAll('.card-back').forEach(card => {
            card.className = `card-face card-back ${theme}`;
        });
    }

    /**
     * @method startGame
     * @description Inicializa o reinicia el juego
     * Configura el tablero, reinicia contadores y prepara el estado inicial
     */
    startGame() {
        // Limpiamos cualquier estado previo
        this.elements.message.style.display = 'none';
        this.selectedCards = [];
        this.allowClick = true;
        this.turns = 0;

        // Actualizamos la UI
        this.elements.turnsDisplay.textContent = `Turnos: ${this.turns}`;

        // Configuramos el nivel y creamos el tablero
        const level = this.elements.levelSelect.value;
        document.body.setAttribute('data-level', level);

        // Iniciamos el juego
        this.createGameBoard();
        this.startTimer();
    }
}

// Inicialización del juego cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    const game = new MemoryGame();
    game.startGame();
    game.changeTheme();
});
