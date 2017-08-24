module.exports = Market;

var Price = require('./price.js');
var LogLog = require('log-log');
var events = require("events");
var ShopItem = require('./shop/inventory/shopItem.js');

/*

 TODO Maybe add sold market items history?

 TODO Add price history to prevent crazy market prices

 TODO FIX On new item (ownmarket) can't click on old items (Maybe not on fresh backpack, coz own market doesn't fresh, but check injection)
 > Seems that when editing price on a certain item that one is not the actual target therefore when selling there's no market price set
 > and you get error

 TODO Read and think about this
 13:27 - xosmin: and  on a side note, i know you dont put  value on ks and paints, but maybe you could give it a try for skins
 13:28 - xosmin: ks, strange, festivized etc
 13:29 - Ax_6: Do you mean value as in showing the pain in the shop? Because skins are not priced if not by users
 13:29 - Ax_6: paint*
 13:30 - xosmin: for example, i have a ks rustic shotgun in the bp
 13:30 - xosmin: the bot sees it as a regular one
 13:30 - xosmin: even if i price is higher than a non-ks, the buyer wont know it's ks
 13:33 - xosmin: and you might wanna put a limit on garbage items to save bot's bp like giftapult eternaween etc
 13:33 - Ax_6: Yeah there's already a limit no worries

 */

// Note: database table marketed_items has item_id column which is the item id at the time it has been marketed.
// This will link the only owner at the time of trade


/**
 * @param shop {Shop}
 * @constructor
 */
function Market(shop) {
    /**
     * @type {Shop}
     */
    this.shop = shop;
    /**
     * @type {Sfuminator}
     */
    this.sfuminator = this.shop.sfuminator;
    this.db = this.shop.db;
    this.queries = Market.QUERIES;
    this.items_limit = Market.ITEMS_LIMIT;
    this.item_max_key_price = Market.ITEM_MAX_KEY_PRICE;
    this.item_max_price_ratio = Market.ITEM_MAX_PRICE_RATIO;
    this.ajaxResponses = this.sfuminator.responses;
    /**
     * @type {MarketItem[]}
     */
    this.items = [];
    this.log = LogLog.create({applicationName: "market", color: "cyan", dim: true});
    this.fixerLog = LogLog.create({applicationName: "Market shop ID Fixer", color: "cyan"});
    events.EventEmitter.call(this);
}

require("util").inherits(Market, events.EventEmitter);

Market.ITEMS_LIMIT = 12;
Market.ITEM_MAX_KEY_PRICE = 30;
Market.ITEM_MAX_PRICE_RATIO = 1.25;
Market.ITEM_STATUS = {
    SOLD: 0, //Item successfully sold through shop
    AVAILABLE: 1, //Item is available in shop
    IN_TRANSIT: 2, //Item is being transferred from user to shop
    CANCELLED: 3, //When marketing item user cancelled transaction
    WITHDRAWN: 4 //Item has been withdrawn from shop
};

Market.prototype.load = function (callback) {
    var self = this;
    this.db.connect(function (connection) {
        connection.query(self.queries.createTable(), function () {
            self.loadItems(connection, function () {
                connection.release();
                callback();
            });
        });
    });
};

Market.prototype.loadItems = function (connection, callback) {
    var self = this;
    connection.query(this.queries.loadItems(), function (result) {
        for (var i = 0; i < result.length; i += 1) {
            self.items.push(new MarketItem(self, result[i]));
        }
        callback();
    });
};

Market.prototype.marketerExists = function (steamid) {
    for (var i = 0; i < this.items.length; i += 1) {
        if (this.items[i].getMarketer() === steamid) {
            return true;
        }
    }
    return false;
};

Market.prototype.itemExists = function (shopItem) {
    return this.getItem(shopItem) !== false;
};

/**
 * @param shopItem {ShopItem|Number}
 * @returns {MarketItem}
 */
