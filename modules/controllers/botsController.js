module.exports = BotsController;

var Logs = require('./../../lib/logs.js');
var TraderBot = require('./../../bots/traderBot.js');
var BotCommands = require('./../../bots/botCommands.js');

/**
 * @class BotsController
 * @parameter {Sfuminator} sfuminator
 * @constructor
 */
function BotsController(sfuminator) {
    /**
     * @type {Sfuminator}
     */
    this.sfuminator = sfuminator;
    /**
     * @type {TraderBot[]}
     */
    this.tradeBots = [];

    this.preSmeltedQuantity = 12;

    this.commands = new BotCommands(this.sfuminator);
    this.log = new Logs({applicationName: "Bots Controller", color: "blue", dim: true});

    this.loadBots();
    this._bindHandlers();
}

BotsController.prototype._bindHandlers = function () {
    for (var i = 0; i < this.tradeBots.length; i += 1) {
        this._bindBotHandler(this.tradeBots[i]);
    }
};

/**
 * @param {TraderBot} bot
 * @private
 */
BotsController.prototype._bindBotHandler = function (bot) {
    var self = this;
    bot.steamClient.on('newFriend', function (friend) {
        self.log.debug("Loading user " + friend.getSteamid());
        self.sfuminator.users.get(friend.getSteamid());
    });
    bot.steamClient.on('message', function (steamid, message) {
        self.commands.execute(steamid, message, bot);
    });
};

BotsController.prototype.loadBots = function () {
    var tradeBotSteamids = this.sfuminator.getCFG().getTradeBotSteamids();
    for (var i = 0; i < tradeBotSteamids.length; i += 1) {
        this.tradeBots.push(new TraderBot(this.sfuminator.shop.getBotUser(tradeBotSteamids[i]), this.sfuminator));
    }
};

/**
 * @param {String} steamid
 * @returns {TraderBot}
 */
BotsController.prototype.getBot = function (steamid) {
    for (var i = 0; i < this.tradeBots.length; i += 1) {
        if (this.tradeBots[i].getSteamid() === steamid) {
            return this.tradeBots[i];
        }
    }
};

/**
 * @returns {TraderBot[]}
 */
BotsController.prototype.getTradingBots = function () {
    return this.tradeBots;
};

BotsController.prototype.preSmeltMetal = function () {
    var self = this;
    /**
     * @param {TraderBot} bot
     */
    var preSmelt = function (bot) {
        var backpack = bot.getUser().getTF2Backpack();
        backpack.getCached(function () {
            var metalToSmeltDefindexes = [5002, 5001, 5000];
            for (var i = 0; i < 2; i += 1) {
                var count = backpack.getCount({defindex: metalToSmeltDefindexes[i + 1]});
                if (count < self.preSmeltedQuantity) {
                    self.log.debug("PreSmelting metal, count for " + metalToSmeltDefindexes[i + 1] + " is " + count);
                    var itemsLength = backpack.getItems().length;
                    var filter = {id: []};
                    while (itemsLength -= 1) {
                        var itemsToSmelt = backpack.getItems(filter, {defindex: metalToSmeltDefindexes[i]}, 1);
                        if (itemsToSmelt.length && !self.sfuminator.shop.reservations.exist(itemsToSmelt[0].getID())) {
                            bot.steamClient.craftTF2Items(itemsToSmelt);
                            break;
                        } else {
                            filter.id.push(itemsToSmelt[0].getID());
                        }
                    }
                }
            }
        });
    };
    for (var i = 0; i < this.tradeBots.length; i += 1) {
        preSmelt(this.tradeBots[i]);
    }
};