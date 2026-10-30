import { httpPost } from '../http'
import type { ContactRequest } from '../api-types'

export const contactService = {
  send: (body: ContactRequest): Promise<void> =>
    httpPost('/contact', body),
}
