(function (root) {
  const searchEngines = { Google: 'https://www.google.com/search?q=', DuckDuckGo: 'https://duckduckgo.com/?q=', Bing: 'https://www.bing.com/search?q=' };
  function cleanUrl(input, engine = 'Google') {
    const value = String(input || '').trim();
    if (!value) return '';
    if (/^(javascript|data|file|chrome|devtools):/i.test(value)) return '';
    if (/^(https?:\/\/|about:blank$)/i.test(value)) return value;
    if (/^[\w-]+:\/\//.test(value)) return '';
    if (/^(localhost|(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\])(?::\d+)?(?:\/|$)/i.test(value) || (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(value) && !/\s/.test(value))) return `https://${value}`;
    return (searchEngines[engine] || searchEngines.Google) + encodeURIComponent(value);
  }
  const api = Object.freeze({ cleanUrl });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NovaUrl = api;
})(typeof window !== 'undefined' ? window : null);
