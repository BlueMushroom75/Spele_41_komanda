const canvas = document.getElementById("drawBoard")
const ctx = canvas.getContext("2d")

// const shapeDropdown = document.getElementById("select-contour")
const pointSlider = document.getElementById("select-points")

const uiPlayerPoints = document.getElementById("score-display")
const uiCurrentPlayer = document.getElementById("current_player")
const uiIntersectPreview = document.getElementById("about_to_intersect")

const serchDepthInput = document.getElementById("maxDepthInput")
const resetButton = document.getElementById("reset-button")

const selectPlayer1 = document.getElementById("player-1-select")
const selectPlayer2 = document.getElementById("player-2-select")

const COLOR_POINT = "#000000"
const COLOR_LINE = "#000000"
const COLOR_FRIEDNLY = "#00ff00"
const COLOR_OPPONENT = "#ff6666ff"
const COLOR_SELECTED = "#bb1be3ff"
const COLOR_INTERSECT = "#9c0000ff"

let pointSize = 10;
let selectPointSize = 15;
let lineWidth = 2;
let mouseMargin = 20;

let idCounter = 1;

let pointCount = pointSlider.value // Nomaina ar UI


const arena_x = 400
const arena_y = 400


const canvasW = canvas.width
const canvasH = canvas.height
const centerX = canvasW / 2
const centerY = canvasH / 2


let selectedShape = "circle" // shapeDropdown.value // Nomaina ar UI
let maximumDepth = serchDepthInput.value // Nomaina ar UI


let lines = [] // Līnijas, [sākuma punkts, beigu punkts, id], punkti doti pēc indeksa
let filledPoints = [] // masīvs, satur visus punktus un viņu id, pēc id nosaka vai pašreizējā spēlētāja vai nē 
let drawPoints = [] // masīvs, satur visus punktus un viņu pozīcijas
let highlightedPoint = undefined
let fromDrawPoint = undefined
let mousePos = { x: 0, y: 0 }


let currentPlayer = 0
let playerCount = 2
let players = ["human", "human"]
let playerScore = []
let playerLines = []


class GameNode {
    constructor(score, gamestate, move, childrenC) {
        this.startingScore = score
        this.score = score
        this.bestMove = undefined
        this.gamestate = gamestate
        this.parent = 0 // parent
        this.children = new Array(childrenC)
        this.move = move
    }

    setParent(parent) {
        this.parent = parent
    }

    setBestScore(score, move) {
        this.score = score
        this.bestMove = move
    }

    getBestChild() {
        return this.children[this.bestMove]
    }

}


document.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect()
    mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    let minX = mouseMargin * 2
    let minY = mouseMargin * 2
    let selPoint = undefined
    for (let i = 0; i < drawPoints.length; i++) {
        const el = drawPoints[i]
        let pX = mousePos.x - el[0]
        let pY = mousePos.y - el[1]
        if (Math.hypot(pX ** 2 + pY ** 2) < Math.hypot(minX ** 2, minY ** 2) && i != fromDrawPoint) {//filledPoints[i] == 0 && i != fromDrawPoint){
            let invalidLines = 0
            for (let j = 0; j < lines.length; j++) {
                if (
                    fromDrawPoint == lines[j][0] && i == lines[j][1] ||
                    fromDrawPoint == lines[j][1] && i == lines[j][0]
                ) {
                    invalidLines++
                    break
                }
            }
            if (invalidLines == 0) {
                selPoint = i
                minX = pX
                minY = pY
            }
        }
    }
    highlightedPoint = selPoint

})
document.addEventListener("mousedown", (e) => {
    fromDrawPoint = highlightedPoint
    highlightedPoint = undefined
})
document.addEventListener("mouseup", (e) => {
    if (fromDrawPoint != highlightedPoint && fromDrawPoint != undefined && highlightedPoint != undefined) {
        makeAMove(fromDrawPoint, highlightedPoint)
    }
    fromDrawPoint = undefined
    highlightedPoint = undefined
})

let graph = {}





