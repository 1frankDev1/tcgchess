import {
    customSignIn,
    getCurrentUser,
    customSignOut,
    getCharacters,
    getUserSelections,
    saveUserSelection,
    getModelUrl
} from './supabase.js';

class PersonajesSelection {
    constructor() {
        this.pieceTypes = ['Rey', 'Reina', 'Torre', 'Alfil', 'Caballo', 'Peón'];
        this.characters = [];
        this.currentTab = 'player'; // 'player' or 'opponent'
        this.selections = {
            player: {},
            opponent: {}
        };
        this.initUI();
        this.checkAuth();
    }

    initUI() {
        this.loginSection = document.getElementById('user-login');
        this.dashboardSection = document.getElementById('selection-dashboard');
        this.usernameInput = document.getElementById('user-username');
        this.passwordInput = document.getElementById('user-password');
        this.btnLogin = document.getElementById('btn-login-user');
        this.btnLogout = document.getElementById('btn-logout-selection');
        this.loginError = document.getElementById('user-login-error');

        this.bentoGrid = document.getElementById('bento-categories');
        this.selectionArea = document.getElementById('character-selection-area');
        this.charactersList = document.getElementById('characters-list');
        this.categoryTitle = document.getElementById('current-category-title');
        this.btnBack = document.getElementById('btn-back-to-bento');
        this.btnSave = document.getElementById('btn-save-selections');

        this.btnLogin.addEventListener('click', () => this.handleLogin());
        this.btnLogout.addEventListener('click', () => this.handleLogout());
        this.btnSave.addEventListener('click', () => this.saveSelections());
        if (this.btnBack) {
            this.btnBack.addEventListener('click', () => this.showBento());
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTab = e.target.dataset.tab;
                this.showBento(); // Reset to bento when switching tabs
            });
        });

        document.querySelectorAll('.bento-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                this.showCharacters(type);
            });
        });
    }

    async checkAuth() {
        const user = getCurrentUser();
        if (user) {
            this.showDashboard();
        } else {
            this.showLogin();
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

    showLogin() {
        this.loginSection.classList.remove('hidden');
        this.dashboardSection.classList.add('hidden');
    }

    async showDashboard() {
        this.loginSection.classList.add('hidden');
        this.dashboardSection.classList.remove('hidden');
        await this.loadData();
    }

    async loadData() {
        try {
            this.characters = await getCharacters();
            const user = getCurrentUser();
            const currentSelections = await getUserSelections(user.id);

            // Populate internal selections state
            currentSelections.forEach(s => {
                const target = s.is_opponent ? 'opponent' : 'player';
                this.selections[target][s.piece_type] = s.character_id;
            });

            this.updateBentoBadges();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    updateBentoBadges() {
        const currentSelections = this.selections[this.currentTab];
        document.querySelectorAll('.bento-item').forEach(item => {
            const type = item.dataset.type;
            if (currentSelections[type]) {
                item.style.borderColor = 'var(--primary-color)';
                item.style.background = 'rgba(0, 210, 255, 0.05)';
            } else {
                item.style.borderColor = 'var(--card-border)';
                item.style.background = 'var(--card-bg)';
            }
        });
    }

    showBento() {
        this.bentoGrid.classList.remove('hidden');
        this.selectionArea.classList.add('hidden');
        this.updateBentoBadges();
    }

    async showCharacters(type) {
        this.categoryTitle.textContent = type;
        this.bentoGrid.classList.add('hidden');
        this.selectionArea.classList.remove('hidden');

        this.charactersList.innerHTML = '<div class="loading">Cargando personajes...</div>';

        const typeChars = this.characters.filter(c => c.piece_type === type);
        this.charactersList.innerHTML = '';

        if (typeChars.length === 0) {
            this.charactersList.innerHTML = '<p class="empty">No hay personajes configurados para esta categoría.</p>';
            return;
        }

        for (const char of typeChars) {
            const isSelected = this.selections[this.currentTab][type] === char.id;
            const card = document.createElement('div');
            card.className = `character-card ${isSelected ? 'selected' : ''}`;

            const modelUrl = await getModelUrl(char.gltf_path);

            card.innerHTML = `
                <model-viewer src="${modelUrl}" auto-rotate camera-controls shadow-intensity="1"></model-viewer>
                <h3>${char.name}</h3>
                <button class="btn btn-select-char" data-id="${char.id}">${isSelected ? 'Seleccionado' : 'Seleccionar'}</button>
            `;

            card.querySelector('.btn-select-char').addEventListener('click', (e) => {
                this.selectCharacter(type, char.id);
            });

            this.charactersList.appendChild(card);
        }
    }

    selectCharacter(type, charId) {
        this.selections[this.currentTab][type] = charId;
        this.showCharacters(type); // Refresh list to show selection
    }

    async saveSelections() {
        const user = getCurrentUser();
        if (!user) return;

        try {
            const promises = [];

            // Save player selections
            for (const type of this.pieceTypes) {
                const charId = this.selections.player[type];
                if (charId) {
                    promises.push(saveUserSelection(user.id, type, charId, false));
                }
            }

            // Save opponent selections
            for (const type of this.pieceTypes) {
                const charId = this.selections.opponent[type];
                if (charId) {
                    promises.push(saveUserSelection(user.id, type, charId, true));
                }
            }

            await Promise.all(promises);
            alert('Todas las selecciones se han guardado correctamente');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error al guardar: ' + error.message);
        }
    }
}

new PersonajesSelection();
