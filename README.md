# file-transform-cache

## Why?

file-transform-cache is a build-system independent API for applying transformations to
files and caching the result in a persistent cache.

### Getting Started

 - install with: `npm intall file-transform-cache`  


### Creating

```javascript
var ftcache = require('file-transform-cache');

/**
 *
 * @param options.path {String} the path of the cache file to be created/read to store transformations.
 * @param options.transforms {Function|Array} a function or an array of transform creation functions.
 * @param options.hash {boolean} if true use the hash of the file content rather than modified time to check for staleness.
 */
var ftc     = ftcache({path,       '.myCache',
                       transforms: [ myTransform1(opts), ...] });
```

A transform creation function should be implemented as follows

```javascript
function myTransform1(opts) {

    // opts is anything needed by the transform function.
    // thy transform author provides this.

    return (file, next) => {
        // file is a vinyl file. It can be transformed in some way
        // by altering it's .contents attribute (a buffer)

        // call callback after the transformation
        next(null, file);
    }

}
```

## API

#### transform(file, next)

```javascript
/**
 *  
 *  @param {String|vinyl} a filename or a vinyl file object.
 *  @param {Function} the callback to invoke with the result of the transformation
 *
 **/
ftc.transform(file, done);
```

Example:

```javascript
var ftcache = require('file-transform-cache');
var ftc     = ftcache({path,       '.myCache',
                       transforms: [ myTransform1(opts), ...] });


ftc.transform( 'foo.js', function(err, file) {
    if (err) {
        console.log('error transforming file', err);
        return;
    }
    console.log('file was tranformed', file.path);
    console.log(file.contents.toString());
});
```

#### transformGlob(globPattern, options, next)

```javascript
/**
 *  
 *  @param {String} glob pattern to pass to glob
 *  @param {Object} an (optional) set of options to provide glob. (see the glob module for details).
 *  @param {Function} the callback to invoke with the result of the transformations
 *
 **/
ftc.transformGlob(globPattern, done);
```

Example:

```javascript
var ftcache = require('file-transform-cache');
var ftc     = ftcache({path,       '.myCache',
                       transforms: [ myTransform1(opts), ...] });


ftc.transformGlob( 'js/**/foo.js', function(err, results) {
    if (err) {
        console.log('error transforming files', err);
        return;
    }
    _.forEach( results, function(result) {
        if ( result.err ) {
            console.log(err);
            return;
        }
        console.log(result.file.contents.toString());
    });
});
```

#### save()

```javascript
/**
 *  Persist the cache into the file designated by the options.path
 *  at creation time.
 **/
ftc.save();
```

##### See the example directory for more detailed examples.