// shapeDropdown.addEventListener("input", (e) => {
//     selectedShape = e.target.value
//     console.log(selectedShape)
//     // initGame()
// })
pointSlider.addEventListener("input", (e) => {
    pointCount = Number(e.target.value)
    console.log(pointCount)
    // initGame()
})
serchDepthInput.addEventListener("input", (e) => {
    maximumDepth = e.target.value
    // initGame()
})

selectPlayer1.addEventListener("input", (e) => {
    players[0] = e.target.value
    // initGame()
})
selectPlayer2.addEventListener("input", (e) => {
    players[1] = e.target.value
    // initGame()
})


resetButton.addEventListener("click", (e) => {
    initGame()
})

function line2id(line) {
    return line[2]
}

function updScore() {
    let msg = "Spēlētāju punkti: \n"
    for (let i = 0; i < playerCount; i++) {
        msg += `${i + 1}. ${players[i]}: ${playerScore[i]}\n`

    }
    uiPlayerPoints.textContent = msg
    uiCurrentPlayer.textContent = `${currentPlayer + 1}. ${players[currentPlayer]}`
}

function getDepthSize(depth) {
    const P = Math.floor(pointCount * (pointCount - 1) / 2)
    let sum = 1
    for (let i = 0; i < depth; i++) {
        sum *= (P - i)
    }
    return sum
}

function updIntersectCount(count) {
    uiIntersectPreview.textContent = count > 0 ? "Jā" : "Nē"
}

function addFunctionalLine(from, to) {
    playerLines[currentPlayer].add(idCounter)
    lines.push([from, to, idCounter])
    filledPoints[from] = idCounter
    filledPoints[to] = idCounter
    idCounter++
}

function point2id(start, end) {
    if (start > end) {
        [start, end] = [end, start]
    }
    return (start * (2 * pointCount - start - 1)) / 2 + (end - start - 1)
}


function id2point(bitmask) {

    let id = bitmask.toString(2).length - 1
    // TODO
    for (let i = 0; i < pointCount; i++) {
        for (let j = i + 1; j < pointCount; j++) {
            if (id == point2id(i, j)) return [i, j]
        }

    }

    throw new Error("Invalid move")
}


function getGamestate() {
    let state = 0n
    lines.forEach(line => {
        state |= (1n << BigInt(point2id(line[0], line[1])))
    })
    console.log("Found gamestate: ", state.toString(2).padStart(pointCount * (pointCount - 1) / 2, '0'))
    return state
}
function buildColMask(total_lines, pow2) {
    const collisionTable = new Array(total_lines).fill(0n);
    for (let s1 = 0; s1 < pointCount; s1++) {
        for (let e1 = s1 + 1; e1 < pointCount; e1++) {
            const l1 = point2id(s1, e1)
            for (let s2 = 0; s2 < pointCount; s2++) {
                for (let e2 = s2 + 1; e2 < pointCount; e2++) {
                    if (s1 === s2 || s1 === e2 || e1 === s2 || e1 === e2) continue
                    const l2 = point2id(s2, e2)

                    const collision = isInside(s2, s1, e1) ^ isInside(e2, s1, e1)
                    if (collision) {
                        collisionTable[l1] |= pow2[l2]
                        collisionTable[l2] |= pow2[l1]
                    }
                }
            }
        }
    }
    return collisionTable
}

function buildPowTable(total_lines) {
    const pow2 = []
    for (let i = 0; i < total_lines; i++) {
        pow2[i] = 1n << BigInt(i)
    }
    return pow2
}

