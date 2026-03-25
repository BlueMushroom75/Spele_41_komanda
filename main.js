
const canvas = document.getElementById("drawBoard");
const ctx = canvas.getContext("2d");

const shapeDropdown = document.getElementById("select-contour");
const pointSlider = document.getElementById("select-points");
const uiPlayerPoints = document.getElementById("score-display");
const uiCurrentPlayer = document.getElementById("current_player");
const uiIntersectPreview = document.getElementById("about_to_intersect");
const searchDepthInput = document.getElementById("maxDepthInput");
const resetButton = document.getElementById("reset-button");

const selectPlayer1 = document.getElementById("player-1-select");
const selectPlayer2 = document.getElementById("player-2-select");

const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");
const resultsScreen = document.getElementById("results-screen");
const startButton = document.getElementById("start-button");
const playAgainButton = document.getElementById("play-again-button");
const menuButton = document.getElementById("menu-button");
const menuFromGameButton = document.getElementById("menu-from-game-button");
const pointsValueDisplay = document.getElementById("points-value");


const COLOR_POINT = "#000000";
const COLOR_PLAYER_1 = "#00aa00";
const COLOR_PLAYER_2 = "#cc3333";
const COLOR_SELECTED = "#bb1be3";
const COLOR_INTERSECT = "#9c0000";
const COLOR_PREVIEW = "#00aa00";

const pointSize = 10;
const selectPointSize = 15;
const lineWidth = 2;
const mouseMargin = 20;

const arena_x = 400;
const arena_y = 400;

const canvasW = canvas.width;
const canvasH = canvas.height;
const centerX = canvasW / 2;
const centerY = canvasH / 2;


let pointCount = Number(pointSlider.value);
let selectedShape = shapeDropdown.value;
let maximumDepth = Number(searchDepthInput.value);
let players = ["human", "human"];
const playerCount = 2;

let totalLines = 0;
let fullMask = 0n;
let edgeList = [];          // moveId -> [from, to]
let edgeIndex = [];         // edgeIndex[a][b] -> moveId
let edgeMasks = [];         // moveId -> 1n << moveId
let crossingMasks = [];     // moveId -> bitmask of all crossing edges


let drawPoints = [];
let highlightedPoint = undefined;
let fromDrawPoint = undefined;
let mousePos = { x: 0, y: 0 };

let game = null;

// ========================================
// DATA STRUCTURES
// ========================================
class SearchNode {
    constructor({
        mask,
        score0,
        score1,
        playerToMove,
        evalScore,
        bestMove = -1,
        children = [],
    }) {
        this.mask = mask;
        this.score0 = score0;
        this.score1 = score1;
        this.playerToMove = playerToMove;
        this.evalScore = evalScore;
        this.bestMove = bestMove;
        this.children = children; // [{ moveId, node }]
    }
}

class GameState {
    constructor() {
        this.mask = 0n;
        this.lines = []; // { from, to, moveId, owner }
        this.scores = [0, 0];
        this.currentPlayer = 0;
    }

    clone() {
        const g = new GameState();
        g.mask = this.mask;
        g.lines = this.lines.slice();
        g.scores = [...this.scores];
        g.currentPlayer = this.currentPlayer;
        return g;
    }
}

//
function buildEdgeTables() {
    totalLines = Math.floor((pointCount * (pointCount - 1)) / 2);
    fullMask = (1n << BigInt(totalLines)) - 1n;

    edgeList = [];
    edgeIndex = Array.from({ length: pointCount }, () => Array(pointCount).fill(-1));
    edgeMasks = new Array(totalLines);
    crossingMasks = new Array(totalLines).fill(0n);

    let id = 0;
    for (let i = 0; i < pointCount; i++) {
        for (let j = i + 1; j < pointCount; j++) {
            edgeList[id] = [i, j];
            edgeIndex[i][j] = id;
            edgeIndex[j][i] = id;
            edgeMasks[id] = 1n << BigInt(id);
            id++;
        }
    }

    for (let a = 0; a < totalLines; a++) {
        const [a1, a2] = edgeList[a];
        for (let b = a + 1; b < totalLines; b++) {
            const [b1, b2] = edgeList[b];

            if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) {
                continue;
            }

            if (edgesCrossOnContour(a1, a2, b1, b2)) {
                crossingMasks[a] |= edgeMasks[b];
                crossingMasks[b] |= edgeMasks[a];
            }
        }
    }
}

