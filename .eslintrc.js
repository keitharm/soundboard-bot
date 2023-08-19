module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: 'airbnb-base',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console': 'off',
    'no-plusplus': 'off',
    'consistent-return': 'off',
    'no-param-reassign': ['error', { props: false }],
    'no-use-before-define': 'off',
    'max-len': 'off',
    'no-shadow': 'off',
  },
};
