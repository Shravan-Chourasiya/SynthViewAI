import { httpPost } from "../http";
import { ENDPOINTS } from "../constants/endpoints";
import type { ContactRequest } from "../types/api";

/**
 * Public contact form submission. Resolves once the message has reached the
 * team inbox; the visitor's confirmation email is sent server-side in the
 * background.
 */
export function submitContactMessage(body: ContactRequest): Promise<{ delivered: true }> {
  return httpPost<{ delivered: true }>(ENDPOINTS.contact.submit, body);
}