function point2id(a, b) {
    if (a === b) {
        throw new Error("Invalid move: same point");
    }
    return edgeIndex[a][b];
}

function id2point(moveId) {
    return edgeList[moveId];
}

function isInsideArc(point, start, end) {
    if (start > end) {
        return point > start || point < end;
    }
    return point > start && point < end;
}

function edgesCrossOnContour(a, b, c, d) {
    const cInside = isInsideArc(c, a, b);
    const dInside = isInsideArc(d, a, b);
    return cInside !== dInside;
}

// ========================================
// DRAW POINT LAYOUT
// ========================================
function buildDrawPoints() {
    drawPoints = [];

    const arena_x_2 = arena_x / 2;
    const arena_y_2 = arena_y / 2;

    switch (selectedShape) {
        case "square": {
            const step = (2 * (arena_x + arena_y)) / pointCount;
            for (let i = 0; i < pointCount; i++) {
                let offset = i * step;

                if (offset < arena_x) {
                    drawPoints.push([centerX + offset - arena_x_2, centerY + arena_y_2]);
                } else if (offset < arena_x + arena_y) {
                    offset -= arena_x;
                    drawPoints.push([centerX + arena_x_2, centerY + arena_y_2 - offset]);
                } else if (offset < 2 * arena_x + arena_y) {
                    offset -= arena_x + arena_y;
                    drawPoints.push([centerX + arena_x_2 - offset, centerY - arena_y_2]);
                } else {
                    offset -= 2 * arena_x + arena_y;
                    drawPoints.push([centerX - arena_x_2, centerY + offset - arena_y_2]);
                }
            }
            break;
        }

        case "circle": {
            for (let i = 0; i < pointCount; i++) {
                const deg = (i / pointCount) * 2 * Math.PI;
                drawPoints.push([
                    centerX + arena_x_2 * Math.cos(deg),
                    centerY + arena_y_2 * Math.sin(deg),
                ]);
            }
            break;
        }

        case "triangle": {
            const hypot = Math.sqrt(arena_x_2 ** 2 + arena_y ** 2);
            const step = (arena_x + 2 * hypot) / pointCount;
            const ratio = arena_x_2 / arena_y;

            for (let i = 0; i < pointCount; i++) {
                let offset = i * step;

                if (offset < arena_x) {
                    drawPoints.push([centerX + offset - arena_x_2, centerY + arena_y_2]);
                } else if (offset < arena_x + hypot) {
                    offset -= arena_x;
                    const cY = offset / Math.sqrt(ratio ** 2 + 1);
                    drawPoints.push([centerX + arena_x_2 - cY * ratio, centerY + arena_y_2 - cY]);
                } else {
                    offset -= arena_x + hypot;
                    const cY = offset / Math.sqrt(ratio ** 2 + 1);
                    drawPoints.push([centerX - cY * ratio, centerY - arena_y_2 + cY]);
                }
            }
            break;
        }

        default:
            throw new Error(`Unknown shape: ${selectedShape}`);
    }
}

// ========================================
// CORE GAME HELPERS
// ========================================
function getLegalMoves(mask) {
    const moves = [];
    for (let moveId = 0; moveId < totalLines; moveId++) {
        if ((mask & edgeMasks[moveId]) === 0n) {
            moves.push(moveId);
        }
    }
    return moves;
}

function hasValidMoves(mask) {
    return mask !== fullMask;
}

