const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        // Absolute paths: Metro workers don't always run from the project root.
        root: [__dirname],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: { '@': path.join(__dirname, 'src') },
      },
    ],
    // zod v4 ships `export * as ns from`, which the RN preset doesn't compile.
    '@babel/plugin-transform-export-namespace-from',
    // Must stay last.
    'react-native-worklets/plugin',
  ],
};
