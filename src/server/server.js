import express from 'express';
import config from './config';
import webpack from 'webpack';
import helmet from 'helmet';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { renderRoutes } from 'react-router-config';
import { StaticRouter } from 'react-router-dom';
import serverRoutes from '../frontend/routes/serverRoutes';
import reducer from '../frontend/reducers';
import initialState from '../frontend/initialState';
import getManifest from './getManifest';

const { env, port } = config;

const app = express();

if (env === 'development') {
  console.log('Development config');
  // eslint-disable-next-line global-require
  const webpackConfig = require('../../webpack.config.dev');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webPackHotMiddleware = require('webpack-hot-middleware');
  const compiler = webpack(webpackConfig);
  const serverConfig = { port: port, hot: true };

  app.use(webpackDevMiddleware(compiler, serverConfig));
  app.use(webPackHotMiddleware(compiler));
}else{
  app.use((req, res, next) => {
    if(!req.hashManifest) req.hashManifest = getManifest();
    next();
  });
  app.use(express.static(`${__dirname}/public`));
 // app.use(helmet());
  app.use(helmet({contentSecurityPolicy: false,}), );
  //app.use(helmet.permittedCrossDomainPolicies());
  app.disable('x-powered-by');
  //app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: 'none' }));
  //app.disable('x-powered-by');
}

const setResponse = (html, preloadedState, manifest) => {
  const mainStyles = manifest ? manifest['main.css'] : 'assets/app.css';
  const mainBuild = manifest ? manifest['main.js'] : 'assets/app.js';
  const vendorBuild = manifest ? manifest['vendors.js'] : 'assets/vendor.js';

  return(`
  <!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="${mainStyles}" type="text/css">
        <title>Platzi Video</title>
      </head>
      <body>
        <div id="app">${html}</div>
        <script>
          // WARNING: See the following for security issues around embedding JSON in HTML:
          // https://redux.js.org/recipes/server-rendering/#security-considerations
          window.__PRELOADED_STATE__ = ${JSON.stringify(preloadedState).replace(/</g,'\\u003c')}
        </script>
        <script src="${mainBuild}" type="text/javascript"></script>
        <script src="${vendorBuild}" type="text/javascript"></script>
      </body>
    </html>
    `);
}

const renderApp = (req, res) => {
  const store = createStore(reducer, initialState);
  const preloadedState = store.getState();
  const html = renderToString(
    <Provider store={store}>
      <StaticRouter location={req.url} context={{}}>
        {renderRoutes(serverRoutes)}
      </StaticRouter>
    </Provider>,
  );
  res.send(setResponse(html, preloadedState, req.hashManifest));
};

app.get('*', renderApp);

app.listen(port, (err) => {
  if(err) console.log(err);
  else console.log(`Server running => http://localhost:${port}/`);
});