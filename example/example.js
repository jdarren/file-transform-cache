'use strict';

var fs       = require('fs'),
    path     = require('path'),
    File     = require('vinyl'),
    ftcache  = require('../lib');

const DELAY = 800;

var prefixTransformer = function(options) {
    var prefix = options.prefix;
    return (file, next) => {
        file.contents = new Buffer(prefix + file.contents.toString());
        setTimeout( () => { next(null, file); }, DELAY );
    };
};

var suffixTransformer = function(options) {
    var suffix = options.suffix;
    return (file, next) => {
        file.contents = new Buffer(file.contents.toString() + suffix);
        setTimeout( () => { next(null, file); }, DELAY );
    };
};

var ftc = ftcache({
    transforms: [
        prefixTransformer({prefix:'/* File Preamble Transform: Done */\n\n'}),
        suffixTransformer({suffix:'/* File Suplemental Info */\n'})
    ],
    path: path.join( __dirname, '.samplecache')
});

var file1 = path.join( __dirname, 'helloworld.js' );

// also accepts vinyl files
//var file2 = new File({path: file1, contents: new Buffer(fs.readFileSync(file1))});

ftc.transform( file1, (err, resultFile) => {
    if ( err ) {
        console.log('Error transforming', aFileName);
    }
    console.log(resultFile.contents.toString());

    // persist...
    ftc.save();
});
