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

        this.renderTable(spirits, chessChars);
    }

    async renderTable(spirits, chessChars) {
        const tbody = document.getElementById('storage-files-list');
        tbody.innerHTML = '';

        for (const spirit of spirits) {
            const chessChar = chessChars.find(c => c.gltf_path === spirit.gltf_url || c.name === spirit.name);

            const tr = document.createElement('tr');

            // Preview
            const tdPreview = document.createElement('td');
            tdPreview.innerHTML = `
                <model-viewer src="${spirit.gltf_url}" style="width: 80px; height: 80px;" auto-rotate camera-controls></model-viewer>
            `;

            // File Path
            const tdFile = document.createElement('td');
            tdFile.textContent = spirit.gltf_url.split('/').pop();
            tdFile.title = spirit.gltf_url;

            // Name
            const tdName = document.createElement('td');
            const inputName = document.createElement('input');
            inputName.type = 'text';
            inputName.value = chessChar ? chessChar.name : spirit.name;
            inputName.className = 'form-input';
            tdName.appendChild(inputName);

            // Classification
            const tdClass = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'form-select';
            select.innerHTML = '<option value="">Sin asignar</option>';
            this.classificationOptions.forEach(opt => {
                const selected = chessChar && chessChar.piece_type === opt ? 'selected' : '';
                select.innerHTML += `<option value="${opt}" ${selected}>${opt}</option>`;
            });
            tdClass.appendChild(select);

            // Actions
            const tdActions = document.createElement('td');
            const btnSave = document.createElement('button');
            btnSave.className = 'btn btn-sm';
            btnSave.textContent = 'Guardar';
            btnSave.onclick = () => this.saveCharacter(spirit, inputName.value, select.value, chessChar?.id);
            tdActions.appendChild(btnSave);

            tr.appendChild(tdPreview);
            tr.appendChild(tdFile);
            tr.appendChild(tdName);
            tr.appendChild(tdClass);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
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
