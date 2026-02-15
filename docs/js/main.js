import { SceneManager } from './scene.js';
import { Board } from './board.js';
import { PieceManager } from './pieces.js';
import { Game } from './game.js';
import { InputHandler } from './input.js';
import { customSignIn, getCurrentUser, customSignOut } from './supabase.js';

class Main {
    constructor() {
        this.initUI();
        this.checkAuth();
    }

    initUI() {
        this.gameUI = document.getElementById('game-ui');
        this.btnReset = document.getElementById('btn-reset');
        this.turnDisplay = document.getElementById('current-turn-display');
        this.loadingOverlay = document.getElementById('loading-overlay');

        // Auth UI
        this.loginOverlay = document.getElementById('main-login');
        this.usernameInput = document.getElementById('main-username');
        this.passwordInput = document.getElementById('main-password');
        this.btnLogin = document.getElementById('btn-login-main');
        this.btnLogout = document.getElementById('btn-logout-main');
        this.loginError = document.getElementById('main-login-error');

        this.btnReset.addEventListener('click', () => this.handleReset());
        this.btnLogin.addEventListener('click', () => this.handleLogin());
        this.btnLogout.addEventListener('click', () => this.handleLogout());
    }

    checkAuth() {
        const user = getCurrentUser();
        if (user) {
            this.loginOverlay.classList.add('hidden');
            this.initGame();
        } else {
            this.loginOverlay.classList.remove('hidden');
        }
    }

    async handleLogin() {
        const username = this.usernameInput.value;
        const password = this.passwordInput.value;
        try {
            await customSignIn(username, password);
            window.location.reload();
        } catch (error) {
            this.loginError.textContent = error.message;
        }
    }

    handleLogout() {
        customSignOut();
        window.location.reload();
    }

    async initGame() {
        const container = document.getElementById('canvas-container');
        this.sceneManager = new SceneManager(container);
        this.board = new Board(this.sceneManager.scene);
        this.pieceManager = new PieceManager(this.sceneManager.scene);
        this.game = new Game(this.sceneManager, this.board, this.pieceManager);
        this.inputHandler = new InputHandler(this.sceneManager, this.game, this.board);

        this.animate();
        await this.showGame();
    }

    async handleReset() {
        if (confirm('¿Reiniciar partida?')) {
            await this.game.startNewGame();
        }
    }

    async showGame() {
        this.gameUI.classList.remove('hidden');
        this.loadingOverlay.classList.remove('hidden');

        await this.pieceManager.loadModels();
        this.loadingOverlay.classList.add('hidden');

        await this.game.startNewGame();
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        
        const deltaTime = this.lastTime ? (time - this.lastTime) / 1000 : 0;
        this.lastTime = time;

        if (this.pieceManager) {
            this.pieceManager.update(deltaTime);
        }

        if (this.sceneManager) {
            this.sceneManager.render();
        }
        
        if (this.game && this.turnDisplay) {
            const turnText = this.game.turn === 'white' ? 'Blanco' : 'Negro';
            this.turnDisplay.textContent = `Turno: ${turnText}`;
        }
    }
}

// Start the application
new Main();
