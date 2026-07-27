'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { z } = require('zod');
const fruits = require('./api/fruits');

const server = new McpServer({
  name: 'nodejs-crud',
  version: '1.0.0'
});

server.tool('list_fruits', 'List all fruits in the database', {}, async () => {
  const result = await fruits.findAll();
  return {
    content: [{ type: 'text', text: JSON.stringify(result.rows) }]
  };
});

server.tool(
  'get_fruit',
  'Get a single fruit by id',
  { id: z.number().int().positive().describe('Fruit id') },
  async ({ id }) => {
    const result = await fruits.find(id);
    if (result.rowCount === 0) {
      return { content: [{ type: 'text', text: `Fruit ${id} not found` }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }] };
  }
);

server.tool(
  'create_fruit',
  'Add a new fruit to the database',
  {
    name: z.string().min(1).max(40).describe('Fruit name'),
    stock: z.number().int().min(0).describe('Stock quantity')
  },
  async ({ name, stock }) => {
    const result = await fruits.create(name, stock);
    return { content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }] };
  }
);

server.tool(
  'update_fruit',
  'Update an existing fruit by id',
  {
    id: z.number().int().positive().describe('Fruit id'),
    name: z.string().min(1).max(40).describe('New name'),
    stock: z.number().int().min(0).describe('New stock quantity')
  },
  async ({ id, name, stock }) => {
    const result = await fruits.update({ id, name, stock });
    if (result.rowCount === 0) {
      return { content: [{ type: 'text', text: `Fruit ${id} not found` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Fruit ${id} updated` }] };
  }
);

server.tool(
  'delete_fruit',
  'Delete a fruit by id',
  { id: z.number().int().positive().describe('Fruit id') },
  async ({ id }) => {
    const result = await fruits.remove(id);
    if (result.rowCount === 0) {
      return { content: [{ type: 'text', text: `Fruit ${id} not found` }], isError: true };
    }
    return { content: [{ type: 'text', text: `Fruit ${id} deleted` }] };
  }
);

// Map session id -> transport instance
const transports = {};

module.exports = { server, SSEServerTransport, transports };
