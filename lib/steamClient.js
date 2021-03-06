module.exports = SteamClient;

var events = require('events');
var fs = require('fs');
var CFG = require('../cfg.js');
var LogLog = require('log-log');
var Steam = require('steam');
var SteamCommunity = require('steamcommunity');
var SteamFriend = require('./steamFriend.js');
var SteamGames = require('./steamGames.js');
var SteamTradeOffer = require('./steamTradeOffer.js');
var SteamTradeOffers = require('steam-tradeoffers');
var SteamTradeOffersManager = require('steam-tradeoffer-manager');
var SteamWebLogOn = require('steam-weblogon');
var API = require('./api.js');
var SteamAPI = require('./steamapi.js');
var TeamFortress2 = require('tf2');

Steam.servers = [{"host":"155.133.242.9","port":27018},{"host":"185.25.180.15","port":27019},{"host":"185.25.180.15","port":27018},{"host":"185.25.180.14","port":27017},{"host":"185.25.180.15","port":27017},{"host":"155.133.242.9","port":27019},{"host":"155.133.242.9","port":27017},{"host":"185.25.180.14","port":27018},{"host":"185.25.180.14","port":27019},{"host":"155.133.242.8","port":27017},{"host":"155.133.242.8","port":27018},{"host":"155.133.242.8","port":27019},{"host":"162.254.197.40","port":27018},{"host":"155.133.248.50","port":27017},{"host":"155.133.248.51","port":27017},{"host":"162.254.196.68","port":27017},{"host":"162.254.197.41","port":27017},{"host":"162.254.196.67","port":27019},{"host":"155.133.248.53","port":27018},{"host":"155.133.248.52","port":27018},{"host":"162.254.196.67","port":27017},{"host":"162.254.196.67","port":27018},{"host":"162.254.196.83","port":27017},{"host":"162.254.196.84","port":27017},{"host":"155.133.248.52","port":27017},{"host":"162.254.196.68","port":27018},{"host":"162.254.197.40","port":27019},{"host":"155.133.248.51","port":27019},{"host":"155.133.248.52","port":27019},{"host":"155.133.248.53","port":27019},{"host":"155.133.248.50","port":27019},{"host":"155.133.248.53","port":27017},{"host":"162.254.196.68","port":27019},{"host":"162.254.197.42","port":27019},{"host":"162.254.196.84","port":27018},{"host":"155.133.248.50","port":27018},{"host":"162.254.196.83","port":27019},{"host":"162.254.197.42","port":27018},{"host":"162.254.197.41","port":27018},{"host":"162.254.196.84","port":27019},{"host":"162.254.196.83","port":27018},{"host":"162.254.197.40","port":27017},{"host":"162.254.197.41","port":27019},{"host":"155.133.248.51","port":27018},{"host":"162.254.197.42","port":27017},{"host":"146.66.152.11","port":27018},{"host":"146.66.152.11","port":27019},{"host":"146.66.152.11","port":27017},{"host":"146.66.152.10","port":27019},{"host":"146.66.152.10","port":27017},{"host":"146.66.152.10","port":27018},{"host":"208.78.164.10","port":27018},{"host":"208.78.164.9","port":27019},{"host":"208.78.164.13","port":27018},{"host":"208.78.164.9","port":27017},{"host":"208.78.164.12","port":27018},{"host":"208.78.164.10","port":27017},{"host":"155.133.229.251","port":27019},{"host":"155.133.229.251","port":27017},{"host":"208.78.164.14","port":27018},{"host":"208.78.164.12","port":27019},{"host":"208.78.164.13","port":27017},{"host":"208.78.164.9","port":27018},{"host":"208.78.164.14","port":27019},{"host":"208.78.164.11","port":27018},{"host":"208.78.164.10","port":27019},{"host":"155.133.229.250","port":27017},{"host":"208.78.164.12","port":27017},{"host":"208.78.164.11","port":27019},{"host":"155.133.229.250","port":27018},{"host":"155.133.229.251","port":27018},{"host":"208.78.164.11","port":27017},{"host":"155.133.229.250","port":27019},{"host":"208.78.164.13","port":27019},{"host":"208.78.164.14","port":27017},{"host":"162.254.193.7","port":27017},{"host":"162.254.193.47","port":27019},{"host":"162.254.193.7","port":27018},{"host":"162.254.193.46","port":27018},{"host":"162.254.193.6","port":27017}];
Steam.EFriendRelationship = {
    None: 0,
    Blocked: 1,
    PendingInvitee: 2, // obsolete - renamed to RequestRecipient
    RequestRecipient: 2,
    Friend: 3,
    RequestInitiator: 4,
    PendingInviter: 4, // obsolete - renamed to RequestInitiator
    Ignored: 5,
    IgnoredFriend: 6,
    SuggestedFriend: 7,
    Max: 8
};

