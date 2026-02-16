import { supabase, getCurrentUser, getUserSelections } from './supabase.js';

class AdminPersonajes {
    constructor() {
        this.classificationOptions = ['Rey', 'Reina', 'Torre', 'Alfil', 'Caballo', 'Peón'];
        this.currentSide = 'player'; // 'player' o 'opponent'
        this.spirits = [];
        this.chessChars = [];
        this.selections = {
            player: {},
            opponent: {}
        };
        this.init();
    }

    async init() {
        const user = getCurrentUser();
        if (!user || user.role !== 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        await this.loadData();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('btn-sync-storage').addEventListener('click', () => this.loadData());
        document.getElementById('btn-save-all').addEventListener('click', () => this.saveAll());

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentSide = btn.dataset.side;
                this.renderGrid();
            });
        });
    }

    async loadData() {
        try {
            const { data: spirits, error: sError } = await supabase
                .from('spirits')
                .select('*');

            const { data: chessChars, error: cError } = await supabase
                .from('chess_characters')
                .select('*');

            const user = getCurrentUser();
            const selections = await getUserSelections(user.id);

            if (sError || cError) {
                console.error("Error loading data", sError, cError);
                return;
            }

            this.spirits = spirits;
        this.chessChars = chessChars;

        // Ensure every spirit has a chessChar entry (at least in memory for name/path)
        this.spirits.forEach(s => {
            if (!this.chessChars.find(c => c.gltf_path === s.gltf_url || c.name === s.name)) {
                this.chessChars.push({
                    name: s.name,
                    gltf_path: s.gltf_url,
                    piece_type: ""
                });
            }
        });

        // Reset selections state using gltf_path as key for easier local management
        this.selections = { player: {}, opponent: {} };
        selections.forEach(sel => {
            const side = sel.is_opponent ? 'opponent' : 'player';
            const char = this.chessChars.find(c => c.id === sel.character_id);
            if (char) {
                this.selections[side][sel.piece_type] = char.gltf_path;
            }
        });

        this.renderGrid();
        } catch (error) {
            console.error("Error in loadData:", error);
        }
    }

    handleSelectChange(spirit, newType) {
        const side = this.currentSide;

        // Clear this spirit from ANY type it might have had on this side
        for (const [type, path] of Object.entries(this.selections[side])) {
            if (path === spirit.gltf_url) {
                delete this.selections[side][type];
            }
        }

        // If assigning a new type, clear that type from ANY OTHER spirit
        if (newType !== "") {
            delete this.selections[side][newType];
            this.selections[side][newType] = spirit.gltf_url;
        }

        this.renderGrid();
    }

    renderGrid() {
        const grid = document.getElementById('characters-grid');
        grid.innerHTML = '';

        for (const spirit of this.spirits) {
            const chessChar = this.chessChars.find(c => c.gltf_path === spirit.gltf_url || c.name === spirit.name);
            const sideSelections = this.selections[this.currentSide];

            // Find if this spirit is selected for the current side
            let selectedType = "";
            for (const [type, path] of Object.entries(sideSelections)) {
                if (path === spirit.gltf_url) {
                    selectedType = type;
                    break;
                }
            }

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
            select.innerHTML = '<option value="">Sin asignar</option>';
            this.classificationOptions.forEach(opt => {
                const selected = selectedType === opt ? 'selected' : '';
                select.innerHTML += `<option value="${opt}" ${selected}>${opt}</option>`;
            });

            select.onchange = (e) => this.handleSelectChange(spirit, e.target.value);

            // Spirit name change listener
            inputName.onchange = (e) => {
                if (chessChar) chessChar.name = e.target.value;
                else spirit.name = e.target.value;
            };

            info.appendChild(labelName);
            info.appendChild(inputName);
            info.appendChild(labelClass);
            info.appendChild(select);

            card.appendChild(preview);
            card.appendChild(info);
            grid.appendChild(card);
        }
    }

    async saveAll() {
        const btn = document.getElementById('btn-save-all');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Guardando...</span>';
        btn.disabled = true;

        try {
            const user = getCurrentUser();

            // 1. Prepare and Save chess_characters
            const toUpsert = this.chessChars.map(c => {
                const charData = {
                    name: c.name,
                    gltf_path: c.gltf_path,
                    piece_type: c.piece_type || "Peón"
                };
                if (c.id) charData.id = c.id;

                // Ensure piece_type matches whatever is currently selected for this spirit
                for (const side of ['player', 'opponent']) {
                    for (const [type, path] of Object.entries(this.selections[side])) {
                        if (path === c.gltf_path) {
                            charData.piece_type = type;
                        }
                    }
                }
                return charData;
            });

            const { error: upsError } = await supabase
                .from('chess_characters')
                .upsert(toUpsert);

            if (upsError) throw upsError;

            // Re-fetch characters to get IDs for new ones
            const { data: updatedChars, error: refError } = await supabase
                .from('chess_characters')
                .select('*');
            if (refError) throw refError;

            // 2. Prepare and Save chess_selections
            const selectionsToInsert = [];
            for (const side of ['player', 'opponent']) {
                for (const [type, path] of Object.entries(this.selections[side])) {
                    const char = updatedChars.find(c => c.gltf_path === path);
                    if (char) {
                        selectionsToInsert.push({
                            user_id: user.id,
                            piece_type: type,
                            character_id: char.id,
                            is_opponent: side === 'opponent'
                        });
                    }
                }
            }

            // Delete old selections for this user
            const { error: delError } = await supabase
                .from('chess_selections')
                .delete()
                .eq('user_id', user.id);

            if (delError) throw delError;

            // Insert new selections
            if (selectionsToInsert.length > 0) {
                const { error: insError } = await supabase
                    .from('chess_selections')
                    .insert(selectionsToInsert);
                if (insError) throw insError;
            }

            alert("Todos los cambios guardados correctamente");
            await this.loadData();
        } catch (error) {
            console.error("Error saving all:", error);
            alert("Error al guardar: " + error.message);
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

new AdminPersonajes();
