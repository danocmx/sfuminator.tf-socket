module.exports = ShopItem;

var CompressionLookup = require("./compressionTable.js");
var TF2Item = require("../../tf2/tf2Item.js");
var Price = require("../../price.js");
var TF2Currency = require('../../tf2/tf2Currency.js');
var SteamGames = require("../../../lib/steamGames.js");

/**
 * Generic purpose Shop Item class, default shop ID is equal to item id
 * @class ShopItem
 * @param {Shop} shop
 * @param {TF2Item} item
 * @param {String} mine
 * @returns {ShopItem}
 */
function ShopItem(shop, item, mine) {
    /**
     * @type {Shop}
     */
    this.shop = shop;
    /**
     * @type {TF2Item}
     */
    this.item = item;
    if (this.item instanceof TF2Item) {
        this.game = SteamGames.TF2;
    }
    this.id = this.item.getID();
    this.section = this.getType();
    if (mine && mine === "mine") {
        this.setAsMineSection();
    }
    this.transferring = false; //Transfer occurs when hopping to another bot backpack
}

ShopItem.TYPE = {
    HATS: "hats",
    CURRENCY: "currency",
    STRANGE: "strange"
};

ShopItem.prototype.setID = function (id) {
    this.id = id;
};

ShopItem.prototype.getID = function () {
    return this.id;
};

ShopItem.prototype.getGameCode = function () {
    return this.game.getID();
};

ShopItem.prototype.getContextID = function () {
    if (this.isTF2Item()) {
        return SteamGames.CONTEXT.GAME_ITEM;
    }
};

ShopItem.prototype.isTF2Item = function () {
    return this.game.getID() === SteamGames.TF2.getID();
};

/**
 * Get steam item
 * @returns {TF2Item}
 */
ShopItem.prototype.getItem = function () {
    return this.item;
};

/**
 * Elaborate unique item id game associated for this shopItem
 * @returns {Number}
 */
ShopItem.prototype.getUniqueItemID = function () {
    if (this.isTF2Item()) {
        return this.item.getOriginalID();
    } else {
        this.log.error("Cannot elaborate unique item id for game " + this.getGameCode());
    }
};

/**
 * Parse shop type from item
 * @returns {String}
 */
ShopItem.prototype.getType = function () {
    if (this.isTF2Item()) {
        if (this.item.isPriced() && this.item.isTradable()) {
            if (this.item.isHat() && this.item.isCraftable()) {
                return ShopItem.TYPE.HATS;
            } else if (this.item.isStrangeWeapon()) {
                return ShopItem.TYPE.STRANGE;
            } else if (this.isCurrency()) {
                return ShopItem.TYPE.CURRENCY;
            }
        }
        return "";
    }
};

ShopItem.prototype.isHiddenType = function () {
    for (var i = 0; i < this.shop.hiddenSections.length; i += 1) {
        if (this.shop.hiddenSections[i] === this.getType()) {
            return true;
        }
    }
    return false;
};

ShopItem.prototype.setAsTransferring = function () {
    this.transferring = true;
};

ShopItem.prototype.unsetAsTransferring = function () {
    this.transferring = false;
};

ShopItem.prototype.isBeingTransferred = function () {
    return this.transferring;
};

ShopItem.prototype.isReserved = function () {
    return this.shop.reservations.exist(this.getID());
};

/**
 * @returns {Reservation}
 */
ShopItem.prototype.getReservation = function () {
    return this.shop.reservations.get(this.getID());
};

ShopItem.prototype.getSectionID = function () {
    return this.section;
};

ShopItem.prototype.setAsMineSection = function () {
    this.section = "mine";
};

/**
 * Establish if Shop Item belongs to Section of type "mine"
 * @returns {Boolean}
 */
ShopItem.prototype.isMineItem = function () {
    return this.section === "mine";
};

/**
 * Item used as currency
 * @returns {Boolean}
 */
ShopItem.prototype.isCurrency = function () {
    return this.item.isCurrency();
};

/**
 * Get Shop Section Item price.
 * Price is related to shop section.
 * @returns {Price}
 */
ShopItem.prototype.getPrice = function () {
    if (this.isMineItem() && !this.isCurrency()) {
        return this.getMinePrice();
    }
    return this.item.getPrice();
};