/**
 * @event clientLoggedIn
 * @event loggedIn
 * @event newFriend {SteamFriend} steamid
 * @event friendList {SteamFriend[]} friendList //Emitted when friendList has been populated and on login if populated
 * @event message {String}
 * @class SteamClient
 * @param steamid
 * @constructor
 */
function SteamClient(steamid) {
    this.steamid = steamid;
    this.credentials = CFG.getBotCredentials(this.steamid);

    this.client = new Steam.SteamClient();
    this.user = new Steam.SteamUser(this.client);
    this.friends = new Steam.SteamFriends(this.client);
    this.community = new SteamCommunity();
    this.steamWebLogOn = new SteamWebLogOn(this.client, this.user);
    this.tradeOffers = new SteamTradeOffers();
    this.tradeOffersManager = new SteamTradeOffersManager({steam: this.user, language: "en", pollInterval: -1});
    this.tf2 = new TeamFortress2(this.user);
    this.api = new SteamAPI(this.credentials.getApiKey());
    this.browser = new API("steamcommunity.com");

    this.loggingIn = false;
    this.lastLoginSucceded = false;
    this.logoutIsWanted = false;
    this.attemptsSinceLastSuccessfulLogin = 0;
    this.loginAttemptsInterval = 15000;
    this.activeTradeOffersFetchInterval = 1500;
    this.automaticMobileTradingConfirmationInterval = 4000;
    this.itemsInEscrowFetchInterval = 300000;
    this.tradeOffersCount = 0;
    this.gamePlayed = null;
    this.lastCraftedItems = [];
    /**
     * @type {SteamFriend[]}
     */
    this.friendList = [];
    /**
     * @type {OnFriendWithHandler[]}
     */
    this.onFriendWithHandlers = [];
    /**
     * @type {OnTradeOfferChangeHandler[]}
     */
    this.onTradeOfferChangeHandlers = [];
    /**
     * @type {OnTradeOfferChangeHandler[]}
     */
    this.onTradeConfirmationHandlers = [];
    /**
     * @type {ItemsInEscrow}
     */
    this.itemsInEscrow = new ItemsInEscrow();

    this._onceLoggedInHandlers = [];

    this.tradeOffersManagerPollDataPath = "./.tom_pollData";
    this.log = LogLog.create({applicationName: "Steam " + this.steamid, color: "yellow", dim: true});
    events.EventEmitter.call(this);

    this.loadFriends();
    this._bindHandlers();
}

require("util").inherits(SteamClient, events.EventEmitter);

