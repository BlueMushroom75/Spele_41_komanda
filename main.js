const canvas = document.getElementById("drawBoard");
const ctx = canvas.getContext("2d");

const playersSelect = document.getElementById("select-players");
const shapeDropdown = document.getElementById("select-contour");
const pointSlider = document.getElementById("select-points");
const algorithmDropdown = document.getElementById("select-algorithm");
const algorithm2Dropdown = document.getElementById("select-algorithm2");
const startPlayerDropdown = document.getElementById("select-startingPlayer");

const uiPlayerPoints = document.getElementById("player_points");
const uiPcPoints = document.getElementById("pc_points");
const uiIntersectPreview = document.getElementById("about_to_intersect");

const startButton = document.getElementById("start-button");
const serchDepthInput = document.getElementById("maxDepthInput")
const resetButton = document.getElementById("reset-button");

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

let pointCount = pointSlider.value; // Nomaina ar UI


const arena_x = 400;
const arena_y = 400;


const canvasW = canvas.width
const canvasH = canvas.height
const centerX = canvasW / 2
const centerY = canvasH / 2

let selectedPlayers = playersSelect.value // Nomaina ar UI
let selectedShape = shapeDropdown.value // Nomaina ar UI
let selectedAlg = algorithmDropdown.value // Nomaina ar UI
let selectedAlg2 = algorithm2Dropdown.value // Nomaina ar UI
let selectedStartPlayer = startPlayerDropdown.value // Nomaina ar UI
let maximumDepth = serchDepthInput.value // Nomaina ar UI


let isPlayerTurn = false;
let playerPoints = 0;
let pcPoints = 0;

let lines = [] // Līnijas, [sākuma punkts, beigu punkts, id], punkti doti pēc indeksa
let filledPoints = [] // masīvs, satur visus punktus un viņu id, pēc id nosaka vai pašreizējā spēlētāja vai nē 
let drawPoints = [] // masīvs, satur visus punktus un viņu pozīcijas
let highlightedPoint = undefined
let fromDrawPoint = undefined
let mousePos = { x: 0, y: 0 }

class Node {
    constructor(playerPoints, pcPoints, usedLines, newLine, isPcTurn) {
        this.playerPoints = playerPoints;
        this.pcPoints = pcPoints;
        this.usedLines = usedLines;
        this.newLine = newLine;
        this.isPcTurn = isPcTurn;
        this.children = [];
    }
    setPlayerPoints(newPoints) {
        this.playerPoints = newPoints;
    }
    setPcPoints(newPoints) {
        this.pcPoints = newPoints;
    }
    setUsedLines(newLines) {
        this.usedLines = newLines;
    }
    addLine(newLine) {
        this.usedLines.push(newLine);
    }
    setIsPcTurn(isPcTurn) {
        this.isPcTurn = isPcTurn;
    }
    replaceNode(newNode) {
        this.playerPoints = newNode.playerPoints;
        this.pcPoints = newNode.pcPoints;
        this.usedLines = newNode.usedLines;
        this.newLine = newNode.newLine;
        this.isPcTurn = newNode.isPcTurn;
        this.children = newNode.children;
    }
    clear() {
        this.playerPoints = null;
        this.pcPoints = null;
        this.usedLines = null;
        this.newLine = null;
        this.isPcTurn = null;
        this.children = null;
    }
}
let rootNode = new Node(playerPoints, pcPoints, lines, [], true)

document.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    let minX = mouseMargin * 2
    let minY = mouseMargin * 2
    let selPoint = undefined
    for (let i = 0; i < drawPoints.length; i++) {
        const el = drawPoints[i];
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
    if (selectedPlayers != "pcvpc") { // bloķēt peles klikšķi, ja spēlē dators pret datoru
        fromDrawPoint = highlightedPoint
        highlightedPoint = undefined
    }
})
document.addEventListener("mouseup", (e) => {
    if (selectedPlayers != "pcvpc") { // bloķēt peles klikšķi, ja spēlē dators pret datoru
        if (fromDrawPoint != highlightedPoint && fromDrawPoint != undefined && highlightedPoint != undefined) {
            makeAMove(fromDrawPoint, highlightedPoint)
        }
    }
    fromDrawPoint = undefined
    highlightedPoint = undefined
})

let graph = {}


