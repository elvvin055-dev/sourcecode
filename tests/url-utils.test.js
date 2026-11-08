const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanUrl } = require('../src/url-utils.js');

test('recognizes an https address', () => assert.equal(cleanUrl('https://example.com/a'), 'https://example.com/a'));
test('adds https to a domain', () => assert.equal(cleanUrl('example.com'), 'https://example.com'));
test('converts ordinary text into a web search', () => assert.equal(cleanUrl('hello browser'), 'https://www.google.com/search?q=hello%20browser'));
test('blocks dangerous and non-web schemes from the address field', () => {
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'ftp://example.com', 'chrome://settings']) assert.equal(cleanUrl(value), '', value);
});
test('permits localhost for development', () => assert.equal(cleanUrl('localhost:8080'), 'https://localhost:8080'));
test('preserves query punctuation as a search query', () => assert.equal(cleanUrl('cats & dogs?'), 'https://www.google.com/search?q=cats%20%26%20dogs%3F'));
test('supports only configured engine names and defaults safely', () => assert.equal(cleanUrl('foo', 'not-an-engine'), 'https://www.google.com/search?q=foo'));
