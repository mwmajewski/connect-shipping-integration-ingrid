import { describe, expect, test } from '@jest/globals';
import { isValidIngridSessionId } from '../../src/utils/ingrid-session-id.utils';

describe('ingrid-session-id.utils', () => {
  describe('isValidIngridSessionId', () => {
    test('shouldReturnTrue_whenValueMatchesIngridSessionIdFormat', () => {
      // given
      const value = 'VM2-00112233445566778899aabbccddeeff';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(true);
    });

    test('shouldReturnTrue_whenValueMatchesIngridSessionIdFormatWithUppercaseHex', () => {
      // given
      const value = 'VM2-00112233445566778899AABBCCDDEEFF';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(true);
    });

    test('shouldReturnFalse_whenValueIsMissingTheVm2Prefix', () => {
      // given
      const value = '00112233445566778899aabbccddeeff';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(false);
    });

    test('shouldReturnFalse_whenValueLooksLikeAProtocolRelativeUrl', () => {
      // given
      const value = '//158.94.211.77:1234/path';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(false);
    });

    test('shouldReturnFalse_whenValueContainsAUrlFragment', () => {
      // given
      const value = 'x#isidb562ca9c-frag';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(false);
    });

    test('shouldReturnFalse_whenValueIsEmpty', () => {
      // given
      const value = '';

      // when
      const result = isValidIngridSessionId(value);

      // then
      expect(result).toBe(false);
    });
  });
});
