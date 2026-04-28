# Security Spec: AgriRoute

## Data Invariants
1. An order must have a valid `clientId` matching the requester.
2. A rider can only update orders assigned to them.
3. Inventory changes must be made by the farmer who owns that inventory record.

## "The Dirty Dozen" Payloads (Deny Cases)
1. Unauthorized profile update: Changing another user's role to 'admin'.
2. Counterfeit order: Creating an order for another `clientId`.
3. Inventory spoofing: Farmer A updating Farmer B's stock prices.
4. Route hijacking: Rider A completing Rider B's delivery route.
5. Orphaned order: Creating an order with a non-existent recipe or farmer.
6. PII Leak: Requesting all user emails as a public "client".
7. State Skipping: Updating order status from 'paid' to 'completed' without 'delivering'.
8. Resource Poisoning: Injecting 2MB of text into an ingredient description.
9. Delivery Spoofing: Updating delivery location after rider has started.

## Verification Tests Plan
- `test_order_creation`: Block if `clientId != auth.uid`.
- `test_inventory_write`: Block if `farmerId != auth.uid`.
- `test_role_management`: Block any non-admin from writing to the `role` field.
