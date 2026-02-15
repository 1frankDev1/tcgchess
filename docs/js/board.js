import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class Board {
    constructor(scene) {
        this.scene = scene;
        this.size = 8;
        this.squareSize = 1;
        this.squares = [];
        this.createBoard();
    }

    createBoard() {
        const geometry = new THREE.BoxGeometry(this.squareSize, 0.1, this.squareSize);
        const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xebecd0 });
        const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x779556 });

        for (let x = 0; x < this.size; x++) {
            for (let z = 0; z < this.size; z++) {
                const material = (x + z) % 2 === 0 ? lightMaterial : darkMaterial;
                const square = new THREE.Mesh(geometry, material);
                
                // Centrar el tablero en (0,0,0)
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
            gridX,
            gridZ
        };
    }

    worldToGrid(x, z) {
        const gridX = Math.round(x / this.squareSize + (this.size - 1) / 2);
        const gridZ = Math.round(z / this.squareSize + (this.size - 1) / 2);
        
        if (gridX >= 0 && gridX < this.size && gridZ >= 0 && gridZ < this.size) {
            return { gridX, gridZ };
        }
        return null;
    }

    highlightSquare(gridX, gridZ, color = 0xffff00) {
        const square = this.getSquareAt(gridX, gridZ);
        if (square) {
            if (!square.userData.originalColor) {
                square.userData.originalColor = square.material.color.clone();
            }
            square.material.color.set(color);
        }
    }

    resetSquareColor(gridX, gridZ) {
        const square = this.getSquareAt(gridX, gridZ);
        if (square && square.userData.originalColor) {
            square.material.color.copy(square.userData.originalColor);
        }
    }

    clearHighlights() {
        this.squares.forEach(square => {
            if (square.userData.originalColor) {
                square.material.color.copy(square.userData.originalColor);
            }
        });
    }
}
