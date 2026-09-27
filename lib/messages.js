function getHeader(headers = [], name) {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decodeBody(data = '') {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function findBodyPart(part, mimeType) {
  if (part.mimeType === mimeType && part.body?.data) return decodeBody(part.body.data);
  for (const child of part.parts ?? []) {
    const body = findBodyPart(child, mimeType);
    if (body) return body;
  }
  return '';
}

function extractMessage(message, accountEmail, category) {
  const headers = message.payload?.headers ?? [];
  const html = findBodyPart(message.payload ?? {}, 'text/html');
  const text = findBodyPart(message.payload ?? {}, 'text/plain');

  return {
    id: message.id,
    threadId: message.threadId,
    accountEmail,
    category,
    sender: getHeader(headers, 'from'),
    subject: getHeader(headers, 'subject') || '(no subject)',
    date: getHeader(headers, 'date'),
    internalDate: Number(message.internalDate) || 0,
    snippet: message.snippet ?? '',
    body: text || html || message.snippet || '',
  };
}

module.exports = { extractMessage };