Market.prototype.getItem = function (shopItem) {
    var i;
    //So. Let's check first if this thin is an id
    if (!(shopItem instanceof ShopItem)) {
        var id = shopItem;
        for (i = 0; i < this.items.length; i += 1) {
            if (this.items[i].item_id === id) { //This is the very unique id
                return this.items[i];
            }
        }
        for (i = 0; i < this.items.length; i += 1) {
            if (this.items[i].shop_id === id) { //Backup on shop id
                return this.items[i];
            }
        }
    } else {
        //Else it's a shop item.
        for (i = 0; i < this.items.length; i += 1) {
            if (this.items[i].shop_id === shopItem.getID()) { //First option is checking shop id
                return this.items[i];
            }
        }
        //If there's no match on shop id we backup on original id
        var originalID = shopItem.getItem().getOriginalID();
        var foundMarketItems = [];
        for (i = 0; i < this.items.length; i += 1) {
            var marketItem = this.items[i];
            if (marketItem.original_id === originalID) {
                //Now that we have matched the original id, let's double check on the shop id
                if (marketItem.shop_id === shopItem.getID()) {
                    //Good this for sure didn't have any problem
                    return marketItem;
                } else {
                    //I don't like this and i think is where the bug happens, but with the original id i guess
                    foundMarketItems.push(marketItem); //just to be sure because original_id is not unique
                    this.log.warning("YEP I THINK WE SAVED IT, SHOP ID WASN'T MATCHING BUT ORIGINAL ID WAS");
                }
            }
        }
        if (foundMarketItems.length) {
            foundMarketItems.sort(function (a, b) {
                if (a.last_update_date > b.last_update_date) {
                    return -1;
                } else {
                    return 1;
                }
            });
            return foundMarketItems[0];
        }
    }
    return false;
};

Market.prototype.taxPrice = function (price) {
    return new Price(parseInt(price.toScrap() * (1 - this.shop.getMarketRatio()) + 0.5), "scrap");
};

Market.prototype.editItemPrice = function (shopId, scrapPrice, requesterSteamid) {
    if (this.canEditPrice(shopId, scrapPrice, requesterSteamid)) {
        for (var i = 0; i < this.items.length; i += 1) {
            if (this.items[i].shop_id === shopId) {
                this.items[i].editPrice(new Price(scrapPrice, "scrap"));
                return true;
            }
        }

    }
    return false;
};

Market.prototype.canEditPrice = function (shopId, scrapPrice, requesterSteamid) {
    return !this.getCannotEditPriceResponse(shopId, scrapPrice, requesterSteamid);
};

Market.prototype.getCannotEditPriceResponse = function (shopId, scrapPrice, requesterSteamid) {
    if (!isNaN(scrapPrice) && !isNaN(shopId)) {
        var marketItem = this.getItem(this.shop.getItem(shopId));
        var marketPrice = new Price(scrapPrice, "scrap");
        if (marketItem) {
            if (marketItem.getMarketer() === requesterSteamid) {
                if (this.checkPrice(marketItem.getShopItem(), marketPrice)) {
                    if (marketItem.isCooldownDecayed()) {
                        return false;
                    } else {
                        return this.ajaxResponses.editPriceCooldown((MarketItem.EDIT_COOLDOWN_TIME - marketItem.getCooldownTime()) / 1000);
                    }
                } else {
                    return this.getCannotSetPriceResponse(marketItem.getShopItem(), marketPrice);
                }
            } else {
                return this.ajaxResponses.error;
            }
        } else {
            return this.ajaxResponses.itemNotFound;
        }
    } else {
        return this.ajaxResponses.error;
    }
};

/**
 * @param shopItem {ShopItem}
 * @param marketPrice {Price}
 * @returns {boolean}
 */
Market.prototype.checkPrice = function (shopItem, marketPrice) {
    return !this.getCannotSetPriceResponse(shopItem, marketPrice);
};

/**
 * @param shopItem {ShopItem}
 * @param marketPrice {Price}
 */
Market.prototype.getCannotSetPriceResponse = function (shopItem, marketPrice) {
    if (shopItem) {
        if (this.taxPrice(marketPrice) > shopItem.getMinimumMarketPrice().toScrap()) {
            if (marketPrice.toKeys() < this.item_max_key_price) {
                return false;
            } else {
                return this.ajaxResponses.marketPriceTooHigh;
            }
        } else {
            return this.ajaxResponses.marketPriceTooLow;
        }
    } else {
        return this.ajaxResponses.error;
    }
};

