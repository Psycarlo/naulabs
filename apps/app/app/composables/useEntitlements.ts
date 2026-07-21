import { api } from '@naulabs/backend'

// Current plan + entitlements + this period's usage. Null when signed out.
export const useEntitlements = () =>
  useConvexQuery(api.entitlements.getMyEntitlements, {})
