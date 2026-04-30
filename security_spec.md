# Security Specification

## 1. Data Invariants
- A user document can only be created by the verified user whose UID matches the document ID.
- User roles ("client", "farmer", "rider", "admin") cannot be self-assigned; creation requires default "client" or no role unless handled securely (we'll allow setting role strictly through an admin backend, or for this prototype, users can only read their own profile, maybe setting 'client' on create).
- A Transaction must belong to the client who creates it.
- A client can only read their own transactions.
- A Transaction's paymentStatus and status can only be updated securely (either by admin or through specific allowed state transitions by the user/system).
- Produce can only be created/updated by the farmer (farmerId == request.auth.uid) and they must have the "farmer" role (or we just identify by ownership).

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: `{"clientId": "other-user-uid"}` during Transaction create.
2. **Ghost Field**: `{"status": "pending", "ghost": "boo"}` during Transaction create.
3. **Escalation**: `{"role": "admin"}` during User update.
4. **Invalid Type**: `{"totalAmount": "100"}` (string instead of number) during Transaction create.
5. **Array Overload**: `{"items": [excessive_items]}` during Transaction create.
6. **State Skip**: `{"status": "delivered"}` on a fresh Transaction create.
7. **Immutable Edit**: Updating `createdAt` timestamp on an existing document.
8. **Delete Attack**: Attempting to delete someone else's Transaction.
9. **List Exposure**: Attempting to list all transactions without a `clientId == request.auth.uid` filter.
10. **ID Poisoning**: Creating a User or Transaction with a 1MB string as the document ID.
11. **Spoofed Email**: Creating a User doc with another person's email without `email_verified == true`.
12. **Unverified Auth**: Attempting to create a Transaction with an unverified email account.

## 3. The Test Runner
A `firestore.rules.test.ts` will verify these using `@firebase/rules-unit-testing`.