function calculateMiniMax(gamestate) {
    const total_lines = Math.floor((pointCount * (pointCount - 1)) / 2)
    const full_mask = (1n << BigInt(total_lines)) - 1n
    const pow2 = buildPowTable(total_lines)
    const collisionTable = buildColMask(total_lines, pow2)


    const childrenAtDepth = []
    let totalSize = 0
    for (let i = 0; i < maximumDepth; i++) {
        let size = getDepthSize(i + 1)
        childrenAtDepth.unshift(Math.floor(pointCount * (pointCount - 1) / 2) - i)
        totalSize += size
    }
    const memory = new Map()

    let total_calls = 0
    let total_colls = 0

    function minimax(mask, last_move_id, acc_score, depth, max_player) {
        total_calls++
        let cKey = `${mask}:${last_move_id}:${max_player}` // Slow, ielikt atpakal hash
        let best_score = max_player ? -Infinity : Infinity
        let best_move = 0

        const memCheck = memory.get(cKey)
        if (memCheck) {
            total_colls++
            return memCheck
        }

        let collision_score = ((collisionTable[last_move_id] & mask) !== 0n) ? -1*(depth+1) : 0

        const nMask = mask | pow2[last_move_id]
        if (depth === 0 || nMask === full_mask) {
            const gameNode = new GameNode(acc_score + collision_score, mask, last_move_id, 0)
            return gameNode
        }


        let empty = (~nMask) & full_mask
        let move = 0
        let selfNode = new GameNode(acc_score, mask, last_move_id, childrenAtDepth[depth])
        while (empty) {
            if (empty & 1n) {
                const gameNode = minimax(nMask, move, acc_score + collision_score, depth - 1, !max_player)
                selfNode.children[move] = gameNode
                if (max_player) {
                    if (gameNode.score > best_score) {
                        best_score = gameNode.score
                        best_move = move
                    }
                }
                else {
                    if (gameNode.score < best_score) {
                        best_score = gameNode.score
                        best_move = move
                    }
                }
            }
            empty >>= 1n
            move++
        }
        selfNode.setBestScore(best_score, best_move)
        memory.set(cKey, selfNode)
        return selfNode
    }

    function minimax_calc(mask) {
        total_calls++
        let empty = (~mask) & full_mask
        const nMask = mask

        let best_score = -Infinity
        let best_move = -1

        let move = 0
        let selfNode = new GameNode(0, 0, -1, childrenAtDepth[maximumDepth])
        while (empty) {
            if (empty & 1n) {
                // Ielikt webworkera, lai viss ui nehango? (+uz vairakiem coriem, lai ir atraks)
                const gameNode = minimax(nMask, move, 0, maximumDepth - 1, false)
                selfNode.children[move] = gameNode
                if (gameNode.score > best_score) {
                    best_score = gameNode.score
                    best_move = move
                }
            }
            empty >>= 1n
            move++
        }
        selfNode.setBestScore(best_score, best_move)
        return selfNode
    }
    console.log(`Starting minimax with depth: ${maximumDepth}`)
    let result = minimax_calc(gamestate)
    console.log(total_calls, total_colls)
    console.log(result)
    // console.log(gameTree)
    console.log(`Move found: ${result.bestMove}`)
    return pow2[result.bestMove]
}

