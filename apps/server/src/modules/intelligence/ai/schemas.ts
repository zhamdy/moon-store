/**
 * The AI module's request contracts (#102).
 *
 * These are statistical suggestions computed from the shop's own history, not calls to a
 * model, so they are read-only and take nothing but a window and a page.
 */
import { defineRequestContract } from '../../../http/requestContracts';
import { aiListQuerySchema, forecastQuerySchema, recommendationQuerySchema } from './types';

export const aiRequestContracts = {
  getForecast: defineRequestContract({
    method: 'GET',
    path: '/api/v1/ai/forecast',
    operation: 'getForecast',
    query: forecastQuerySchema,
  }),

  getRecommendations: defineRequestContract({
    method: 'GET',
    path: '/api/v1/ai/recommendations',
    operation: 'getRecommendations',
    query: recommendationQuerySchema,
  }),

  getPricingSuggestions: defineRequestContract({
    method: 'GET',
    path: '/api/v1/ai/pricing-suggestions',
    operation: 'getPricingSuggestions',
    query: aiListQuerySchema,
  }),

  getChurnRisk: defineRequestContract({
    method: 'GET',
    path: '/api/v1/ai/churn-risk',
    operation: 'getChurnRisk',
    query: aiListQuerySchema,
  }),

  getAnomalies: defineRequestContract({
    method: 'GET',
    path: '/api/v1/ai/anomalies',
    operation: 'getAnomalies',
    query: aiListQuerySchema,
  }),
} as const;

export const aiContractList = Object.values(aiRequestContracts);
