import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
import { getModelUrl, getUserSelections, getCurrentUser, customSignIn, customSignOut } from './supabase.js';

// --- RULES LOGIC ---
class ChessRules {
    static isValidMove(piece, toX, toZ, boardState) {
        const fromX = parseInt(piece.gridX);
        const fromZ = parseInt(piece.gridZ);
        const targetX = parseInt(toX);
        const targetZ = parseInt(toZ);
        const type = piece.type;
        const color = piece.color;

        if (fromX === targetX && fromZ === targetZ) return false;
        if (targetX < 0 || targetX > 7 || targetZ < 0 || targetZ > 7) return false;

        const targetPiece = boardState[targetX] && boardState[targetX][targetZ];
        if (targetPiece && targetPiece.color === color) return false;

        switch (type) {
            case 'pawn':
                return this.isValidPawnMove(fromX, fromZ, targetX, targetZ, color, boardState);
            case 'rook':
                return this.isValidRookMove(fromX, fromZ, targetX, targetZ, boardState);
            case 'knight':
                return this.isValidKnightMove(fromX, fromZ, targetX, targetZ);
            case 'bishop':
                return this.isValidBishopMove(fromX, fromZ, targetX, targetZ, boardState);
            case 'queen':
                return this.isValidRookMove(fromX, fromZ, targetX, targetZ, boardState) ||
                       this.isValidBishopMove(fromX, fromZ, targetX, targetZ, boardState);
            case 'king':
                return this.isValidKingMove(fromX, fromZ, targetX, targetZ);
            default:
                return false;
        }
    }

    static isValidPawnMove(fromX, fromZ, toX, toZ, color, boardState) {
        const direction = color === 'white' ? 1 : -1;
        const startRow = color === 'white' ? 1 : 6;
        const diffX = toX - fromX;
        const diffZ = toZ - fromZ;

        if (diffX === direction && diffZ === 0) {
            return !boardState[toX]?.[toZ];
        }
        if (fromX === startRow && diffX === 2 * direction && diffZ === 0) {
            const pathBlocked = boardState[fromX + direction]?.[fromZ] || boardState[toX]?.[toZ];
            return !pathBlocked;
        }
        if (diffX === direction && Math.abs(diffZ) === 1) {
            return !!boardState[toX]?.[toZ];
        }
        return false;
    }

    static isValidRookMove(fromX, fromZ, toX, toZ, boardState) {
        if (fromX !== toX && fromZ !== toZ) return false;
        const stepX = fromX === toX ? 0 : (toX > fromX ? 1 : -1);
        const stepZ = fromZ === toZ ? 0 : (toZ > fromZ ? 1 : -1);
        let currX = fromX + stepX;
        let currZ = fromZ + stepZ;
        while (currX !== toX || currZ !== toZ) {
            if (boardState[currX]?.[currZ]) return false;
            currX += stepX;
            currZ += stepZ;
        }
        return true;
    }

    static isValidKnightMove(fromX, fromZ, toX, toZ) {
        const dx = Math.abs(toX - fromX);
        const dz = Math.abs(toZ - fromZ);
        return (dx === 2 && dz === 1) || (dx === 1 && dz === 2);
    }

    static isValidBishopMove(fromX, fromZ, toX, toZ, boardState) {
        if (Math.abs(toX - fromX) !== Math.abs(toZ - fromZ)) return false;
        const stepX = toX > fromX ? 1 : -1;
        const stepZ = toZ > fromZ ? 1 : -1;
        let currX = fromX + stepX;
        let currZ = fromZ + stepZ;
        while (currX !== toX || currZ !== toZ) {
            if (boardState[currX]?.[currZ]) return false;
            currX += stepX;
            currZ += stepZ;
        }
        return true;
    }

    static isValidKingMove(fromX, fromZ, toX, toZ) {
        return Math.abs(toX - fromX) <= 1 && Math.abs(toZ - fromZ) <= 1;
    }

