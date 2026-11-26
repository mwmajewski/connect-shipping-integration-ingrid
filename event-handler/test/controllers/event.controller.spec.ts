import { Request, Response } from 'express';
import { post } from '../../src/controllers/event.controller';
import { createApiRoot } from '../../src/client/commercetools/create.client';
import * as updateClient from '../../src/client/commercetools/update.client';
import PubSubValidator from '../../src/utils/validate_requests.utils';
import IngridApiClient from '../../src/client/ingrid/ingrid.client';
import {
  type IngridAddresses,
  IngridCompleteSessionResponse,
  type IngridDeliveryGroupCategory,
  type IngridDeliveryGroupDeliveryTime,
  type IngridDeliveryGroupPricing,
  type IngridDeliveryGroupSelection,
  type IngridDeliveryGroupShipping,
} from '../../src/client/ingrid/types/ingrid.client.type';
import { readConfiguration } from '../../src/utils/config.utils';
import { logger } from '../../src/utils/logger.utils';
import CustomError from '../../src/errors/custom.error';

// Add Jest imports
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  orderWithCancelShipmentState,
  orderWithReadyShipmentState,
} from '../mock/mock-order';
import { mockApiRootOrderResponse } from '../mock/mock-api-root';

type MockFn = jest.MockedFunction<any>;

const mockIngridSessionId = 'VM2-00112233445566778899aabbccddeeff';

jest.mock('../../src/client/commercetools/create.client');
jest.mock('../../src/utils/validate_requests.utils');
jest.mock('../../src/client/ingrid/ingrid.client');
jest.mock('../../src/utils/config.utils');
jest.mock('../../src/utils/logger.utils');

// Define interfaces for type safety

