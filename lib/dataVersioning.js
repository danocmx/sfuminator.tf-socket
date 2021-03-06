// Sfuminator.tf | Module for Data with versioning

module.exports = DataVersioning;

var LogLog = require("log-log");

/**
 * Generic purpose Data Versioning class
 * @class DataVersioning
 * @param {Number} size Indicates maximum number of history steps
 * @param {String} [versioningName] Used just for easier to understand logging
 * @returns {DataVersioning}
 */
function DataVersioning(size, versioningName) {
    this.size = size;
    /**
     * DataCommits list
     * @type {DataCommit[]}
     */
    this.versioning = [];
    this.log = LogLog.create({
        applicationName: "Data Versioning" + ((versioningName) ? (" " + versioningName) : ""),
        color: "black",
        dim: true
    });
    this.log.setDepthLevel(0);
}

/**
 * Add data to versioning
 * @param {Object[]} toAdd List of changes to add
 * @param {Object[]} toRemove List of changes to remove
 * @param {Date} [forcedVersion] Force history step date
 */
DataVersioning.prototype.add = function (toAdd, toRemove, forcedVersion) {
    if ((toAdd instanceof Array && toAdd.length) || (toRemove instanceof Array && toRemove.length)) {
        var thisVersion = new Date();
        if (forcedVersion) {
            thisVersion = forcedVersion;
        }
        this.versioning.push(new DataCommit(toAdd, toRemove, thisVersion));
        this.log.debug("New versioning  +" + toAdd.length + ", -" + toRemove.length + " " + thisVersion, 1);
        if (this.versioning.length > this.size) {
            //Secure method to remove lowest date, instead could be array.splice(0,1)
            //but we don't know what's happening next to versioning so to be sure...
            var lowestDate = {index: 0, value: new Date()};
            for (var i = 0; i < this.versioning.length; i += 1) {
                if (this.versioning[i].date < lowestDate.value) {
                    lowestDate.value = this.versioning[i].date;
                    lowestDate.index = i;
                }
            }
            this.versioning.splice(lowestDate.index, 1);
        }
        this.log.debug("New versioning: " + thisVersion, 3);
    } else {
        if (!(toAdd instanceof Array) || !(toRemove instanceof Array)) {
            this.log.error("Either toAdd or toRemove is not an array can't create version");
        }
    }
};

/**
 * Get versioning starting from given date
 * @param {Date} [since]
 * @returns {DataCommit|Boolean} False if versioning can't handle given date (e.g to old)<br>
 */
DataVersioning.prototype.get = function (since) {
    if (since instanceof Date) {
        if (this.getOldest().date.getTime() > since.getTime()) {
            return false; //Checking if versioning can't handle requested date
        }
    } else {
        since = this.getOldest().getDate();
    }
    var result = new DataCommit([], []);
    for (var i = 0; i < this.versioning.length; i += 1) {
        if (this.versioning[i].date.getTime() >= since.getTime()) {
            result.toAdd = result.toAdd.concat(this.versioning[i].toAdd);
            result.toRemove = result.toRemove.concat(this.versioning[i].toRemove);
        }
    }
    return result;
};

/**
 * Check if versioning includes all the steps starting from given date
 * @param {Date} since
 * @returns {Boolean}
 */
DataVersioning.prototype.isAvailable = function (since) {
    return since.getTime() >= this.getOldest().date.getTime();
};

/**
 * Get latest history step
 * @returns {DataCommit}
 */
DataVersioning.prototype.getLatest = function () {
    var newestDate = {index: -1, value: 0};
    for (var i = 0; i < this.versioning.length; i += 1) {
        if (this.versioning[i].date >= newestDate.value) {
            newestDate.value = this.versioning[i].date;
            newestDate.index = i;
        }
    }
    if (newestDate.index === -1) {
        return new DataCommit([], [], new Date(0));
    }
    return this.versioning[newestDate.index];
};

/**
 * Get first history step
 * @returns {DataCommit}
 */
DataVersioning.prototype.getOldest = function () {
    var oldestDate = {index: -1, value: new Date()};
    for (var i = 0; i < this.versioning.length; i += 1) {
        if (this.versioning[i].date <= oldestDate.value) {
            oldestDate.value = this.versioning[i].date;
            oldestDate.index = 0;
        }
    }
    if (oldestDate.index === -1) {
        return new DataCommit([], []);
    }
    return this.versioning[oldestDate.index];
};

/**
 * Generic DataCommit class
 * Each instance will specify elements to add and to remove based.
 * Commit date can be specified.
 * @param {Object[]} toAdd
 * @param {Object[]} toRemove
 * @param {Date} [date]
 * @returns DataCommit
 */
function DataCommit(toAdd, toRemove, date) {
    this.toAdd = toAdd;
    this.toRemove = toRemove;
    this.date = new Date();
    if (date) {
        this.date = date;
    }
}

DataCommit.prototype.getToAdd = function () {
    return this.toAdd;
};

DataCommit.prototype.getToRemove = function () {
    return this.toRemove;
};

DataCommit.prototype.getDate = function () {
    return this.date;
};

//function DataCommit(toAdd, toRemove, date) {}