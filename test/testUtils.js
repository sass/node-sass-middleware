'use strict';
var fs = require('fs');

exports.setupBeforeEach = function (test_cssFile, index_cssFile, index_sourceMap) {
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
};