/**
 * @param marketItem {MarketItem}
 */
Market.prototype.setItemAsSold = function (marketItem) {
    if (marketItem.getStatus() === Market.ITEM_STATUS.AVAILABLE) {
        this.updateItemStatus(marketItem, Market.ITEM_STATUS.SOLD);
        var user = this.sfuminator.users.get(marketItem.getMarketer());
        user.getWallet().updateBalance(marketItem.getTaxedPrice().toScrap());
    } else {
        this.log.error("Trying to set item as Sold but is not marked as Available: cs(" + marketItem.getStatus() + "), sid(" + marketItem.getID() + ")");
    }
};

Market.prototype.setItemAsWithdrawn = function (marketItem) {
    this.updateItemStatus(marketItem, Market.ITEM_STATUS.WITHDRAWN);
};

Market.prototype.setItemAsAvailable = function (marketItem) {
    this.updateItemStatus(marketItem, Market.ITEM_STATUS.AVAILABLE);
};

Market.prototype.updateItemStatus = function (marketItem, status) {
    var found = true;
    for (var i = 0; i < this.items.length; i += 1) {
        if (this.items[i].shop_id === marketItem.getID()
            && this.items[i].item_id === marketItem.getItemID()) {
            this.items[i].status = status;
            found = true;
            break;
        }
    }
    var self = this;
    this.db.connect(function (connection) {
        connection.query(self.queries.updateItemStatus(marketItem, status), function () {
            connection.release();
        });
    });
    if (!found) {
        this.log.error("Didn't find any item to update under id: " + marketItem.getID() + ", item: " + marketItem.getItemID());
    }
};

/**
 * @param tradeAssets {ShopItem[]}
 * @param itemsStatus {[number]}
 */
Market.prototype.importItems = function (tradeAssets, itemsStatus) {
    var shopItems = [];
    for (var i = 0; i < tradeAssets.length; i += 1) {
        if (!tradeAssets[i].isMarketItem()) {
            this.log.error(tradeAssets[i].getItem().getID() + " is not market item!?!?!?");
        }
        shopItems.push(this.shop.inventory.makeShopItem(tradeAssets[i].getItem())
            || this.shop.inventory.getItem(this.shop.inventory.ids.make(tradeAssets[i])));

        shopItems[i].setMarketPrice(tradeAssets[i].getPrice()); //Inject market price
    }
    if (shopItems.length) {
        this.log.debug("Importing " + shopItems.length + " assets to Market for " + shopItems[0].getOwner());
        this._databaseImport(shopItems, itemsStatus);
        this._localImport(shopItems, itemsStatus);
    }
};

Market.prototype.cancelInTransitItems = function (assets) {
    this.log.debug("Cancelling in transit items...");
    for (var i = 0; i < assets.length; i += 1) {
        var itemId = assets[i].getItem().getID();
        for (var p = 0; p < this.items.length; p += 1) {
            if (this.items[p].item_id === itemId) {
                if (this.items[p].status !== Market.ITEM_STATUS.IN_TRANSIT) {
                    this.log.error(itemId + " Item is not market as in transit?!");
                } else {
                    this.items.splice(p, 1);
                }
                break;
            }
        }
    }
    var self = this;
    if (assets.length) {
        this.db.connect(function (connection) {
            connection.query(self.queries.cancelInTransitItems(assets), function () {
                connection.release();
            });
        });
    }
};

Market.prototype.getShopTradePrices = function (idList) {
    var prices = {};
    for (var i = 0; i < idList.length; i += 1) {
        for (var p = 0; p < this.items.length; p += 1) {
            if (this.items[p].item_id === idList[i]) {
                prices[idList[i]] = this.items[p].market_price.toScrap();
                break;
            }
        }
    }
    return prices;
};

/**
 * @param shopItems {ShopItem[]}
 * @param itemsStatus
 * @private
 */
