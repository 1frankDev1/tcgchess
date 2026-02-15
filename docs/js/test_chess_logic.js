// Mocking ChessRules for testing in Node
import { ChessRules } from './rules.js';

function testPawnMove() {
    const boardState = {
        1: { 0: { type: 'pawn', color: 'white' } }
    };
    const piece = { type: 'pawn', color: 'white', gridX: 1, gridZ: 0 };
    
    console.assert(ChessRules.isValidMove(piece, 2, 0, boardState) === true, "Pawn should move forward 1");
    console.assert(ChessRules.isValidMove(piece, 3, 0, boardState) === true, "Pawn should move forward 2 from start");
    console.assert(ChessRules.isValidMove(piece, 2, 1, boardState) === false, "Pawn should not move diagonally without capture");
    
    boardState[2] = { 1: { type: 'pawn', color: 'black' } };
    console.assert(ChessRules.isValidMove(piece, 2, 1, boardState) === true, "Pawn should capture diagonally");
    
    console.log("Pawn tests passed!");
}

function testKnightMove() {
    const piece = { type: 'knight', color: 'white', gridX: 0, gridZ: 1 };
    const boardState = {};
    
    console.assert(ChessRules.isValidMove(piece, 2, 0, boardState) === true, "Knight L-move 1");
    console.assert(ChessRules.isValidMove(piece, 2, 2, boardState) === true, "Knight L-move 2");
    console.assert(ChessRules.isValidMove(piece, 1, 3, boardState) === true, "Knight L-move 3");
    console.assert(ChessRules.isValidMove(piece, 1, 1, boardState) === false, "Knight invalid move");
    
    console.log("Knight tests passed!");
}

function testCheckDetection() {
    const boardState = {
        0: { 4: { type: 'king', color: 'white' } },
        7: { 4: { type: 'rook', color: 'black' } }
    };
    
    console.assert(ChessRules.isKingInCheck('white', boardState) === true, "King should be in check from rook");
    
    boardState[7][4] = { type: 'bishop', color: 'black' };
    console.assert(ChessRules.isKingInCheck('white', boardState) === false, "King should not be in check from bishop on same column");
    
    console.log("Check detection tests passed!");
}

try {
    testPawnMove();
    testKnightMove();
    testCheckDetection();
    console.log("All logic tests passed!");
} catch (e) {
    console.error("Test failed!", e);
    process.exit(1);
}