function isMoveCrossing(mask, moveId) {
    return (crossingMasks[moveId] & mask) !== 0n;
}

function getMovePenalty(mask, moveId) {
    return isMoveCrossing(mask, moveId) ? 1 : 0;
}

function applyMoveToState(state, moveId) {
    if ((state.mask & edgeMasks[moveId]) !== 0n) {
        throw new Error(`Move ${moveId} already exists`);
    }

    const [from, to] = id2point(moveId);
    const owner = state.currentPlayer;
    const penalty = getMovePenalty(state.mask, moveId);

    state.mask |= edgeMasks[moveId];
    state.lines.push({ from, to, moveId, owner });
    state.scores[owner] += penalty;
    state.currentPlayer = 1 - state.currentPlayer;
}

function countSafeAndRiskyMoves(mask) {
    let safe = 0;
    let risky = 0;

    for (let moveId = 0; moveId < totalLines; moveId++) {
        if ((mask & edgeMasks[moveId]) !== 0n) continue;

        if (isMoveCrossing(mask, moveId)) risky++;
        else safe++;
    }

    return { safe, risky };
}


function evaluateState(mask, score0, score1, playerToMove, rootPlayer) {
    const myScore = rootPlayer === 0 ? score0 : score1;
    const oppScore = rootPlayer === 0 ? score1 : score0;

  
    let value = (oppScore - myScore) * 10000;

    const { safe, risky } = countSafeAndRiskyMoves(mask);

   
    value += safe * 15;
    value -= risky * 5;

  
    if (playerToMove !== rootPlayer) {
        value = value - 10;
    }

    return value;
}

function orderMoves(mask, moves) {
    return moves.slice().sort((a, b) => {
        const pa = getMovePenalty(mask, a);
        const pb = getMovePenalty(mask, b);

        if (pa !== pb) return pa - pb;

        const futureA = countFutureSafeMoves(mask, a);
        const futureB = countFutureSafeMoves(mask, b);

        return futureB - futureA;
    });
}

function countFutureSafeMoves(mask, moveId) {
    const newMask = mask | edgeMasks[moveId];
    let safe = 0;

    for (let nextMove = 0; nextMove < totalLines; nextMove++) {
        if ((newMask & edgeMasks[nextMove]) !== 0n) continue;
        if (!isMoveCrossing(newMask, nextMove)) safe++;
    }

    return safe;
}

// ========================================
// SEARCH: MINIMAX
// ========================================
function calculateMiniMaxBestMove(state) {
    const rootPlayer = state.currentPlayer;
    const memo = new Map();

    function minimax(mask, score0, score1, playerToMove, depth) {
        const key = `${mask}|${score0}|${score1}|${playerToMove}|${depth}`;
        if (memo.has(key)) {
            return memo.get(key);
        }

        const legalMoves = getLegalMoves(mask);

        if (depth === 0 || legalMoves.length === 0) {
            const node = new SearchNode({
                mask,
                score0,
                score1,
                playerToMove,
                evalScore: evaluateState(mask, score0, score1, playerToMove, rootPlayer),
                bestMove: -1,
                children: [],
            });
            memo.set(key, node);
            return node;
        }

        const maximizing = playerToMove === rootPlayer;
        let bestEval = maximizing ? -Infinity : Infinity;
        let bestMove = -1;
        const children = [];

        const ordered = orderMoves(mask, legalMoves);

        for (const moveId of ordered) {
            const penalty = getMovePenalty(mask, moveId);
            const newMask = mask | edgeMasks[moveId];
            const newScore0 = score0 + (playerToMove === 0 ? penalty : 0);
            const newScore1 = score1 + (playerToMove === 1 ? penalty : 0);

            const child = minimax(newMask, newScore0, newScore1, 1 - playerToMove, depth - 1);
            children.push({ moveId, node: child });

            if (maximizing) {
                if (child.evalScore > bestEval) {
                    bestEval = child.evalScore;
                    bestMove = moveId;
                }
            } else {
                if (child.evalScore < bestEval) {
                    bestEval = child.evalScore;
                    bestMove = moveId;
                }
            }
        }

        const node = new SearchNode({
            mask,
            score0,
            score1,
            playerToMove,
            evalScore: bestEval,
            bestMove,
            children,
        });

        memo.set(key, node);
        return node;
    }

    const root = minimax(
        state.mask,
        state.scores[0],
        state.scores[1],
        state.currentPlayer,
        maximumDepth
    );

    return root.bestMove;
}

