import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
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
        this.initUI();
        this.initThree();
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

        this.btnLogin.addEventListener('click', () => this.handleLogin());
        this.btnLogout.addEventListener('click', () => this.handleLogout());
        this.btnSave.addEventListener('click', () => this.saveSelections());
    }

    initThree() {
        const container = document.getElementById('model-viewer');
        if (!container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        this.loader = new GLTFLoader();
        this.currentModel = null;

        this.animate();

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0) {
                this.camera.aspect = container.clientWidth / container.clientHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.currentModel) {
            this.currentModel.rotation.y += 0.01;
        }
        this.renderer.render(this.scene, this.camera);
    }

    async loadPreview(charId) {
        const char = this.characters.find(c => c.id === charId);
        if (!char) return;

        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }

        try {
            const url = await getModelUrl(char.gltf_path);
            this.loader.load(url, (gltf) => {
                this.currentModel = gltf.scene;

                // Center and scale model
                const box = new THREE.Box3().setFromObject(this.currentModel);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;
                this.currentModel.scale.set(scale, scale, scale);

                const center = box.getCenter(new THREE.Vector3());
                this.currentModel.position.x = -center.x * scale;
                this.currentModel.position.y = -center.y * scale;
                this.currentModel.position.z = -center.z * scale;

                this.scene.add(this.currentModel);

                document.getElementById('selected-info').innerHTML = `
                    <h4>${char.name}</h4>
                    <p>Clasificación: ${char.piece_type}</p>
                `;
            });
        } catch (e) {
            console.error("Error loading preview", e);
        }
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
        await this.loadSelectionMenu();
    }

    async loadSelectionMenu() {
        try {
            this.characters = await getCharacters();
            const user = getCurrentUser();
            const currentSelections = await getUserSelections(user.id);

            this.categoriesContainer.innerHTML = '';

            this.pieceTypes.forEach(type => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-group';
                categoryDiv.innerHTML = `<h3>${type}</h3>`;

                const select = document.createElement('select');
                select.id = `select-${type}`;
                select.innerHTML = `<option value="">Pieza Estándar</option>`;

                const typeChars = this.characters.filter(c => c.piece_type === type);
                typeChars.forEach(char => {
                    const option = document.createElement('option');
                    option.value = char.id;
                    option.textContent = char.name;

                    const isSelected = currentSelections.find(s => s.piece_type === type && s.character_id === char.id);
                    if (isSelected) option.selected = true;

                    select.appendChild(option);
                });

                select.addEventListener('change', (e) => {
                    if (e.target.value) this.loadPreview(e.target.value);
                });

                categoryDiv.appendChild(select);
                this.categoriesContainer.appendChild(categoryDiv);
            });
        } catch (error) {
            console.error('Error loading menu:', error);
        }
    }

    async saveSelections() {
        const user = getCurrentUser();
        if (!user) return;

        try {
            const promises = this.pieceTypes.map(type => {
                const charId = document.getElementById(`select-${type}`).value;
                if (charId) {
                    return saveUserSelection(user.id, type, charId);
                }
                return Promise.resolve();
            });

            await Promise.all(promises);
            alert('Selecciones guardadas correctamente');
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    }
}

new PersonajesSelection();
