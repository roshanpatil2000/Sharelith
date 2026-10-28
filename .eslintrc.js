module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['supabase/functions/**', 'coverage/**'],
  rules: {
    // Screens must use theme tokens instead of inline styles.
    'react-native/no-inline-styles': 'error',
  },
};
