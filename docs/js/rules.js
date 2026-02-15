export class ChessRules {
    static isValidMove(piece, toX, toZ, boardState) {
        const fromX = parseInt(piece.gridX);
        const fromZ = parseInt(piece.gridZ);
        const targetX = parseInt(toX);
        const targetZ = parseInt(toZ);
        const type = piece.type;
        const color = piece.color;

        // No se puede mover a la misma casilla
        if (fromX === targetX && fromZ === targetZ) return false;

        // Fuera del tablero
        if (targetX < 0 || targetX > 7 || targetZ < 0 || targetZ > 7) return false;

        // No se puede capturar una pieza del mismo color
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

        // Movimiento simple hacia adelante (1 casilla)
        if (diffX === direction && diffZ === 0) {
            return !boardState[toX]?.[toZ];
        }

        // Doble movimiento inicial (2 casillas)
        if (fromX === startRow && diffX === 2 * direction && diffZ === 0) {
            const pathBlocked = boardState[fromX + direction]?.[fromZ] || boardState[toX]?.[toZ];
            return !pathBlocked;
        }

        // Captura diagonal
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

        // Clonar el estado del tablero y simular el movimiento
        const nextBoardState = JSON.parse(JSON.stringify(boardState));
        if (!nextBoardState[toX]) nextBoardState[toX] = {};
        nextBoardState[toX][toZ] = { type: piece.type, color: piece.color };
        if (nextBoardState[fromX]) delete nextBoardState[fromX][fromZ];

        return this.isKingInCheck(color, nextBoardState);
    }
}