    static isKingInCheck(color, boardState) {
        let kingPos = null;
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                const piece = boardState[x]?.[z];
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingPos = { x, z };
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return false;
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                const piece = boardState[x]?.[z];
                if (piece && piece.color !== color) {
                    if (this.isValidMove({ type: piece.type, color: piece.color, gridX: x, gridZ: z }, kingPos.x, kingPos.z, boardState)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    static wouldBeInCheck(piece, toX, toZ, boardState) {
        const fromX = parseInt(piece.gridX);
        const fromZ = parseInt(piece.gridZ);
        const color = piece.color;
        const nextBoardState = JSON.parse(JSON.stringify(boardState));
        if (!nextBoardState[toX]) nextBoardState[toX] = {};
        nextBoardState[toX][toZ] = { type: piece.type, color: piece.color };
        if (nextBoardState[fromX]) delete nextBoardState[fromX][fromZ];
        return this.isKingInCheck(color, nextBoardState);
    }
}

// --- BOARD LOGIC ---
class Board {
    constructor(scene) {
        this.scene = scene;
        this.size = 8;
        this.squareSize = 1;
        this.squares = [];
        this.createBoard();
    }

    createBoard() {
        const geometry = new THREE.BoxGeometry(this.squareSize, 0.1, this.squareSize);
        // Colores más amigables y modernos
        const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xf0d9b5 }); // Crema
        const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x48cae4 }); // Azul vibrante suave
        for (let x = 0; x < this.size; x++) {
            for (let z = 0; z < this.size; z++) {
                const material = ((x + z) % 2 === 0 ? lightMaterial : darkMaterial).clone();
                const square = new THREE.Mesh(geometry, material);
                const posX = (x - (this.size - 1) / 2) * this.squareSize;
                const posZ = (z - (this.size - 1) / 2) * this.squareSize;
                square.position.set(posX, -0.05, posZ);
                square.receiveShadow = true;
                square.userData = { gridX: x, gridZ: z, isSquare: true };
                this.scene.add(square);
                this.squares.push(square);
            }
        }
    }

    getSquareAt(gridX, gridZ) {
        return this.squares.find(s => s.userData.gridX === gridX && s.userData.gridZ === gridZ);
    }

    gridToWorld(gridX, gridZ) {
        return {
            x: (gridX - (this.size - 1) / 2) * this.squareSize,
            z: (gridZ - (this.size - 1) / 2) * this.squareSize,
            gridX, gridZ
        };
    }

    highlightSquare(gridX, gridZ, color = 0xffff00) {
        const square = this.getSquareAt(gridX, gridZ);
        if (square) {
            if (!square.userData.originalColor) square.userData.originalColor = square.material.color.clone();
            square.material.color.set(color);
        }
    }

    clearHighlights() {
        this.squares.forEach(square => {
            if (square.userData.originalColor) square.material.color.copy(square.userData.originalColor);
        });
    }
}

// --- SCENE LOGIC ---
class SceneManager {
    constructor(canvasContainer) {
        this.container = canvasContainer;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, 10);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.camera.lookAt(0, 0, 0);
        this.setupLights();
        this.setupResize();
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
    }

    setupResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    render() { this.renderer.render(this.scene, this.camera); }
}

