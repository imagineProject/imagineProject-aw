/* global process */

// polyfill login for development purpose

import { validateSessionForComponent } from 'js/sessionManager.service';

const getXsrfToken = () => {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('XSRF-TOKEN='));
    return cookie ? cookie.split('=')[1] : '';
};

const baseUrl = window.location.origin;

const loginUser = process.env?.REACT_APP_LOGIN_USER;
const loginPass = process.env?.REACT_APP_LOGIN_PASS;

/**
 * post SOA request, a simplified version to avoid pulling dependencies
 * @param {string} serviceName service name
 * @param {string} operationName operation name
 * @param {Object} body body of the request
 * @returns {Promise<Response>} response of the request
 */
export const postSOA = async (
    serviceName,
    operationName,
    body = {}
    // options = {} as Record<string, boolean>,
) => {
    const resp = await fetch(`${baseUrl}/tc/RestServices/${serviceName}/${operationName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Cookie: getCookieString(),
            'X-XSRF-TOKEN': getXsrfToken(),
            'X-Siemens-Operation-Id': 'awLogin/1',
            'Log-Correlation-Id': 'awLogin/1'
            // 'X-Siemens-Session-Id': '998n30gh6',
            // different to different request
            // 'X-Correlation-Id': '6m7j7le70',
        },
        body: JSON.stringify({
            // SOA Header
            header: {
                policy: {},
                state: {
                    clientID: 'ActiveWorkspaceClient',
                    clientVersion: '10000.1.2',
                    enableServerStateHeaders: true,
                    formatProperties: true,
                    logCorrelationID: 'awLogin/1',
                    stateless: true
                }
            },
            // SOA Body
            body
        })
    });

    return resp;
};

/**
 * handle login
 * @returns {Promise<void>}
 */
export async function handleLogin() {
    try {
        await fetch(`${baseUrl}/getSessionVars?url=${baseUrl}/`);

        /*
        const resp1 = await postSOA('Internal-AWS2-2017-12-DataManagement', 'getTCSessionAnalyticsInfo', {
        });
        console.log('getSessionVars', resp1.status)
        */

        await postSOA('Core-2011-06-Session', 'login', {
            credentials: {
                descrimator: 'login-dev-service',
                user: loginUser,
                password: loginPass,
                locale: 'en_US',
                group: '',
                role: ''
            }
        });
        await validateSessionForComponent();
    } catch (err) {
        console.error('getSessionVars', err);
    }
}

