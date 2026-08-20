import type { AxiosError, AxiosInstance } from 'axios';
import api from '../../services/api';
import { ApiError, type Transport, type TransportRequest, type TransportResult } from './types';

const API_PREFIX = '/api/v1';

interface Envelope<T> {
  success?: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: string;
}

/**
 * The real transport: axios underneath, plus the two contracts the server
 * imposes — responses nested inside a `{ success, data, meta }` envelope, and
 * failures carrying their message on `error`.
 *
 * This is the only module in the client that should know either of those.
 */
export function createHttpTransport(client: AxiosInstance = api): Transport {
  return {
    async request<T>({
      method,
      path,
      params,
      body,
      responseType = 'json',
    }: TransportRequest): Promise<TransportResult<T>> {
      try {
        const response = await client.request<Envelope<T>>({
          method,
          url: `${API_PREFIX}/${path}`,
          params,
          data: body,
          ...(responseType === 'blob' ? { responseType: 'blob' as const } : {}),
          // The shared client pins JSON, which makes axios serialise a FormData
          // body to "{}" instead of uploading it. Clearing the header lets the
          // browser set multipart/form-data with its own boundary. Encoding is
          // this adapter's business, so callers still just hand over a body.
          ...(body instanceof FormData ? { headers: { 'Content-Type': undefined } } : {}),
        });
        // A streamed file has no envelope to unwrap; the blob is the answer.
        if (responseType === 'blob') return { data: response.data as unknown as T };
        return { data: response.data.data, meta: response.data.meta };
      } catch (caught) {
        const error = caught as AxiosError<{ error?: string }>;
        // Only the server's own wording is worth showing a user. Axios's
        // ("Network Error", "timeout of 0ms exceeded") is left out, so callers
        // fall back to something they phrased themselves.
        throw new ApiError(error.response?.data?.error ?? '', error.response?.status ?? null);
      }
    },
  };
}