// --- PIECE LOGIC ---
class PieceManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        this.loader.setDRACOLoader(dracoLoader);

        this.models = new Map();
        this.pieces = [];
        this.typeMapping = { 'pawn': 'Peón', 'rook': 'Torre', 'knight': 'Caballo', 'bishop': 'Alfil', 'queen': 'Reina', 'king': 'Rey' };
        this.characterInfo = new Map();
    }

    async loadModels() {
        const pieceTypes = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
        const colors = ['white', 'black'];
        const user = getCurrentUser();
        let selections = [];
        if (user) selections = await getUserSelections(user.id);

        const promises = [];
        for (const type of pieceTypes) {
            for (const color of colors) {
                const mappedType = this.typeMapping[type];
                const selection = selections.find(s => s.piece_type === mappedType && s.is_opponent === (color === 'black'));
                const path = (selection && selection.chess_characters) ? selection.chess_characters.gltf_path : `${type}_${color}.glb`;
                const charName = (selection && selection.chess_characters) ? selection.chess_characters.name : type;
                this.characterInfo.set(`${type}_${color}`, { name: charName, classification: mappedType });
                promises.push(this.loadModel(type, color, path));
            }
        }
        await Promise.all(promises);
    }

    async loadModel(type, color, path) {
        try {
            const url = await getModelUrl(path);
            return new Promise((resolve) => {
                this.loader.load(url, (gltf) => {
                    const model = gltf.scene;
                    model.updateMatrixWorld(true);
                    const initialBox = new THREE.Box3().setFromObject(model);
                    const initialSize = initialBox.getSize(new THREE.Vector3());
                    const maxDim = Math.max(initialSize.x, initialSize.y, initialSize.z);

                    if (maxDim > 0) {
                        const scale = 0.8 / maxDim;
                        model.scale.set(scale, scale, scale);
                        model.updateMatrixWorld(true);
                        const scaledBox = new THREE.Box3().setFromObject(model);
                        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                        model.position.x -= scaledCenter.x;
                        model.position.z -= scaledCenter.z;
                        model.position.y -= scaledBox.min.y - 0.05;
                    }

                    // OPTIMIZACIÓN: Remover texturas y aplicar color sólido
                    const colorValue = color === 'white' ? 0xffffff : 0x222222;
                    model.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                            node.material = new THREE.MeshStandardMaterial({
                                color: colorValue,
                                side: THREE.FrontSide
                            });
                            if (color === 'white') node.material.emissive = new THREE.Color(0x333333);
                        }
                    });

                    const wrapper = new THREE.Group();
                    wrapper.add(model);
                    this.models.set(`${type}_${color}`, wrapper);
                    resolve(wrapper);
                }, undefined, () => {
                    this.createPlaceholder(type, color);
                    resolve();
                });
            });
        } catch (e) { this.createPlaceholder(type, color); }
    }

    createPlaceholder(type, color) {
        const height = type === 'pawn' ? 0.5 : 0.8;
        const geometry = type === 'pawn' ? new THREE.CylinderGeometry(0.2, 0.3, height) : new THREE.BoxGeometry(0.4, height, 0.4);
        const colorValue = color === 'white' ? 0xffffff : 0x222222;
        const material = new THREE.MeshStandardMaterial({ color: colorValue, side: THREE.FrontSide });
        if (color === 'white') material.emissive = new THREE.Color(0x333333);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = height / 2 + 0.05;
        const wrapper = new THREE.Group();
        wrapper.add(mesh);
        this.models.set(`${type}_${color}`, wrapper);
    }

    createPiece(type, color, position) {
        const originalModel = this.models.get(`${type}_${color}`);
        if (!originalModel) return null;
        const info = this.characterInfo.get(`${type}_${color}`);
        const piece = originalModel.clone();
        piece.position.set(position.x, 0, position.z);
        piece.userData = { type, color, gridX: position.gridX, gridZ: position.gridZ, characterName: info.name, classification: info.classification };
        this.scene.add(piece);
        this.pieces.push(piece);
        return piece;
    }

    clearPieces() { this.pieces.forEach(p => this.scene.remove(p)); this.pieces = []; }

    removePieceAt(gridX, gridZ) {
        const idx = this.pieces.findIndex(p => p.userData.gridX === gridX && p.userData.gridZ === gridZ);
        if (idx !== -1) { this.scene.remove(this.pieces[idx]); this.pieces.splice(idx, 1); }
    }

    getPieceAt(gridX, gridZ) { return this.pieces.find(p => p.userData.gridX === gridX && p.userData.gridZ === gridZ); }

    update(deltaTime) {
        this.pieces.forEach(piece => {
            if (piece.userData.targetPosition) {
                piece.position.lerp(piece.userData.targetPosition, 10 * deltaTime);
                if (piece.position.distanceTo(piece.userData.targetPosition) < 0.01) {
                    piece.position.copy(piece.userData.targetPosition);
                    delete piece.userData.targetPosition;
                }
            }
        });
    }
}

