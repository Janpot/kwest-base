var kwest   = require('..'),
    express = require('express'),
    assert  = require('chai').assert;

describe('kwest-base', function () {

  var server;

  afterEach(function (done) {
    if (server) server.close(done);
    else done();
  });

  it('should make basic requests', function (done) {

    server = express()
      .get('/', function (req, res) {
        res.header('x-test', 'success');
        res.header('connection', 'close');
        res.end('hello');
      })
      .listen(3000, function () {
        var request = kwest();
        request('http://localhost:3000')
          .then(function (response) {
            assert.strictEqual(response.getHeader('x-test'), 'success');
            done();
          })
          .catch(done);
      });

  });

  it('should use a middleware', function (done) {

    server = express()
      .get('/', function (req, res) {
        res.header('connection', 'close');
        res.end();
      })
      .listen(3000, function () {
        var request = kwest();

        request.use(function (request, next) {
          return next(request).then(function (response) {
            response.setHeader('x-test', 'success');
            return response;
          });
        });

        request('http://localhost:3000')
          .then(function (response) {
            assert.strictEqual(response.getHeader('x-test'), 'success');
            done();
          })
          .catch(done);
      });

  });

});
