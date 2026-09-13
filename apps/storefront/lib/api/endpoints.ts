export const API_PREFIX = '/api/v1';

/**
 * Path registry for future endpoints, keyed by feature. Types declared here model
 * the API's response DTOs — never a server repository or database type, which the
 * storefront has no visibility into and must not depend on.
 */
export const endpoints = {} as const;