// --- GAME LOGIC ---
class Game {
    constructor(sceneManager, board, pieceManager) {
        this.sceneManager = sceneManager;
        this.board = board;
        this.pieceManager = pieceManager;
        this.turn = 'white';
        this.selectedPiece = null;
        this.boardState = {};
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.initPieceInfoUI();
        this.pieceIcons = {
            'white_pawn': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
            'white_rook': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
            'white_knight': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
            'white_bishop': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
            'white_queen': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
            'white_king': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
            'black_pawn': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
            'black_rook': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
            'black_knight': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
            'black_bishop': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
            'black_queen': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
            'black_king': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
        };
    }

    initPieceInfoUI() {
        this.infoDiv = document.createElement('div');
        this.infoDiv.id = 'piece-info-tooltip';
        this.infoDiv.className = 'tooltip hidden';
        document.body.appendChild(this.infoDiv);
    }

    showPieceInfo(userData) {
        if (!userData.characterName) return;
        this.infoDiv.innerHTML = `<strong>${userData.characterName}</strong><br><span>${userData.classification}</span>`;
        this.infoDiv.classList.remove('hidden');
    }

    hidePieceInfo() { this.infoDiv.classList.add('hidden'); }

    async startNewGame() {
        this.turn = 'white';
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.updateCapturedUI();
        this.initBoardState();
        this.renderPieces();
        const modal = document.getElementById('game-over-modal');
        if (modal) modal.classList.add('hidden');
    }

    initBoardState() {
        this.boardState = {};
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let z = 0; z < 8; z++) {
            if (!this.boardState[0]) this.boardState[0] = {};
            this.boardState[0][z] = { type: backRow[z], color: 'white' };
            if (!this.boardState[1]) this.boardState[1] = {};
            this.boardState[1][z] = { type: 'pawn', color: 'white' };
            if (!this.boardState[6]) this.boardState[6] = {};
            this.boardState[6][z] = { type: 'pawn', color: 'black' };
            if (!this.boardState[7]) this.boardState[7] = {};
            this.boardState[7][z] = { type: backRow[z], color: 'black' };
        }
    }

    renderPieces() {
        this.pieceManager.clearPieces();
        for (let x in this.boardState) {
            for (let z in this.boardState[x]) {
                const pos = this.board.gridToWorld(parseInt(x), parseInt(z));
                this.pieceManager.createPiece(this.boardState[x][z].type, this.boardState[x][z].color, pos);
            }
        }
    }

    selectPiece(gridX, gridZ) {
        const piece = this.pieceManager.getPieceAt(gridX, gridZ);
        if (piece && piece.userData.color === this.turn) {
            this.selectedPiece = piece;
            this.highlightValidMoves(gridX, gridZ);
            return true;
        }
        return false;
    }

    highlightValidMoves(fromX, fromZ) {
        this.board.clearHighlights();
        this.board.highlightSquare(fromX, fromZ, 0x00ff00);
        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                if (ChessRules.isValidMove(this.selectedPiece.userData, x, z, this.boardState)) {
                    // Resaltar todos los movimientos válidos según el tipo de pieza
                    this.board.highlightSquare(x, z, 0xffff00);
                }
            }
        }
    }

    async moveSelectedPiece(toX, toZ) {
        if (!this.selectedPiece) return false;
        if (ChessRules.isValidMove(this.selectedPiece.userData, toX, toZ, this.boardState)) {
            const fromX = this.selectedPiece.userData.gridX;
            const fromZ = this.selectedPiece.userData.gridZ;
            const pieceData = this.boardState[fromX][fromZ];

            // Detectar captura
            if (this.boardState[toX]?.[toZ]) {
                const captured = this.boardState[toX][toZ];
                if (captured.color === 'white') this.capturedWhite.push(captured.type);
                else this.capturedBlack.push(captured.type);
                this.updateCapturedUI();

                // Si se captura el Rey, termina la partida
                if (captured.type === 'king') {
                    this.endGame(pieceData.color);
                }

                this.pieceManager.removePieceAt(toX, toZ);
            }

            if (!this.boardState[toX]) this.boardState[toX] = {};
            this.boardState[toX][toZ] = pieceData;
            delete this.boardState[fromX][fromZ];
            const worldPos = this.board.gridToWorld(toX, toZ);
            this.selectedPiece.userData.targetPosition = new THREE.Vector3(worldPos.x, 0, worldPos.z);
            this.selectedPiece.userData.gridX = toX;
            this.selectedPiece.userData.gridZ = toZ;
            this.selectedPiece = null;
            this.board.clearHighlights();
            this.turn = this.turn === 'white' ? 'black' : 'white';
            return true;
        }
        return false;
    }

    updateCapturedUI() {
        const whiteContainer = document.getElementById('captured-white');
        const blackContainer = document.getElementById('captured-black');
        if (whiteContainer) {
            whiteContainer.innerHTML = this.capturedWhite.map(type =>
                `<img src="${this.pieceIcons['white_' + type]}" title="${type}">`
            ).join('');
        }
        if (blackContainer) {
            blackContainer.innerHTML = this.capturedBlack.map(type =>
                `<img src="${this.pieceIcons['black_' + type]}" title="${type}">`
            ).join('');
        }
    }

    endGame(winnerColor) {
        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('modal-title');
        const msg = document.getElementById('modal-message');
        const icon = document.getElementById('modal-icon');

        if (modal) {
            title.textContent = winnerColor === 'white' ? '¡Victoria Blanca!' : '¡Victoria Negra!';
            msg.textContent = winnerColor === 'white' ? 'El ejército de la luz ha dominado el tablero.' : 'La oscuridad ha prevalecido en la batalla.';
            icon.innerHTML = `<i class="fas ${winnerColor === 'white' ? 'fa-crown' : 'fa-skull-crossbones'}"></i>`;
            modal.classList.remove('hidden');
        }
    }
}

