import api from './api';

/**
 * The one product operation the transport seam cannot carry.
 *
 * `TransportRequest` has no header channel, and the shared axios client pins
 * `Content-Type: application/json`, which makes axios serialise a `FormData`
 * body to JSON instead of sending it as a multipart upload. So a multipart POST
 * has to name its own content type, and that is below the seam.
 *
 * Keeping it here rather than in the page means the page still never sees axios,
 * a URL prefix, or a response envelope — it asks for one named operation.
 */
export async function uploadProductImage(productId: number, file: File): Promise<void> {
  const form = new FormData();
  form.append('image', file);
  await api.post(`/api/v1/products/${productId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