// ========================================
// SEARCH: ALPHA-BETA
// ========================================
function calculateAlphaBetaBestMove(state) {
    const rootPlayer = state.currentPlayer;

    // Vienkārša transposition table exact values only
    const memo = new Map();

    function alphabeta(mask, score0, score1, playerToMove, depth, alpha, beta) {
        const key = `${mask}|${score0}|${score1}|${playerToMove}|${depth}`;
        if (memo.has(key)) {
            return memo.get(key);
        }

        const legalMoves = getLegalMoves(mask);

        if (depth === 0 || legalMoves.length === 0) {
            const node = new SearchNode({
                mask,
                score0,
                score1,
                playerToMove,
                evalScore: evaluateState(mask, score0, score1, playerToMove, rootPlayer),
                bestMove: -1,
                children: [],
            });
            memo.set(key, node);
            return node;
        }

        const maximizing = playerToMove === rootPlayer;
        let bestEval = maximizing ? -Infinity : Infinity;
        let bestMove = -1;
        const children = [];
        let fullyExplored = true;

        const ordered = orderMoves(mask, legalMoves);

        for (const moveId of ordered) {
            const penalty = getMovePenalty(mask, moveId);
            const newMask = mask | edgeMasks[moveId];
            const newScore0 = score0 + (playerToMove === 0 ? penalty : 0);
            const newScore1 = score1 + (playerToMove === 1 ? penalty : 0);

            const child = alphabeta(
                newMask,
                newScore0,
                newScore1,
                1 - playerToMove,
                depth - 1,
                alpha,
                beta
            );

            children.push({ moveId, node: child });

            if (maximizing) {
                if (child.evalScore > bestEval) {
                    bestEval = child.evalScore;
                    bestMove = moveId;
                }
                alpha = Math.max(alpha, bestEval);
            } else {
                if (child.evalScore < bestEval) {
                    bestEval = child.evalScore;
                    bestMove = moveId;
                }
                beta = Math.min(beta, bestEval);
            }

            if (alpha >= beta) {
                fullyExplored = false;
                break;
            }
        }

        const node = new SearchNode({
            mask,
            score0,
            score1,
            playerToMove,
            evalScore: bestEval,
            bestMove,
            children,
        });

        if (fullyExplored) {
            memo.set(key, node);
        }

        return node;
    }

    const root = alphabeta(
        state.mask,
        state.scores[0],
        state.scores[1],
        state.currentPlayer,
        maximumDepth,
        -Infinity,
        Infinity
    );

    return root.bestMove;
}

// ========================================
// UI / SCORE / RESULT HELPERS
// ========================================
function updateScoreUI() {
    let msg = "Spēlētāju punkti:\n";
    for (let i = 0; i < playerCount; i++) {
        msg += `${i + 1}. ${players[i]}: ${game.scores[i]}\n`;
    }

    uiPlayerPoints.textContent = msg;
    uiCurrentPlayer.textContent = `${game.currentPlayer + 1}. ${players[game.currentPlayer]}`;
}

function updateIntersectPreview(count) {
    uiIntersectPreview.textContent = String(count);
}

