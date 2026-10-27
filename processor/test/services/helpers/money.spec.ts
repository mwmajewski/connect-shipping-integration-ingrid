import { describe, expect, test } from '@jest/globals';
import { convertCentAmountToIngridAmount, convertIngridAmountToCentAmount } from '../../../src/services/helpers/money';

describe('money', () => {
  describe('convertCentAmountToIngridAmount', () => {
    test('should not change a 2-fraction-digit currency amount (EUR)', () => {
      expect(convertCentAmountToIngridAmount(2599, 2)).toEqual(2599);
    });

    test('should multiply a 0-fraction-digit currency amount by 100 (ISK)', () => {
      expect(convertCentAmountToIngridAmount(9000, 0)).toEqual(900000);
    });

    test('should round a 3-fraction-digit currency amount not divisible by ten to an integer (KWD)', () => {
      // 12345 fils (12.345 KWD) would otherwise become 1234.5, a fractional amount Ingrid rejects.
      expect(convertCentAmountToIngridAmount(12345, 3)).toEqual(1235);
      expect(Number.isInteger(convertCentAmountToIngridAmount(12345, 3))).toBe(true);
    });
  });

  describe('convertIngridAmountToCentAmount', () => {
    test('should not change a 2-fraction-digit currency amount (EUR)', () => {
      expect(convertIngridAmountToCentAmount(2599, 2)).toEqual(2599);
    });

    test('should divide a 0-fraction-digit currency amount by 100 (ISK)', () => {
      expect(convertIngridAmountToCentAmount(900000, 0)).toEqual(9000);
    });

    test('should round a 3-fraction-digit currency amount to an integer centAmount (KWD)', () => {
      expect(convertIngridAmountToCentAmount(1235, 3)).toEqual(12350);
    });
  });
});
