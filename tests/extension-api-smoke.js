const path = require('node:path');
const { app, session } = require('electron');

const extensionPath = path.resolve(process.argv[2] || '');
if (process.env.NOVA_TEST_USER_DATA) app.setPath('userData', path.resolve(process.env.NOVA_TEST_USER_DATA));
app.whenReady().then(async () => {
  try {
    const testSession = session.fromPartition('persist:nova-extension-api-smoke');
    const extension = await testSession.extensions.loadExtension(extensionPath, { allowFileAccess: false });
    const listed = testSession.extensions.getAllExtensions().some(item => item.id === extension.id);
    if (!listed || !extension.id || extension.version !== '1.0.0') throw new Error('Extension load did not return the expected registered extension.');
    console.log(JSON.stringify({ status: 'PASS', id: extension.id, name: extension.name, version: extension.version }));
    app.quit();
  } catch (error) {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
    app.exit(1);
  }
});
