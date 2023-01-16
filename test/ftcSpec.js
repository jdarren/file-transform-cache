'use strict';

var assert = require('assert');
var ftcache = require('../lib');
var path = require('path');
var File = require('vinyl');
var fs = require('fs');

/* a simple example transformer */
function bracketTransform(options) {
    return (file, next) => {
        options.numRuns++;
        file.contents = Buffer.from('[' + file.contents.toString() + ']');
        next(null, file);
    };
}

function extTransform(options) {
    return (file, next) => {
        options.numRuns++;
        file.contents = Buffer.from('[' + file.contents.toString() + ']');
        file.extname = '.dat';
        next(null, file);
    };
}

function updateFile(file, str) {
    fs.writeFileSync(file.path, str, 'utf-8');
    file.contents = Buffer.from(str);
}

function removeFile(file) {
    fs.unlinkSync(file.path);
}

describe('file-transform-cache', function () {
    describe('creation', function () {
        it('it should return an object with the methods for transform', function () {
            var ftc = ftcache({ path: '.sample', transforms: [] });
            assert.equal('object', typeof ftc);
            assert.equal('function', typeof ftc.transform);
            assert.equal('function', typeof ftc.save);
        });
    });

    describe('caching', function () {
        it('should run the transform when cache not present, but not otherwise', function (done) {
            var transformOpts = { numRuns: 0 };
            var helloFile = new File({ path: path.join(__dirname, 'hello') });

            // put a physical file out there so it can be checked for mod time.
            updateFile(helloFile, 'hello');

            var ftc = ftcache({
                path: path.join(__dirname, '.sample'),
                transforms: [bracketTransform(transformOpts)],
            });
            ftc.transform(helloFile, (err, resultFile) => {
                assert.equal(1, transformOpts.numRuns); // transform ran once
                assert.equal('[hello]', resultFile.contents.toString()); // and produced the correct value.

                transformOpts.numRuns = 0;

                ftc.transform(helloFile, (err, resultFile) => {
                    assert.equal(0, transformOpts.numRuns); // transform did not run that time
                    assert.equal('[hello]', resultFile.contents.toString()); // but still got the correct value out of cache

                    removeFile(helloFile);

                    done();
                });
            });
        });

        it('should run the transform and preserve ext changes', function (done) {
            var transformOpts = { numRuns: 0 };
            var atextFile = new File({
                path: path.join(__dirname, 'sometext.txt'),
            });

            // put a physical file out there so it can be checked for mod time.
            updateFile(atextFile, 'sometext');

            var ftc = ftcache({
                path: path.join(__dirname, '.sample'),
                hash: true,
                transforms: [extTransform(transformOpts)],
            });
            ftc.transform(atextFile, (err, resultFile) => {
                assert.equal(1, transformOpts.numRuns); // transform ran once
                assert.equal('[sometext]', resultFile.contents.toString()); // and produced the correct value.

                transformOpts.numRuns = 0;

                ftc.transform(atextFile, (err, resultFile) => {
                    assert(
                        'is a new file with a .dat',
                        resultFile.path.indexOf('.dat') > 0
                    );
                    assert.equal(0, transformOpts.numRuns); // transform did not run that time
                    assert.equal('[sometext]', resultFile.contents.toString()); // but still got the correct value out of cache

                    fs.unlinkSync(atextFile.history[0]);

                    done();
                });
            });
        });

        it('should run the transform when the cache is stale', function (done) {
            var transformOpts = { numRuns: 0 };
            var helloFile = new File({
                path: path.join(__dirname, 'hello'),
                contents: Buffer.from('hello'),
            });

            // put a physical file out there so it can be checked for mod time.
            fs.writeFileSync(helloFile.path, helloFile.contents);

            var ftc = ftcache({
                path: path.join(__dirname, '.sample2'),
                transforms: [bracketTransform(transformOpts)],
            });
            ftc.transform(helloFile, (err, resultFile) => {
                assert.equal(1, transformOpts.numRuns); // transform ran once
                assert.equal('[hello]', resultFile.contents.toString()); // and produced the correct value.

                transformOpts.numRuns = 0;

                // now the cache should have a value, but let's now update the source file
                setTimeout(() => {
                    // updateFile.
                    updateFile(helloFile, 'howdy');

                    ftc.transform(helloFile, (err, resultFile) => {
                        assert.equal(1, transformOpts.numRuns); // transform should have run again....
                        assert.equal('[howdy]', resultFile.contents.toString()); // ...and produced the correct value.
                        assert.equal(
                            '[howdy]',
                            ftc._cache[helloFile.path].content
                        ); // cache is updated with the new value

                        removeFile(helloFile);
                        done();
                    });
                }, 1000);
            });
        });

        it('should not run the transform when the file content is the same when using the hash option', function (done) {
            var transformOpts = { numRuns: 0 };
            var helloFile = new File({
                path: path.join(__dirname, 'hello'),
                contents: Buffer.from('hello'),
            });

            // put a physical file out there so it can be checked for mod time.
            fs.writeFileSync(helloFile.path, helloFile.contents);

            var ftc = ftcache({
                path: path.join(__dirname, '.sample2'),
                hash: true,
                transforms: [bracketTransform(transformOpts)],
            });

            // run it once to seed the cache...
            ftc.transform(helloFile, (err, resultFile) => {
                // now touch the file so that the mod time is new, but the content is the same...
                fs.writeFileSync(helloFile.path, Buffer.from('hello'));
                transformOpts.numRuns = 0; /* reset */

                // now transform again, should be a straight pull from cache
                ftc.transform(helloFile, (err, resultFile2) => {
                    assert.equal(0, transformOpts.numRuns); // transform ran once
                    assert.equal('[hello]', resultFile.contents.toString()); // and produced the correct value.
                    done();
                });
            });
        });
    });

    describe('saving', function () {
        it('save() should save when the cache is dirty', function (done) {
            var transformOpts = { numRuns: 0 };
            var helloFileName = path.join(__dirname, 'hello');
            var helloFile = new File({ path: helloFileName });
            var cacheFileName = path.join(__dirname, '.sample3');

            updateFile(helloFile, 'greetings');

            var ftc = ftcache({
                path: cacheFileName,
                transforms: [bracketTransform(transformOpts)],
            });
            ftc.transform(helloFile, (err, resultFile) => {
                assert.equal(true, ftc._dirty);
                ftc.save();
                assert.equal(false, ftc._dirty);

                try {
                    // get the value back out of the persisted cache file to make sure it saved.
                    var cacheFile = JSON.parse(
                        fs.readFileSync(cacheFileName, 'utf-8')
                    );
                    assert.equal(
                        '[greetings]',
                        cacheFile[helloFileName].content
                    );

                    removeFile(helloFile);
                    done();
                } catch (err) {
                    removeFile(helloFile);
                    assert(false);
                    done();
                }
            });
        });
    });
});
