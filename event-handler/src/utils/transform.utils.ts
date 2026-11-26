import type { BaseAddress } from '@commercetools/platform-sdk';
import type { IngridDeliveryAddress } from '../client/ingrid/types/ingrid.client.type';

/**
 * Transform an Ingrid delivery address to a commercetools base address.
 *
 * @param address - Ingrid delivery address
 *
 * @returns {BaseAddress}
 */
export const transformIngridAddressToCommercetoolsAddress = (
  address: IngridDeliveryAddress
): BaseAddress => {
  return {
    firstName: address.first_name,
    lastName: address.last_name,
    streetName: address.street,
    streetNumber: address.street_number,
    postalCode: address.postal_code,
    apartment: address.apartment_number,
    city: address.city,
    country: address.country,
    region: address.region,
    phone: address.phone,
    email: address.email,
  };
};
