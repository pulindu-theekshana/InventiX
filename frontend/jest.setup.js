/**
 * Jest setup
 *
 * Purpose : The one mock every test needs. AsyncStorage is a native module, so it has no
 *           implementation under Node; the package ships a mock for exactly this.
 * Look here when : A test fails with "NativeModule: AsyncStorage is null".
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
