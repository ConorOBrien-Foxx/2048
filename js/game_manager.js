// TODO: new game not correctly displaying board size

function GameManager(size, InputManager, Actuator, StorageManager) {
    console.log("Starting");
    this.inputManager   = new InputManager;
    this.storageManager = new StorageManager;
    try {
        this.size           = this.storageManager.getGameState().size; // Size of the grid
    }
    catch {
        this.Size       = 4;
    }
    this.actuator       = new Actuator(this.size);

    this.startTiles     = 2;

    this.inputManager.on("move", this.move.bind(this));
    this.inputManager.on("restart", this.restart.bind(this));
    this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
    this.inputManager.on("click", this.handleClick.bind(this));

    this.setup();
}

const snap2 = (v) => {
    let va = Math.abs(v);
    return Math.max(1, Math.sign(v) * 2 ** Math.floor(Math.log2(va)));
};

// Restart the game
GameManager.prototype.restart = function () {
    this.storageManager.clearGameState();
    this.actuator.continueGame(); // Clear the game won/lost message
    this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
    this.keepPlaying = true;
    this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
    return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
    var previousState = this.storageManager.getGameState();

    // Reload the game from a previous game if present
    if (previousState) {
        this.grid        = new Grid(previousState.grid.size,
                            previousState.grid.cells); // Reload grid
        this.score       = previousState.score;
        this.over        = previousState.over;
        this.won         = previousState.won;
        this.keepPlaying = previousState.keepPlaying;
        this.bonusThreshold = previousState.bonusThreshold;
        this.tileQueue = previousState.tileQueue;
    } else {
        this.grid        = new Grid(this.size);
        this.score       = 0;
        this.over        = false;
        this.size        = 4;
        this.won         = false;
        this.keepPlaying = false;
        this.bonusThreshold = 20;
        this.tileQueue = [];
        this.updateLayout(this.size);

        // Add the initial tiles
        this.addStartTiles();
    }

    // Update the actuator
    this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
    for (var i = 0; i < this.startTiles; i++) {
        this.addRandomTile();
    }
};

// More complex random generator
GameManager.prototype.getNewTileValue = function () {
    let sign = Math.random() < 0.5 ? -1 : 1;
    let r = 1 / Math.random();
    let log = Math.floor(Math.log2(r) / 2 + 1);
    let p = 2 ** log;
    p = Math.min(p, 256);
    return p * sign;
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
    if (this.grid.cellsAvailable()) {
        var value, isBonus = false;
        if(this.tileQueue.length) {
            [value, isBonus] = this.tileQueue.shift();
        }
        else {
            value = this.getNewTileValue();
        }
        var tile = new Tile(this.grid.randomAvailableCell(), value, isBonus);

        this.grid.insertTile(tile);
    }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
    if (this.storageManager.getBestScore() < this.score) {
        this.storageManager.setBestScore(this.score);
    }

    // Clear the state when the game is over (game over only, not win)
    if (this.over) {
        this.storageManager.clearGameState();
    } else {
        this.storageManager.setGameState(this.serialize());
    }

    this.actuator.actuate(this.grid, {
        score:      this.score,
        bonus:      this.bonusThreshold - this.score,
        over:       this.over,
        won:        this.won,
        bestScore:  this.storageManager.getBestScore(),
        terminated: this.isGameTerminated()
    });

};

GameManager.prototype.setPositions = function () {
    this.grid.eachCell((x, y, tile) => {
        if(tile) {
            tile.savePosition();
        }
    });
};

GameManager.prototype.updateLayout = function (size = this.size) {
    this.actuator.updateLayout(size);
};

