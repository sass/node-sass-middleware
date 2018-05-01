/*global describe it*/
'use strict';

var fs = require('fs'),
    path = require('path'),
    request = require('supertest'),
    connect = require('connect'),
    middleware = require('../middleware'),
    fixture = path.join.bind(null, __dirname, 'fixtures'),
    testCssFile = fixture('test.css'),
    indexCssFile = fixture('index.css'),
    indexScssFile = fixture('index.scss'),
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

describe('Spawning test server', function() {
  it('starts the server', function(done) {
    var serverStartupTimeout = 950;
    spawnedServer = spawn('node', [fixture('test-server.js')]);

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
    var expected = '[sass]  \u001b[90msource:\u001b[0m \u001b[36m' + indexScssFile + ' \u001b[0m';

    http.request({ method: 'GET', host: 'localhost', port: process.env.PORT || '8000', path: '/index.css' })
      .end();

    spawnedServer.stdout.once('data', function(data) {
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
        fs.unlinkSync(indexCssFile);
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

  it('should produce beep ', function(done) {
    this.timeout(this.timeout() + 55500);
    // setup
    var testScssFile = fixture('test2.scss');
    var content = fs.readFileSync(fixture('test.scss')) + '\nbody { background;: red; }';
    fs.writeFileSync(testScssFile, content, { flag: 'w' });

    var expectedKey = '\x07\x1B';

    http.request({ method: 'GET', host: 'localhost', port: process.env.PORT || '8000', path: '/test2.css' })
      .end();

    spawnedServer.stderr.on('data', function(data) {
      // skip until we get the error
      if (data.indexOf('[sass]  \x1B[90merror:') !== 0) {
        return;
      }

      data.toString().should.containEql(expectedKey);

      fs.unlinkSync(testScssFile);
      done();
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
    .use(function(err, req, res) {
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
        fs.exists(testCssFile, function(exists) {
          if (exists) {
            fs.unlinkSync(testCssFile);
          }
        });
        done();
      });
  });
});

describe('Killing test server', function() {
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
