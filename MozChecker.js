var url = require('url'),
    stream = require('stream'),
    request = require('request');

var CHECKER_FORM = 'http://99webtools.com/page-authority-domain-authority-checker.php',
    CHECKER_URL  = 'http://99webtools.com/inc/pada.php',
    CHECKER_MAX  = 50,
    PAUSE_BETWEEN_REQUESTS = 1000;


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
    self.buffer      = [];

    self.createSession();
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


MozChecker.prototype._read = function (size) {
    // console.log('MozChecker._read');
    return false;
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


MozChecker.prototype.createSession = function () {
    this.sessionJar = request.jar();
    this.isReady = false;
}


MozChecker.prototype.start = function () {
    var self = this;

    if (!this.isReady) {
        this.init(function () {
            self.start();
        });

        return;
    }

    console.log("MozChecker.start: Ready for batch request");
    this.next();
};


MozChecker.prototype.getNextBatch = function () {
    var sliceLen = Math.min(this.domainQueue.length, CHECKER_MAX),
        nextList = this.domainQueue.splice(0, sliceLen);

    return nextList;
};


MozChecker.prototype.printResults = function (results) {
    results.forEach(function (row) {
        console.log(
            row['uu'].substring(0, row['uu'].length-1), "\t",
            row['pda'].toFixed(2), " \t",
            row['upa'].toFixed(2), " \t"
        );
    });
};


MozChecker.prototype.bufferResults = function (results) {
    var self = this;
    results.forEach(function (row) {
        var domain = {
            domain: row['uu'].substring(0, row['uu'].length-1),
            MozDA: row['pda'].toFixed(2),
            MozPA: row['upa'].toFixed(2)
        };

        self.push(
            [domain.domain, domain.MozDA, domain.MozPA].join(',') + '\n'
        );
    });
};


MozChecker.prototype.next = function () {
    var domains = this.getNextBatch();

    if (domains.length) {
        console.log('MozChecker.next:', domains.length, "domains.");
        this.doRequest(domains)
    }
};


MozChecker.prototype.pauseAndRetry = function (domainList, retry) {
    var self = this;

    if (retry <= 3) {
        retry++;
        console.log("MozChecker.pauseAndRetry:", retry);

        setTimeout(function () {
            console.log("MozChecker.pauseAndRetry: Retrying with new session")
            self.createSession();
            self.init(function () {
                self.doRequest(domainList, retry);
            });
        }, PAUSE_BETWEEN_REQUESTS);
    } else {
        console.log("MozChecker.pauseAndRetry: Max retries reached. aborting.");
    }
}


MozChecker.prototype.doRequest = function (domainList, retry) {
    var self = this;

    retry = retry || 0;

    request
        .defaults({jar: self.sessionJar})
        .post({
            url: CHECKER_URL,
            form: {
                site: domainList.join('\r\n')
            }
        },
        function(error, response, body) {
            var results;
            if (!error && response.statusCode == 200) {
                results = JSON.parse(body);

                if (results instanceof Array) {
                    self.bufferResults(results);
                    // self.printResults(results);

                    setTimeout(function () {
                        self.next();
                    }, PAUSE_BETWEEN_REQUESTS);
                } else if (results instanceof Object && results.status) {
                    console.log("MozChecker.next Moz Error:", results);

                    // Retry request
                    // self.pauseAndRetry(domainList, retry);

                } else {
                    console.log("MozChecker.next Body:", body);
                }
            } else {
                console.log("MozChecker.next: ", error);
            }
        }
    );
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