'use strict';

/*
 *
 *  Copyright 2016-2017 Red Hat, Inc, and individual contributors.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

const logger = require('./logger.js');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const db = require('./lib/db');

const fruits = require('./lib/routes/fruits');

let mcpServer, SSEServerTransport, StreamableHTTPServerTransport, transports;
try {
  const mcp = require('./lib/mcp');
  mcpServer = mcp.server;
  SSEServerTransport = mcp.SSEServerTransport;
  StreamableHTTPServerTransport = mcp.StreamableHTTPServerTransport;
  transports = mcp.transports;
  logger.info('MCP module loaded');
} catch (err) {
  logger.error({ err }, 'Failed to load MCP module');
}

app.use(bodyParser.json());
app.use((error, request, response, next) => {
  if (request.body === '' || (error instanceof SyntaxError && error.type === 'entity.parse.failed')) {
    response.status(415);
    return response.send('Invalid payload!');
  }

  next();
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', fruits);

// MCP SSE endpoint — clients connect here to receive server-sent events
if (mcpServer && SSEServerTransport && StreamableHTTPServerTransport && transports) {
  // Legacy SSE transport
  app.get('/mcp/sse', async (request, response) => {
    const transport = new SSEServerTransport('/mcp/messages', response);
    transports[transport.sessionId] = transport;
    response.on('close', () => {
      delete transports[transport.sessionId];
    });
    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (request, response) => {
    const sessionId = request.query.sessionId;
    const transport = transports[sessionId];
    if (!transport) {
      response.status(400).send('Unknown session');
      return;
    }
    await transport.handlePostMessage(request, response);
  });

  // Streamable HTTP transport (MCP spec 2025-03-26)
  app.all('/mcp', async (request, response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(request, response);
  });

  logger.info('MCP routes registered at /mcp, /mcp/sse and /mcp/messages');
} else {
  logger.error('MCP routes NOT registered — module failed to load');
}

// Add a health check
app.use('/ready', (request, response) => {
  return response.sendStatus(200);
});

app.use('/live', (request, response) => {
  return response.sendStatus(200);
});

db.init().then(() => {
  logger.info('Database init\'d');
}).catch(error => {
  logger.error(error);
});

module.exports = app;