ShopItem.prototype.getMinePrice = function () {
    if (this.minePrice) {
        return this.minePrice;
    }
    var finalPrice;
    if (this.isTF2Item()) {
        var item = this.getItem();
        var originalPrice = item.getPrice();
        if (item.isHat()) {
            //Cut price we pay if maximum exceeded
            if (originalPrice.toMetal() > this.shop.ratio.hats.weBuy.maximum) {
                originalPrice = new Price(this.shop.ratio.hats.weBuy.maximum, TF2Currency.priceInits.Metal);
            }

            //Apply ratio to price
            if (originalPrice.toMetal() === 1.66) {
                finalPrice = new Price(this.shop.ratio.hats.weBuy.default166, TF2Currency.priceInits.Metal);
            } else {
                var ratio = this.shop.ratio.hats.weBuy.normal;
                if (originalPrice.toMetal() <= 2) {
                    ratio = this.shop.ratio.hats.weBuy.lowTier;
                }
                finalPrice = new Price(parseInt(originalPrice.toScrap() * ratio), TF2Currency.priceInits.Scrap);
            }

            //Compensate price if it's lower than the minimum we pay
            if (finalPrice.toMetal() < this.shop.ratio.hats.weBuy.minimum) {
                finalPrice = new Price(this.shop.ratio.hats.weBuy.minimum, TF2Currency.priceInits.Metal);
            }
        } else if (item.isStrangeWeapon()) {
            //Cut
            if (originalPrice.toMetal() > this.shop.ratio.strange.weBuy.maximum) {
                originalPrice = new Price(this.shop.ratio.strange.weBuy.maximum, TF2Currency.priceInits.Metal);
            }
            //Ratio
            finalPrice = new Price(parseInt(originalPrice.toScrap() * this.shop.ratio.strange.weBuy.normal), TF2Currency.priceInits.Scrap);
            //Compensate
            if (finalPrice.toMetal() < this.shop.ratio.strange.weBuy.minimum) {
                finalPrice = new Price(this.shop.ratio.strange.weBuy.minimum, TF2Currency.priceInits.Metal);
            }
        } else {
            finalPrice = Price(0);
        }
    }
    this.minePrice = finalPrice;
    return finalPrice;
};

/**
 * @returns {SteamTradeOfferItemStructure}
 */
ShopItem.prototype.getTradeOfferAsset = function () {
    return new SteamTradeOfferItemStructure(this);
};

/**
 * @param {ShopItem} shopItem
 * @returns {SteamTradeOfferItemStructure}
 */
function SteamTradeOfferItemStructure(shopItem) {
    this.appid = shopItem.getGameCode();
    this.contextid = shopItem.getContextID();
    this.amount = 1;
    this.assetid = shopItem.getItem().getID().toString();
}

/**
 * Get Shop Item object structure
 * @returns {{
 * id: Number, defindex: Number, level: Number,
 * quality: Number, name: String, image_url: String,
 * image_url_large: String, used_by_classes: String,
 * relative_price: Number, currency: String, shop: String,
 * reserved_to: String, [paint_color]: String
 * }}
 */
ShopItem.prototype.valueOf = function () {
    return new ShopItemDataStructure(this);
};

/**
 * @param {ShopItem} shopItem Shop Item
 * @returns {ShopItemDataStructure}
 */
function ShopItemDataStructure(shopItem) {
    this.id = shopItem.getID();
    this.defindex = shopItem.item.defindex;
    this.level = shopItem.item.level;
    this.quality = shopItem.item.getQuality();
    this.name = shopItem.item.getFullName();
    this.image_url = shopItem.item.image_url;
    this.image_url_large = shopItem.item.image_url_large;
    this.used_by_classes = shopItem.item.used_by_classes;
    this.currency = TF2Currency.priceInits.Metal;
    this.relative_price = shopItem.getPrice().toMetal();
    this.shop = shopItem.section;
    this.reserved_to = shopItem.getReservation().getHolder();
    if (shopItem.isMineItem() && shopItem.item.isPainted()) {
        this.paint_color = shopItem.item.getPaintColor();
    }
    if (this.id !== shopItem.getItem().getID()) {
        this.real_id = shopItem.getItem().getID();
    }
}

/**
 * Get compressed Shop Item
 *
 * Item compression has its purpose on client data exchange.
 * Shop Section Item properties are reduced to single chars and certain
 * properties are reduced in length.
 *
 * Compression will also eliminate any data redundancies.
 *
 * Lookup tables are coded in, and easy to modify.
 *
 * For more info on their data structure, check the lookup tables stored
 * in the Section/SectionItem class file.
 * @returns {Object}
 */
ShopItem.prototype.getCompressed = function () {
    var itemValue = this.valueOf();
    var compressedItem = {}, property;
    for (property in CompressionLookup.schema) {
        if (itemValue.hasOwnProperty(property) && itemValue[property]) {
            if (!CompressionLookup.values.hasOwnProperty(property)) {
                //Schema - Direct compression lookup
                compressedItem[CompressionLookup.schema[property]] = itemValue[property];
            } else if (typeof CompressionLookup.values[property] === "function") {
                //Schema - Compression lookup via function
                compressedItem[CompressionLookup.schema[property]] = CompressionLookup.values[property](itemValue[property]);
            } else {
                //Schema - Compression lookup via set of values
                compressedItem[CompressionLookup.schema[property]] = CompressionLookup.values[property][itemValue[property]];
            }
        }
    }
    var compressedAttributes = {};
    for (property in CompressionLookup.unique_identifiers) {
        if (itemValue.hasOwnProperty(property) && itemValue[property]) {
            if (!CompressionLookup.values.hasOwnProperty(property)) {
                //Item - Direct compression lookup
                compressedAttributes[CompressionLookup.unique_identifiers[property]] = itemValue[property];
            } else if (typeof CompressionLookup.values[property] === "function") {
                //Item - Compression lookup via function
                compressedAttributes[CompressionLookup.unique_identifiers[property]] = CompressionLookup.values[property](itemValue[property]);
            } else {
                //Item - Compression lookup via set of values
                compressedAttributes[CompressionLookup.unique_identifiers[property]] = CompressionLookup.values[property][itemValue[property]];
            }
        }
    }
    compressedItem[CompressionLookup.items_group] = [compressedAttributes];
    return compressedItem;
};