playersSelect.addEventListener("input", (e) => {
    selectedPlayers = e.target.value
    console.log(selectedPlayers)
    if (selectedPlayers == "humanvpc") {
        document.getElementById("startingPlayerContainer").style.display = "block"
        document.getElementById("algorithm2Container").style.display = "none"
    }
    else if (selectedPlayers == "pcvpc") {
        document.getElementById("startingPlayerContainer").style.display = "none"
        document.getElementById("algorithm2Container").style.display = "block"
    }
    else {
        document.getElementById("startingPlayerContainer").style.display = "none"
        document.getElementById("algorithm2Container").style.display = "none"
    }
})
shapeDropdown.addEventListener("input", (e) => {
    selectedShape = e.target.value
    console.log(selectedShape)
})
pointSlider.addEventListener("input", (e) => {
    pointCount = Number(e.target.value)
    console.log(pointCount)
})
algorithmDropdown.addEventListener("input", (e) => {
    selectedAlg = e.target.value
    console.log(selectedAlg)
})
algorithm2Dropdown.addEventListener("input", (e) => {
    selectedAlg2 = e.target.value
    console.log(selectedAlg2)
})
startPlayerDropdown.addEventListener("input", (e) => {
    selectedStartPlayer = e.target.value
    console.log(selectedStartPlayer)
})
serchDepthInput.addEventListener("input", (e) => {
    maximumDepth = e.target.value
    console.log(maximumDepth)
})
startButton.addEventListener("click", (e) => {
    initGame()
    document.getElementById("menu-container").style.display = "none"
})

resetButton.addEventListener("click", (e) => {
    initGame()
    document.getElementById("menu-container").style.display = "block"
})

function line2id(line) {
    return line[2]
}

function updScore() {
    uiPlayerPoints.textContent = playerPoints
    uiPcPoints.textContent = pcPoints
}

function updIntersectCount(count) {
    uiIntersectPreview.textContent = count
}

function addFunctionalLine(from, to) {
    if (isPlayerTurn) p1Lines.add(idCounter)
    else p2Lines.add(idCounter)
    lines.push([from, to, idCounter])
    filledPoints[from] = idCounter
    filledPoints[to] = idCounter
    idCounter++
}

function createGameTree(node, curDepth) {
    if (curDepth == maximumDepth) return

    if (node.children.length == 0) {
        for (let i = 0; i < pointCount; i++) {
            for (let j = i + 1; j < pointCount; j++) {
                let validLine = true
                for (k = 0; k < node.usedLines.length; k++) {
                    if (
                        i == node.usedLines[k][0] && j == node.usedLines[k][1] ||
                        i == node.usedLines[k][1] && j == node.usedLines[k][0]
                    ) {
                        validLine = false
                        break
                    }
                }
                if (validLine) {
                    let newNode = new Node(0, 0, [], [i, j], !node.isPcTurn)
                    newNode.setUsedLines(node.usedLines.slice())
                    newNode.addLine([i, j, 0])
                    if (node.isPcTurn) {
                        newNode.setPcPoints(node.pcPoints + countIntersections(i, j, newNode.usedLines))
                        newNode.setPlayerPoints(node.playerPoints)
                    } else {
                        newNode.setPlayerPoints(node.playerPoints + countIntersections(i, j, newNode.usedLines))
                        newNode.setPcPoints(node.pcPoints)
                    }
                    //console.log(newNode)
                    node.children.push(newNode)
                    //console.log(node.children)
                    createGameTree(newNode, curDepth + 1)
                }
            }
        }
    } else {
        for (let child of node.children) {
            createGameTree(child, curDepth + 1)
        }
    }

}

function calculateGameTree() {
    if (selectedPlayers == "pcvpc") {
        if (!isPlayerTurn) {
            switch (selectedAlg2) {
                case "minmax":
                    createGameTree(rootNode, 0)
                    // console.log(rootNode)
                    return minmax(rootNode, 0)[0]

                case "alpha-beta":
                    createGameTree(rootNode, 0)
                    return alphabeta() // TODO
            }
        }
    }
    switch (selectedAlg) {
        case "minmax":
            createGameTree(rootNode, 0)
            // console.log(rootNode)
            return minmax(rootNode, 0)[0]

        case "alpha-beta":
            createGameTree(rootNode, 0)
            return alphabeta() // TODO
    }
}

function minmax(node, curDepth) {
    if (curDepth == maximumDepth) return [node.newLine, node.playerPoints, node.pcPoints]

    let bestPointDiff = -10000
    let bestPoints = []
    let bestLine = []
    for (let child of node.children) {
        let [l, PP, PCP] = minmax(child, curDepth + 1)
        if (node.isPcTurn && PP - PCP > bestPointDiff) {
            bestPointDiff = PP - PCP
            bestPoints = [PP, PCP]
            bestLine = [child.newLine[0], child.newLine[1]]
        } else if (!node.isPcTurn && PCP - PP > bestPointDiff) {
            bestPointDiff = PCP - PP
            bestPoints = [PP, PCP]
            bestLine = [child.newLine[0], child.newLine[1]]
        }

    }
    if (node.isPcTurn) {
        console.log(`PC: ${bestPointDiff}`)
    } else {
        console.log(`Player: ${bestPointDiff}`)
    }

    return [bestLine, bestPoints[0], bestPoints[1]]
}

function alphabeta() {
    //TODO
}


