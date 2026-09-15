/**
 * `GET /api/v1/catalog/store-policies`: store-wide delivery and returns copy, edited in
 * the dashboard's store settings. Arabic primary, English optional; each field is `null`
 * when unset. A response DTO, not a server type.
 */
export interface StorePolicies {
  delivery: string | null;
  deliveryEn: string | null;
  returns: string | null;
  returnsEn: string | null;
}
