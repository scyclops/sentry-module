
import Vue from 'vue';
import * as Sentry from '@sentry/browser';
import { get } from 'shvl';

export default async (ctx, inject) => {

    // ctx has req & res which are from the node.js server
    let sentry;

    if (process.server) {
        sentry = ctx.req.$sentry;
    } else {
        const opts = Object.assign({}, <%= JSON.stringify(options.config) %>, {

            // TODO: try using fewer integrations and see how that affects final package size..
            //       b/c there are 9 default integrations
            //       of which, the bigger ones are: breadcrumbs, trycatch, inboundfilters, dedupe
            //       but probably don't want to remove dedupe or breadcrumbs
            //       inboundfilters okay to remove if unused
            //
            // https://docs.sentry.io/platforms/javascript/default-integrations/
            // https://github.com/getsentry/sentry-javascript/tree/master/packages/browser/src/integrations
            // https://github.com/getsentry/sentry-javascript/tree/master/packages/core/src/integrations

            // use the defaults + Vue
            integrations: [new Sentry.Integrations.Vue({ Vue })]

        });

        Sentry.init(opts);

        sentry = Sentry;
    }

    // wrapper to set user scope & context tag
    function callSentry(method, arg, options) {
        sentry.withScope(scope => {
            <% if (options.user_id) { %>
            let user_id = get(ctx.store.state, <%= serialize(options.user_id) %>);
            if (user_id) {
                scope.setUser({id: user_id});
            }
            <% } %>

            options = options || {};

            if (options.tags) {
                Object.keys(options.tags).forEach(k => {
                    scope.setTag(k, options.tags[k]);
                });
            }

            if (options.extra) {
                Object.keys(options.extra).forEach(k => {
                    scope.setExtra(k, options.extra[k]);
                });
            }

            scope.setTag('context', process.server ? 'server-plugin' : 'client-plugin');

            // XXX: could pass the whole state of the vuex store
            //      and maybe the current page/components state..

            sentry[method](arg);
        });
    }

    // make this.$sentry & app.$sentry provide access to sentry reporting
    // and changed capture method names to make it clear they are not the standard sentry API calls
    inject('sentry', {
        captureErr: (err, options) => callSentry('captureException', err, options),
        captureMsg: (msg, options) => callSentry('captureMessage', msg, options),
    });

}
