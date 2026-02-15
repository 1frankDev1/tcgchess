import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class InputHandler {
    constructor(sceneManager, game, board) {
        this.sceneManager = sceneManager;
        this.game = game;
        this.board = board;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.sceneManager.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.onPointerDown(touch);
        }, { passive: false });
    }

    updateMousePosition(event) {
        const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onPointerMove(event) {
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);

        if (intersects.length > 0) {
            let object = intersects[0].object;
            while (object && object.userData.gridX === undefined && !object.userData.isSquare) {
                object = object.parent;
            }

            if (object && !object.userData.isSquare) {
                this.game.showPieceInfo(object.userData);

                // Position tooltip near mouse
                const tooltip = document.getElementById('piece-info-tooltip');
                if (tooltip) {
                    tooltip.style.left = (event.clientX + 10) + 'px';
                    tooltip.style.top = (event.clientY + 10) + 'px';
                }
            } else {
                this.game.hidePieceInfo();
            }
        } else {
            this.game.hidePieceInfo();
        }
    }

    onPointerDown(event) {
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);

        if (intersects.length > 0) {
            let object = intersects[0].object;
            while (object && object.userData.gridX === undefined && !object.userData.isSquare) {
                if (object.parent && object.parent.userData.gridX !== undefined) {
                    object = object.parent;
                    break;
                }
                object = object.parent;
            }

            if (!object) return;

            const gridX = object.userData.gridX;
            const gridZ = object.userData.gridZ;

            if (this.game.selectedPiece) {
                const moved = this.game.moveSelectedPiece(gridX, gridZ);
                if (!moved) {
                    this.game.selectPiece(gridX, gridZ);
                }
            } else {
                this.game.selectPiece(gridX, gridZ);
            }
        } else {
            this.game.selectedPiece = null;
            this.board.clearHighlights();
        }
    }
}