Market.prototype._localImport = function (shopItems, itemsStatus) {
    for (var i = 0; i < shopItems.length; i += 1) {
        var item = shopItems[i];
        this.items.push(new MarketItem(this, {
            shop_id: item.getID(),
            item_id: item.getItem().getID(),
            original_id: item.getItem().getOriginalID(),
            owner: item.getOwner(),
            market_price: item.marketPrice.toScrap(),
            taxed_price: this.taxPrice(item.marketPrice).toScrap(),
            status: (!isNaN(itemsStatus) ? itemsStatus : Market.ITEM_STATUS.AVAILABLE),
            last_update_date: new Date()
        }));
    }
};

Market.prototype._databaseImport = function (shopItems, itemsStatus) {
    var self = this;
    this.db.connect(function (connection) {
        connection.query(self.queries.insertItems(shopItems, itemsStatus), function () {
            connection.release();
        });
    });
};

Market.QUERIES = {
    insertItems: function (shopItems, itemsStatus) {
        var query = "INSERT INTO `marketed_items` (`shop_id`, `item_id`, `original_id`, `owner`, `market_price`, `taxed_price`, `status`, `last_update_date`) VALUES ";
        for (var i = 0; i < shopItems.length; i += 1) {
            var item = shopItems[i];
            console.log("Inserting item to market.. " + item.getID() + " ~ " + item.getItem().getOriginalID());
            query += "(" + item.getID() + "," + item.getItem().getID() + "," + item.getItem().getOriginalID() + ",'" + item.getOwner() + "',"
                + item.marketPrice.toScrap() + "," + item.shop.market.taxPrice(item.marketPrice).toScrap()
                + "," + (!isNaN(itemsStatus) ? itemsStatus : Market.ITEM_STATUS.AVAILABLE) + ", NOW()), ";
        }
        return query.slice(0, query.length - 2) + " ON DUPLICATE KEY UPDATE " +
            "`market_price`=VALUES(`market_price`), `taxed_price`=VALUES(`taxed_price`), `status`=VALUES(`status`), `last_update_date`=NOW()";

    },
    updateItemStatus: function (marketItem, status) {
        return "UPDATE `marketed_items` SET `status`=" + status + ", `last_update_date`=NOW() WHERE `shop_id`=" + marketItem.getID() + " AND `item_id`=" + marketItem.getItemID();
    },
    updateItemPrice: function (shopItemID, marketPrice, taxedPrice) {
        return "UPDATE `marketed_items` SET `market_price`=" + marketPrice + ", `taxed_price`=" + taxedPrice + ", `last_update_date`=NOW() WHERE `shop_id`=" + shopItemID;
    },
    cancelInTransitItems: function (shopItems) {
        var query = "UPDATE `marketed_items` SET `status`=" + Market.ITEM_STATUS.CANCELLED + " WHERE `item_id` IN(";
        for (var i = 0; i < shopItems.length; i += 1) {
            var item = shopItems[i];
            query += item.getItem().getID() + ", ";
        }
        return query.slice(0, query.length - 2) + ")";

    },
    loadItems: function () {
        return "SELECT `shop_id`,`item_id`,`original_id`,`owner`,`market_price`,`taxed_price`,`status`,`last_update_date` FROM `marketed_items` " +
            "WHERE `status`=" + Market.ITEM_STATUS.AVAILABLE + " OR `status`=" + Market.ITEM_STATUS.IN_TRANSIT;
    },
    createTable: function () {
        return "CREATE TABLE IF NOT EXISTS `marketed_items` ("
            + "`shop_id` bigint(20),"
            + "`item_id` bigint(20),"
            + "`original_id` bigint(20),"
            + "`owner` VARCHAR(17), "
            + "`market_price` INT, "
            + "`taxed_price` INT, "
            + "`status` TINYINT, "
            + "`last_update_date` DATETIME,"
            + "PRIMARY KEY (`shop_id`,`item_id`),"
            + "KEY (`owner`),"
            + "KEY(`original_id`)"
            + ")"
            + "ENGINE = InnoDB "
            + "DEFAULT CHARACTER SET = utf8 "
            + "COLLATE = utf8_bin";
    },
    getItemsToFix: function () {
        return "SELECT sin.shop_id as actual_shop_id ,fuzz.*,sin.item_id as sin_orig_id " +
            "FROM (SELECT marketed_items.item_id as marketed_item_id,marketed_items.shop_id as marketed_shop_id,owner,status,market_price,taxed_price,last_update_date,original_id,shop_inventory_ids.* " +
            "FROM (SELECT * FROM marketed_items WHERE last_update_date>'2017-08-19' AND status=1 order by last_update_date) as marketed_items " +
            "LEFT JOIN (select shop_id as s_shop_id, item_id as s_original_id from shop_inventory_ids) as shop_inventory_ids " +
            "ON marketed_items.shop_id=shop_inventory_ids.s_shop_id WHERE `s_original_id` IS NULL) as fuzz " +
            "LEFT JOIN shop_inventory_ids as sin ON sin.item_id=fuzz.original_id"
    },
    updateShopID: function (dbItem) {
        return "UPDATE marketed_items SET shop_id=" + dbItem.actual_shop_id + " WHERE shop_id=" + dbItem.marketed_shop_id;
    },
    getItemHistory: function (dbItem) {
        return "SELECT `owner`,`id`,`last_update_date` FROM my_sfuminator_items.items WHERE original_id=" + dbItem.original_id + " ORDER BY last_update_date";
    }
};

