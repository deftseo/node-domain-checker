var url = require('url'),
    stream = require('stream'),
    request = require('request');

var CHECKER_FORM = 'http://99webtools.com/page-authority-domain-authority-checker.php',
    CHECKER_URL  = 'http://99webtools.com/inc/pada.php',
    CHECKER_MAX  = 20;


function MozChecker() {
    var self = this;
    if (!(this instanceof MozChecker)) {
        return new MozChecker();
    }

    stream.Duplex.call(this, {
        decodeStrings: false
    });

    self.config = {
        max_per_request: CHECKER_MAX
    };

    self.domainQueue = [];
    self.domainCache = [];

    self.sessionJar = request.jar();
    self.isReady = false;
    self.isStarted = false;
};

MozChecker.prototype.__proto__ = stream.Duplex.prototype;


/**********************************************************************
*
* Duplex interface implementation
*
**********************************************************************/

MozChecker.prototype._write = function (chunk, encoding, callback) {
    domains = chunk.split('\n');
    this.queueDomains(domains);
    return true;
};


/**********************************************************************
*
* Main implementation
*
**********************************************************************/

MozChecker.prototype.init = function (callback) {
    var self = this;

    if (!self.isReady) {
        console.log("MozChecker.init");
        request
            .defaults({jar: self.sessionJar})
            .get(CHECKER_FORM, function(error, response, body) {
                if (!error) {
                    console.log("MozChecker.init:", response.headers['set-cookie']);
                    self.isReady = true;

                    if (callback) {
                        callback();
                    }
                }
            });
    }
};


MozChecker.prototype.start = function () {
    var self = this;

    if (!this.isReady) {
        this.init(function () {
            self.start();
        });

        return;
    }

    console.log("MozChecker.start: Ready for first batch request");
    this.next();
};


MozChecker.prototype.getNextBatch = function () {
    var sliceLen = Math.min(this.domainQueue.length, CHECKER_MAX),
        nextList = this.domainQueue.splice(0, sliceLen);

    return nextList;
}


MozChecker.prototype.printResults = function (results) {
    results.forEach(function (row) {
        console.log(
            row['uu'], "\t",
            row['pda'].toFixed(2), " \t",
            row['upa'].toFixed(2), " \t"
        );
    });
}


MozChecker.prototype.next = function () {
    var self = this,
        domains = this.getNextBatch();

    if (domains.length) {
        console.log('MozChecker.next: ', domains.length, " domains.");
        request
            .defaults({jar: self.sessionJar})
            .post({
                url: CHECKER_URL,
                form: {site: domains.join('\r\n')}
            },
            function(error, response, body) {
                var results;
                if (!error) {
                    results = JSON.parse(body);
                    self.printResults(results);
                    self.start();
                } else {
                    console.log(error);
                }
            }
        );
    }
};


MozChecker.prototype.queueDomains = function (domains) {
    //console.log("MozChecker: ", domains);
    Array.prototype.push.apply(this.domainQueue, domains);
    console.log("MozChecker.queue:", this.domainQueue.length);

    if (!this.isStarted) {
        this.start()
    }
};



module.exports = {
    MozChecker: function() {
        return new MozChecker();
    }
};