describe('Event Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis() as MockFn,
      send: jest.fn().mockReturnThis() as MockFn,
    };

    (readConfiguration as MockFn).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'test-environment',
    });

    (logger.info as MockFn).mockImplementation(() => undefined);
    (logger.error as MockFn).mockImplementation(() => undefined);
  });

  it('should successfully process a valid event', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      notificationType: 'Message',
      projectKey: 'dummy-project-key',
      id: 'dummy-message-id',
      version: 1,
      sequenceNumber: 1,
      resource: { typeId: 'order', id: mockOrderId },
      resourceVersion: 1,
      type: 'OrderCreated',
      order: {
        id: mockOrderId,
      },
    });
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: mockIngridSessionId,
              },
            },
          },
        },
        orderNumber: 'test-order-number',
        id: mockOrderId,
      },
    };

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);
    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValue(orderWithReadyShipmentState);

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValue(orderWithReadyShipmentState);

    const mockIngridCompletionSuccessResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: 'VM2-00112233445566778899aabbccddeeff',
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            addresses: {} as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    (
      IngridApiClient.prototype.completeCheckoutSession as MockFn
    ).mockResolvedValue(mockIngridCompletionSuccessResponse);

    await post(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(mockResponse.send).toHaveBeenCalled();
    expect(
      IngridApiClient.prototype.completeCheckoutSession
    ).toHaveBeenCalledWith({
      checkout_session_id: mockIngridSessionId,
      external_id: mockOrder?.body?.orderNumber,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'processing shipping session completion for order ID : test-order-id'
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Update transport order ID for the order ID ${mockOrderId}: dummy-tos-id.`
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('complete ingrid session successfully')
    );
  });

  it('shouldLogErrorAndSkipAddressUpdate_whenCompletedIngridSessionHasNoDeliveryAddress', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      notificationType: 'Message',
      projectKey: 'dummy-project-key',
      id: 'dummy-message-id',
      version: 1,
      sequenceNumber: 1,
      resource: { typeId: 'order', id: mockOrderId },
      resourceVersion: 1,
      type: 'OrderCreated',
      order: {
        id: mockOrderId,
      },
    });
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: mockIngridSessionId,
              },
            },
          },
        },
        orderNumber: 'test-order-number',
        id: mockOrderId,
      },
    };

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);
    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValue(orderWithReadyShipmentState);

    jest
      .spyOn(updateClient, 'setShippingAddress')
      .mockResolvedValue(orderWithReadyShipmentState);

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValue(orderWithReadyShipmentState);

    const mockIngridCompletionSuccessResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: mockIngridSessionId,
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            // no delivery address on the completed session - this is the gap fix #1 covers
            addresses: {} as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    (
      IngridApiClient.prototype.completeCheckoutSession as MockFn
    ).mockResolvedValue(mockIngridCompletionSuccessResponse);

    await post(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(updateClient.setShippingAddress).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to get delivery address from Ingrid session ${mockIngridSessionId} for order ID ${mockOrderId}, shipping address not updated.`
    );
    expect(updateClient.changeShipmentState).toHaveBeenCalled();
  });

  it('shouldWriteShippingAddress_whenCompletedIngridSessionHasDeliveryAddress', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      notificationType: 'Message',
      projectKey: 'dummy-project-key',
      id: 'dummy-message-id',
      version: 1,
      sequenceNumber: 1,
      resource: { typeId: 'order', id: mockOrderId },
      resourceVersion: 1,
      type: 'OrderCreated',
      order: {
        id: mockOrderId,
      },
    });
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: mockIngridSessionId,
              },
            },
          },
        },
        orderNumber: 'test-order-number',
        id: mockOrderId,
      },
    };

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);
    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    const orderWithShippingAddressSet = {
      ...orderWithReadyShipmentState,
      version: orderWithReadyShipmentState.version + 1,
    };
    const orderWithTransportOrderIdSet = {
      ...orderWithReadyShipmentState,
      version: orderWithShippingAddressSet.version + 1,
    };

    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValue(orderWithTransportOrderIdSet);

    jest
      .spyOn(updateClient, 'setShippingAddress')
      .mockResolvedValue(orderWithShippingAddressSet);

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValue(orderWithReadyShipmentState);

    const mockIngridCompletionSuccessResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: mockIngridSessionId,
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            addresses: {
              delivery_address: {
                address_lines: ['Test Street 3'],
                apartment_number: '',
                city: 'Test City',
                country: 'IL',
                email: 'test@example.com',
                external_id: '',
                first_name: 'Daniel',
                last_name: 'Test',
                phone: '+972500000000',
                postal_code: '4481300',
                street: 'Test Street',
                street_number: '3',
              },
            } as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    (
      IngridApiClient.prototype.completeCheckoutSession as MockFn
    ).mockResolvedValue(mockIngridCompletionSuccessResponse);

    await post(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(updateClient.setShippingAddress).toHaveBeenCalledWith(
      mockOrderId,
      undefined,
      {
        firstName: 'Daniel',
        lastName: 'Test',
        streetName: 'Test Street',
        streetNumber: '3',
        postalCode: '4481300',
        apartment: '',
        city: 'Test City',
        country: 'IL',
        region: undefined,
        phone: '+972500000000',
        email: 'test@example.com',
      }
    );
    expect(updateClient.setTransportOrderId).toHaveBeenCalledWith(
      undefined,
      mockOrderId,
      orderWithShippingAddressSet.version,
      'dummy-tos-id'
    );
    expect(updateClient.changeShipmentState).toHaveBeenCalledWith(
      mockOrderId,
      orderWithTransportOrderIdSet.version,
      'Ready'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('shouldNotBlockTransportOrderIdOrShipmentState_whenShippingAddressWriteIsPermanentlyRejected', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      notificationType: 'Message',
      projectKey: 'dummy-project-key',
      id: 'dummy-message-id',
      version: 1,
      sequenceNumber: 1,
      resource: { typeId: 'order', id: mockOrderId },
      resourceVersion: 1,
      type: 'OrderCreated',
      order: {
        id: mockOrderId,
      },
    });
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: mockIngridSessionId,
              },
            },
          },
        },
        orderNumber: 'test-order-number',
        id: mockOrderId,
      },
    };

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);
    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    const orderWithTransportOrderIdSet = {
      ...orderWithReadyShipmentState,
      version: orderWithReadyShipmentState.version + 1,
    };

    jest.spyOn(updateClient, 'setShippingAddress').mockRejectedValue(
      new CustomError(
        502,
        'Failed to update order "test-order-id". invalid address',
        {
          cause: Object.assign(new Error('invalid address'), {
            statusCode: 400,
          }),
        }
      )
    );

    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValue(orderWithTransportOrderIdSet);

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValue(orderWithReadyShipmentState);

    const mockIngridCompletionSuccessResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: mockIngridSessionId,
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            addresses: {
              delivery_address: {
                address_lines: ['Test Street 3'],
                apartment_number: '',
                city: 'Test City',
                country: 'IL',
                email: 'test@example.com',
                external_id: '',
                first_name: 'Daniel',
                last_name: 'Test',
                phone: '+972500000000',
                postal_code: '4481300',
                street: 'Test Street',
                street_number: '3',
              },
            } as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    (
      IngridApiClient.prototype.completeCheckoutSession as MockFn
    ).mockResolvedValue(mockIngridCompletionSuccessResponse);

    await post(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to update shipping address for order ID ${mockOrderId}: Failed to update order "test-order-id". invalid address`
    );
    expect(updateClient.setTransportOrderId).toHaveBeenCalledWith(
      undefined,
      mockOrderId,
      undefined,
      'dummy-tos-id'
    );
    expect(updateClient.changeShipmentState).toHaveBeenCalledWith(
      mockOrderId,
      orderWithTransportOrderIdSet.version,
      'Ready'
    );
  });

  it('shouldNotProceedToReadyOrSkipRetry_whenShippingAddressWriteFailsTransiently', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      notificationType: 'Message',
      projectKey: 'dummy-project-key',
      id: 'dummy-message-id',
      version: 1,
      sequenceNumber: 1,
      resource: { typeId: 'order', id: mockOrderId },
      resourceVersion: 1,
      type: 'OrderCreated',
      order: {
        id: mockOrderId,
      },
    });
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: mockIngridSessionId,
              },
            },
          },
        },
        orderNumber: 'test-order-number',
        id: mockOrderId,
      },
    };

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);
    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    const transientError = new CustomError(
      502,
      'Failed to update order "test-order-id". fetch failed',
      { cause: new Error('fetch failed') }
    );

    jest
      .spyOn(updateClient, 'setShippingAddress')
      .mockRejectedValue(transientError);

    jest.spyOn(updateClient, 'setTransportOrderId');
    jest.spyOn(updateClient, 'changeShipmentState');

    const mockIngridCompletionSuccessResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: mockIngridSessionId,
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            addresses: {
              delivery_address: {
                address_lines: ['Test Street 3'],
                apartment_number: '',
                city: 'Test City',
                country: 'IL',
                email: 'test@example.com',
                external_id: '',
                first_name: 'Daniel',
                last_name: 'Test',
                phone: '+972500000000',
                postal_code: '4481300',
                street: 'Test Street',
                street_number: '3',
              },
            } as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    (
      IngridApiClient.prototype.completeCheckoutSession as MockFn
    ).mockResolvedValue(mockIngridCompletionSuccessResponse);

    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toBe(transientError);

    // it must not reach a terminal shipment state, so a redelivered message can still retry
    // the address write - reaching Ready here would make the idempotency guard at the top of
    // this handler skip every future redelivery, leaving the address permanently missing
    expect(updateClient.setTransportOrderId).not.toHaveBeenCalled();
    expect(updateClient.changeShipmentState).not.toHaveBeenCalled();
  });

  it('should throw error when Ingrid session ID is not found', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      orderId: mockOrderId,
    });

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: {},
            },
          },
        },
        id: 'test-order-id',
        orderNumber: 'test-order-number',
      },
    };
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValue(orderWithCancelShipmentState);

    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow(
      `Ingrid session ID not found for the order with ID ${mockOrder.body.id}.`
    );
  });

  it('should throw error when Ingrid session ID on the order is malformed', async () => {
    // the order's cart ingridSessionId custom field is writable through the commercetools
    // public API and must not be forwarded to the Ingrid API as if it were a real session ID
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({
      orderId: mockOrderId,
    });

    const mockOrder = {
      body: {
        cart: {
          obj: {
            custom: {
              fields: { ingridSessionId: '//158.94.211.77:1234/path' },
            },
          },
        },
        id: 'test-order-id',
        orderNumber: 'test-order-number',
      },
    };
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow(
      `Ingrid session ID not found for the order with ID ${mockOrder.body.id}.`
    );
    expect(
      IngridApiClient.prototype.completeCheckoutSession
    ).not.toHaveBeenCalled();
    expect(IngridApiClient.prototype.getCheckoutSession).not.toHaveBeenCalled();
  });

  it('should throw error when PubSub validation fails', async () => {
    const validationError = new Error('Invalid request body');
    (PubSubValidator.validateRequestBody as MockFn).mockImplementation(() => {
      throw validationError;
    });

    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow('Invalid request body');

    expect(logger.error).not.toHaveBeenCalled();
  });

  // Test for handling errors in ingridClient.completeCheckoutSession
  it('should handle errors from ingridClient.completeCheckoutSession and update shipment state as canceled', async () => {
    // Setup mocks
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;
    const mockError = new Error('Failed to complete session on Ingrid');

    // Mock PubSubValidator
    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    // Mock createApiRoot get order response
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    // Mock readConfiguration
    (readConfiguration as jest.Mock).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'STAGING',
    });

    jest
      .spyOn(IngridApiClient.prototype, 'completeCheckoutSession')
      .mockRejectedValue(mockError);

    // Mock setTransportOrderId
    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValue(orderWithReadyShipmentState);

    // Mock changeShipmentState
    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValueOnce(orderWithCancelShipmentState);

    // Execute test
    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow('Failed to complete session on Ingrid');

    // Verify the shipment state was updated to CANCELED
    expect(updateClient.changeShipmentState).toHaveBeenCalledWith(
      mockOrderId,
      mockVersion,
      'Canceled'
    );
  });

  // Test for recovering when Ingrid already completed the session despite a completion error
  it('should mark shipment ready when Ingrid session is already COMPLETE despite a completion error', async () => {
    // Setup mocks
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;
    const mockError = new Error('Request failed with status code 409');

    // Mock PubSubValidator
    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    // Mock createApiRoot get order response
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    // Mock readConfiguration
    (readConfiguration as jest.Mock).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'STAGING',
    });

    jest
      .spyOn(IngridApiClient.prototype, 'completeCheckoutSession')
      .mockRejectedValue(mockError);

    const mockIngridSessionResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: 'VM2-00112233445566778899aabbccddeeff',
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [
          {
            addresses: {} as IngridAddresses,
            category: {} as IngridDeliveryGroupCategory,
            delivery_time: {} as IngridDeliveryGroupDeliveryTime,
            group_id: '',
            header: '',
            items: [],
            pricing: {} as IngridDeliveryGroupPricing,
            selection: {} as IngridDeliveryGroupSelection,
            shipping: {} as IngridDeliveryGroupShipping,
            tos_id: 'dummy-tos-id',
          },
        ],
        purchase_country: 'US',
      },
    };

    jest
      .spyOn(IngridApiClient.prototype, 'getCheckoutSession')
      .mockResolvedValueOnce(mockIngridSessionResponse);

    jest
      .spyOn(updateClient, 'setTransportOrderId')
      .mockResolvedValueOnce(orderWithReadyShipmentState);

    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValueOnce(orderWithReadyShipmentState);

    // Execute test
    await post(mockRequest as Request, mockResponse as Response);

    // Verify the session was looked up, the transport order ID was set and the
    // shipment state was moved to READY instead of being canceled
    expect(IngridApiClient.prototype.getCheckoutSession).toHaveBeenCalledWith(
      'VM2-00112233445566778899aabbccddeeff'
    );
    expect(updateClient.setTransportOrderId).toHaveBeenCalled();
    expect(updateClient.changeShipmentState).toHaveBeenCalledWith(
      mockOrderId,
      orderWithReadyShipmentState.version,
      'Ready'
    );
    expect(mockResponse.status).toHaveBeenCalledWith(204);
  });

  // Test for the idempotency guard against Pub/Sub redelivery of an already-processed message
  it('should skip reprocessing when the order shipment state is already a terminal state', async () => {
    const mockOrderId = 'test-order-id';

    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: 1,
        shipmentState: 'Ready',
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    jest.spyOn(updateClient, 'changeShipmentState');

    await post(mockRequest as Request, mockResponse as Response);

    // it must not touch Ingrid or commercetools again for an already-finalized order
    expect(
      IngridApiClient.prototype.completeCheckoutSession
    ).not.toHaveBeenCalled();
    expect(updateClient.changeShipmentState).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(mockResponse.send).toHaveBeenCalledWith({
      orderId: mockOrderId,
      shipmentState: 'Ready',
    });
  });

  // Test for the gap where Ingrid reports COMPLETE but hasn't produced a transport order ID yet
  it('should ask for a retry instead of marking ready when Ingrid session is COMPLETE but has no transport order ID', async () => {
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;

    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    (readConfiguration as jest.Mock).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'STAGING',
    });

    const mockIngridCompleteButNoTransportId: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: 'VM2-00112233445566778899aabbccddeeff',
        status: 'COMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [],
        purchase_country: 'US',
      },
    };

    jest
      .spyOn(IngridApiClient.prototype, 'completeCheckoutSession')
      .mockResolvedValue(mockIngridCompleteButNoTransportId);

    jest.spyOn(updateClient, 'setTransportOrderId');
    jest.spyOn(updateClient, 'changeShipmentState');

    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow('has no transport order ID yet');

    // it must not set the shipment state at all, so a retry can still complete it
    expect(updateClient.setTransportOrderId).not.toHaveBeenCalled();
    expect(updateClient.changeShipmentState).not.toHaveBeenCalled();
  });

  // Test for handling retryable errors from ingridClient.completeCheckoutSession
  it('should not update shipment state when the Ingrid call fails with a retryable error', async () => {
    // Setup mocks
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;
    const mockError = new CustomError(
      502,
      'Failed to complete session on Ingrid. fetch failed'
    );

    // Mock PubSubValidator
    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    // Mock createApiRoot get order response
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    // Mock readConfiguration
    (readConfiguration as jest.Mock).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'STAGING',
    });

    jest
      .spyOn(IngridApiClient.prototype, 'completeCheckoutSession')
      .mockRejectedValue(mockError);

    jest.spyOn(updateClient, 'changeShipmentState');

    // Execute test
    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toBe(mockError);

    // Verify the shipment state was left untouched so a retry can complete it
    expect(updateClient.changeShipmentState).not.toHaveBeenCalled();
  });

  // Test for handling INCOMPLETE status from Ingrid
  it('should update shipment state as canceled when Ingrid session status is not COMPLETE', async () => {
    // Setup mocks
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;

    // Mock PubSubValidator
    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    // Mock createApiRoot get order response
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse({
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
              },
            },
          },
        },
        orderNumber: 'test-order-number',
      },
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    // Mock readConfiguration
    (readConfiguration as jest.Mock).mockReturnValue({
      ingridApiKey: 'test-api-key',
      ingridEnvironment: 'STAGING',
    });

    // Mock IngridApiClient with INCOMPLETE status
    const mockIngridResponse: IngridCompleteSessionResponse = {
      session: {
        checkout_session_id: 'VM2-00112233445566778899aabbccddeeff',
        status: 'INCOMPLETE',
        updated_at: new Date().toISOString(),
        cart: {
          total_value: 0,
          total_discount: 0,
          items: [],
          cart_id: 'test-cart-id',
        },
        delivery_groups: [],
        purchase_country: 'US',
      },
    };

    jest
      .spyOn(IngridApiClient.prototype, 'completeCheckoutSession')
      .mockResolvedValue(mockIngridResponse);

    // Mock changeShipmentState
    jest
      .spyOn(updateClient, 'changeShipmentState')
      .mockResolvedValueOnce(orderWithCancelShipmentState);

    // Execute test
    await post(mockRequest as Request, mockResponse as Response);

    // Verify the shipment state was updated to CANCELED
    expect(updateClient.changeShipmentState).toHaveBeenCalledWith(
      mockOrderId,
      mockVersion,
      'Canceled'
    );

    // Verify the response
    expect(mockResponse.status).toHaveBeenCalledWith(204);
    expect(mockResponse.send).toHaveBeenCalledWith({
      ingridSessionId: 'VM2-00112233445566778899aabbccddeeff',
      status: 'INCOMPLETE',
    });

    // Verify logs were created
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining('complete ingrid session failed')
    );
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining(
        'Update commercetools cart shipment state as canceled'
      )
    );
  });

  // Test for handling missing ingridSessionId
  it('should throw an error when ingridSessionId is not found', async () => {
    // Setup mocks
    const mockOrderId = 'test-order-id';
    const mockVersion = 1;

    // Mock PubSubValidator
    (PubSubValidator.validateRequestBody as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as jest.Mock).mockReturnValue({});
    (PubSubValidator.decodeMessageData as jest.Mock).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as jest.Mock).mockReturnValue(
      mockOrderId
    );

    // Mock createApiRoot get order response with missing ingridSessionId
    // Mock createApiRoot get order response
    const mockOrder = {
      body: {
        id: mockOrderId,
        version: mockVersion,
        cart: {
          obj: {
            custom: {
              fields: {
                // ingridSessionId is missing
              },
            },
          },
        },

        orderNumber: 'test-order-number',
      },
    };
    const mockCommercetoolsGetOrders = mockApiRootOrderResponse(mockOrder);

    (createApiRoot as MockFn).mockReturnValue({
      orders: mockCommercetoolsGetOrders,
    });

    // Execute test
    await expect(
      post(mockRequest as Request, mockResponse as Response)
    ).rejects.toThrow(
      `Ingrid session ID not found for the order with ID ${mockOrder.body.id}.`
    );
  });

  it('should throw a retryable CustomError when fetching the order from commercetools fails', async () => {
    const mockOrderId = 'test-order-id';
    (PubSubValidator.validateRequestBody as MockFn).mockReturnValue({});
    (PubSubValidator.validateMessageFormat as MockFn).mockReturnValue({});
    (PubSubValidator.decodeMessageData as MockFn).mockReturnValue({});
    (PubSubValidator.validateDecodedMessage as MockFn).mockReturnValue(
      mockOrderId
    );

    const networkError = Object.assign(new Error('fetch failed'), {
      code: 'NetworkError',
      status: 0,
      statusCode: 0,
    });

    (createApiRoot as MockFn).mockReturnValue({
      orders: jest.fn().mockReturnValue({
        withId: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            execute: jest.fn().mockRejectedValue(networkError),
          }),
        }),
      }),
    });

    let caughtError: unknown;
    try {
      await post(mockRequest as Request, mockResponse as Response);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(CustomError);
    expect((caughtError as CustomError).statusCode).toBe(502);
    expect((caughtError as CustomError).message).toContain(
      `Failed to fetch order ${mockOrderId} from commercetools`
    );
    expect((caughtError as CustomError).cause).toBe(networkError);
  });

  // Test for handling RESOURCE_CREATED_MESSAGE
  it('should skip processing for RESOURCE_CREATED_MESSAGE', async () => {
    // Mock PubSubValidator to return RESOURCE_CREATED_MESSAGE
    jest.mocked(PubSubValidator.validateRequestBody).mockReturnValue({});
    jest.mocked(PubSubValidator.validateMessageFormat).mockReturnValue({});
    jest.mocked(PubSubValidator.decodeMessageData).mockReturnValue({});
    jest
      .mocked(PubSubValidator.validateDecodedMessage)
      .mockReturnValue('RESOURCE_CREATED_MESSAGE');

    // Execute test
    await post(mockRequest as Request, mockResponse as Response);

    // Verify the response
    expect(mockResponse.status).toHaveBeenCalledWith(202);
    expect(mockResponse.send).toHaveBeenCalledWith(
      'Message for subscription created. Skip processing message.'
    );
    expect(jest.mocked(logger.info)).toHaveBeenCalledWith(
      'Message for subscription created. Skip processing message.'
    );
  });
});
