/**
 * jest-dom 7 augments `declare module 'vitest'`, but Vitest 4 re-exports its
 * Assertion interface from '@vitest/expect', so that augmentation no longer
 * merges. This shim applies the matcher types where Vitest 4 actually
 * declares them.
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/types/matchers';

declare module '@vitest/expect' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
