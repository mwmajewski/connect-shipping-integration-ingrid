/**
 * Convert a commercetools centAmount to the hundredths-of-major-unit amount Ingrid's
 * checkout API always expects, regardless of the currency's real fraction digits
 * (e.g. ISK has fractionDigits 0, so 9.000 kr / centAmount 9000 must be sent as 900000).
 *
 * @param {number} centAmount - commercetools centAmount (10^-fractionDigits of the major unit)
 * @param {number} fractionDigits - the currency's fractionDigits, as found on the CentPrecisionMoney object
 *
 * @returns {number} the amount in Ingrid's fixed-hundredths convention
 */
export const convertCentAmountToIngridAmount = (centAmount: number, fractionDigits: number): number =>
  centAmount * 10 ** (2 - fractionDigits);

/**
 * Convert an Ingrid hundredths-of-major-unit amount back to a commercetools centAmount,
 * using the cart's currency fractionDigits (Ingrid itself carries no fractionDigits).
 *
 * @param {number} ingridAmount - amount as returned by Ingrid (always hundredths of the major unit)
 * @param {number} fractionDigits - the cart currency's fractionDigits
 *
 * @returns {number} commercetools centAmount, rounded to avoid floating point drift
 */
export const convertIngridAmountToCentAmount = (ingridAmount: number, fractionDigits: number): number =>
  Math.round(ingridAmount / 10 ** (2 - fractionDigits));
