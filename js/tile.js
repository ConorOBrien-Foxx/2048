function Tile(position, value = 2, isBonus = false, isVolatile = false) {
    this.x                = position.x;
    this.y                = position.y;
    this.value            = value;
    this.isBonus          = isBonus;

    this.isVolatile       = false;
    this.previousPosition = null;
    this.mergedFrom       = null; // Tracks tiles that merged together
}

Tile.prototype.savePosition = function () {
    this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
    this.x = position.x;
    this.y = position.y;
};

Tile.BonusValueDictionary = {
    1: "☆",
    2: "☢",
    3: "☮",
    4: "☯",
    5: "⛓",
    6: "⚅",
    7: "±",
    8: "☀",
    9: "⭯",
    10: "⭮",
    11: "⚀",
    12: "⮂",
    13: "⮁",
    // 14: "⊕",
}
Tile.BonusValues = Object.keys(Tile.BonusValueDictionary).map(e => parseInt(e));
Tile.prototype.getBonusValue = function () {
    return Tile.BonusValueDictionary[this.value];
};

Tile.prototype.serialize = function () {
    return {
        position: {
            x: this.x,
            y: this.y
        },
        value: this.value,
        isBonus: this.isBonus,
    };
};

Tile.prototype.displayString = function () {
    return this.isBonus ? this.getBonusValue() : this.value.toString();
};