Market.prototype.runShopIDsFixer = function () {
    var self = this;
    this.db.connect(function (connection) {
        connection.query(self.queries.getItemsToFix(), function (result, isEmpty) {
            connection.release();
            if (isEmpty) {
                self.fixerLog.debug("All good!");
            } else {
                self.fixerLog.warning("Hmmm there's something wrong...");
                for (var i = 0; i < result.length; i += 1) {
                    var dbItem = result[i];
                    if (dbItem.actual_shop_id) {
                        //So item should be available but we lost shop id link
                        self.fixerLog.warning("Outdated Shop ID: " + dbItem.marketed_shop_id + " -> " + dbItem.actual_shop_id);
                        self._updateShopID(dbItem);
                    } else {
                        //This should mean that item has been sold gotta update status
                        self.fixerLog.warning("Item seems gone. No inventory link: " + dbItem.marketed_shop_id + " -> " + dbItem.actual_shop_id);
                        self._resolveItemStatus(dbItem);
                    }
                }
            }
        });
    });
};

Market.prototype._updateShopID = function (dbItem) {
    var self = this;
    for (var i = 0; i < this.items.length; i += 1) {
        if (this.items[i].shop_id === dbItem.marketed_shop_id) {
            this.items[i].shop_id = dbItem.actual_shop_id;
            this.fixerLog.debug("Updated " + dbItem.marketed_shop_id + " -> " + this.items[i].shop_id);
            break;
        }
    }
    this.db.connect(function (connection) {
        connection.query(self.queries.updateShopID(dbItem), function () {
            connection.release();
        });
    })
};

Market.prototype._resolveItemStatus = function (dbItem) {
    var self = this;
    var config = self.sfuminator.config;
    this._fetchItemHistory(dbItem, function (history) {
        self.fixerLog.debug("Found history for item: " + dbItem.original_id);
        var startingPointFound = 0;
        for (var i = 0; i < history.length; i += 1) {
            var historyItem = history[i];
            if (startingPointFound > 0) { //Once starting point is found check owner
                if (config.dev.isBot(historyItem.owner) || config.main.isBot(historyItem.owner)) {
                    startingPointFound += 1;
                } else if (startingPointFound === 1) {
                    self.fixerLog.error("Starting point just found and next owner is not bot?? " + historyItem.id);
                } else {
                    var marketItem = self.getItem(dbItem.marketed_shop_id);
                    if (marketItem) {
                        if (historyItem.owner === dbItem.owner) {
                            self.fixerLog.debug("Item returned to original owner, considering as withdrawn. " + historyItem.id + " steps(" + startingPointFound + ")");
                            marketItem.setAsWithdrawn();
                        } else {
                            self.fixerLog.debug("Item passed to new owner, considering as sold. " + historyItem.id + " steps(" + startingPointFound + ")");
                            marketItem.setAsSold();
                        }
                    } else {
                        self.fixerLog.error("Can't get market item?? " + dbItem.marketed_shop_id);
                    }
                }
            }

            if (historyItem.id === dbItem.marketed_item_id) { //Check if starting point
                if (historyItem.owner === dbItem.owner) {
                    self.fixerLog.debug("Found starting point for item " + dbItem.original_id);
                    startingPointFound += 1;
                } else {
                    self.fixerLog.error("WTF item id matches but owner is different?! original_id:" + dbItem.original_id + "/id:" + historyItem.id);
                    return;
                }
            }
        }
    });
};