// --- INPUT LOGIC ---
class InputHandler {
    constructor(sceneManager, game, board) {
        this.sceneManager = sceneManager; this.game = game; this.board = board;
        this.raycaster = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
        this.isRotating = false; this.lastMouseX = 0; this.rotationSensitivity = 0.01;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.sceneManager.renderer.domElement;
        canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        canvas.addEventListener('mouseup', () => this.onPointerUp());
        canvas.addEventListener('touchstart', (e) => this.onPointerDown(e.touches[0]), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.onPointerMove(e.touches[0]), { passive: false });
        canvas.addEventListener('touchend', () => this.onPointerUp());
    }

    updateMousePosition(event) {
        const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onPointerMove(event) {
        this.updateMousePosition(event);
        if (this.isRotating && this.game.selectedPiece) {
            const deltaX = event.clientX - this.lastMouseX;
            this.game.selectedPiece.rotation.y += deltaX * this.rotationSensitivity;
            this.lastMouseX = event.clientX;
            return;
        }
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj && obj.userData.gridX === undefined && !obj.userData.isSquare) obj = obj.parent;
            if (obj && !obj.userData.isSquare) {
                this.game.showPieceInfo(obj.userData);
                const tooltip = document.getElementById('piece-info-tooltip');
                if (tooltip) { tooltip.style.left = (event.clientX + 10) + 'px'; tooltip.style.top = (event.clientY + 10) + 'px'; }
            } else this.game.hidePieceInfo();
        } else this.game.hidePieceInfo();
    }

    async onPointerDown(event) {
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);

        if (intersects.length > 0) {
            let obj = intersects[0].object;
            while (obj && obj.userData.gridX === undefined && !obj.userData.isSquare) obj = obj.parent;
            if (!obj) return;

            const gridX = obj.userData.gridX;
            const gridZ = obj.userData.gridZ;

            // Si hay una pieza seleccionada y clicamos sobre ella, activamos rotación
            if (this.game.selectedPiece && gridX === this.game.selectedPiece.userData.gridX && gridZ === this.game.selectedPiece.userData.gridZ) {
                this.isRotating = true;
                this.lastMouseX = event.clientX;
                this.sceneManager.controls.enabled = false;
                return;
            }

            if (this.game.selectedPiece) {
                // Intentar mover la pieza
                const moved = await this.game.moveSelectedPiece(gridX, gridZ);
                if (!moved) {
                    // Si no se pudo mover, intentar seleccionar una pieza aliada en esa posición
                    const selected = this.game.selectPiece(gridX, gridZ);
                    if (!selected) {
                        // Si tampoco se pudo seleccionar (clic en vacío o enemigo inválido), deseleccionar
                        this.game.selectedPiece = null;
                        this.board.clearHighlights();
                    }
                }
            } else {
                // Intentar seleccionar
                this.game.selectPiece(gridX, gridZ);
            }
        } else {
            // Clic fuera del tablero deselecciona
            this.game.selectedPiece = null;
            this.board.clearHighlights();
        }
    }

    onPointerUp() { if (this.isRotating) { this.isRotating = false; this.sceneManager.controls.enabled = true; } }
}

