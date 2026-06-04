/* eslint-env node */

module.exports = {
    extends: '../../.eslintrc.js',
    rules: {
        'dot-notation': 1,
        'max-nested-callbacks': [ 'error', 7 ],
        'no-else-return': 1,
        'no-trailing-spaces': 1,
        'padded-blocks': [ 'warn', 'never' ],
        quotes: [ 'warn', 'single' ],
        'space-in-parens': [ 'warn', 'always' ],
        'spaced-comment': [ 'warn', 'always' ]
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
            generators: true,
            experimentalObjectRestSpread: true
        }
    }
};
