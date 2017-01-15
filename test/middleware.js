'use strict';
var fs = require('fs'),
    path = require('path'),
    should = require('should'),
    sass = require('node-sass'),
    request = require('supertest'),
    connect = require('connect'),
    middleware = require('../middleware'),
    fixture = path.join.bind(null, __dirname, 'fixtures'),
    test_cssFile = fixture('test.css'),
    test_sassFile = fixture('test.sass'),
    test_scssFile = fixture('test.scss'),
    index_cssFile = fixture('index.css'),
    index_sassFile = fixture('index.sass'),
    index_scssFile = fixture('index.scss'),
    index_sourceMap = fixture('index.css.map'),
    spawn = require('child_process').spawn,
    http = require('http');

describe('Creating middleware', function() {

  it('throws an error when omitting src', function() {
    middleware.should.throw(/requires "src"/);
  });

  it('returns function when invoked with src option', function() {
    middleware({ src: __dirname }).should.be.type('function');
  });

  it('can be given a string as the src option', function() {
    middleware(__dirname).should.be.type('function');
  });

});

var spawnedServer;

describe('Spawning example server', function() {
  it('starts the server', function(done) {
    var serverStartupTimeout = 950;
    spawnedServer = spawn('node', [fixture('example-server.js')]);

    // exclude serverStartupTimeout from timeout and slow counters of test runs
    this.timeout(this.timeout() + serverStartupTimeout);
    this.slow(this.slow() + serverStartupTimeout);

    setTimeout(function() {
      (spawnedServer.killed).should.be.false();
      (spawnedServer.exitCode === null).should.be.true();
      done();
    }, serverStartupTimeout);
  });
});

describe('Log messages', function() {
  it('should use the default logger when none provided', function(done) {
    var expected = '[sass]  \u001b[90msource:\u001b[0m \u001b[36m' + index_scssFile + ' \u001b[0m';

    http.request({ method: 'GET', host: 'localhost', port: process.env.PORT || '8000', path: '/index.css' })
        .end();

    spawnedServer.stderr.once('data', function(data) {
      data.toString().should.startWith(expected);
      done();
    });
  });

  it('should use the provided custom logger', function(done) {
    var loggerArguments;

    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        debug: true,
        log: function() {
          loggerArguments = arguments;
        }
      }));

    request(server)
      .get('/index.css')
      .expect(200, function() {
        fs.unlink(index_cssFile);
        loggerArguments[0].should.equal('debug');
        done();
      });
  });

  it('should skip fast when requested path is missing the prefix', function(done) {
    this.timeout(this.timeout() + 500);

    var loggerArguments;
    var dest = '/some/static-css/directory/file.css';

    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        debug: true,
        prefix: '/foo/bar',
        log: function() {
          loggerArguments = arguments;
        }
      }));

    request(server)
      .get(dest)
      .expect(200, function() {
        loggerArguments[1].should.equal('skip');
        loggerArguments[2].should.equal(dest);
        loggerArguments[3].should.equal('prefix mismatch');
        done();
      });
  });

  it('should skip when requested path is not suffixed by css', function(done) {
    this.timeout(this.timeout() + 500);

    var loggerArguments;
    var dest = '/assets/file.mp4';

    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        debug: true,
        prefix: '/foo/bar',
        log: function() {
          loggerArguments = arguments;
        }
      }));

    request(server)
      .get(dest)
      .expect(200, function() {
        loggerArguments[1].should.equal('skip');
        loggerArguments[2].should.equal(dest);
        loggerArguments[3].should.equal('nothing to do');
        done();
      });
  });

});

function setupBeforeEach() {
  beforeEach(function(done) {
    fs.exists(test_cssFile, function(exists) {
      if (exists) {
        fs.unlink(test_cssFile);
      }
    });

    fs.exists(index_cssFile, function(exists) {
      if (exists) {
        fs.unlink(index_cssFile);
      }
    });

    fs.exists(index_sourceMap, function(exists) {
      if (exists) {
        fs.unlink(index_sourceMap);
      }
    });

    done();
  });
}

