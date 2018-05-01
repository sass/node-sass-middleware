/*global describe it before after*/
'use strict';

var fs = require('fs'),
    path = require('path'),
    should = require('should'),
    sass = require('node-sass'),
    request = require('supertest'),
    connect = require('connect'),
    middleware = require('../middleware'),
    fixture = path.join.bind(null, __dirname, 'fixtures'),
    testCssFile = fixture('test.css'),
    testScssFile = fixture('test.scss'),
    indexCssFile = fixture('index.css'),
    indexScssFile = fixture('index.scss'),
    indexSourceMap = fixture('index.css.map'),
    testUtils = require('./testUtils');

describe('Using middleware to compile .scss', function() {
  var server = connect()
    .use(middleware({
      src: fixture(),
      dest: fixture(),
      indentedSyntax: false
    }))
    .use(function(err, req, res, next) {
      res.statusCode = 500;
      res.end(err.message);
      next();
    });

  testUtils.setupBeforeEach(testCssFile, indexCssFile, indexSourceMap);

  describe('successful file request', function() {
    it('serves a file with 200 Content-Type css', function(done) {
      request(server)
        .get('/test.css')
        .set('Accept', 'text/css')
        .expect('Content-Type', /css/)
        .expect(200, done);
    });

    it('serves the compiled contents of the relative scss file', function(done) {
      var filesrc = fs.readFileSync(testScssFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: false });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(testScssFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: false });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            if (fs.existsSync(testCssFile)) {
              fs.readFileSync(testCssFile).toString().should.equal(result.css.toString());
              done();
            } else {
              done(new Error('file was not written before request ends'));
            }
          }
        });
    });

    it('only writes the compiled contents out to the expected file without serving them', function(done) {
      var filesrc = fs.readFileSync(testScssFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: false }),
          anotherResponse = 'something else',
          server = connect()
            .use(middleware({
              response: false,
              src: fixture(),
              dest: fixture(),
              indentedSyntax: false
            }));

      server.use(function(req, res) {
        res.end(anotherResponse);
      });

      request(server)
        .get('/test.css')
        .expect(anotherResponse)
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            fs.readFileSync(testCssFile).toString().should.equal(result.css.toString());
            done();
          }
        });
    });
  });

  describe('unsucessful file request', function() {
    it('moves to next middleware', function(done) {
      request(server)
        .get('/does-not-exist.css')
        .expect('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /does-not-exist.css</pre>\n</body>\n</html>\n')
        .expect(404, done);
    });
  });

  describe('compiling files with dependencies (source file contains includes)', function() {
    it('serves the compiled contents of the relative scss file', function(done) {
      var filesrc = fs.readFileSync(indexScssFile),
          result = sass.renderSync({ data: filesrc.toString(), includePaths: [fixture()], indentedSyntax: false });
      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(indexScssFile),
          result = sass.renderSync({ data: filesrc.toString(), includePaths: [fixture()], indentedSyntax: false });

      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            (function checkFile() {
              if (fs.existsSync(indexCssFile)) {
                fs.readFileSync(indexCssFile).toString().should.equal(result.css.toString());
                done();
              } else {
                setTimeout(checkFile, 25);
              }
            }());
          }
        });
    });

    it('any change in a dependent file, force recompiling', function(done) {
      request(server)
        .get('/index.css')
        .expect(200, function() {
          (function checkInitialFile() {
            fs.stat(indexCssFile, function(err, initialDate) {
              if (initialDate !== undefined) {
                fs.appendFile(testScssFile, '\nbody { background: red; }', function(err) {
                  if (err) {
                    throw err;
                  }

                  var filesrc = fs.readFileSync(indexScssFile),
                      result = sass.renderSync({ data: filesrc.toString(), includePaths: [fixture()], indentedSyntax: false });

                  request(server)
                    .get('/index.css')
                    .expect(200, function() {
                      (function checkRecompiledFile() {
                        var cont = fs.readFileSync(indexCssFile).toString();
                        if (cont === result.css.toString()) {
                          done();
                        } else {
                          setTimeout(checkRecompiledFile, 10);
                        }
                      }());
                    });
                });
              } else {
                setTimeout(checkInitialFile, 10);
              }
            });
          }());
        });

      // clean
      after(function() {
        var reset = fs.readFileSync(testScssFile).toString().replace('\nbody { background: red; }', '');
        fs.writeFileSync(testScssFile, reset, { flag: 'w' });
      });
    });
  });

  describe('generating source-map for compiled css', function() {
    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        indentedSyntax: false,
        sourceMap: true
      }))
      .use(function(err, req, res, next) {
        res.statusCode = 500;
        res.end(err.message);
        next();
      });

    it('generates source-map with correct contents', function(done) {
      request(server)
        .get('/index.css')
        .expect(200, function() {
          var result = sass.renderSync({
            file: indexScssFile,
            indentedSyntax: false,
            outFile: indexCssFile,
            sourceMap: true
          });

          (function checkFile() {
            fs.exists(indexSourceMap, function(exists) {
              if (exists) {
                var cont = fs.readFileSync(indexSourceMap).toString();
                if (cont === result.map.toString()) {
                  return done();
                }
              }
              setTimeout(checkFile, 10);
            });
          }());
        });
    });
  });

  describe('compiling files with errors moves to next middleware with err', function() {
    // alter
    before(function() {
      fs.appendFileSync(testScssFile, '\nbody { background;: red; }');
    });

    it('if error is in the main file', function(done) {
      request(server)
        .get('/test.css')
        .expect('property "background" must be followed by a \':\'')
        .expect(500, done);
    });

    it('if error is in imported file', function(done) {
      request(server)
        .get('/index.css')
        .expect('property "background" must be followed by a \':\'')
        .expect(500, done);
    });

    // clean
    after(function() {
      var reset = fs.readFileSync(testScssFile).toString().replace('\nbody { background;: red; }', '');
      fs.writeFileSync(testScssFile, reset, { flag: 'w' });
    });
  });
});