function showResults() {
    const [s0, s1] = game.scores;

    let winnerText = "";
    if (s0 < s1) {
        winnerText = `Player 1 (${players[0]}) Wins!`;
    } else if (s1 < s0) {
        winnerText = `Player 2 (${players[1]}) Wins!`;
    } else {
        winnerText = "Draw!";
    }

    document.getElementById("winner-display").textContent = winnerText;

    let scoresHTML = "";
    for (let i = 0; i < playerCount; i++) {
        scoresHTML += `
            <div class="score-entry">
                <span class="player-name">Player ${i + 1} (${players[i]})</span>
                <span class="score-value">${game.scores[i]}</span>
            </div>
        `;
    }

    document.getElementById("final-scores-container").innerHTML = scoresHTML;
    resultsScreen.classList.add("show");
}


function initGame() {
    pointCount = Number(pointSlider.value);
    selectedShape = shapeDropdown.value;
    maximumDepth = Number(searchDepthInput.value);

    players[0] = selectPlayer1.value;
    players[1] = selectPlayer2.value;

    highlightedPoint = undefined;
    fromDrawPoint = undefined;
    mousePos = { x: 0, y: 0 };

    buildEdgeTables();
    buildDrawPoints();

    game = new GameState();

    updateScoreUI();
    updateIntersectPreview(0);
    resultsScreen.classList.remove("show");

    if (players[game.currentPlayer] !== "human") {
        setTimeout(chooseNextTurn, 20);
    }
}

function chooseNextTurn() {
    if (!hasValidMoves(game.mask)) {
        showResults();
        return;
    }

    const alg = players[game.currentPlayer];
    let moveId = -1;

    if (alg === "minmax") {
        moveId = calculateMiniMaxBestMove(game);
    } else if (alg === "alpha-beta") {
        moveId = calculateAlphaBetaBestMove(game);
    } else {
        return;
    }

    if (moveId < 0) {
        showResults();
        return;
    }

    const [from, to] = id2point(moveId);
    makeAMove(from, to);
}

function makeAMove(from, to) {
    const moveId = point2id(from, to);

    if ((game.mask & edgeMasks[moveId]) !== 0n) {
        throw new Error(`Move ${from}-${to} is already used`);
    }

    applyMoveToState(game, moveId);
    updateScoreUI();

    if (!hasValidMoves(game.mask)) {
        showResults();
        return;
    }

    if (players[game.currentPlayer] !== "human") {
        setTimeout(chooseNextTurn, 20);
    }
}


function calculateIntersectionsForPreview(from, to) {
    const moveId = point2id(from, to);
    const result = [];

    for (const line of game.lines) {
        if ((crossingMasks[moveId] & edgeMasks[line.moveId]) !== 0n) {
            result.push(line);
        }
    }

    return result;
}


function drawPoint(x, y, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
    ctx.fill();
}

function drawLine(x1, y1, x2, y2, color, dashed = []) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashed);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawHighlight(x, y) {
    ctx.beginPath();
    ctx.strokeStyle = COLOR_SELECTED;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([10, 10]);
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawFromPoint(x, y) {
    ctx.beginPath();
    ctx.strokeStyle = COLOR_PREVIEW;
    ctx.lineWidth = lineWidth;
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI);
    ctx.stroke();
}

function getLineColor(owner) {
    return owner === 0 ? COLOR_PLAYER_1 : COLOR_PLAYER_2;
}

