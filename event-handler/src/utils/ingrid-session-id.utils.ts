const INGRID_SESSION_ID_PATTERN = /^VM2-[0-9a-fA-F]{32}$/;

/**
 * Checks whether a value has the shape of a real Ingrid checkout session ID (e.g.
 * `VM2-00168d51494c495084a25e8f15c3d35a`), as opposed to arbitrary data that happens to be
 * stored in the order's cart's `ingridSessionId` custom field.
 *
 * @remarks
 * Commercetools cart custom fields are writable through the public API and must not be trusted
 * as if they originated from Ingrid. A value that doesn't match this shape must never be
 * forwarded to the Ingrid API.
 */
export function isValidIngridSessionId(value: string): boolean {
  return INGRID_SESSION_ID_PATTERN.test(value);
}
