var fs = require('fs'),
    moz = require('./MozChecker');

var DOMAIN_FILE = 'domain_list.txt',
    reader = fs.createReadStream(DOMAIN_FILE, {encoding: 'utf-8'}),
    mozChecker = moz.MozChecker();

reader
    .pipe(mozChecker)
    .pipe(process.stdout);