function drawLoop() {
    ctx.clearRect(0, 0, canvasW, canvasH);

    if (game) {
        for (const line of game.lines) {
            const [x1, y1] = drawPoints[line.from];
            const [x2, y2] = drawPoints[line.to];
            drawLine(x1, y1, x2, y2, getLineColor(line.owner));
        }

        if (fromDrawPoint !== undefined && highlightedPoint !== undefined) {
            const [x1, y1] = drawPoints[fromDrawPoint];
            const [x2, y2] = drawPoints[highlightedPoint];

            drawLine(x1, y1, x2, y2, COLOR_PREVIEW, [10, 10]);

            const intersects = calculateIntersectionsForPreview(fromDrawPoint, highlightedPoint);
            for (const line of intersects) {
                const [ix1, iy1] = drawPoints[line.from];
                const [ix2, iy2] = drawPoints[line.to];
                drawLine(ix1, iy1, ix2, iy2, COLOR_INTERSECT);
            }

            updateIntersectPreview(intersects.length);
        } else {
            updateIntersectPreview(0);
        }
    }

    for (let i = 0; i < drawPoints.length; i++) {
        const [x, y] = drawPoints[i];
        drawPoint(x, y, COLOR_POINT);
    }

    drawPoint(mousePos.x, mousePos.y, COLOR_SELECTED);

    if (fromDrawPoint !== undefined) {
        const [x, y] = drawPoints[fromDrawPoint];
        drawFromPoint(x, y);
    }

    if (highlightedPoint !== undefined) {
        const [x, y] = drawPoints[highlightedPoint];
        drawHighlight(x, y);
    }

    requestAnimationFrame(drawLoop);
}

// ========================================
// MOUSE HANDLERS
// ========================================
document.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };

    let nearest = undefined;
    let nearestDist = mouseMargin;

    for (let i = 0; i < drawPoints.length; i++) {
        if (i === fromDrawPoint) continue;

        const [px, py] = drawPoints[i];
        const dist = Math.hypot(mousePos.x - px, mousePos.y - py);

        if (dist > nearestDist) continue;

        if (fromDrawPoint !== undefined && game) {
            const moveId = point2id(fromDrawPoint, i);
            if ((game.mask & edgeMasks[moveId]) !== 0n) {
                continue;
            }
        }

        nearest = i;
        nearestDist = dist;
    }

    highlightedPoint = nearest;
});

document.addEventListener("mousedown", () => {
    if (!game) return;
    if (players[game.currentPlayer] !== "human") return;

    fromDrawPoint = highlightedPoint;
    highlightedPoint = undefined;
});

document.addEventListener("mouseup", () => {
    if (!game) return;
    if (players[game.currentPlayer] !== "human") return;

    if (
        fromDrawPoint !== undefined &&
        highlightedPoint !== undefined &&
        fromDrawPoint !== highlightedPoint
    ) {
        const moveId = point2id(fromDrawPoint, highlightedPoint);
        if ((game.mask & edgeMasks[moveId]) === 0n) {
            makeAMove(fromDrawPoint, highlightedPoint);
        }
    }

    fromDrawPoint = undefined;
    highlightedPoint = undefined;
});

// ========================================
// UI EVENTS
// ========================================
shapeDropdown.addEventListener("input", (e) => {
    selectedShape = e.target.value;
    initGame();
});

pointSlider.addEventListener("input", (e) => {
    pointCount = Number(e.target.value);
    pointsValueDisplay.textContent = e.target.value;
    initGame();
});

searchDepthInput.addEventListener("input", (e) => {
    maximumDepth = Number(e.target.value);
    initGame();
});

selectPlayer1.addEventListener("input", (e) => {
    players[0] = e.target.value;
    initGame();
});

selectPlayer2.addEventListener("input", (e) => {
    players[1] = e.target.value;
    initGame();
});

resetButton.addEventListener("click", () => {
    initGame();
});

startButton.addEventListener("click", () => {
    menuScreen.classList.add("hidden");
    gameScreen.style.display = "block";
    initGame();
});

playAgainButton.addEventListener("click", () => {
    resultsScreen.classList.remove("show");
    initGame();
});

menuButton.addEventListener("click", () => {
    menuScreen.classList.remove("hidden");
    gameScreen.style.display = "none";
    resultsScreen.classList.remove("show");
});

menuFromGameButton.addEventListener("click", () => {
    menuScreen.classList.remove("hidden");
    gameScreen.style.display = "none";
    resultsScreen.classList.remove("show");
});

// ========================================
// START
// ========================================
pointsValueDisplay.textContent = pointSlider.value;
buildEdgeTables();
buildDrawPoints();
game = new GameState();
updateScoreUI();
updateIntersectPreview(0);
drawLoop();