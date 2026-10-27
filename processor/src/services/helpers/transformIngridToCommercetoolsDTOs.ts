import { CustomError } from '../../libs/fastify/errors';
import { convertIngridAmountToCentAmount } from './money';
import type { BaseAddress, ShippingRateDraft } from '@commercetools/platform-sdk';
import type {
  IngridBillingAddress,
  IngridDeliveryAddress,
  IngridDeliveryGroup,
} from '../../clients/ingrid/types/ingrid.client.type';

type CustomShippingMethod = {
  shippingMethodName: string;
  shippingRate: ShippingRateDraft;
};

/**
 * Transform Ingrid delivery groups to Commercetools data types
 *
 * @param {IngridDeliveryGroup[]} ingridDeliveryGroups - Array of Ingrid delivery groups
 * @param {number} cartCurrencyFractionDigits - fractionDigits of the commercetools cart's currency,
 * used to convert Ingrid's hundredths-of-major-unit amounts back to commercetools centAmounts
 *
 * @returns {Object} Object containing billing address, delivery address and custom shipping method
 * @returns {BaseAddress} returns.billingAddress - Commercetools billing address
 * @returns {BaseAddress} returns.deliveryAddress - Commercetools delivery address
 * @returns {CustomShippingMethod} returns.customShippingMethod - Custom shipping method with name and rate
 *
 * @throws {CustomError} When no delivery groups are found
 * @throws {CustomError} When multiple delivery groups are provided (not yet supported)
 */
export const transformIngridDeliveryGroupsToCommercetoolsDataTypes = (
  ingridDeliveryGroups: IngridDeliveryGroup[],
  cartCurrencyFractionDigits: number,
): {
  billingAddress: BaseAddress;
  deliveryAddress: BaseAddress;
  customShippingMethod: CustomShippingMethod;
  extMethodId: string | undefined;
  pickupPointId: string | undefined;
  deliveryAddons: string | undefined;
  instaboxToken: string | undefined;
} => {
  if (ingridDeliveryGroups.length === 0) {
    throw new CustomError({
      message: 'No delivery groups found',
      code: 'NO_DELIVERY_GROUPS_FOUND',
      httpErrorStatus: 500,
    });
  }
  if (ingridDeliveryGroups.length > 1) {
    throw new CustomError({
      message: "We don't support multiple delivery groups yet",
      code: 'MULTIPLE_DELIVERY_GROUPS_NOT_SUPPORTED',
      httpErrorStatus: 500,
    });
  }

  const ingridDeliveryGroup = ingridDeliveryGroups[0]!;
  const billingAddress = transformIngridAddressToCommercetoolsAddress(ingridDeliveryGroup.addresses.billing_address);
  const deliveryAddress = transformIngridAddressToCommercetoolsAddress(ingridDeliveryGroup.addresses.delivery_address);
  const customShippingMethod = transformIngridDeliveryGroupToCustomShippingMethod(
    ingridDeliveryGroup,
    cartCurrencyFractionDigits,
  );
  const extMethodId = ingridDeliveryGroup.shipping.carrier_product_id;
  const pickupPointId = transformDependantFields(ingridDeliveryGroup);
  const deliveryAddons: string | undefined = transformDeliveryAddons(ingridDeliveryGroup);
  const instaboxToken = (ingridDeliveryGroup.shipping.meta?.['isb.availability_token'] as string) ?? undefined;
  return {
    billingAddress,
    deliveryAddress,
    customShippingMethod,
    extMethodId,
    pickupPointId,
    deliveryAddons,
    instaboxToken,
  };
};

/**
 * Convert ingrid address to commercetools base address
 *
 * @param address - Ingrid billing or delivery address
 *
 * @returns {BaseAddress}
 */
const transformIngridAddressToCommercetoolsAddress = (
  address: IngridBillingAddress | IngridDeliveryAddress,
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

/**
 * Transform ingrid delivery group to custom shipping method
 *
 * @param ingridDeliveryGroup - Ingrid delivery group
 * @param cartCurrencyFractionDigits - fractionDigits of the commercetools cart's currency
 *
 * @returns {CustomShippingMethod}
 */
const transformIngridDeliveryGroupToCustomShippingMethod = (
  ingridDeliveryGroup: IngridDeliveryGroup,
  cartCurrencyFractionDigits: number,
): CustomShippingMethod => {
  const customShippingMethod = {
    shippingMethodName: ingridDeliveryGroup.category.name,
    shippingRate: {
      price: {
        currencyCode: ingridDeliveryGroup.pricing.currency,
        centAmount: convertIngridAmountToCentAmount(
          ingridDeliveryGroup.pricing.net_price ?? ingridDeliveryGroup.pricing.price,
          cartCurrencyFractionDigits,
        ),
      },
    },
  };
  return customShippingMethod;
};

const transformDependantFields = (ingridDeliveryGroup: IngridDeliveryGroup): string | undefined => {
  const deliveryType = ingridDeliveryGroup.shipping.delivery_type;
  if (deliveryType === 'pickup' || deliveryType === 'instore') {
    return ingridDeliveryGroup.addresses.location?.external_id ?? undefined;
  }
  return undefined;
};

const transformDeliveryAddons = (ingridDeliveryGroup: IngridDeliveryGroup): string | undefined => {
  const ingridDeliveryAddons = ingridDeliveryGroup.shipping.delivery_addons;
  if (!ingridDeliveryAddons) return undefined;

  return ingridDeliveryAddons.map((addon) => JSON.stringify(addon)).join(',');
};
