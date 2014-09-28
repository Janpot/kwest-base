'use strict';

var Promise  = require('bluebird'),
    urlUtil  = require('url'),
    caseless = require('caseless'),
    defaults = require('merge-defaults'),
    http     = require('http'),
    https    = require('https');

function isParsedUrl(url) {
  return url && url.protocol && (url.host || url.hostname);
}

function buildRequestObject(options) {
  if (!isParsedUrl(options.uri)) {
    throw new Error('Must define at least a valid parsed url object');
  }

  var request = {
    uri: options.uri,
    method: options.method || 'GET'
  };
  caseless.httpify(request, options.headers || {});
  defaults(request, options);

  return request;
}


function toHttpOptions(request) {
  var options = {};
  Object.keys(request)
    .filter(function (key) {
      return key !== 'uri';
    })
    .forEach(function (key) {
      options[key] = request[key];
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

  function fork() {
    return init(initial);
  }

  function use(middleware) {
    var oldNext = initial;
    initial = function (request) {
      return middleware(request, oldNext);
    };
    return makeRequest;
  }

  makeRequest.fork = fork;
  makeRequest.use = use;
  return makeRequest;

}


module.exports = init;
