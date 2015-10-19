var fs = require('fs'),
    moz = require('./MozChecker');

var DOMAIN_FILE = 'domain_list.txt',
    file = (process.argv.length > 1) ? process.argv[2] : DOMAIN_FILE
    reader = fs.createReadStream(file, {encoding: 'utf-8'}),
    mozChecker = moz.MozChecker();

reader
    .pipe(mozChecker)
    .pipe(process.stdout);
