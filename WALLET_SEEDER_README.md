# Wallet Seeder

This directory contains scripts to create wallets for members who don't have them.

## Files

- `seed-wallet.js` - Simple wallet seeder for a specific member
- `seed-member-wallets.js` - Comprehensive wallet seeder with multiple options
- `run-wallet-seeder.js` - Command-line runner script

## Usage

### Quick Start

Create a wallet for the default member (juwontayo@gmail.com):

```bash
node run-wallet-seeder.js
```

### Create Wallet for Specific Member

```bash
node run-wallet-seeder.js --email=juwontayo@gmail.com
```

### Create Wallets for All Members Without Wallets

```bash
node run-wallet-seeder.js --all
```

### List Members Without Wallets

```bash
node run-wallet-seeder.js --list
```

### Show Help

```bash
node run-wallet-seeder.js --help
```

## Direct Script Usage

### Using seed-wallet.js

```bash
node seed-wallet.js
```

This will create a wallet for `juwontayo@gmail.com`.

### Using seed-member-wallets.js

```bash
node seed-member-wallets.js
```

This will:

1. Create a member wallet for `juwontayo@gmail.com`
2. Create all wallet types for the member
3. List all members without wallets

## Wallet Types

The seeder can create different types of wallets:

- **member** - General member wallet (default)
- **contribution** - For cooperative contributions
- **asset** - For specific asset investments
- **external** - For external transactions

## Environment Variables

Make sure you have the following environment variables set:

- `MONGODB_URI` - MongoDB connection string (defaults to `mongodb://localhost:27017/cooperative`)

## What the Seeder Does

1. **Connects to MongoDB** using the configured connection string
2. **Finds the member** by email address
3. **Checks for existing wallets** to avoid duplicates
4. **Creates the wallet** with appropriate settings
5. **Updates the member** to include the wallet in their wallets array
6. **Logs the process** with detailed information

## Example Output

```
MongoDB Connected: localhost
Creating wallet for member: juwontayo@gmail.com
Found member: John Doe (ID: 68dbe198b321b8c06b018aba)
Member belongs to cooperative: Test Cooperative (ID: 68dbe198b321b8c06b018abb)
✅ Successfully created member wallet with ID: 68dbe198b321b8c06b018abc
   Balance: ₦0
   Currency: NGN
✅ Added wallet to member's wallets array
✅ Wallet seeding completed successfully!
```

## Troubleshooting

### Member Not Found

If you get "Member with email X not found", make sure:

- The member exists in the database
- The email address is spelled correctly
- The member has been properly registered

### Cooperative Not Found

If you get "Cooperative not found for member", make sure:

- The member has a valid `cooperativeId`
- The cooperative exists in the database

### Wallet Already Exists

If a wallet already exists, the seeder will:

- Log the existing wallet information
- Return the existing wallet instead of creating a new one
- Continue without error

## Integration with Existing Code

The seeder follows the same patterns as the existing codebase:

- Uses the same models (`Member`, `Wallet`, `Cooperative`)
- Follows the same database connection pattern
- Uses the same error handling approach
- Maintains consistency with existing wallet creation logic

