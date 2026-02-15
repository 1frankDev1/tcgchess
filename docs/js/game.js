import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { ChessRules } from './rules.js';

export class Game {
    constructor(sceneManager, board, pieceManager) {
        this.sceneManager = sceneManager;
        this.board = board;
        this.pieceManager = pieceManager;
        this.turn = 'white';
        this.selectedPiece = null;
        this.gameId = null;
        this.boardState = {}; // { x: { z: { type, color } } }
        this.initPieceInfoUI();
    }

    initPieceInfoUI() {
        this.infoDiv = document.createElement('div');
        this.infoDiv.id = 'piece-info-tooltip';
        this.infoDiv.className = 'tooltip hidden';
        document.body.appendChild(this.infoDiv);
    }

    showPieceInfo(userData) {
        if (!userData.characterName) return;
        this.infoDiv.innerHTML = `
            <strong>${userData.characterName}</strong><br>
            <span>Clasificación: ${userData.classification}</span>
        `;
        this.infoDiv.classList.remove('hidden');
    }

    hidePieceInfo() {
        this.infoDiv.classList.add('hidden');
    }

    async startNewGame() {
        this.turn = 'white';
        this.initBoardState();
        this.renderPieces();
    }

    initBoardState() {
        this.boardState = {};
        const setup = [
            { row: 0, color: 'white' },
            { row: 1, color: 'white', type: 'pawn' },
            { row: 6, color: 'black', type: 'pawn' },
            { row: 7, color: 'black' }
        ];

        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

        setup.forEach(s => {
            if (!this.boardState[s.row]) this.boardState[s.row] = {};
            for (let z = 0; z < 8; z++) {
                const type = s.type || backRow[z];
                this.boardState[s.row][z] = { type, color: s.color };
            }
        });
    }

    renderPieces() {
        this.pieceManager.clearPieces();
        for (let x in this.boardState) {
            for (let z in this.boardState[x]) {
                const piece = this.boardState[x][z];
                const pos = this.board.gridToWorld(parseInt(x), parseInt(z));
                this.pieceManager.createPiece(piece.type, piece.color, pos);
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
        this.board.highlightSquare(fromX, fromZ, 0x00ff00); // Highlight selected

        for (let x = 0; x < 8; x++) {
            for (let z = 0; z < 8; z++) {
                if (ChessRules.isValidMove(this.selectedPiece.userData, x, z, this.boardState)) {
                    if (!ChessRules.wouldBeInCheck(this.selectedPiece.userData, x, z, this.boardState)) {
                        this.board.highlightSquare(x, z, 0xffff00);
                    }
                }
            }
        }
    }

    async moveSelectedPiece(toX, toZ) {
        if (!this.selectedPiece) return false;

        if (ChessRules.isValidMove(this.selectedPiece.userData, toX, toZ, this.boardState)) {
            if (ChessRules.wouldBeInCheck(this.selectedPiece.userData, toX, toZ, this.boardState)) {
                console.log('Cannot move: King would be in check');
                return false;
            }

            const fromX = this.selectedPiece.userData.gridX;
            const fromZ = this.selectedPiece.userData.gridZ;

            // Actualizar estado interno
            const pieceData = this.boardState[fromX][fromZ];
            
            // Captura
            if (this.boardState[toX]?.[toZ]) {
                this.pieceManager.removePieceAt(toX, toZ);
            }

            if (!this.boardState[toX]) this.boardState[toX] = {};
            this.boardState[toX][toZ] = pieceData;
            delete this.boardState[fromX][fromZ];

            // Animación y actualización visual
            const worldPos = this.board.gridToWorld(toX, toZ);
            this.selectedPiece.userData.targetPosition = new THREE.Vector3(worldPos.x, 0, worldPos.z);
            this.selectedPiece.userData.gridX = toX;
            this.selectedPiece.userData.gridZ = toZ;

            this.selectedPiece = null;
            this.board.clearHighlights();
            this.turn = this.turn === 'white' ? 'black' : 'white';

            // Verificar Jaque al oponente
            if (ChessRules.isKingInCheck(this.turn, this.boardState)) {
                console.log(`Check! ${this.turn} king is in danger.`);
            }

            return true;
        }

        return false;
    }
}
