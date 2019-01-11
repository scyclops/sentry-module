
const Sentry = require('@sentry/node');
const { resolve } = require('path');
const logger = require('consola').withScope('nuxt:sentry');


module.exports = function (moduleOptions) {

    const defaults = {
        disabled: false,
        user_id: false,
        config: {}
    };

    const options = Object.assign({}, defaults, moduleOptions);

    if (options.disabled) { 
        logger.info('Sentry is disabled');
        return;
    }

    // client & server plugin
    this.addPlugin({
        src: resolve(__dirname, 'templates/sentry-plugin.js'),
        fileName: 'sentry-plugin.js',
        options: JSON.parse(JSON.stringify(options))
    });

    // must be after addPlugin b/c init will modify the config
    Sentry.init(options.config);

    // sentry errors reported through the functionality below won't have user data set 
    // (but it can probably be determined via cookies/access_token data in the request)
    //
    // it might be possible to add more info by using event processors and hints
    // https://docs.sentry.io/platforms/node/

    this.nuxt.hook(
        'render:setupMiddleware',
        app => { // app is a connect instance: https://www.npmjs.com/package/connect
            const sentryRequestHandler = Sentry.Handlers.requestHandler();

            // hack to make server side Sentry available to nuxt plugin so it can be injected and used during SSR
            app.use((req, res, next) => {
                req.$sentry = Sentry; 
                sentryRequestHandler(req, res, next);
            });
        }
    );

    this.nuxt.hook('render:errorMiddleware', app => app.use(Sentry.Handlers.errorHandler()));

    this.nuxt.hook('generate:routeFailed', ({ route, errors }) => {
        errors.forEach(({ error }) => Sentry.withScope(scope => {
            scope.setExtra('route', route);
            Sentry.captureException(error);
        }));
    });
}