function calculateAlphaBeta(gamestate) {
    const total_lines = Math.floor((pointCount * (pointCount - 1)) / 2)
    const full_mask = (1n << BigInt(total_lines)) - 1n
    const pow2 = buildPowTable(total_lines)
    const collisionTable = buildColMask(total_lines, pow2)


    const childrenAtDepth = []
    let totalSize = 0
    for (let i = 0; i < maximumDepth; i++) {
        let size = getDepthSize(i + 1)
        childrenAtDepth.unshift(Math.floor(pointCount * (pointCount - 1) / 2) - i)
        totalSize += size
    }
    const memory = new Map()

    let total_calls = 0
    let total_colls = 0

    function alphabeta(mask, last_move_id, acc_score, depth, a, b, max_player) {
        total_calls++
        let cKey = `${mask}:${last_move_id}:${acc_score}` // Slow, ielikt atpakal hash
        let best_score = max_player ? -Infinity : Infinity
        let best_move = 0

        const memCheck = memory.get(cKey)
        if (memCheck) {
            total_colls++
            return memCheck
        }

        let collision_score = ((collisionTable[last_move_id] & mask) !== 0n) ? -1*(depth+1) : 0

        const nMask = mask | pow2[last_move_id]
        if (depth === 0 || nMask === full_mask) {
            const gameNode = new GameNode(acc_score + collision_score, mask, last_move_id, 0)
            return gameNode
        }


        let empty = (~nMask) & full_mask
        let move = 0
        let selfNode = new GameNode(acc_score, mask, last_move_id, childrenAtDepth[depth])
        while (empty) {
            if (empty & 1n) {
                const gameNode = alphabeta(nMask, move, acc_score + collision_score, depth - 1, a, b, !max_player)
                selfNode.children[move] = gameNode
                if (max_player) {
                    if (gameNode.score > best_score) {
                        best_score = gameNode.score
                        best_move = move
                        a = gameNode.score
                        if (a >= b) break
                    }
                }
                else {
                    if (gameNode.score < best_score) {
                        best_score = gameNode.score
                        best_move = move
                        b = gameNode.score
                        if (a >= b) break
                    }
                }
            }

            empty >>= 1n
            move++
        }
        selfNode.setBestScore(best_score, best_move)
        if (!Number.isFinite(selfNode.score)) debugger
        memory.set(cKey, selfNode)
        return selfNode
    }

    function alphabeta_calc(mask) {
        total_calls++
        let empty = (~mask) & full_mask
        const nMask = mask

        let best_score = -Infinity
        let best_move = -1


        let a = -Infinity
        let b = +Infinity

        let move = 0
        let selfNode = new GameNode(0, 0, -1, childrenAtDepth[maximumDepth])
        while (empty) {
            if (empty & 1n) {
                // Ielikt webworkera, lai viss ui nehango? (+uz vairakiem coriem, lai ir atraks)
                const gameNode = alphabeta(nMask, move, 0, maximumDepth - 1, a, b, false)
                selfNode.children[move] = gameNode
                if (gameNode.score > best_score) {
                    best_score = gameNode.score
                    best_move = move
                    a = best_score

                }
            }
            empty >>= 1n
            move++
        }
        selfNode.setBestScore(best_score, best_move)
        return selfNode
    }
    console.log(`Starting minimax with depth: ${maximumDepth}`)
    let result = alphabeta_calc(gamestate)
    console.log(total_calls, total_colls)
    console.log(result)
    // console.log(gameTree)
    console.log(`Move found: ${result.bestMove}`)
    return pow2[result.bestMove]
}


function isInside(point, start, end) {
    if (start > end)
        return point > start || point < end
    else
        return point > start && point < end
}


function friendlyLine(id) {
    return playerLines[currentPlayer].has(id)
}

function calculateIntersections(from, to) {
    let intersections = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
            (from != line[0] && from != line[1] && to != line[0] && to != line[1]) && (
                (isInside(line[0], from, to) && !isInside(line[1], from, to)) ||
                (isInside(line[1], from, to) && !isInside(line[0], from, to)))
        ) {
            intersections.push(line)
        }
    }
    return intersections
}

