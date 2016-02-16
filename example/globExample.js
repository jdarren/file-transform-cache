'use strict';

var fs       = require('fs'),
    path     = require('path'),
    File     = require('vinyl'),
    glob     = require('glob'),
    _        = require('lodash'),
    ftcache  = require('../lib');

const DELAY = 1000;

var prefixTransformer = function(options) {
    var prefix = options.prefix;
    return (file, next) => {
        file.contents = new Buffer(prefix + file.contents.toString());
        setTimeout( () => { next(null, file); }, DELAY );
    };
};

var ftc = ftcache({
    transforms: prefixTransformer({prefix:'// marklar the marklar!\n'}),
    path: path.join( __dirname, '.globExample')
});


ftc.transformGlob( '**/*.json', (err, results) => {
    if ( err ) {
        console.log('Error transforming JS glob', err);
    }

    _.forEach( results, function(result) {
        if ( result.err ) {
            console.log(err);
            return;
        }
        var file = result.file;
        console.log( file.path + '\n======\n');
        console.log( file.contents.toString() );
    });

    // persist...
    ftc.save();
});
