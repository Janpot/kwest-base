'use strict';

var Promise  = require('bluebird'),
    urlUtil  = require('url'),
    caseless = require('caseless'),
    http     = require('http'),
    https    = require('https');

function isParsedUrl(url) {
  return url.protocol && (url.host || url.hostname);
}

function buildRequestObject(options) {
  if (options._isKwest) {
    return options;
  }

  var uri;

  if (typeof options === 'string') {
    uri = urlUtil.parse(options);
  } else if (typeof options.uri === 'string') {
    uri = urlUtil.parse(options.uri);
  } else if (isParsedUrl(options.uri)) {
    uri = options.uri;
  } else {
    throw new Error('Must define at least a valid uri');
  }

  var request = {
    _isKwest: true,
    uri: uri,
    method: options.method || 'GET'
  };

  caseless.httpify(request, options.headers || {});

  if (typeof options === 'object') {
    var dontCopyKeys = Object.keys(request);

    Object.keys(options)
      .filter(function (key) {
        return dontCopyKeys.indexOf(key) >= 0;
      })
      .forEach(function (key) {
        request[key] = options[key];
      });
  }

  return request;
}


function toHttpOptions(request) {
  var options = {};
  Object.keys(request)
    .forEach(function (key) {
      switch (key) {
        case '_isKwest': return;
        case 'uri': return;
        default: options[key] = request[key];
      }
    });
  options.hostname = request.uri.hostname;
  options.port = request.uri.port;
  options.path = request.uri.path;
  return options;
}


function kwestifyResponse(response) {
  caseless.httpify(response, response.headers || {});
  response.data = response;
  return response;
}


var defaultMakeRequest = function (request) {
  var protocol = {
    'http:' : http,
    'https:': https
  }[request.uri.protocol];

  var options = toHttpOptions(request),
      req;

  var responsePromise = new Promise(function (resolve, reject) {
    req = protocol.request(options)
      .on('response', resolve)
      .on('error', reject);
  })
    .then(kwestifyResponse)
    .cancellable()
    .catch(Promise.CancellationError, function (err) {
      req.abort();
      throw(err);
    });

  req.end();
  return responsePromise;
};


function init(next) {

  if (typeof next !== 'function') {
    next = defaultMakeRequest;
  }

  function makeRequest(options) {
    return Promise.try(function () {
      var request = buildRequestObject(options);
      return next(request);
    });
  }

  function fork() {
    return init(next);
  }

  function use(middleware) {
    var oldNext = next;
    next = function (request) {
      return middleware(request, oldNext);
    };
    return makeRequest;
  }


  makeRequest.fork = fork;
  makeRequest.use = use;
  return makeRequest;

}


module.exports = init;
