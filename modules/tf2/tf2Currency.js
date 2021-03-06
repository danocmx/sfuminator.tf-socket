// Sfuminator.tf | TF2 Currency handler

var LogLog = require("log-log");
module.exports = new TF2Currency();

/**
 * TF2 Currency class<br>
 * Requiring this class will create either return a singleton<br>
 * Calling TF2Currency.setCloud is needed in order to work properly
 * @returns {TF2Currency}
 */
function TF2Currency() {
    this.log = LogLog.create({applicationName: "TF2 Currency", color: "blue"});
    this._currency = {};
}

/**
 * Will apply webApi instance to the TF2 Currency instance
 * @param {WebApi} webApi
 */
TF2Currency.prototype.setWebApi = function (webApi) {
    this.webApi = webApi;
};

/**
 * Get the current tf2 currency data structure<br>
 * Numbers multiplied by a value will convert From -> To<br>
 * Eg: (usd_price) x (_currency.usd.keys) -> key_price<br>
 * @returns {TF2Currency._currency|Object}
 * Object will have following structure<br>
 * {<br>
 * &nbsp;usd: {
 * <br>&nbsp;&nbsp;usd: Float,
 * <br>&nbsp;&nbsp;metal: Float,
 * <br>&nbsp;&nbsp;keys: Float,
 * <br>&nbsp;&nbsp;earbuds: Float (obsolete)
 * <br>&nbsp;},
 * <br>&nbsp;metal: {..},
 * <br>&nbsp;keys: {..},
 * <br>&nbsp;..
 * <br>}
 */
TF2Currency.prototype.valueOf = function () {
    return this._currency;
};

/**
 * Get instance
 * @returns {TF2Currency}
 */
TF2Currency.prototype.get = function () {
    return this;
};

/**
 * Will update currency through webApi connection
 * @param {Function} [callback]
 * Callback will return TF2Currency.valueOf
 */
TF2Currency.prototype.update = function (callback) {
    var self = this;
    this.log.debug("Updading...");
    this.fetch(function (currency) {
        for (var prop in currency) {
            self[prop] = currency[prop];
        }
        self._currency = currency;
        if (typeof callback === "function") {
            callback(self.valueOf());
        }
    });
};

/**
 * Fetch current TF2 Currency from webApi
 * @param {type} [callback]
 * Callback will return currency fetched from webApi
 */
TF2Currency.prototype.fetch = function (callback) {
    if (typeof callback === "function") {
        callback(this.webApi.tf2.currencies);
    }
};