SteamClient.prototype._bindHandlers = function () {
    var self = this;
    this.on('clientLoggedIn', function () {
        self.lastLoginSucceded = true;
        self.attemptsSinceLastSuccessfulLogin = 0;
        self.webLogin(function () {
            self.emit('loggedIn');
            if (self.friendList.length > 0) {
                self.emit('friendList', self.friendList);
            }
            for (var i = 0; i < self._onceLoggedInHandlers.length; i += 1) {
                self._onceLoggedInHandlers[i]();
            }
            self._onceLoggedInHandlers = [];
        });
    });
    this.client.on('connected', function () {
        self._fireLogOn();
    });
    this.client.on('error', function () {
        self.log.error("Steam client returned an error");
        if (!self.isLogged()) {
            self.log.warning("Disconnected from Steam, last login: " + self.lastLoginSucceded);
            self.log.warning("Will try to relog");
            self._retryLogin();
        }
    });
    this.client.on('loggedOff', function () {
        self.log.warning("We were logged off from Steam");
        if (!self.lastLoginSucceded) {
            self.attemptsSinceLastSuccessfulLogin += 1;
            self._retryLogin();
        } else if (!self.logoutIsWanted) {
            self.log.warning("Unexpected logout! WTF Steam");
            self._retryLogin();
        }
        self.logoutIsWanted = false;
    });
    this.client.on('logOnResponse', function (response) {
        self.loggingIn = false;
        self.lastLoginSucceded = false;
        self._onLogOnResponse(response);
    });
    this.user.on('updateMachineAuth', function (response, callback) {
        self._updateSentryFile(response, callback);
    });
    this.user.on('tradeOffers', function (newTradeOffersCount) {
        self.tradeOffersCount = newTradeOffersCount;
    });
    this.friends.on('friend', function (steamid, EFriendRelationship) {
        if (EFriendRelationship === Steam.EFriendRelationship.Friend) {
            self._manageNewFriend(steamid);
        }
        if (EFriendRelationship === Steam.EFriendRelationship.PendingInvitee) {
            self.log.debug("Accepting friend request from " + steamid);
            self.addFriend(steamid);
            self._manageNewFriend(steamid);
        }
        if (EFriendRelationship === Steam.EFriendRelationship.None) {
            for (var i = 0; i < self.friendList.length; i += 1) {
                if (self.friendList[i].getSteamid() === steamid) {
                    self.friendList.splice(i, 1);
                    break;
                }
            }
        }
    });
    this.friends.on('relationships', function () {
        for (var steamid in self.friends.friends) {
            if (self.friends.friends[steamid] === Steam.EFriendRelationship.PendingInvitee) {
                self.log.debug("Accepting friend request from " + steamid);
                self.addFriend(steamid);
                self._manageNewFriend(steamid);
            }
        }
    });
    this.friends.on('friendMsg', function (steamid, message) {
        if (message) {
            self.emit('message', steamid, message);
        }
    });
    this.tf2.on('craftingComplete', function (recipe, itemsGained) {
        self.log.debug("Crafted, " + itemsGained);
        self.lastCraftedItems = [];
        if (itemsGained instanceof Array) {
            for (var i = 0; i < itemsGained.length; i += 1) {
                self.lastCraftedItems.push(parseInt(itemsGained[i]));
            }
        } else if (!isNaN(itemsGained)) {
            self.lastCraftedItems = [parseInt(itemsGained)];
        }
    });
    this.community.on('confKeyNeeded', function (tag, callback) {
        self.log.debug("confKeyNeeded: " + tag);
        callback(null, self._getUnixTimestamp(), self.credentials.getConfirmationKey(tag));
    });

    this.community.on('newConfirmation', function (confirmation) {
        self.log.debug("new confirmation for " + confirmation.offerID);
        confirmation.respond(self._getUnixTimestamp(), self.credentials.getConfirmationKey("allow"), true, function (error) {
            if (error) {
                self.log.error("Confirming trade: " + error);
                self.emit("confirmationError", confirmation.offerID);
            } else {
                self.log.debug("Trade " + confirmation.offerID + " confirmed");
                self._bypassTradeOfferMangerPolling(confirmation.offerID);
            }
            self._manageOnTradeConfirmationHandlers(confirmation.offerID, error);
        });
    });
    this.tradeOffersManager.on('sentOfferChanged', function (offer) {
        self._manageOnTradeOfferChangeHandlers(offer);
    });
    this.tradeOffersManager.on('receivedOfferChanged', function (offer) {
        self._manageOnTradeOfferChangeHandlers(offer);
    });
    this.tradeOffersManager.on('pollData', function (pollData) {
        self._saveTradeOfferManagerPollData(pollData);
    });
};

SteamClient.prototype.getSteamid = function () {
    return this.steamid;
};

/**
 * @returns {BotCredentials}
 */
SteamClient.prototype.getCredentials = function () {
    return this.credentials;
};

SteamClient.prototype.logOut = function () {
    this.logoutIsWanted = true;
    this.client.disconnect();
};

SteamClient.prototype.login = function () {
    var self = this;
    this.log.debug("Logging in...");
    if (this.isLogged()) {
        this.log.warning("We are already logged in, no need to login again (?)");
        return;
    }
    this.loggingIn = true;
    if (!this.isConnected()) {
        this.client.connect();
    } else {
        self._fireLogOn();
    }
};

SteamClient.prototype.onceLoggedIn = function (callback) {
    this._onceLoggedInHandlers.push(callback);
};

