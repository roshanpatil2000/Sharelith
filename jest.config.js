module.exports = {
  preset: '@react-native/jest-preset',
  // Reset mock call history (not implementations) between tests.
  clearMocks: true,
  // Resolves Reanimated/Worklets to their JS (non-native) implementations.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Jest would otherwise pick lucide's ESM (.mjs) build.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@gorhom|@shopify|lucide-react-native)/)',
  ],
};
