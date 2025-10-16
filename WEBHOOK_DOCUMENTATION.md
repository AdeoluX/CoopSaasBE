# Paystack Webhook Implementation

## Overview

This document describes the Paystack webhook implementation for handling payment notifications in the CoopSaas application.

## Webhook Endpoint

**URL:** `POST /api/v1/webhook/paystack/webhook`

## Paystack Webhook Format

Paystack sends webhooks in the following format:

```json
{
  "event": "charge.success",
  "data": {
    "id": 5239215532,
    "domain": "test",
    "status": "success",
    "reference": "CNT-19d02857e59946fe8f89aa417184d22a",
    "amount": 1000000,
    "message": null,
    "gateway_response": "Successful",
    "paid_at": "2025-08-14T23:09:02.000Z",
    "created_at": "2025-08-14T23:08:57.000Z",
    "channel": "card",
    "currency": "NGN",
    "ip_address": "102.89.46.202",
    "metadata": {
      "contribution": "689e6c8713f731925359a268",
      "wallet": "689332a2eb6df606a01cbfef",
      "referrer": "http://localhost:5173/"
    },
    "fees": 25000,
    "customer": {
      "id": 297561246,
      "email": "alpha@cyberdyne.com",
      "customer_code": "CUS_d1ech8iyksbs52q"
    }
  }
}
```

## Security

### Signature Verification

All webhooks are verified using HMAC SHA512 signature verification:

1. Paystack sends the webhook payload with an `x-paystack-signature` header
2. The signature is generated using the webhook payload and your secret key
3. The application verifies the signature before processing the webhook

### Required Headers

- `Content-Type: application/json`
- `x-paystack-signature: <hmac_sha512_signature>`

## Supported Events

Currently, the webhook handles the following Paystack events:

- `charge.success` - Successful payment
- `charge.failed` - Failed payment

Other events are ignored and return a 200 status with "Event ignored" message.

## Processing Flow

### 1. Webhook Reception

- Webhook is received at `/api/v1/webhook/paystack/webhook`
- Signature is verified for security
- Event type is validated

### 2. Transaction Processing

- Transaction is found by reference
- Status is updated based on the event
- For successful payments, wallet balance is updated
- All operations are wrapped in a database transaction

### 3. Wallet Balance Update

- For successful payments (`charge.success`):

  - Finds the wallet for the member, currency, and assetId
  - Updates the wallet balance using the transaction amount
  - Links the transaction to the wallet

- For failed payments (`charge.failed`):
  - Only updates transaction status to "failed"
  - No wallet balance changes

## Database Schema

### Transaction Model

```javascript
{
  member: ObjectId,
  cooperativeId: ObjectId,
  amount: Number,
  status: String, // "pending", "success", "failed"
  type: String, // "CR", "DR"
  descriptions: String,
  reference: String, // Unique reference from Paystack
  currency: String, // "NGN", "USD"
  assetId: ObjectId, // Optional - for asset-specific contributions
  createdAt: Date
}
```

### Wallet Model

```javascript
{
  member: ObjectId,
  cooperativeId: ObjectId,
  assetId: ObjectId, // null for general contributions
  ledger_balance: Number,
  currency: String,
  transactions: [ObjectId]
}
```

## Error Handling

### Common Error Scenarios

1. **Invalid Signature (401)**

   - Webhook signature doesn't match
   - Indicates potential security breach

2. **Invalid Webhook Format (400)**

   - Missing event or data fields
   - Malformed webhook payload

3. **Missing Required Fields (400)**

   - Missing reference or status in data
   - Incomplete webhook data

4. **Transaction Not Found**

   - Reference doesn't match any transaction
   - Transaction may have been deleted or reference is incorrect

5. **Wallet Not Found**
   - No wallet exists for the member/currency/assetId combination
   - Indicates data inconsistency

## Testing

Run the webhook tests:

```bash
npm test test/webhook.test.js
```

The tests cover:

- Successful charge processing
- Failed charge processing
- Invalid signature rejection
- Non-charge event handling

## Configuration

### Environment Variables

- `PAYSTACK_SECRET_KEY` - Your Paystack secret key for signature verification
- `MONGODB_URI` - MongoDB connection string

### Webhook URL Setup

In your Paystack dashboard:

1. Go to Settings > Webhooks
2. Add webhook URL: `https://yourdomain.com/api/v1/webhook/paystack/webhook`
3. Select events: `charge.success`, `charge.failed`
4. Save the webhook configuration

## Monitoring

The webhook implementation includes comprehensive logging:

- Webhook reception with full payload
- Signature verification results
- Transaction processing steps
- Wallet balance updates
- Error details for debugging

Check your application logs to monitor webhook processing and troubleshoot issues.

## Troubleshooting

### Common Issues

1. **Webhook not being received**

   - Check webhook URL configuration in Paystack dashboard
   - Verify server is accessible from Paystack's servers
   - Check firewall settings

2. **Signature verification failing**

   - Ensure `PAYSTACK_SECRET_KEY` is correct
   - Verify webhook payload format
   - Check for any middleware modifying the request body

3. **Transaction not found**

   - Verify reference format matches your transaction references
   - Check if transaction was created before webhook processing
   - Ensure transaction wasn't deleted

4. **Wallet not found**
   - Verify wallet creation in contribute function
   - Check assetId matching logic
   - Ensure member and currency combination exists
