function HTMLActuator(size) {
    this.tileContainer    = document.querySelector(".tile-container");
    this.scoreContainer   = document.querySelector(".score-container");
    this.bestContainer    = document.querySelector(".best-container");
    this.bonusContainer   = document.querySelector(".bonus-container");
    this.gridContainer    = document.querySelector(".grid-container");
    this.messageContainer = document.querySelector(".game-message");
    this.cssContainer     = document.querySelector(".css-container");

    this.score = 0;
    this.updateLayout(size);
}

HTMLActuator.prototype.updateLayout = function (size) {
    while(this.gridContainer.children.length < size) {
        let row = document.createElement("div");
        row.className = "grid-row";
        this.gridContainer.appendChild(row);
    }
    while(this.gridContainer.children.length > size) {
        this.gridContainer.lastElementChild.remove();
    }
    for(let row of this.gridContainer.children) {
        while(row.children.length < size) {
            let cell = document.createElement("div");
            cell.className = "grid-cell";
            row.appendChild(cell);
        }
        while(row.children.length > size) {
            row.lastElementChild.remove();
        }
    }
    // TODO: decrease size
    this.clearContainer(this.cssContainer);
    let cssString = "";
    let increment = 121;
    for(let x = 0; x < size; x++) {
        for(let y = 0; y < size; y++) {
            let xpx = x * increment;
            let ypx = y * increment;
            let cellCSS = `.tile.tile-position-${x + 1}-${y + 1} {
                -webkit-transform: translate(${xpx}px, ${ypx}px);
                -moz-transform: translate(${xpx}px, ${ypx}px);
                -ms-transform: translate(${xpx}px, ${ypx}px);
                transform: translate(${xpx}px, ${ypx}px);
            }\n`;
            cssString += cellCSS;
        }
    }
    let cellWidth = 107;
    let cellInner = cellWidth - 0.75;
    let width = cellWidth * size + 15 * (size + 1);
    cssString += `
    .grid-cell {
        width: ${cellInner}px;
        height: ${cellInner}px;
    }
    .tile, .tile .tile-inner {
        width: ${cellWidth}px;
        height: ${cellWidth}px;
        line-height: ${cellWidth}px;
    }
    .game-container {
        width: ${width}px;
        height: ${width}px;
    }
    .container {
        width: ${width}px;
    }
    `;
    this.cssContainer.textContent = cssString;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
    var self = this;

    window.requestAnimationFrame(function () {
        self.clearContainer(self.tileContainer);

        grid.cells.forEach(function (column) {
            column.forEach(function (cell) {
                if (cell) {
                    self.addTile(grid, cell);
                }
            });
        });

        self.updateBonus(metadata.bonus);
        self.updateScore(metadata.score);
        self.updateBestScore(metadata.bestScore);

        if (metadata.terminated) {
            if (metadata.over) {
                self.message(false); // You lose
            } else if (metadata.won) {
                self.message(true); // You win!
            }
        }

    });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
    this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
};

HTMLActuator.prototype.addTile = function (grid, tile) {
    var self = this;

    var wrapper   = document.createElement("div");
    var inner     = document.createElement("div");
    var position  = tile.previousPosition || { x: tile.x, y: tile.y };
    var positionClass = this.positionClass(position);

    // We can't use classlist because it somehow glitches when replacing classes
    var classes = [
        "tile",
        tile.isBonus ? "tile-bonus" : "tile-" + tile.value,
        positionClass
    ];

    if (tile.value < 0) classes.push("tile-negative");
    if (tile.isBonus) {
        classes.push("tile-clickable");
    }
    if (tile.value > 2048) classes.push("tile-super");
    if (tile.value < -2048) classes.push("tile-negative-super");
    if (tile.isVolatile) classes.push("tile-volatile");

    this.applyClasses(wrapper, classes);

    inner.classList.add("tile-inner");
    inner.textContent = tile.displayString();

    if (tile.previousPosition) {
        // Make sure that the tile gets rendered in the previous position first
        window.requestAnimationFrame(function () {
          classes[2] = self.positionClass({ x: tile.x, y: tile.y });
          self.applyClasses(wrapper, classes); // Update the position
        });
    } else if (tile.mergedFrom) {
        classes.push("tile-merged");
        this.applyClasses(wrapper, classes);

        // Render the tiles that merged
        tile.mergedFrom.forEach(function (merged) {
            self.addTile(grid, merged);
        });
    } else {
        classes.push("tile-new");
        this.applyClasses(wrapper, classes);
    }

    // Add the inner part of the tile to the wrapper
    wrapper.appendChild(inner);

    // Put the tile on the board
    this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
    element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
    return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
    position = this.normalizePosition(position);
    return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
    this.clearContainer(this.scoreContainer);

    var difference = score - this.score;
    this.score = score;

    this.scoreContainer.textContent = this.score;

    if (difference > 0) {
        var addition = document.createElement("div");
        addition.classList.add("score-addition");
        addition.textContent = "+" + difference;

        this.scoreContainer.appendChild(addition);
    }
};

HTMLActuator.prototype.updateBonus = function (bonus) {
    this.clearContainer(this.bonusContainer);
    this.bonusContainer.textContent = bonus;
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
    this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.message = function (won) {
    var type    = won ? "game-won" : "game-over";
    var message = won ? "You win!" : "Game over!";

    this.messageContainer.classList.add(type);
    this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
    // IE only takes one value to remove at a time.
    this.messageContainer.classList.remove("game-won");
    this.messageContainer.classList.remove("game-over");
};