GameManager.prototype.handleClick = function (data) {
    let { x, y } = data;
    let bonusTile = this.grid.cells[x][y];
    this.grid.removeTile(bonusTile);
    let sign = Math.random() < 0.5 ? -1 : 1;
    console.log("Handling click!", bonusTile);
    this.setPositions();
    switch(bonusTile.value) {
        case 1: {
            // star: randomly make the entire board positive or negative
            this.grid.eachCell((x, y, tile) => {
                if(tile && !tile.isBonus) {
                    tile.value = Math.abs(tile.value) * sign;
                }
            });
            break;
        }
        case 2: {
            // radiate: set all other values in radius of 1 to -1
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    let pos = { x: x + dx, y: y + dy };
                    if(this.grid.withinBounds(pos)) {
                        let tile = new Tile(pos, -1);
                        this.grid.insertTile(tile);
                    }
                }
            }
            break;
        }
        case 3: {
            // peace: set all values in row/column to positive
            for(let d = 0; d < this.size; d++) {
                let tile = this.grid.cellContent({ x: d, y: y });
                if(tile && !tile.isBonus) {
                    tile.value = Math.abs(tile.value);
                }
                let tile2 = this.grid.cellContent({ x: x, y: d });
                if(tile2 && !tile2.isBonus) {
                    tile2.value = Math.abs(tile2.value);
                }
            }
            break;
        }
        case 4: {
            // balance: all tiles become the absolute logarithmic average;
            // signs are distributed randomly and as equally as possible
            let flattened = this.grid.cells
                .flat()
                .filter(e => e && e.value && !e.isBonus)
                .map(e => Math.log2(Math.abs(e.value)));
            let sum = flattened.reduce((p, c) => p + c, 0);
            let avg = Math.ceil(sum / flattened.length);
            avg = 2 ** avg;
            console.table({sum, avg});

            let negativeCount = 0;
            let positiveCount = 0;
            let half = flattened.length / 2;
            this.grid.eachCell((x, y, tile) => {
                if(tile && !tile.isBonus) {
                    let sign = Math.random() < 0.5 ? -1 : 1;
                    if(sign === -1 && negativeCount >= half) {
                        sign = 1;
                    }
                    else if(sign === 1 && positiveCount >= half) {
                        sign = -1;
                    }
                    if(sign ===  1) positiveCount++;
                    if(sign === -1) negativeCount++;
                    tile.value = avg * sign;
                }
            });
            break;
        }
        case 5: {
            // combine 2 tiles from anywhere on the board with the same value
            let coors = {};
            this.grid.eachCell((x, y, tile) => {
                if(!tile || tile.isBonus) return;
                let { value } = tile;
                coors[value] = coors[value] || [];
                coors[value].push(tile);
            });
            let hasDoubles = [];

            for(let [key, values] of Object.entries(coors)) {
                key = parseInt(key);
                if(values.length >= 2) {
                    hasDoubles.push(key);
                }
            }

            let combiningFactor = hasDoubles[Math.random() * hasDoubles.length | 0];

            let toInsert = bonusTile;
            if(combiningFactor !== null) {
                let candidates = coors[combiningFactor];
                let twoToMerge = [];
                while(twoToMerge.length < 2) {
                    let ri = Math.floor(Math.random() * candidates.length);
                    let val = candidates.splice(ri, 1);
                    twoToMerge.push(...val);
                }
                for(let toMerge of twoToMerge) {
                    // console.log(toMerge);
                    this.grid.removeTile(toMerge);
                }
                toInsert = new Tile({ x: x, y: y }, combiningFactor * 2);
            }
            this.grid.insertTile(toInsert);
            break;
        }
        case 6: {
            // re-roll: keeping sign, sets all values to a random from
            // 1 to the highest power on the board
            let absFlattened = this.grid.cells
                .flat()
                .filter(e => e && e.value && !e.isBonus)
                .map(e => Math.abs(e.value));
            let maxBase = Math.log2(Math.max(...absFlattened));
            this.grid.eachCell((x, y, tile) => {
                if(tile && !tile.isBonus) {
                    let sign = Math.sign(tile.value);
                    tile.value = 0
                    // best of 2 random rolls
                    for(let i = 0; i < 2; i++) {
                        let prospect = 2 ** Math.floor(Math.random() * maxBase);
                        if(prospect > tile.value) {
                            tile.value = prospect;
                        }
                    }
                    tile.value *= sign;
                }
            });
            break;
        }
        case 7: {
            // plus-minus: flips the sign of the entire board
            // and reflects the board.
            let toInsert = [];
            this.grid.eachCell((x, y, tile) => {
                if(tile) {
                    this.grid.removeTile(tile);
                    if(!tile.isBonus) {
                        tile.value *= -1;
                    }
                    tile.x = this.grid.size - x - 1;
                    tile.y = this.grid.size - y - 1;
                    toInsert.push(tile);
                }
            });
            for(let tile of toInsert) {
                this.grid.insertTile(tile);
            }
            break;
        }
        case 8: {
            // sun: destroys all bonus tiles on the board
            this.grid.eachCell((x, y, tile) => {
                if(tile && tile.isBonus) {
                    this.grid.removeTile(tile);
                }
            });
            break;
        }
        case 9:
        case 10: {
            // 9 = clockwise, 10 = counterclockwise
            // rotates the moore neighborhood around the tile
            let delta = bonusTile.value === 10 ? 1 : -1;

            const rotateTile = (tile, delta) => {
                let dx = tile.x - x;
                let dy = tile.y - y;

                if(dy === 1 && dx * delta >= 0) {
                    tile.x -= delta;
                }
                else if(dx === -1 && dy * delta >= 0) {
                    tile.y -= delta;
                }
                else if(dy === -1 && dx * delta <= 0) {
                    tile.x += delta;
                }
                else if(dx === 1 && dy * delta <= 0) {
                    tile.y += delta;
                }
            };

            let cells = [];
            for(let xi = -1; xi <= 1; xi++) {
                for(let yi = -1; yi <= 1; yi++) {
                    if(xi == 0 && yi == 0) continue;
                    let pos = { x: x + xi, y: y+ yi };
                    let tile = this.grid.cellContent(pos);
                    if(this.grid.withinBounds(pos)) {
                        cells.push({ tile: tile, dx: xi, dy: yi });
                        if(tile) {
                            this.grid.removeTile(tile);
                        }
                    }
                }
            }
            for(let info of cells) {
                let { dx, dy, tile } = info;
                if(!tile) continue;
                tile.savePosition();
                do {
                    rotateTile(tile, delta);
                }
                while(!this.grid.withinBounds(tile));
                this.grid.insertTile(tile);
            }
            break;
        }
        case 11: {
            // re-roll: shuffles the board
            let toInsert = [];
            this.grid.eachCell((x, y, tile) => {
                if(tile) {
                    this.grid.removeTile(tile);
                    toInsert.push(tile);
                }
            });
            for(let tile of toInsert) {
                tile.updatePosition(this.grid.randomAvailableCell());
                this.grid.insertTile(tile);
            }
            break;
        }
        case 12:
        case 13: {
            let prop = bonusTile.value === 12 ? 'x' : 'y';
            let upPos = { x: x, y: y };
            let downPos = { x: x, y: y };
            upPos[prop]++;
            downPos[prop]--;
            if(this.grid.withinBounds(upPos) && this.grid.withinBounds(downPos)) {
                let upTile = this.grid.cellContent(upPos);
                let downTile = this.grid.cellContent(downPos);
                if(upTile) this.grid.removeTile(upTile);
                if(downTile) this.grid.removeTile(downTile);
                if(upTile) upTile.updatePosition(downPos);
                if(downTile) downTile.updatePosition(upPos);
                if(upTile) this.grid.insertTile(upTile);
                if(downTile) this.grid.insertTile(downTile);
            }
            else {
                bonusTile.savePosition();
                this.grid.insertTile(bonusTile);
            }
            break;
        }
        case 14: {
            // grid size more!
            this.size++;
            let nextGrid = new Grid(this.size);
            for(let x = 0; x < this.grid.size; x++) {
                for(let y = 0; y < this.grid.size; y++) {
                    nextGrid.cells[x][y] = this.grid.cells[x][y];
                }
            }
            this.grid = nextGrid;
            this.updateLayout(this.size);
            break;
        }
        default:
            console.warn("Unrecognized tile value:", bonusTile.value);
            break;
    }
    bonusTile.isVolatile = true;
    this.actuate();
};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
    return {
        grid:        this.grid.serialize(),
        score:       this.score,
        over:        this.over,
        won:         this.won,
        keepPlaying: this.keepPlaying,
        tileQueue:   this.tileQueue,
        bonusThreshold: this.bonusThreshold,
        size:        this.size,
    };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
    this.grid.eachCell(function (x, y, tile) {
        if (tile) {
            tile.mergedFrom = null;
            tile.savePosition();
        }
    });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
    this.grid.cells[tile.x][tile.y] = null;
    this.grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
};

