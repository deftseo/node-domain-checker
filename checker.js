var fs = require('fs'),
    url = require('url'),
    request = require('request');

var DOMAIN_FILE = 'domain_list_2.txt',
    DOMAIN_LIST = fs.readFileSync(DOMAIN_FILE, 'utf-8').split('\n'),
    CHECKER_FORM = 'http://99webtools.com/page-authority-domain-authority-checker.php',
    CHECKER_URL  = 'http://99webtools.com/inc/pada.php',
    CHECKER_MAX  = 50;

var sessionJar = request.jar();


function init_session(callback) {
    request
        .defaults({jar: sessionJar})
        .get(CHECKER_FORM, function(error, response, body) {
            if (!error) {
                console.log(response.headers['set-cookie']);
                if (callback) {
                    callback();
                }
            }
        });
}


function process_list() {
    console.log(DOMAIN_LIST.length);
    sliceLen = Math.min(DOMAIN_LIST.length, CHECKER_MAX);
    
    curList = DOMAIN_LIST.splice(0, sliceLen);

    request
        .defaults({jar: sessionJar})
        .post({
            url: CHECKER_URL,
            form: {site: curList.join('\r\n')}
        },
        function(error, response, body) {
            var results;
            if (!error) {
                results = JSON.parse(body);
                console.log(results);
            } else {
                console.log(error);
            }
        }
    );

}

init_session(process_list);
