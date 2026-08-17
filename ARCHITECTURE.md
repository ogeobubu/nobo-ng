# Architecture & Technical Thinking

If NoboNG grows to 100,000 customers and thousands of orders per day, I would keep the backend modular, with clear boundaries around checkout, payments, orders, catalog, and fulfillment. That keeps the system easy to maintain now, while still making it possible to split services later if traffic or team size demands it.

For payment confirmation, I would not trust the client as the source of truth. The payment provider should confirm the transaction through signed webhooks, and the backend should only mark an order as paid after verifying that event. That way, a success message on the app does not automatically mean the payment went through.

To prevent double charging when a request is retried, I would use idempotency keys and unique payment references. Each checkout attempt should have one stable identifier, and the backend should enforce that at the database level. If the same request is sent again, the system should return the original result instead of creating a second charge.

To protect customer and payment-related information, I would store only the minimum required data, encrypt sensitive fields at rest, use HTTPS everywhere, and keep secrets in a proper secret manager. I would avoid storing raw card details entirely and rely on the payment provider’s tokenized flow.

For logistics, I would model order status as a proper state machine, with states like pending, paid, packed, shipped, and delivered. That makes the system easier to extend later with delivery partners, because logistics updates can come in through webhooks or background jobs without changing the core order flow.
