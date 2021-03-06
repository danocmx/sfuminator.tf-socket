// Sfuminator.tf | Price Class

module.exports = Price;

var TF2Currency = require("./tf2/tf2Currency.js");

/**
 * General purpose Item Price class
 * @param {float} price
 * By default: USD item price, other type if initCurrency is specified
 * @param {String} [initCurrency]
 * Defines currency of the given price, can be: scrap, metal, usd, keys, earbuds (obsolete)
 * @returns {Price}
 * @construct
 */
function Price(price, initCurrency) {
    this.absolute_price = price;
    this.currency = TF2Currency;

    if (initCurrency) {
        if (initCurrency === "keys") {
            price = price * new Price(this.currency.keys.metal, "metal").toScrap();
            initCurrency = "scrap";
        }
        if (initCurrency === "scrap") {
            initCurrency = "metal";
            price = price / 9;
        }
        this.absolute_price = price * this.currency[initCurrency].usd;
    }
}

Price.SCRAP_METAL = "scrap";
Price.REFINED_METAL = "metal";
Price.KEYS = "keys";
Price.USD = "usd";

/**
 * Get price converted in USD
 * @returns {float}
 */
Price.prototype.toUSD = function () {
    return this.absolute_price;
};

/**
 * Get price converted in Metal
 * @returns {float}
 */
Price.prototype.toMetal = function () {
    if (!this._metalPrice) {
        this._metalPrice = parseInt(this.absolute_price * this.currency.usd.metal * 100 + (0.1 * this.getPriceSign())) / 100;
    }
    return this._metalPrice;
};

/**
 * Get price converted in Keys
 * @returns {float}
 */
Price.prototype.toKeys = function () {
    if (!this._keyPrice) {
        this._keyPrice = parseInt((this.toScrap() / new Price(1, "keys").toScrap()) * 100) / 100;
    }
    return this._keyPrice;
};

/**
 * Get price converted in Scraps
 * @returns {Number}
 */
Price.prototype.toScrap = function () {
    if (!this._scrapPrice) {
        this._scrapPrice = parseInt((this.toMetal() + (0.1 * this.getPriceSign())) * 9);
    }
    return this._scrapPrice;
};

Price.prototype.getPriceSign = function () {
    if (this.absolute_price < 0) {
        return -1;
    } else {
        return 1;
    }
};

/**
 * Instance value used by operators
 * Any instance of this class can be used as a Int variable for
 * computational purposes
 * @returns {Number} scrap price
 */
Price.prototype.valueOf = function () {
    return this.toScrap();
};