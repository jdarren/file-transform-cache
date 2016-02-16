'use strict';

var _      = require('lodash'),
    File   = require('vinyl'),
    vasync = require('vasync'),
    bunyan = require('bunyan'),
    glob   = require('glob'),
    fs     = require('fs');

function normalize(file) {
    if ( typeof file === 'string' ) {
        return new File({path: file, contents: new Buffer(fs.readFileSync(file))});
    }
    else if ( !File.isVinyl(file) ) {
        return null;
    }
    return file;
}

function getSourcePath(file) {
    // a transform step has changed the path to the file, however, we want
    // the path of the original source, so we'll grab it off of the history
    if ( file.history && file.history.length > 1 ) {
        return file.history[0];
    }
    return file.path;
}

/**
 *  @param {Object} options for construction, as follows:
 *
 *  options.path {String} filename of the cache.
 *  options.transforms {Array} of transformations to apply and cache.
 *
 **/
function FileTransformCache(options) {
    this._logger     = bunyan.createLogger({name: 'file-transform-cache', level: (options.loggingLevel||'warn')});
    this.options     = _.assign( {}, options );
    this._path       = this.options.path;
    this._transforms = this.options.transforms || [];
    this._cache      = {};
    this._dirty      = false;

    if ( typeof this._transforms === 'function' ) {
        this._transforms = [ this._transforms ];
    }

    this._init();
}

FileTransformCache.prototype._init = function init() {

    var fileExists = false;
    try {
        fileExists = fs.statSync(this._path).isFile();
    }
    catch(err) {
        // thrown if file doesn't exist... just gobble
    }

    if ( fileExists ) {
        this._load();
    }
    else {
        this.save();
    }
};

FileTransformCache.prototype._load = function load() {
    var cacheContent = fs.readFileSync( this._path );
    this._cache = JSON.parse(cacheContent.toString());
};

FileTransformCache.prototype._get = function(file) {
    var key         = getSourcePath(file),
        fileStats   = fs.statSync(key),
        cachedEntry = this._cache[key];

    if ( cachedEntry ) {
        this._logger.info({path: file.path}, 'found in cached');
        if ( cachedEntry.timestamp >= fileStats.mtime.getTime() ) {
            this._logger.info({path: file.path}, 'is up to date in cache.');
            return cachedEntry.content;
        }
        else {
            this._logger.info({path: file.path}, 'in cache, but stale, so purging');
            // delete the stale cache entry, and fall through...
            delete this._cache[key];
            this._dirty = true;
        }
    }
    return null;
};

/**
 *  @param {Object} vinyl file
 *  @param {String} transformed content
 *
 **/
FileTransformCache.prototype._store = function(file, content) {
    var key       = getSourcePath(file),
        fileStats = fs.statSync(key);

    this._cache[key] = {
        path:      key,
        timestamp: fileStats.mtime.getTime(),
        content:   content
    };
    this._dirty = true;
};

FileTransformCache.prototype._transform = function transform(file, next) {

    if ( file.isStream() ) {
        return next( new Error('streaming not supported'), null);
    }

    var contents = file.contents.toString();
    if ( this._transforms.length === 0 ) {
        return next(null, contents);
    }

    var transformPipeline = _.map( this._transforms, (transform,idx) => {
        if ( idx === 0 ) {
            return (callback) => {
                transform(file, callback);
            }
        }
        return function(arg, cb) {
            transform(arg, cb);
        }
    });

    vasync.waterfall(transformPipeline, (err, results) => {
        if ( err ) {
            return next(err,null);
        }
        next(null, results);
    });
}





//------------------------------------------------------------------------------
// Public API
//------------------------------------------------------------------------------




FileTransformCache.prototype.save = function save() {
    if ( this._dirty ) {
        fs.writeFileSync( this._path, JSON.stringify(this._cache) );
        this._dirty = false;
    }
};

/**
 *  @param {String|vinyl} a filename or a vinyl file object.
 *  @param {Function} the callback to invoke with the result of the transformation
 *
 **/
FileTransformCache.prototype.transform = function transform(file, next) {

    file = normalize(file);
    if ( !file ) {
        return next( new Error('1st param to transform must be a string or vinyl file'), null);
    }

    var cachedTransform = this._get(file);
    this._logger.info('cached transform for', file.path);

    if ( cachedTransform ) {
        var cachedFile = new File({
            path: file.path,
            contents: new Buffer(cachedTransform)
        });
        return next(null, cachedFile);
    }

    this._transform(file, (err, fileResult) => {

        if ( err ) {
            return next(err,null);
        }

        // no errors in transformation, so cache the result
        this._store(file, fileResult.contents.toString());
        next(null, fileResult);
    });

};

/**
 *
 *  @param {String} glob pattern to pass to glob
 *  @param {Object} an (optional) set of options to provide glob. (see the glob module for details).
 *  @param {Function} the callback to invoke with the result of the transformations
 *
 **/
FileTransformCache.prototype.transformGlob = function transformGlob(globPattern, options, next) {

    var self = this;
    if ( arguments.length === 2 && typeof options === 'function' ) {
        next    = options;
        options = {};
    }

    glob(globPattern, options, function(err, files) {
        if ( err ) {
            return next(err, null);
        }

        vasync.forEachParallel({
            func:   self.transform.bind(self),
            inputs: files
        }, function(err, results) {
            if ( err ) {
                return next(err, null);
            }
            next(null, _.map( results.operations, (operation) => {
                return {
                    err: operation.err,
                    file: operation.result
                };
            }));
        });
    });

};

function filetransformcache(options) {
    return new FileTransformCache(options);
}

module.exports = filetransformcache;
