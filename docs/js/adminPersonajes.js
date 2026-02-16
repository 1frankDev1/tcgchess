import { supabase, getModelUrl, getCurrentUser } from './supabase.js';

class AdminPersonajes {
    constructor() {
        this.classificationOptions = ['Rey', 'Reina', 'Torre', 'Alfil', 'Caballo', 'Peón'];
        this.init();
    }

    async init() {
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        await this.loadCharacters();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('btn-sync-storage').addEventListener('click', () => this.syncFromSpirits());
    }

    async loadCharacters() {
        const { data: spirits, error: sError } = await supabase
            .from('spirits')
            .select('*');

        const { data: chessChars, error: cError } = await supabase
            .from('chess_characters')
            .select('*');

        if (sError || cError) {
            console.error("Error loading data", sError, cError);
            return;
        }

        this.renderCharacters(spirits, chessChars);
    }

    async renderCharacters(spirits, chessChars) {
        const grid = document.getElementById('characters-grid');
        grid.innerHTML = '';

        for (const spirit of spirits) {
            const chessChar = chessChars.find(c => c.gltf_path === spirit.gltf_url || c.name === spirit.name);

            const card = document.createElement('div');
            card.className = 'spirit-card bento-item';
            card.style.padding = '20px';
            card.style.gap = '15px';

            // Preview
            const preview = document.createElement('model-viewer');
            preview.src = spirit.gltf_url;
            preview.style.width = '100%';
            preview.style.height = '180px';
            preview.style.background = 'rgba(0,0,0,0.3)';
            preview.style.borderRadius = '15px';
            preview.setAttribute('auto-rotate', '');
            preview.setAttribute('camera-controls', '');

            // Info Container
            const info = document.createElement('div');
            info.style.width = '100%';
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            info.style.gap = '10px';

            // Name Input
            const labelName = document.createElement('label');
            labelName.textContent = 'Nombre:';
            labelName.style.fontSize = '0.75rem';
            labelName.style.color = 'var(--primary-color)';
            labelName.style.fontWeight = 'bold';

            const inputName = document.createElement('input');
            inputName.type = 'text';
            inputName.value = chessChar ? chessChar.name : spirit.name;
            inputName.className = 'form-input';
            inputName.style.background = 'rgba(255,255,255,0.05)';
            inputName.style.border = '1px solid rgba(255,255,255,0.1)';
            inputName.style.color = '#fff';

            // Classification Select
            const labelClass = document.createElement('label');
            labelClass.textContent = 'Clasificación:';
            labelClass.style.fontSize = '0.75rem';
            labelClass.style.color = 'var(--primary-color)';
            labelClass.style.fontWeight = 'bold';

            const select = document.createElement('select');
            select.className = 'form-select';
            select.style.background = 'rgba(255,255,255,0.05)';
            select.style.border = '1px solid rgba(255,255,255,0.1)';
            select.style.color = '#fff';
            select.innerHTML = '<option value="">Sin asignar</option>';
            this.classificationOptions.forEach(opt => {
                const selected = chessChar && chessChar.piece_type === opt ? 'selected' : '';
                select.innerHTML += `<option value="${opt}" ${selected}>${opt}</option>`;
            });

            // Action Button
            const btnSave = document.createElement('button');
            btnSave.className = 'ctrl-btn';
            btnSave.style.width = '100%';
            btnSave.style.justifyContent = 'center';
            btnSave.innerHTML = '<i class="fas fa-save"></i> <span>Guardar</span>';
            btnSave.onclick = () => this.saveCharacter(spirit, inputName.value, select.value, chessChar?.id);

            info.appendChild(labelName);
            info.appendChild(inputName);
            info.appendChild(labelClass);
            info.appendChild(select);
            info.appendChild(btnSave);

            card.appendChild(preview);
            card.appendChild(info);
            grid.appendChild(card);
        }
    }

    async saveCharacter(spirit, name, classification, existingId) {
        if (!classification) {
            alert("Por favor selecciona una clasificación");
            return;
        }

        const charData = {
            name: name,
            gltf_path: spirit.gltf_url,
            piece_type: classification
        };

        let error;
        if (existingId) {
            const result = await supabase
                .from('chess_characters')
                .update(charData)
                .eq('id', existingId);
            error = result.error;
        } else {
            const result = await supabase
                .from('chess_characters')
                .insert([charData]);
            error = result.error;
        }

        if (error) {
            alert("Error al guardar: " + error.message);
        } else {
            alert("Personaje guardado correctamente");
            this.loadCharacters();
        }
    }

    async syncFromSpirits() {
        // En realidad ya lo hacemos en loadCharacters al mostrar todo lo de spirits
        this.loadCharacters();
    }
}

new AdminPersonajes();
