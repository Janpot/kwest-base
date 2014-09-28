'use strict';

var Promise  = require('bluebird'),
    urlUtil  = require('url'),
    caseless = require('caseless'),
    defaults = require('merge-defaults'),
    http     = require('http'),
    https    = require('https');

function isParsedUrl(url) {
  return url.protocol && (url.host || url.hostname);
}

function readUri(options) {
  if (!options) {
    return undefined;
  } if (typeof options === 'string') {
    return urlUtil.parse(options);
  } else if (typeof options.uri === 'string') {
    return urlUtil.parse(options.uri);
  } else if (isParsedUrl(options.uri)) {
    return options.uri;
  }
  return undefined;
}

function buildRequestObject(options) {
  var uri = readUri(options);

  if (!uri) {
    throw new Error('Must define at least a valid uri');
  }

  var request = {
    _isKwest: true,
    uri: uri,
    method: options.method || 'GET'
  };

  caseless.httpify(request, options.headers || {});
  defaults(request, options);
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


function init(initial) {

  if (typeof initial !== 'function') {
    initial = defaultMakeRequest;
  }

  function makeRequest(options) {
    return Promise.try(function () {
      var request = buildRequestObject(options);
      return initial(request);
    });
  }

  function use(middleware) {
    var oldNext = initial;
    initial = function (request) {
      return middleware(request, oldNext);
    };
    return makeRequest;
  }

  makeRequest.use = use;
  return makeRequest;

}


module.exports = init;
