const app = require('../server');

module.exports = (request, response) => {
  if (!request.url.startsWith('/api/')) {
    const queryStart = request.url.indexOf('?');
    const pathname = queryStart === -1 ? request.url : request.url.slice(0, queryStart);
    const query = queryStart === -1 ? '' : request.url.slice(queryStart);
    request.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`;
  }
  return app(request, response);
};