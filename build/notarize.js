// build/after-sign-hook.js
const { notarize } = require('electron-notarize');

module.exports = async function afterSignHook(context) {
  const { electronPlatformName, appOutDir } = context;

  // On ne notarise que la version macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  console.log("• Notarization process started...");

  // Nom du .app généré
  const appName = context.packager.appInfo.productFilename;

  try {
    await notarize({
      appBundleId: 'com.corecast.app', // Mettez votre propre appId
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      ascProvider: process.env.ASC_PROVIDER // facultatif si vous n'en avez pas besoin
    });
    console.log("✔ Notarization completed successfully!");
  } catch (error) {
    console.error("✖ Notarization failed:", error);
    throw error;
  }
};