SteamClient.prototype.webLogin = function (callback) {
    var self = this;
    this.steamWebLogOn.webLogOn(function (webSessionID, cookies) {
        self.log.debug("WebLogged!");
        self.tradeOffers.setup({
            sessionID: webSessionID,
            webCookie: cookies,
            APIKey: self.credentials.getApiKey()
        });
        self.cookies = cookies;
        self.webSessionID = webSessionID;
        self.community.setCookies(cookies);
        self.browser.setCookie(cookies);
        self.tradeOffersManager.setCookies(cookies, function () {
            if (typeof callback === "function") {
                callback();
            }
        });
    });
};

SteamClient.prototype.isConnected = function () {
    return this.client.connected;
};

SteamClient.prototype.isLogged = function () {
    return this.client.loggedOn;
};

SteamClient.prototype.isLoggingIn = function () {
    return this.loggingIn;
};

SteamClient.prototype.getSessionID = function () {
    return this.webSessionID;
};

SteamClient.prototype.getTradeOffersCount = function () {
    return this.tradeOffersCount;
};

SteamClient.prototype.sendMessage = function (steamid, message) {
    if (message) {
        this.friends.sendMessage(steamid, message);
    } else {
        this.log.warning("Avoiding empty steam message to " + steamid);
    }
};

SteamClient.prototype.loadFriends = function () {
    var self = this;
    this.api.getFriendList(this.steamid, function (result) {
        if (result.hasOwnProperty("friendslist")
            && result.friendslist.hasOwnProperty("friends")
            && !isNaN(result.friendslist.friends.length)) {
            var friendList = result.friendslist.friends;
            for (var i = 0; i < friendList.length; i += 1) {
                self.friendList.push(new SteamFriend(self, friendList[i].steamid, new Date(friendList[i].friend_since * 1000)));
            }
            self.emit('friendList', self.friendList);
        } else {
            self.log.warning("Wasn't able to fetch friend list, will retry in " + parseInt(self.loginAttemptsInterval / 1000) + " seconds");
            setTimeout(function () {
                self.loadFriends();
            }, self.loginAttemptsInterval);
        }
    });
};

SteamClient.prototype.addFriend = function (steamid) {
    this.friends.addFriend(steamid);
};

SteamClient.prototype.removeFriend = function (steamid) {
    this.log.debug("Removing " + steamid + " from friend list");
    this.friends.removeFriend(steamid);
    this._removeFromLocalFriendList(steamid);
};

SteamClient.prototype.isFriend = function (steamid) {
    return this.friends.friends.hasOwnProperty(steamid) && this.friends.friends[steamid] === Steam.EFriendRelationship.Friend;
};

/**
 * @param steamid
 * @returns {SteamFriend}
 */
SteamClient.prototype.getFriend = function (steamid) {
    for (var i = 0; i < this.friendList.length; i += 1) {
        if (this.friendList[i].getSteamid() === steamid) {
            return this.friendList[i];
        }
    }
};

/**
 * @param {String[]} [whiteList]
 * @returns {SteamFriend}
 */
SteamClient.prototype.getOldestFriend = function (whiteList) {
    if (this.getNumberOfFriends() > 0) {
        var oldestFriend, i;
        if (whiteList && whiteList instanceof Array) {
            for (i = 0; i < this.getNumberOfFriends(); i += 1) {
                if (whiteList.indexOf(this.friendList[i].getSteamid()) === -1) {
                    oldestFriend = this.friendList[i];
                    break;
                }
            }
        } else {
            oldestFriend = this.friendList[0];
        }
        if (oldestFriend) {
            for (i = 0; i < this.getNumberOfFriends(); i += 1) {
                if (this.friendList[i].getFriendSince() < oldestFriend.getFriendSince()) {
                    if (!(whiteList && whiteList instanceof Array && whiteList.indexOf(this.friendList[i].getSteamid()) > -1)) {
                        oldestFriend = this.friendList[i];
                    }
                }
            }
            return oldestFriend;
        }
    }
};

SteamClient.prototype.onFriendWith = function (steamid, callback) {
    this.onFriendWithHandlers.push(new OnFriendWithHandler(steamid, callback));
};

SteamClient.prototype.getNumberOfFriends = function () {
    return this.friendList.length;
};

/**
 * @param {String} steamid
 * @param {String} comment
 * @param {Function} [callback]
 */
SteamClient.prototype.postProfileComment = function (steamid, comment, callback) {
    var options = {comment: comment, count: 6, sessionid: this.getSessionID()};
    this.browser.post("http://steamcommunity.com/comment/Profile/post/" + steamid + "/-1/", options, function (result) {
        if (typeof callback === "function") {
            callback(result && result.hasOwnProperty("success") && result.success === true);
        }
    });
};

