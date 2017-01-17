/*global beforeEach*/
'use strict';

var fs = require('fs');

exports.setupBeforeEach = function(testCssFile, indexCssFile, indexSourceMap) {
  beforeEach(function(done) {
    fs.exists(testCssFile, function(exists) {
      if (exists) {
        fs.unlink(testCssFile);
      }
    });

    fs.exists(indexCssFile, function(exists) {
      if (exists) {
        fs.unlink(indexCssFile);
      }
    });

    fs.exists(indexSourceMap, function(exists) {
      if (exists) {
        fs.unlink(indexSourceMap);
      }
    });

    done();
  });
};