Market.prototype._fetchItemHistory = function (dbItem, callback) {
    var self = this;
    this.db.connect(function (connection) {
        connection.query(self.queries.getItemHistory(dbItem), function (result, isEmpty) {
            connection.release();
            if (!isEmpty) {
                callback(result);
            } else {
                self.fixerLog.error("No records of this item?! WHAT?! " + dbItem.original_id);
            }
        });
    });
};

/**
 * @param market {Market}
 * @param data {object}
 * @constructor
 */
function MarketItem(market, data) {
    this.market = market;
    this.sfuminator = this.market.sfuminator;
    this.shop = this.market.shop;
    this.shop_id = data.shop_id;
    this.item_id = data.item_id;
    this.original_id = data.original_id;
    this.owner = data.owner;
    this.market_price = new Price(data.market_price, "scrap");
    this.taxed_price = new Price(data.taxed_price, "scrap");
    this.status = data.status;
    this.last_update_date = new Date(data.last_update_date);
    this.editCooldownTimeout = null;
    this.lastPriceEditDate = new Date(0);
}

MarketItem.EDIT_COOLDOWN_TIME = 1000 * 60 * 5;

MarketItem.prototype.getID = function () {
    return this.shop_id;
};

MarketItem.prototype.getItemID = function () {
    return this.item_id;
};

MarketItem.prototype.getStatus = function () {
    return this.status;
};

/**
 * @returns {String}
 */
MarketItem.prototype.getMarketer = function () {
    return this.owner;
};

MarketItem.prototype.getPrice = function () {
    return this.market_price;
};

MarketItem.prototype.getTaxedPrice = function () {
    return this.taxed_price;
};

MarketItem.prototype.getShopItem = function () {
    return this.shop.getItem(this.shop_id);
};

MarketItem.prototype.isAvailable = function () {
    if (this.status === Market.ITEM_STATUS.IN_TRANSIT && this.getShopItem()) {
        this.market.log.warning("Found transit item that is actually present in inventory, will update to available. Probably was in escrow?");
        this.setAsAvailable();
    }
    return this.status === Market.ITEM_STATUS.AVAILABLE && this.getShopItem();
};

MarketItem.prototype.setAsWithdrawn = function () {
    this.market.setItemAsWithdrawn(this);
};

MarketItem.prototype.setAsSold = function () {
    this.market.setItemAsSold(this);
};

MarketItem.prototype.setAsAvailable = function () {
    this.market.setItemAsAvailable(this);
};

MarketItem.prototype.editPrice = function (marketPrice) {
    this.market.log.debug("Editing item price: " + this.getID() + " -> " + marketPrice.toScrap());
    var taxedPrice = this.market.taxPrice(marketPrice);
    this.taxed_price = taxedPrice;
    this.market_price = marketPrice;
    var shopItem = this.getShopItem();
    this.shop.sections[shopItem.getType()].remove(shopItem).add(shopItem).commit();
    this.sfuminator.users.get(shopItem.getMarketer()).getMarketerSection().remove(shopItem).add(shopItem).commit();
    var self = this;
    this.market.db.connect(function (connection) {
        connection.query(self.market.queries.updateItemPrice(shopItem.getID(), marketPrice.toScrap(), taxedPrice.toScrap()), function () {
            connection.release();
        });
    });
    this._refreshEditCooldown();
};

MarketItem.prototype.isCooldownDecayed = function () {
    return this.getCooldownTime() > MarketItem.EDIT_COOLDOWN_TIME;
};

MarketItem.prototype.getCooldownTime = function () {
    return new Date().getTime() - this.lastPriceEditDate.getTime();
};

MarketItem.prototype._refreshEditCooldown = function () {
    this.lastPriceEditDate = new Date();
};