SteamClient.prototype.onTradeOfferChange = function (tradeOfferID, callback) {
    this.onTradeOfferChangeHandlers.push(new OnTradeOfferChangeHandler(tradeOfferID, callback));
};

SteamClient.prototype.tradeOfferHasListener = function (tradeOfferID) {
    for (var i = 0; i < this.onTradeOfferChangeHandlers.length; i += 1) {
        if (this.onTradeOfferChangeHandlers[i].tradeOfferID === tradeOfferID) {
            return true;
        }
    }
    return false;
};

SteamClient.prototype.disableOnTradeOfferChangeListener = function (tradeOfferID) {
    var onTradeOfferChangeHandlersLength = this.onTradeOfferChangeHandlers.length;
    for (var i = 0; i < onTradeOfferChangeHandlersLength; i += 1) {
        if (this.onTradeOfferChangeHandlers[i].tradeOfferID === tradeOfferID) {
            this.onTradeOfferChangeHandlers.splice(i, 1);
            onTradeOfferChangeHandlersLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype.onTradeConfirmation = function (tradeOfferID, callback) {
    this.onTradeConfirmationHandlers.push(new OnTradeOfferChangeHandler(tradeOfferID, callback));
};

SteamClient.prototype.disableOnTradeConfirmationListener = function (tradeOfferID) {
    var onTradeConfirmationHandlersLength = this.onTradeConfirmationHandlers.length;
    for (var i = 0; i < onTradeConfirmationHandlersLength; i += 1) {
        if (this.onTradeConfirmationHandlers[i].tradeOfferID === tradeOfferID) {
            this.onTradeConfirmationHandlers.splice(i, 1);
            onTradeConfirmationHandlersLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype.setAutomaticMobileTradingConfirmation = function () {
    this.community.startConfirmationChecker(this.automaticMobileTradingConfirmationInterval);
};

SteamClient.prototype.startTradeOffersManagerPolling = function () {
    var self = this;
    this._readTradeOfferManagerPollData(function (pollData) {
        self.tradeOffersManager.pollData = pollData;
        self.tradeOffersManager.pollInterval = self.activeTradeOffersFetchInterval;
        self.tradeOffersManager.doPoll();
    });
};

SteamClient.prototype.getActiveOffers = function (callback) {
    if (this.activeOffersDecayed || typeof this.activeOffers === "undefined") {
        var self = this;
        this.tradeOffersManager.getOffers(1, null, function (err, sent, received) {
            if (!err) {
                self.activeOffers = {sent: sent, received: received};
                self.activeOffersDecayed = false;
                setTimeout(function () {
                    self.activeOffersDecayed = true;
                }, 4000);
                callback(null, sent, received);
            } else {
                callback(err);
            }
        });
    } else {
        callback(null, this.activeOffers.sent, this.activeOffers.received);
    }
};

/**
 * @param {Number} milliseconds
 */
SteamClient.prototype.setAutomaticTradeCancelAfter = function (milliseconds) {
    this.tradeOffersManager.cancelTime = milliseconds;
};

SteamClient.prototype.startItemsInEscrowPolling = function () {
    var self = this;
    setTimeout(function () {
        self.fetchItemsInEscrow();
    }, 5000);//wait for api key
    setInterval(function () {
        self.fetchItemsInEscrow();
    }, this.itemsInEscrowFetchInterval);
};

/**
 * @returns {ItemsInEscrow}
 */
SteamClient.prototype.getItemsInEscrow = function () {
    return this.itemsInEscrow;
};

SteamClient.prototype.fetchItemsInEscrow = function (callback) {
    var i, self = this;
    this.tradeOffersManager.getOffers(0, new Date(0), function (err, sent, received) {
        if (err) {
            self.log.warning("Wasn't able to fetch items in escrow: " + err);
            return;
        }
        self.itemsInEscrow.toGive = [];
        self.itemsInEscrow.toReceive = [];
        for (i = 0; i < sent.length; i += 1) {
            if (sent[i].state === SteamTradeOffer.SteamTradeStatus.InEscrow) {
                self.itemsInEscrow.toGive = self.itemsInEscrow.toGive.concat(sent[i].itemsToGive);
                self.itemsInEscrow.toReceive = self.itemsInEscrow.toReceive.concat(sent[i].itemsToReceive);
            }
        }
        for (i = 0; i < received.length; i += 1) {
            if (received[i].state === SteamTradeOffer.SteamTradeStatus.InEscrow) {
                self.itemsInEscrow.toGive = self.itemsInEscrow.toGive.concat(received[i].itemsToGive);
                self.itemsInEscrow.toReceive = self.itemsInEscrow.toReceive.concat(received[i].itemsToReceive);
            }
        }
        if (typeof callback === "function") {
            return self.itemsInEscrow;
        }
    });
};

SteamClient.prototype.stopPlaying = function () {
    this.user.gamesPlayed({});
    this.log.debug("Stopped playing");
    this.gamePlayed = null;
};

/**
 * @param {SteamGame} game
 */
SteamClient.prototype.playGame = function (game) {
    this.user.gamesPlayed({games_played: [{game_id: game.getID()}]});
    this.log.debug("Playing " + game.getName());
    this.gamePlayed = game;
};

SteamClient.prototype.isPlayingGame = function () {
    return this.getPlayingGame() !== null;
};

/**
 * @returns {SteamGame|Null}
 */
SteamClient.prototype.getPlayingGame = function () {
    return this.gamePlayed;
};

/**
 * @param {TF2Item[]} tf2Items
 * @param {Function} callback
 */
SteamClient.prototype.craftTF2Items = function (tf2Items, callback) {
    var itemIDs = [];
    for (var i = 0; i < tf2Items.length; i += 1) {
        itemIDs.push(tf2Items[i].getID());
    }
    if (!this.isPlayingGame() || this.getPlayingGame().getID() !== SteamGames.TF2.getID()) {
        this.playGame(SteamGames.TF2);
        var self = this;
        setTimeout(function () {
            self.tf2.craft(itemIDs);
        }, 500);
    } else {
        this.tf2.craft(itemIDs);
    }
    this.log.debug("Crafted: " + JSON.stringify(itemIDs));
};

SteamClient.prototype._manageNewFriend = function (steamid) {
    this._removeFromLocalFriendList(steamid); //unPopulate in case of dupes
    var friend = new SteamFriend(this, steamid);
    this.friendList.push(friend);
    this.emit("newFriend", friend);
    this._manageOnFriendWithHandlers(steamid);
};

SteamClient.prototype._manageOnFriendWithHandlers = function (steamid) {
    var handlersLength = this.onFriendWithHandlers.length;
    for (var i = 0; i < handlersLength; i += 1) {
        if (this.onFriendWithHandlers[i].steamid === steamid) {
            this.onFriendWithHandlers[i].callback();
            this.onFriendWithHandlers.splice(i, 1);
            handlersLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype._removeFromLocalFriendList = function (steamid) {
    var friendListLength = this.friendList.length;
    for (var i = 0; i < friendListLength; i += 1) {
        if (this.friendList[i].getSteamid() === steamid) {
            this.friendList.splice(i, 1);
            friendListLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype._saveTradeOfferManagerPollData = function (pollData, callback) {
    var self = this;
    if (!this._savingTradeOfferManagerPollData) {
        this._savingTradeOfferManagerPollData = true;
        fs.writeFile(this.tradeOffersManagerPollDataPath, JSON.stringify(pollData), function () {
            self._savingTradeOfferManagerPollData = false;
            if (typeof callback === "function") {
                callback();
            }
        });
    }
};

SteamClient.prototype._readTradeOfferManagerPollData = function (callback) {
    var self = this;
    fs.access(this.tradeOffersManagerPollDataPath, fs.R_OK, function (cantRead) {
        if (cantRead) {
            callback({});
        } else {
            fs.readFile(self.tradeOffersManagerPollDataPath, function (error, content) {
                if (error) {
                    callback({});
                } else {
                    try {
                        var data = JSON.parse(content);
                        callback(data);
                    } catch (error) {
                        callback({});
                    }
                }
            })
        }
    });
};


SteamClient.prototype._bypassTradeOfferMangerPolling = function (tradeOfferID) {
    var actions = ["sent", "received"];
    for (var i = 0; i < actions.length; i += 1) {
        var action = actions[i];
        if (this.tradeOffersManager.pollData[action].hasOwnProperty(tradeOfferID)) {
            this._bypassTradeOfferManagerPolling_AntiCallback(action, tradeOfferID, this.tradeOffersManager.pollData[action][tradeOfferID]);
        }
    }
};

SteamClient.prototype._bypassTradeOfferManagerPolling_AntiCallback = function (action, tradeOfferID, oldState) {
    var self = this;
    this.tradeOffersManager.getOffer(tradeOfferID, function (error, offer) {
        if (error) {
            self.log.error("Wasn't able to fetch offer and bypass manager: " + error);
        } else if (self.tradeOffersManager.pollData[action][tradeOfferID] !== offer.state) {
            var newState = offer.state;
            self.tradeOffersManager.pollData[action][tradeOfferID] = newState;
            self.log.debug("Bypassing " + tradeOfferID + " from " + oldState + " to " + newState);
            self.tradeOffersManager.emit(action + 'OfferChanged', offer, oldState);
        } //Emit bypass only if pollData hasn't been already updated
    });
};

SteamClient.prototype._manageOnTradeOfferChangeHandlers = function (offer) {
    var onTradeOfferChangeHandlersLength = this.onTradeOfferChangeHandlers.length;
    for (var i = 0; i < onTradeOfferChangeHandlersLength; i += 1) {
        if (this.onTradeOfferChangeHandlers[i].tradeOfferID === offer.id) {
            this.onTradeOfferChangeHandlers[i].renewExpiration();
            this.onTradeOfferChangeHandlers[i].callback(offer);
            //It's possible that inside this callback, the trade offer change listener
            //Gets disabled therefore spliced from the list, we have to update length
            //And... well the pointer as well
            if (this.onTradeOfferChangeHandlers.length !== onTradeOfferChangeHandlersLength) {
                this.log.test("Yes, handler was spliced away, updating length");
                onTradeOfferChangeHandlersLength = this.onTradeOfferChangeHandlers.length;
                i -= 1;
            }
        } else if (this.onTradeOfferChangeHandlers[i].isExpired()) {
            this.onTradeOfferChangeHandlers.splice(i, 1);
            onTradeOfferChangeHandlersLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype._manageOnTradeConfirmationHandlers = function (tradeOfferID, error) {
    var onTradeConfirmationHandlersLength = this.onTradeConfirmationHandlers.length;
    for (var i = 0; i < onTradeConfirmationHandlersLength; i += 1) {
        if (this.onTradeConfirmationHandlers[i].tradeOfferID === tradeOfferID) {
            this.onTradeConfirmationHandlers[i].renewExpiration();
            this.onTradeConfirmationHandlers[i].callback(error);
            if (this.onTradeConfirmationHandlers.length !== onTradeConfirmationHandlersLength) {
                this.log.test("Yes, handler was spliced away, updating length");
                onTradeConfirmationHandlersLength = this.onTradeConfirmationHandlers.length;
                i -= 1;
            }
        } else if (this.onTradeConfirmationHandlers[i].isExpired()) {
            this.onTradeConfirmationHandlers.splice(i, 1);
            onTradeConfirmationHandlersLength -= 1;
            i -= 1;
        }
    }
};

SteamClient.prototype._fireLogOn = function () {
    var login_data = {account_name: this.credentials.getUsername(), password: this.credentials.getPassword()};
    if (this.credentials.hasSentryHash()) {
        login_data.sha_sentryfile = this.credentials.getSentryHash();
    } else if (this.credentials.hasSteamGuardCode() && this.credentials.getSteamGuardCode()) {
        login_data.auth_code = this.credentials.getSteamGuardCode();
    } else {
        this.log.warning("Couldn't find sentry file or steam guard code, probably login will be refused");
    }
    if (this.credentials.hasMobileAuth()) {
        login_data.two_factor_code = this.credentials.getTwoFactorCode();
    }
    this.log.debug("Logging in... "
        + (login_data.hasOwnProperty("sha_sentryfile") ? "(found sentry file)" : "")
        + (login_data.hasOwnProperty("auth_code") ? "(found steam guard code)" : "")
    );
    this.user.logOn(login_data);
};

SteamClient.prototype._onLogOnResponse = function (logonResp) {
    if (logonResp.eresult == Steam.EResult.OK) {
        this.friends.setPersonaState(Steam.EPersonaState.Online);
        this.log.debug("Logged in!");
        this.emit('clientLoggedIn');
    } else if (logonResp.eresult === Steam.EResult.AccountLogonDenied) {
        this.log.warning("Login denied, probably steam guard code is needed");
    } else if (logonResp.eresult === Steam.EResult.InvalidLoginAuthCode) {
        this.log.warning("Invalid LoginAuthCode provided");
    } else if (logonResp.eresult === Steam.EResult.TwoFactorCodeMismatch) {
        this.log.warning("Invalid Two Factor Code, probably we missed the right timing");
    } else {
        this.log.warning("Unhandled logon response: " + this._encodeEResult(Steam.EResult, logonResp.eresult));
    }
};

SteamClient.prototype._retryLogin = function () {
    if (this.loggingIn) {
        return;
    }
    this.loggingIn = true;
    var interval;
    if (this.attemptsSinceLastSuccessfulLogin < 2) {
        interval = this.loginAttemptsInterval;
    } else if (this.attemptsSinceLastSuccessfulLogin < 4) {
        interval = this.loginAttemptsInterval * 2;
    } else {
        interval = this.loginAttemptsInterval * this.attemptsSinceLastSuccessfulLogin;
    }

    var self = this;
    setTimeout(function () {
        self.login();
    }, interval);
};

SteamClient.prototype._updateSentryFile = function (sentryResponse, callback) {
    this.log.debug("Updating sentry file: " + sentryResponse.filename);
    this.credentials.saveSentryFile(sentryResponse);
    callback({sha_file: this.credentials.getSentryHash()});
};

SteamClient.prototype._encodeEResult = function (EObject, response_code) {
    for (var response in EObject) {
        if (EObject[response] === response_code) {
            return response;
        }
    }
};

SteamClient.prototype._getUnixTimestamp = function () {
    return parseInt(new Date().getTime() / 1000);
};

/**
 * @param steamid
 * @param callback
 * @constructor
 */
function OnFriendWithHandler(steamid, callback) {
    this.steamid = steamid;
    this.callback = callback;
}

ON_TRADE_OFFER_CHANGE_HANDLER_EXPIRATION = 1000 * 60 * 60; //1 Hour

/**
 * @param tradeOfferID
 * @param callback
 * @constructor
 */
function OnTradeOfferChangeHandler(tradeOfferID, callback) {
    this.tradeOfferID = tradeOfferID;
    this.callback = callback;
    this.renewExpiration();
}

OnTradeOfferChangeHandler.prototype.renewExpiration = function () {
    this.last_update = new Date();
};

OnTradeOfferChangeHandler.prototype.isExpired = function () {
    return this.last_update + ON_TRADE_OFFER_CHANGE_HANDLER_EXPIRATION < new Date();
};

/**
 * @constructor
 */
function ItemsInEscrow() {
    this.toReceive = [];
    this.toGive = [];
}

/**
 * @returns {{toReceive: Number, toGive: Number}}
 */
ItemsInEscrow.prototype.getCounted = function () {
    return {
        toReceive: this.toReceive.length,
        toGive: this.toGive.length
    }
};

var SteamID = require('steamid');
SteamTradeOffersManager.prototype.getEscrowDuration = function (steamID, token, callback) {
    if (typeof token === 'function') {
        callback = token;
        token = undefined;
    }

    if (typeof steamID !== 'object') {
        steamID = new SteamID(steamID);
    }

    this._community.httpRequestGet({
        "uri": "https://steamcommunity.com/tradeoffer/new/",
        "qs": {
            "partner": steamID.accountid,
            "token": token || undefined
        }
    }, this._escrowDurationResponse.bind(callback), "tradeoffermanager");
};
SteamTradeOffersManager.prototype._escrowDurationResponse = function (err, response, body) {
    var callback = this; // horrible hack but I don't care

    if (err || response.statusCode != 200) {
        callback(err || new Error("HTTP error " + response.statusCode));
        return;
    }

    var mine = body.match(/var g_daysMyEscrow = (\d+);/);
    var theirs = body.match(/var g_daysTheirEscrow = (\d+);/);
    if (mine && theirs) {
        callback(null, parseInt(theirs[1], 10), parseInt(mine[1], 10));
        return;
    }

    // No escrow stuff found, look for an error message
    var error = body.match(/<div id="error_msg">([^<]+)<\/div>/);
    if (error) {
        callback(new Error(error[1].trim()));
        return;
    }

    callback(new Error("Malformed response"));
};