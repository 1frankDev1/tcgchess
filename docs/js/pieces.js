import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { getModelUrl, getUserSelections, getCurrentUser } from './supabase.js';

export class PieceManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.models = new Map(); // Cache for models
        this.pieces = []; // Active pieces in the scene
        this.typeMapping = {
            'pawn': 'Peón',
            'rook': 'Torre',
            'knight': 'Caballo',
            'bishop': 'Alfil',
            'queen': 'Reina',
            'king': 'Rey'
        };
        this.characterInfo = new Map(); // Store character name/classification
    }

    async loadModels() {
        const pieceTypes = ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'];
        const colors = ['white', 'black'];

        const user = getCurrentUser();
        let selections = [];
        if (user) {
            try {
                selections = await getUserSelections(user.id);
            } catch (e) {
                console.error("Error fetching selections", e);
            }
        }

        const promises = [];
        for (const type of pieceTypes) {
            const mappedType = this.typeMapping[type];
            const selection = selections.find(s => s.piece_type === mappedType);

            for (const color of colors) {
                let path, charName;
                if (selection && selection.chess_characters) {
                    path = selection.chess_characters.gltf_path;
                    charName = selection.chess_characters.name;
                } else {
                    path = `${type}_${color}.glb`;
                    charName = type.charAt(0).toUpperCase() + type.slice(1);
                }

                this.characterInfo.set(`${type}_${color}`, {
                    name: charName,
                    classification: mappedType
                });

                promises.push(this.loadModel(type, color, path));
            }
        }

        try {
            await Promise.all(promises);
            console.log('All models loaded successfully');
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    async loadModel(type, color, path) {
        try {
            const url = await getModelUrl(path);
            return new Promise((resolve, reject) => {
                this.loader.load(
                    url,
                    (gltf) => {
                        const model = gltf.scene;
                        model.traverse((node) => {
                            if (node.isMesh) {
                                node.castShadow = true;
                                node.receiveShadow = true;
                            }
                        });
                        this.models.set(`${type}_${color}`, model);
                        resolve(model);
                    },
                    undefined,
                    (error) => {
                        console.error(`Error loading model ${path}:`, error);
                        this.createPlaceholder(type, color);
                        resolve();
                    }
                );
            });
        } catch (error) {
            console.error(`Error getting URL for ${path}:`, error);
            this.createPlaceholder(type, color);
        }
    }

    createPlaceholder(type, color) {
        const geometry = type === 'pawn' ? new THREE.CylinderGeometry(0.2, 0.3, 0.5) : new THREE.BoxGeometry(0.4, 0.8, 0.4);
        const material = new THREE.MeshStandardMaterial({ color: color === 'white' ? 0xeeeeee : 0x333333 });
        const mesh = new THREE.Mesh(geometry, material);
        this.models.set(`${type}_${color}`, mesh);
    }

    createPiece(type, color, position) {
        const originalModel = this.models.get(`${type}_${color}`);
        if (!originalModel) return null;

        const info = this.characterInfo.get(`${type}_${color}`) || { name: type, classification: this.typeMapping[type] };

        const piece = originalModel.clone();
        piece.position.set(position.x, 0, position.z);
        piece.userData = {
            type,
            color,
            gridX: position.gridX,
            gridZ: position.gridZ,
            characterName: info.name,
            classification: info.classification
        };
        this.scene.add(piece);
        this.pieces.push(piece);
        return piece;
    }

    clearPieces() {
        this.pieces.forEach(piece => this.scene.remove(piece));
        this.pieces = [];
    }

    removePieceAt(gridX, gridZ) {
        const index = this.pieces.findIndex(p => p.userData.gridX === gridX && p.userData.gridZ === gridZ);
        if (index !== -1) {
            this.scene.remove(this.pieces[index]);
            this.pieces.splice(index, 1);
        }
    }

    getPieceAt(gridX, gridZ) {
        return this.pieces.find(p => p.userData.gridX === gridX && p.userData.gridZ === gridZ);
    }

    update(deltaTime) {
        const lerpSpeed = 10;
        this.pieces.forEach(piece => {
            if (piece.userData.targetPosition) {
                piece.position.lerp(piece.userData.targetPosition, lerpSpeed * deltaTime);
                if (piece.position.distanceTo(piece.userData.targetPosition) < 0.01) {
                    piece.position.copy(piece.userData.targetPosition);
                    delete piece.userData.targetPosition;
                }
            }
        });
    }
}
