'use strict';

var should = require('should'),
  middleware = require('../middleware');

var css;

/**
 * Unit tests
 */
describe('Middleware Unit Tests:', function() {
  beforeEach(function(done) {
    css = 'body {' +
      'ul { margin: 0;' +
      'li { margin: 0; }' +
      '}' +
      '}'

    done();
  });

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
});
