const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const callbacks = new WeakMap();
const allowedEvents = new Set(['browser:open-url', 'browser:new-tab', 'browser:close-tab', 'browser:reload', 'browser:toggle-devtools', 'download:update']);
const bridge = {
  getStore: name => invoke('store:get', name), setStore: (name, value) => invoke('store:set', name, value),
  openPrivateWindow: () => invoke('app:private-window'), isPrivate: () => invoke('app:private-mode'),
  saveCapture: (name, dataUrl) => invoke('dialog:save-file', name, dataUrl),
  securityStatus: () => invoke('security:status'), saveKey: value => invoke('secrets:save', value), clearKey: () => invoke('secrets:clear'), askAI: payload => invoke('ai:ask', payload),
  showInFinder: file => invoke('shell:show-item', file), controlDownload: (id, action) => invoke('download:control', id, action),
  protectionStatus: host => invoke('protection:status', host), setSiteProtection: (host, disabled) => invoke('protection:set-site', host, disabled),
  getPermissions: () => invoke('permissions:get'), clearPermissions: () => invoke('permissions:clear'), clearSiteData: () => invoke('data:clear-site-data'),
  passwordStatus: () => invoke('passwords:status'), listPasswords: () => invoke('passwords:list'), savePassword: entry => invoke('passwords:save', entry),
  revealPassword: (id, origin) => invoke('passwords:reveal', id, origin), deletePassword: id => invoke('passwords:delete', id), generatePassword: length => invoke('passwords:generate', length),
  listExtensions: () => invoke('extensions:list'), installExtension: () => invoke('extensions:install'), setExtensionEnabled: (id, enabled) => invoke('extensions:set-enabled', id, enabled), removeExtension: id => invoke('extensions:remove', id),
  showNotification: (title, body) => invoke('notifications:show', title, body),
  on(channel, callback) {
    if (!allowedEvents.has(channel) || typeof callback !== 'function') return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on(channel, listener); callbacks.set(callback, { channel, listener });
    return () => { ipcRenderer.removeListener(channel, listener); callbacks.delete(callback); };
  }
};
contextBridge.exposeInMainWorld('nova', Object.freeze(bridge));
