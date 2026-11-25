import axios, { AxiosInstance, AxiosResponse } from 'axios';
import IngridApiClient from '../../../src/client/ingrid/ingrid.client';
import {
  IngridBasePath,
  IngridCompleteSessionRequestPayload,
  IngridUrls,
} from '../../../src/client/ingrid/types/ingrid.client.type';
import CustomError from '../../../src/errors/custom.error';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock axios
jest.mock('axios');

describe('IngridApiClient', () => {
  let client: IngridApiClient;
  const mockApiSecret = 'test-api-secret';
  const mockEnvironment = 'STAGING';
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
  } as unknown as jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(axios.create).mockReturnValue(mockAxiosInstance);
    client = new IngridApiClient({
      apiSecret: mockApiSecret,
      environment: mockEnvironment,
    });
  });

  describe('constructor', () => {
    it('should create an axios instance with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: IngridBasePath[mockEnvironment],
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${mockApiSecret}`,
        },
        maxRedirects: 20,
      });
    });
  });

  describe('completeCheckoutSession', () => {
    const mockPayload: IngridCompleteSessionRequestPayload = {
      checkout_session_id: 'test-checkout-id',
      external_id: 'test-external-id',
    };

    const mockResponse = {
      data: {
        session: {
          checkout_session_id: 'test-session-id',
          status: 'COMPLETE',
          updated_at: '2023-01-01T12:00:00Z',
          cart: {
            total_value: 0,
            total_discount: 0,
            items: [],
            cart_id: 'test-cart-id',
          },
          delivery_groups: [],
          purchase_country: 'US',
        },
      },
    } as AxiosResponse;

    it('should successfully complete a checkout session', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.completeCheckoutSession(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        IngridUrls.DELIVERY_CHECKOUT + '/session.complete',
        mockPayload
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw a non-retryable CustomError when the API call fails with a plain error', async () => {
      const mockError = new Error('API error');
      jest.mocked(axios.isAxiosError).mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValueOnce(mockError);

      await expect(client.completeCheckoutSession(mockPayload)).rejects.toThrow(
        CustomError
      );
      await expect(
        client.completeCheckoutSession(mockPayload)
      ).rejects.toMatchObject({
        statusCode: 202,
        message: expect.stringContaining('Failed to complete session on Ingrid.'),
      });
    });

    it('should handle non-Error objects thrown by axios', async () => {
      jest.mocked(axios.isAxiosError).mockReturnValue(false);
      mockAxiosInstance.post.mockRejectedValueOnce('String error');

      await expect(client.completeCheckoutSession(mockPayload)).rejects.toThrow(
        CustomError
      );
      await expect(
        client.completeCheckoutSession(mockPayload)
      ).rejects.toMatchObject({ statusCode: 202 });
    });

    it('should throw a retryable (502) CustomError on a network error with no response', async () => {
      const networkError = Object.assign(new Error('fetch failed'), {
        isAxiosError: true,
        response: undefined,
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValueOnce(networkError);

      await expect(
        client.completeCheckoutSession(mockPayload)
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it('should throw a retryable (502) CustomError when Ingrid responds with a 5xx', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), {
        isAxiosError: true,
        response: { status: 503 },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValueOnce(serverError);

      await expect(
        client.completeCheckoutSession(mockPayload)
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it('should throw a non-retryable (202) CustomError when Ingrid responds with a 4xx', async () => {
      const clientError = Object.assign(new Error('Bad Request'), {
        isAxiosError: true,
        response: { status: 400 },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValueOnce(clientError);

      await expect(
        client.completeCheckoutSession(mockPayload)
      ).rejects.toMatchObject({ statusCode: 202 });
    });
  });

  describe('getCheckoutSession', () => {
    const mockResponse = {
      data: {
        session: {
          checkout_session_id: 'VM2-00112233445566778899aabbccddeeff',
          status: 'COMPLETE',
          updated_at: '2023-01-01T12:00:00Z',
          cart: {
            total_value: 0,
            total_discount: 0,
            items: [],
            cart_id: 'test-cart-id',
          },
          delivery_groups: [],
          purchase_country: 'US',
        },
      },
    } as AxiosResponse;

    it('should successfully get a checkout session', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await client.getCheckoutSession(
        'VM2-00112233445566778899aabbccddeeff'
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        IngridUrls.DELIVERY_CHECKOUT +
          '/session.get?checkout_session_id=VM2-00112233445566778899aabbccddeeff'
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should percent-encode a checkout session ID containing URL-breaking characters', async () => {
      // a caller must not assume checkout_session_id is already URL-safe, since it ultimately
      // comes from a commercetools cart custom field writable through the public API
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await client.getCheckoutSession('//158.94.211.77:1234/path#frag');

      const calledUrl = mockAxiosInstance.get.mock.calls[0]?.[0] as string;
      expect(calledUrl).not.toContain('checkout_session_id=//158.94.211.77');
      const requestedValue = new URL(
        calledUrl,
        'https://example.invalid'
      ).searchParams.get('checkout_session_id');
      expect(requestedValue).toBe('//158.94.211.77:1234/path#frag');
    });

    it('should throw a non-retryable CustomError when the API call fails with a plain error', async () => {
      const mockError = new Error('API error');
      jest.mocked(axios.isAxiosError).mockReturnValue(false);
      mockAxiosInstance.get.mockRejectedValueOnce(mockError);

      await expect(
        client.getCheckoutSession('VM2-00112233445566778899aabbccddeeff')
      ).rejects.toMatchObject({
        statusCode: 202,
        message: expect.stringContaining('Failed to get session from Ingrid.'),
      });
    });

    it('should throw a retryable (502) CustomError when Ingrid responds with a 5xx', async () => {
      const serverError = Object.assign(new Error('Internal Server Error'), {
        isAxiosError: true,
        response: { status: 503 },
      });
      jest.mocked(axios.isAxiosError).mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValueOnce(serverError);

      await expect(
        client.getCheckoutSession('VM2-00112233445566778899aabbccddeeff')
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
