# Transaction Configuration Guide

## Overview

This application supports both transactional and non-transactional database operations to accommodate different MongoDB setups.

## Environment Configuration

### Development Environment (Default)

For development with standalone MongoDB instances:

```bash
# No additional environment variables needed
# Transactions will be disabled automatically
```

### Production Environment with Replica Set

For production with MongoDB replica sets that support transactions:

```bash
NODE_ENV=production
ENABLE_TRANSACTIONS=true
```

### Production Environment without Replica Set

For production with standalone MongoDB:

```bash
NODE_ENV=production
ENABLE_TRANSACTIONS=false
```

## How It Works

### Transaction Detection

The application automatically detects transaction support based on:

1. **Environment Variables**:

   - `NODE_ENV=production` AND `ENABLE_TRANSACTIONS=true` → Transactions enabled
   - All other cases → Transactions disabled

2. **Fallback Behavior**:
   - When transactions are disabled, operations execute without database sessions
   - All functionality remains intact, just without atomic guarantees

### Webhook Processing

- **With Transactions**: All database operations (transaction update + wallet balance update) are atomic
- **Without Transactions**: Operations execute sequentially (still safe for most use cases)

## Benefits

### Development

- ✅ Works with local MongoDB instances
- ✅ No replica set configuration required
- ✅ Faster setup and testing

### Production

- ✅ Can enable transactions for data consistency
- ✅ Graceful fallback for different MongoDB setups
- ✅ Configurable based on infrastructure

## Monitoring

Check the application logs to see transaction status:

```
Transaction support: enabled/disabled
Processing Paystack webhook for reference: CNT-xxx, status: success
Found transaction: xxx, member: xxx, amount: 1000, assetId: null
Payment successful, looking for wallet for member: xxx, currency: NGN, assetId: null
Found wallet: xxx, current balance: 5000
Updated wallet balance for wallet: xxx
Successfully processed webhook for reference: CNT-xxx, status: success
```

## Troubleshooting

### Common Issues

1. **MongoServerError: Transaction numbers are only allowed on a replica set member or mongos**

   - **Solution**: Set `ENABLE_TRANSACTIONS=false` or don't set it at all
   - **Cause**: Trying to use transactions on standalone MongoDB

2. **Transactions not working in production**

   - **Solution**: Ensure `NODE_ENV=production` and `ENABLE_TRANSACTIONS=true`
   - **Cause**: Environment variables not set correctly

3. **Data inconsistency concerns**
   - **Solution**: Enable transactions in production with replica set
   - **Cause**: Operations executing without atomic guarantees

## Migration Guide

### From Transactions to Non-Transactions

No migration needed - the application handles this automatically.

### From Non-Transactions to Transactions

1. Set up MongoDB replica set
2. Set environment variables:
   ```bash
   NODE_ENV=production
   ENABLE_TRANSACTIONS=true
   ```
3. Restart the application

## Best Practices

1. **Development**: Use default settings (no transactions)
2. **Staging**: Test with both transaction modes
3. **Production**: Use transactions if replica set is available
4. **Monitoring**: Always check logs for transaction status
5. **Testing**: Test webhook functionality in both modes
