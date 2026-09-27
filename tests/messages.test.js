const test = require('node:test');
const assert = require('node:assert/strict');
const { extractMessage } = require('../lib/messages');

test('extractMessage maps Gmail headers and plain text body', () => {
  const body = Buffer.from('Hello from Gmail').toString('base64url');
  const message = extractMessage({
    id: 'message-1',
    threadId: 'thread-1',
    internalDate: '1700000000000',
    snippet: 'Hello',
    payload: {
      headers: [
        { name: 'From', value: 'Sender <sender@example.com>' },
        { name: 'Subject', value: 'A test message' },
        { name: 'Date', value: 'Tue, 14 Nov 2023 22:13:20 GMT' },
      ],
      mimeType: 'text/plain',
      body: { data: body },
    },
  }, 'owner@example.com', 'Inbox');

  assert.equal(message.id, 'message-1');
  assert.equal(message.accountEmail, 'owner@example.com');
  assert.equal(message.category, 'Inbox');
  assert.equal(message.sender, 'Sender <sender@example.com>');
  assert.equal(message.subject, 'A test message');
  assert.equal(message.body, 'Hello from Gmail');
  assert.equal(message.internalDate, 1700000000000);
});

test('extractMessage finds text in nested MIME parts and falls back for empty subject', () => {
  const body = Buffer.from('Nested body').toString('base64url');
  const message = extractMessage({
    id: 'message-2',
    payload: { parts: [{ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: body } }] }] },
  }, 'owner@example.com', 'Spam');

  assert.equal(message.subject, '(no subject)');
  assert.equal(message.body, 'Nested body');
});