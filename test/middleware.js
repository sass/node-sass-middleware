'use strict';

var should = require('should'),
  request = require('supertest'),
  http = require('http'),
  middleware = require('../middleware');

var server = http.createServer(function(req, res) {
  /**
   * not sure what goes here
   * have to figure out how to do the necessary routing
   */
});

/**
 * Unit tests
 */
describe('Middleware Unit Tests:', function() {
  it('should throw an error when omitting src', function(done) {
    try {
      middleware({
        // omitting the src attribute, plus some others for brevity
      });
    } catch(err) {
      should.exist(err);
      done();
    }
  });

  it('should create a .css file when giving a valid options object and making a GET request', function(done) {
    middleware({
      src: 'test.scss',
      dest: 'test.css'
    });

    request(server)
      .get('/css/test.css')
      .set('Accept', 'text/css')
      .expect('Content-Type', /css/)
      .expect(200, done);
  });
});