function initGame() {
    lines = []
    filledPoints = []
    drawPoints = []
    fromDrawPoint = undefined
    highlightedPoint = undefined
    playerPoints = 0
    pcPoints = 0

    for (let i = 0; i < pointCount; i++) {
        filledPoints.push(0) // Todo
    }

    playerLines = []
    playerScore = []
    for (let i = 0; i < playerCount; i++) {
        playerLines.push(new Set())
        playerScore.push(0)
    }
    players[0] = selectPlayer1.value
    players[1] = selectPlayer2.value

    const arena_x_2 = arena_x / 2
    const arena_y_2 = arena_y / 2
    switch (selectedShape) {
        case "square":
            {
                let lSpace = 2 * (arena_x + arena_y) / pointCount
                for (let i = 0; i < pointCount; i++) {
                    offset = i * lSpace
                    if (offset < arena_x) {
                        drawPoints.push([centerX + offset - arena_x_2, centerY + arena_y_2])
                    }
                    else if (offset < arena_x + arena_y) {
                        offset = offset - arena_x
                        drawPoints.push([centerX + arena_x_2, centerY + arena_y_2 - offset])
                    }
                    else if (offset < 2 * arena_x + arena_y) {
                        offset = offset - arena_x - arena_y
                        drawPoints.push([centerX + arena_x_2 - offset, centerY + -arena_y_2])
                    }
                    else {
                        offset = offset - 2 * arena_x - arena_y
                        drawPoints.push([centerX - arena_x_2, centerY + offset - arena_y_2])
                    }
                }
            }
            break
        case "circle":
            {
                for (let i = 0; i < pointCount; i++) {
                    let deg = (i / pointCount) * Math.PI * 2
                    drawPoints.push([centerX + arena_x_2 * Math.cos(deg), centerY + arena_y_2 * Math.sin(deg)])
                }
            }
            break
        case "triangle":
            {
                let hypot = Math.sqrt((arena_x_2) ** 2 + arena_y ** 2)
                let lSpace = (arena_x + 2 * hypot) / pointCount
                let rat = arena_x_2 / arena_y
                for (let i = 0; i < pointCount; i++) {
                    offset = i * lSpace
                    if (offset < arena_x) {
                        drawPoints.push([centerX + offset - arena_x_2, centerY + arena_y_2])
                    }
                    else if (offset < arena_x + hypot) {
                        offset -= arena_x
                        let cY = offset / Math.sqrt(rat ** 2 + 1)
                        drawPoints.push([centerX + arena_x_2 - cY * rat, centerY + arena_y_2 - cY])
                    }
                    else {
                        offset -= arena_x + hypot
                        let cY = offset / Math.sqrt(rat ** 2 + 1)
                        drawPoints.push([centerX - cY * rat, centerY - arena_y_2 + cY])
                    }
                }
            }
            break
    }


    currentPlayer = -1
    onNextTurn()
}

function drawPoint(pos_x, pos_y, color) {
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.arc(pos_x, pos_y, pointSize, 0, 2 * Math.PI)
    ctx.fill()
}
function drawLine(fromX, fromY, toX, toY, col, dashed = []) {
    ctx.beginPath()
    ctx.strokeStyle = col
    ctx.lineWidth = lineWidth
    ctx.setLineDash(dashed)
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()
    ctx.setLineDash([])
}
function drawHighlight(x, y) {
    ctx.beginPath()
    ctx.strokeStyle = COLOR_SELECTED
    ctx.setLineDash([10, 10])
    ctx.lineWidth = lineWidth
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])
}
function drawFrom(x, y) {
    ctx.beginPath()
    ctx.strokeStyle = COLOR_FRIEDNLY
    ctx.lineWidth = lineWidth
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI)
    ctx.stroke()
}

function drawLoop() {
    ctx.clearRect(0, 0, canvasW, canvasH)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const from = drawPoints[line[0]]
        const to = drawPoints[line[1]]
        const drawCol = friendlyLine(line2id(line)) ? COLOR_FRIEDNLY : COLOR_OPPONENT
        drawLine(from[0], from[1], to[0], to[1], drawCol)
    }

    if (fromDrawPoint != undefined && highlightedPoint != undefined) {
        let point = drawPoints[fromDrawPoint]
        let hPoint = drawPoints[highlightedPoint]
        drawLine(point[0], point[1], hPoint[0], hPoint[1], COLOR_FRIEDNLY, [10, 10])
        const intersects = calculateIntersections(fromDrawPoint, highlightedPoint)
        for (let i = 0; i < intersects.length; i++) {
            const intersect = intersects[i];
            const i_f_p = drawPoints[intersect[0]]
            const i_t_p = drawPoints[intersect[1]]
            drawLine(i_f_p[0], i_f_p[1], i_t_p[0], i_t_p[1], COLOR_INTERSECT)
        }
        updIntersectCount(intersects.length)
    }
    else updIntersectCount(0)

    for (let i = 0; i < drawPoints.length; i++) {
        const coords = drawPoints[i];
        drawPoint(coords[0], coords[1], COLOR_POINT)
    }

    drawPoint(mousePos.x, mousePos.y, COLOR_SELECTED)


    if (fromDrawPoint != undefined) {
        let point = drawPoints[fromDrawPoint]
        drawFrom(point[0], point[1])
    }
    if (highlightedPoint != undefined) {
        let point = drawPoints[highlightedPoint]
        drawHighlight(point[0], point[1])
    }
    requestAnimationFrame(drawLoop)
}