GameManager.prototype.addBonusTile = function (score) {
    let keys = Tile.BonusValues[Math.random() * Tile.BonusValues.length | 0];
    this.tileQueue.push([keys, true]);
}

GameManager.prototype.addScore = function (amount) {
    this.score += amount;
    // Add bonus tile if applicable
    if(this.bonusThreshold !== null && this.score >= this.bonusThreshold) {
        console.log("Bonus tile!");
        this.addBonusTile(this.score);
        while(this.bonusThreshold <= this.score) {
            this.bonusThreshold += 100 * Math.random() | 0;
        }
    }
}

GameManager.prototype.isVictory = function (value) {
    return Math.abs(value) == 2048;
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
    // 0: up, 1: right, 2: down, 3: left
    var self = this;

    if (this.isGameTerminated()) return; // Don't do anything if the game's over

    var cell, tile;

    var vector     = this.getVector(direction);
    var traversals = this.buildTraversals(vector);
    var moved      = false;

    // remove zeros
    self.grid.eachCell((x, y, cell) => {
        if(cell && !cell.isBonus && cell.value == 0) {
            self.grid.removeTile(cell);
        }
    });

    // Save the current tile positions and remove merger information
    this.prepareTiles();

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach((x) => {
        traversals.y.forEach((y) => {
            cell = { x: x, y: y };
            tile = self.grid.cellContent(cell);

            if (tile) {
                var positions = self.findFarthestPosition(cell, vector);
                var next      = self.grid.cellContent(positions.next);

                // Only one merger per row traversal?
                if (!tile.isBonus && next && !next.isBonus
                    && Math.abs(next.value) === Math.abs(tile.value) && !next.mergedFrom
                ) {
                    var val = tile.value + next.value;
                    var merged = new Tile(positions.next, tile.value + next.value);
                    merged.mergedFrom = [tile, next];

                    self.grid.insertTile(merged);
                    self.grid.removeTile(tile);

                    // Converge the two tiles' positions
                    tile.updatePosition(positions.next);

                    // Update the score
                    self.addScore(Math.abs(merged.value));

                    // The mighty 2048 tile
                    if (this.isVictory(merged.value)) self.won = true;
                } else {
                    self.moveTile(tile, positions.farthest);
                }

                if (!self.positionsEqual(cell, tile)) {
                    moved = true; // The tile moved from its original cell!
                }
            }
        });
    });

    if (moved) {
        this.addRandomTile();

        if (!this.movesAvailable()) {
            this.over = true; // Game over!
        }

        this.actuate();
    }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
    // Vectors representing tile movement
    var map = {
        0: { x: 0,  y: -1 }, // Up
        1: { x: 1,  y: 0 },  // Right
        2: { x: 0,  y: 1 },  // Down
        3: { x: -1, y: 0 }   // Left
    };

    return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
    var traversals = { x: [], y: [] };

    for (var pos = 0; pos < this.size; pos++) {
        traversals.x.push(pos);
        traversals.y.push(pos);
    }

    // Always traverse from the farthest cell in the chosen direction
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();

    return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
    var previous;

    // Progress towards the vector direction until an obstacle is found
    do {
        previous = cell;
        cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (this.grid.withinBounds(cell) &&
    this.grid.cellAvailable(cell));

    return {
        farthest: previous,
        next: cell // Used to check if a merge is required
    };
};

GameManager.prototype.movesAvailable = function () {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable() || this.hasBonus();
};

GameManager.prototype.hasBonus = function () {
    for (var x = 0; x < this.size; x++) {
        for (var y = 0; y < this.size; y++) {
            if(this.grid.cellContent({ x: x, y: y }).isBonus) {
                return true;
            }
        }
    }
    return false;
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
    var self = this;

    var tile;

    for (var x = 0; x < this.size; x++) {
        for (var y = 0; y < this.size; y++) {
            tile = this.grid.cellContent({ x: x, y: y });

            if (tile) {
                for (var direction = 0; direction < this.size; direction++) {
                    var vector = self.getVector(direction);
                    var cell   = { x: x + vector.x, y: y + vector.y };

                    var other  = self.grid.cellContent(cell);

                    if (other && other.value === tile.value) {
                        return true; // These two tiles can be merged
                    }
                }
            }
        }
    }

    return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
    return first.x === second.x && first.y === second.y;
};
