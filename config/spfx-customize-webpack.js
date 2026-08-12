module.exports = function customizeWebpackConfiguration(webpackConfiguration) {
  if (!webpackConfiguration || !webpackConfiguration.devServer) {
    return;
  }

  // SharePoint expects a plain AMD bundle from localhost. The webpack-dev-server
  // client/HMR bootstrap changes the module shape and breaks command-set loading.
  webpackConfiguration.devServer.hot = false;
  webpackConfiguration.devServer.liveReload = false;
  webpackConfiguration.devServer.client = false;
};