function hasValidMoves() {
    let maxLineCount = pointCount * (pointCount - 1) / 2
    console.log("Has valid moves left: ", lines.length < maxLineCount)
    return lines.length < maxLineCount
}

function showResults() {
    if(playerScore[0] != playerScore[1]){

        let winnerIndex = playerScore[0] > playerScore[1] ? 0 : 1
        document.getElementById("winner-display").textContent = `Spēlētājs ${winnerIndex + 1} (${players[winnerIndex]}) Uzvar!`
    }
    else {
        document.getElementById("winner-display").textContent = `Neizšķirts!`
    }
    

    let scoresHTML = ''
    for (let i = 0; i < playerCount; i++) {
        const pType = players[i]
        scoresHTML += `
            <div class="score-entry">
                <span class="player-name">Spēlētājs ${i + 1} (${pType})</span>
                <span class="score-value">${playerScore[i]}</span>
            </div>
        `
    }

    document.getElementById("final-scores-container").innerHTML = scoresHTML
    document.getElementById("results-screen").classList.add("show")
}

function chooseNextTurn() {
    let move = undefined
    let selectedAlg = players[currentPlayer]
    switch (selectedAlg) {
        case "minmax":
            move = calculateMiniMax(getGamestate())
            break
        case "alpha-beta":
            move = calculateAlphaBeta(getGamestate())
    }
    let chosenPoints = id2point(move)
    console.log(`${selectedAlg}: Choosing ${chosenPoints[0]} ${chosenPoints[1]} move: ${move.toString(2).padStart(pointCount * (pointCount - 1) / 2, '0')}`)
    makeAMove(chosenPoints[0], chosenPoints[1])

}

function makeAMove(from, to) {
    for (i = 0; i < lines.length; i++) {
        if (
            from == lines[i][0] && to == lines[i][1] ||
            from == lines[i][1] && to == lines[i][0]
        ) {
            throw Error(`Move ${from} ${to} is not valid`)
        }
    }
    let intersects = calculateIntersections(from, to).length
    addFunctionalLine(from, to)
    playerScore[currentPlayer] += intersects ? 1 : 0
    onNextTurn()
}

function onNextTurn() {
    if (!hasValidMoves()) {
        updScore()
        showResults()
        return
    }
    currentPlayer++
    if (currentPlayer >= playerCount) currentPlayer = 0
    updScore()
    console.log(`Current player: ${currentPlayer + 1}`)
    if (players[currentPlayer] != "human") chooseNextTurn()
}

drawLoop()

// Harvija kods
const menuScreen = document.getElementById("menu-screen")
const gameScreen = document.getElementById("game-screen")
const resultsScreen = document.getElementById("results-screen")
const startButton = document.getElementById("start-button")
const playAgainButton = document.getElementById("play-again-button")
const menuButton = document.getElementById("menu-button")
const menuFromGameButton = document.getElementById("menu-from-game-button")
const pointsValueDisplay = document.getElementById("points-value")
const closeResultsButton = document.getElementById("close-results-button")

startButton.addEventListener("click", () => {
    menuScreen.classList.add("hidden")
    gameScreen.style.display = "block"
    initGame()
})

playAgainButton.addEventListener("click", () => {
    resultsScreen.classList.remove("show")
    initGame()
})

closeResultsButton.addEventListener("click", () => {
    resultsScreen.classList.remove("show")
})

menuButton.addEventListener("click", () => {
    menuScreen.classList.remove("hidden")
    gameScreen.style.display = "none"
    resultsScreen.classList.remove("show")
})

menuFromGameButton.addEventListener("click", () => {
    menuScreen.classList.remove("hidden")
    gameScreen.style.display = "none"
    resultsScreen.classList.remove("show")
})


pointSlider.addEventListener("input", (e) => {
    pointsValueDisplay.textContent = e.target.value
})


pointsValueDisplay.textContent = pointSlider.value