describe('Using middleware to compile .scss', function() {
  var server = connect()
    .use(middleware({
      src: fixture(),
      dest: fixture()
    }))
    .use(function(err, req, res, next) {
      res.statusCode = 500;
      res.end(err.message);
    });

  setupBeforeEach();

  describe('successful file request', function() {

    it('serves a file with 200 Content-Type css', function(done) {
      request(server)
        .get('/test.css')
        .set('Accept', 'text/css')
        .expect('Content-Type', /css/)
        .expect(200, done);
    });

    it('serves the compiled contents of the relative scss file', function(done) {
      var filesrc = fs.readFileSync(test_scssFile),
          result = sass.renderSync({ data: filesrc.toString() });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(test_scssFile),
          result = sass.renderSync({ data: filesrc.toString() });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            if (fs.existsSync(test_cssFile)) {
              fs.readFileSync(test_cssFile).toString().should.equal(result.css.toString());
              done();
            } else {
              done(new Error('file was not written before request ends'));
            }
          }
        });
    });

    it('only writes the compiled contents out to the expected file without serving them', function(done) {
      var filesrc = fs.readFileSync(test_scssFile),
          result = sass.renderSync({ data: filesrc.toString() }),
          anotherResponse = 'something else',
          server = connect()
          .use(middleware({
            response: false,
            src: fixture(),
            dest: fixture()
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
            fs.readFileSync(test_cssFile).toString().should.equal(result.css.toString());
            done();
          }
        });
    });

  });

  describe('unsucessful file request', function() {

    it('moves to next middleware', function(done) {
      request(server)
        .get('/does-not-exist.css')
        .expect('Cannot GET /does-not-exist.css\n')
        .expect(404, done);
    });

  });

  describe('compiling files with dependencies (source file contains includes)', function() {

    it('serves the compiled contents of the relative scss file', function(done) {
      var filesrc = fs.readFileSync(index_scssFile),
          result = sass.renderSync({ data: filesrc.toString() });
      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(index_scssFile),
          result = sass.renderSync({ data: filesrc.toString() });

      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            (function checkFile() {
              if (fs.existsSync(index_cssFile)) {
                fs.readFileSync(index_cssFile).toString().should.equal(result.css.toString());
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
            fs.stat(index_cssFile, function(err, initialDate) {
              if (initialDate != undefined) {
                fs.appendFile(test_scssFile, '\nbody { background: red; }', function(err, data) {
                  if (err) throw err;

                  var filesrc = fs.readFileSync(index_scssFile),
                      result = sass.renderSync({ data: filesrc.toString() });

                  request(server)
                    .get('/index.css')
                    .expect(200, function() {
                      (function checkRecompiledFile() {
                        var cont = fs.readFileSync(index_cssFile).toString();
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
        var reset = fs.readFileSync(test_scssFile).toString().replace('\nbody { background: red; }', '');
        fs.writeFileSync(test_scssFile, reset, { flag: 'w' });
      });
    });

  });

  describe('generating source-map for compiled css', function() {
    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        sourceMap: true
      }))
      .use(function(err, req, res, next) {
        res.statusCode = 500;
        res.end(err.message);
      });

    it('generates source-map with correct contents', function(done) {
      request(server)
        .get('/index.css')
        .expect(200, function() {
          var filesrc = fs.readFileSync(index_scssFile),
              result = sass.renderSync({ file: index_scssFile, outFile: index_cssFile, sourceMap: true });

          (function checkFile() {
            fs.exists(index_sourceMap, function(exists) {
              if (exists) {
                var cont = fs.readFileSync(index_sourceMap).toString();
                if (cont === result.map.toString()) {
                  done();
                }
              } else {
                setTimeout(checkFile, 10);
              }
            });
          }());
        });
    });

  });

  describe('compiling files with errors moves to next middleware with err', function() {

    // alter
    before(function() {
      fs.appendFileSync(test_scssFile, '\nbody { background;: red; }');
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
      var reset = fs.readFileSync(test_scssFile).toString().replace('\nbody { background;: red; }', '');
      fs.writeFileSync(test_scssFile, reset, { flag: 'w' });
    });
  });

});

describe('Using middleware to compile .sass', function() {
  var server = connect()
    .use(middleware({
      src: fixture(),
      dest: fixture(),
      indentedSyntax: true
    }))
    .use(function(err, req, res, next) {
      res.statusCode = 500;
      res.end(err.message);
    });

  setupBeforeEach();

  describe('successful file request', function() {

    it('serves a file with 200 Content-Type css', function(done) {
      request(server)
        .get('/test.css')
        .set('Accept', 'text/css')
        .expect('Content-Type', /css/)
        .expect(200, done);
    });

    it('serves the compiled contents of the relative sass file', function(done) {
      var filesrc = fs.readFileSync(test_sassFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: true });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(test_sassFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: true });
      request(server)
        .get('/test.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            (function checkFile() {
              if (fs.existsSync(test_cssFile)) {
                fs.readFileSync(test_cssFile).toString().should.equal(result.css.toString());
                done();
              } else {
                setTimeout(checkFile, 25);
              }
            }());
          }
        });
    });

  });

  describe('unsucessful file request', function() {

    it('moves to next middleware', function(done) {
      request(server)
        .get('/does-not-exist.css')
        .expect('Cannot GET /does-not-exist.css\n')
        .expect(404, done);
    });

  });

  describe('compiling files with dependencies (source file contains includes)', function() {

    it('serves the compiled contents of the relative sass file', function(done) {
      var filesrc = fs.readFileSync(index_sassFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: true });
      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, done);
    });

    it('writes the compiled contents out to the expected file', function(done) {
      var filesrc = fs.readFileSync(index_sassFile),
          result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: true });

      request(server)
        .get('/index.css')
        .expect(result.css.toString())
        .expect(200, function(err) {
          if (err) {
            done(err);
          } else {
            (function checkFile() {
              if (fs.existsSync(index_cssFile)) {
                fs.readFileSync(index_cssFile).toString().should.equal(result.css.toString());
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
            fs.stat(index_cssFile, function(err, initialDate) {
              if (initialDate != undefined) {
                fs.appendFile(test_sassFile, '\nbody\n\tbackground: red', function(err, data) {
                  if (err) throw err;

                  var filesrc = fs.readFileSync(index_sassFile),
                      result = sass.renderSync({ data: filesrc.toString(), indentedSyntax: true });

                  request(server)
                    .get('/index.css')
                    .expect(200, function() {
                      (function checkRecompiledFile() {
                        var cont = fs.readFileSync(index_cssFile).toString();
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
        var reset = fs.readFileSync(test_sassFile).toString().replace('\nbody\n\tbackground: red', '');
        fs.writeFileSync(test_sassFile, reset, { flag: 'w' });
      });
    });

  });

  describe('generating source-map for compiled css', function() {
    var server = connect()
      .use(middleware({
        src: fixture(),
        dest: fixture(),
        indentedSyntax: true,
        sourceMap: true
      }))
      .use(function(err, req, res, next) {
        res.statusCode = 500;
        res.end(err.message);
      });

    it('generates source-map with correct contents', function(done) {
      request(server)
        .get('/index.css')
        .expect(200, function() {
          var filesrc = fs.readFileSync(index_scssFile),
              result = sass.renderSync({ file: index_sassFile, indentedSyntax: true, outFile: index_cssFile, sourceMap: true });

          (function checkFile() {
            fs.exists(index_sourceMap, function(exists) {
              if (exists) {
                var cont = fs.readFileSync(index_sourceMap).toString();
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
      fs.appendFileSync(test_sassFile, '\nbody\n\tbackground;: red');
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
      var reset = fs.readFileSync(test_sassFile).toString().replace('\nbody\n\tbackground;: red', '');
      fs.writeFileSync(test_sassFile, reset, { flag: 'w' });
    });
  });

});

describe('Checking for http headers', function() {
  var oneDay = 60 * 60 * 24; // one day
  var server = connect()
    .use(middleware({
      src: fixture(),
      dest: fixture(),
      maxAge: oneDay
    }))
    .use(function(err, req, res, next) {
      res.statusCode = 500;
      res.end(err.message);
    });

  it('custom max-age is set', function(done) {
    request(server)
    .get('/test.css')
    .set('Accept', 'text/css')
    .expect('Cache-Control', 'max-age=' + oneDay)
    .expect(200, function() {
      // delete file
      fs.exists(test_cssFile, function(exists) {
        if (exists) {
          fs.unlink(test_cssFile);
        }
      });
      done();
    });
  });

});

describe('Killing example server', function() {
  it('stops the server', function(done) {
    spawnedServer.kill();
    var serverShutdownTimeout = 500;

    // exclude serverStartupTimeout from timeout and slow counters of test runs
    this.timeout(this.timeout() + serverShutdownTimeout);
    this.slow(this.slow() + serverShutdownTimeout);

    setTimeout(function() {
      (spawnedServer.killed).should.be.true();
      done();
    }, serverShutdownTimeout);
  });
});