// --- MAIN ENTRY POINT ---
class Main {
    constructor() { this.initUI(); this.checkAuth(); }
    initUI() {
        this.btnReset = document.getElementById('btn-reset');
        this.turnDisplay = document.getElementById('current-turn-display');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.usernameInput = document.getElementById('main-username');
        this.passwordInput = document.getElementById('main-password');
        document.getElementById('btn-reset').addEventListener('click', () => this.handleReset());
        document.getElementById('btn-login-main').addEventListener('click', () => this.handleLogin());
        document.getElementById('btn-logout-main').addEventListener('click', () => this.handleLogout());
    }
    checkAuth() {
        const user = getCurrentUser();
        if (user) { document.getElementById('main-login').classList.add('hidden'); this.initGame(); }
        else document.getElementById('main-login').classList.remove('hidden');
    }
    async handleLogin() {
        try { await customSignIn(this.usernameInput.value, this.passwordInput.value); window.location.reload(); }
        catch (e) { document.getElementById('main-login-error').textContent = e.message; }
    }
    handleLogout() { customSignOut(); window.location.reload(); }
    async initGame() {
        const container = document.getElementById('canvas-container');
        this.sceneManager = new SceneManager(container);
        this.board = new Board(this.sceneManager.scene);
        this.pieceManager = new PieceManager(this.sceneManager.scene);
        this.game = new Game(this.sceneManager, this.board, this.pieceManager);
        this.inputHandler = new InputHandler(this.sceneManager, this.game, this.board);

        const playAgain = document.getElementById('btn-play-again');
        if (playAgain) {
            playAgain.addEventListener('click', () => this.game.startNewGame());
        }

        this.animate();
        await this.showGame();
    }
    async handleReset() { if (confirm('¿Reiniciar partida?')) await this.game.startNewGame(); }
    async showGame() {
        this.loadingOverlay.classList.remove('hidden');
        await this.pieceManager.loadModels();
        this.loadingOverlay.classList.add('hidden');
        document.getElementById('game-ui').classList.remove('hidden');
        await this.game.startNewGame();
    }
    animate(time) {
        requestAnimationFrame((t) => this.animate(t));
        const deltaTime = this.lastTime ? (time - this.lastTime) / 1000 : 0;
        this.lastTime = time;
        if (this.pieceManager) this.pieceManager.update(deltaTime);
        if (this.sceneManager) { if (this.sceneManager.controls) this.sceneManager.controls.update(); this.sceneManager.render(); }
        if (this.game && this.turnDisplay) this.turnDisplay.textContent = `Turno: ${this.game.turn === 'white' ? 'Blanco' : 'Negro'}`;
    }
}

new Main();