function countIntersections(from, to, usedLines) {
    let intersections = 0
    function isInside(point, start, end) {
        if (start > end)
            return point > start || point < end
        else
            return point > start && point < end
    }
    for (let i = 0; i < usedLines.length; i++) {
        const line = usedLines[i];
        if (
            (from != line[0] && from != line[1] && to != line[0] && to != line[1]) && (
                (isInside(line[0], from, to) && !isInside(line[1], from, to)) ||
                (isInside(line[1], from, to) && !isInside(line[0], from, to)))
        ) {
            intersections++
        }
    }
    return intersections
}


let p1Lines = new Set([0])
let p2Lines = new Set([0])
function friendlyLine(id) {
    if (isPlayerTurn) return p1Lines.has(id)
    else return p2Lines.has(id)
}

function calculateIntersections(from, to) {
    let intersections = []
    function isInside(point, start, end) {
        if (start > end)
            return point > start || point < end
        else
            return point > start && point < end
    }
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
    p1Lines = new Set([0])
    p2Lines = new Set([0])
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

    updScore()
    let newNode = new Node(playerPoints, pcPoints, lines, [], false)
    if (selectedPlayers === "pcvpc") {
        isPlayerTurn = false
        rootNode.clear()
        newNode.setIsPcTurn(true)
        rootNode.replaceNode(newNode)
        chooseNextTurn()
    } else {
        switch (selectedStartPlayer) {
            case "human":
                isPlayerTurn = true
                rootNode.clear()
                rootNode.replaceNode(newNode)
                break

            case "pc":
                isPlayerTurn = false
                rootNode.clear()
                newNode.setIsPcTurn(true)
                rootNode.replaceNode(newNode)
                chooseNextTurn()
                break
        }
    }
    createGameTree(rootNode, 0)
}

function drawPoint(pos_x, pos_y, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(pos_x, pos_y, pointSize, 0, 2 * Math.PI);
    ctx.fill();
}
function drawLine(fromX, fromY, toX, toY, col, dashed = []) {
    ctx.beginPath();
    ctx.strokeStyle = col;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashed);
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.setLineDash([]);
}
function drawHighlight(x, y) {
    ctx.beginPath();
    ctx.strokeStyle = COLOR_SELECTED;
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = lineWidth;
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
}
function drawFrom(x, y) {
    ctx.beginPath();
    ctx.strokeStyle = COLOR_FRIEDNLY;
    ctx.lineWidth = lineWidth;
    ctx.arc(x, y, selectPointSize, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawLoop() {
    ctx.clearRect(0, 0, canvasW, canvasH);
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
    // let empty = 0
    // for (let i = 0; i < filledPoints.length; i++) {
    //     if(!filledPoints[i]) empty++
    // }
    // return empty >= 2
    let maxLineCount = pointCount * (pointCount - 1) / 2
    console.log(lines.length < maxLineCount)
    return lines.length < maxLineCount
}

function showResults() {
    console.log(`P1 points: ${playerPoints}; P2 points: ${pcPoints}`)
    // TODO
    //initGame()
}

function chooseNextTurn() {
    rootNode.setUsedLines(lines)
    let chosenPoints = calculateGameTree()
    console.log(`Choosing ${chosenPoints[0]} ${chosenPoints[1]}`)
    makeAMove(chosenPoints[0], chosenPoints[1])

}

function makeAMove(from, to) {
    for (i = 0; i < lines.length; i++) {
        if (
            from == lines[i][0] && to == lines[i][1] ||
            from == lines[i][1] && to == lines[i][0]
        ) {
            return
        }
    }
    let intersects = calculateIntersections(from, to).length
    addFunctionalLine(from, to)
    for (let child of rootNode.children) {
        if (
            (child.newLine[0] == from && child.newLine[1] == to) ||
            (child.newLine[1] == from && child.newLine[0] == to)
        ) {
            console.log(`root replaced`)
            // let oldRoot = rootNode
            rootNode.replaceNode(child)
            rootNode.setUsedLines(lines)
            // oldRoot.clear()
            // oldRoot = null
            //console.log(rootNode)
        }
    }
    //console.log(rootNode.usedLines)
    if (isPlayerTurn) playerPoints += intersects
    else pcPoints += intersects

    onNextTurn()
}

function onNextTurn() {
    updScore()
    if (!hasValidMoves()) {
        showResults()
        return
    }

    isPlayerTurn = !isPlayerTurn
    if (selectedPlayers == "humanvhuman") { // return lai neļautu botam darboties ja cilvēks pret cilvēku
        return
    }
    if (!isPlayerTurn || selectedPlayers == "pcvpc") {
        chooseNextTurn()
    }
    // TODO main user loop
}

// Karoce!!!!!!!!!!!!!!!
// Good luck, have fun
// Kurs grib taisit UI, kurs algoritmus? (+ kurs JS loopu prieks liniju vilksanas + whatever)




drawLoop() // Init draw
initGame() // TODO: sakuma izveles ekrans