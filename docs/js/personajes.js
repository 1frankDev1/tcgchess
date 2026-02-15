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
        this.categoriesContainer = document.getElementById('piece-categories');
        this.btnSave = document.getElementById('btn-save-selections');
        this.modelViewer = document.getElementById('main-model-viewer');

        this.btnLogin.addEventListener('click', () => this.handleLogin());
        this.btnLogout.addEventListener('click', () => this.handleLogout());
        this.btnSave.addEventListener('click', () => this.saveSelections());

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTab = e.target.dataset.tab;
                this.renderSelectionMenu();
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

            this.renderSelectionMenu();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    renderSelectionMenu() {
        this.categoriesContainer.innerHTML = '';
        const currentData = this.selections[this.currentTab];

        this.pieceTypes.forEach(type => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-group';
            categoryDiv.innerHTML = `<h3>${type}</h3>`;

            const select = document.createElement('select');
            select.id = `select-${type}`;
            select.className = 'form-select';
            select.innerHTML = `<option value="">Pieza Estándar</option>`;

            const typeChars = this.characters.filter(c => c.piece_type === type);
            typeChars.forEach(char => {
                const option = document.createElement('option');
                option.value = char.id;
                option.textContent = char.name;

                if (currentData[type] === char.id) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                const charId = e.target.value;
                this.selections[this.currentTab][type] = charId;
                if (charId) {
                    this.updatePreview(charId);
                }
            });

            categoryDiv.appendChild(select);
            this.categoriesContainer.appendChild(categoryDiv);
        });
    }

    async updatePreview(charId) {
        const char = this.characters.find(c => c.id === charId);
        if (!char) return;

        try {
            const url = await getModelUrl(char.gltf_path);
            this.modelViewer.src = url;

            document.getElementById('selected-info').innerHTML = `
                <h4>${char.name}</h4>
                <p>Clasificación: ${char.piece_type}</p>
            `;
        } catch (e) {
            console.error("Error loading preview", e);
        }
    }

    async saveSelections() {
        const user = getCurrentUser();
        if (!user) return;

        try {
            const promises = [];

            // Save player selections
            for (const [type, charId] of Object.entries(this.selections.player)) {
                if (charId) {
                    promises.push(saveUserSelection(user.id, type, charId, false));
                }
            }

            // Save opponent selections
            for (const [type, charId] of Object.entries(this.selections.opponent)) {
                if (charId) {
                    promises.push(saveUserSelection(user.id, type, charId, true));
                }
            }

            await Promise.all(promises);
            alert('Selecciones guardadas correctamente');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Error al guardar: ' + error.message);
        }
    }
}

new PersonajesSelection();
