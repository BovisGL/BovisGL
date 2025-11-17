# Database Permissions Best Practices

## ⚠️ Preventing SQLITE_READONLY Errors

This document outlines best practices to prevent database permission issues.

## 🛠️ Available Utilities

### 1. `ensureWritableDatabase(dbPath)`
Call this before any database operations to check and fix permissions:
```typescript
import { ensureWritableDatabase } from './modules/auth/services/database.js';

await ensureWritableDatabase('/path/to/your/database.db');
```

### 2. `createDatabaseWithOwnership(dbPath, createTables?)`
Use this to create new databases with proper ownership:
```typescript
import { createDatabaseWithOwnership } from './modules/auth/services/database.js';

const db = await createDatabaseWithOwnership('/path/to/new/database.db', async (db) => {
  await db.exec(`CREATE TABLE IF NOT EXISTS my_table (...)`);
});
```

### 3. `fixOwnership(filePath)`
Manually fix ownership of files or directories:
```typescript
import { fixOwnership } from './modules/auth/services/database.js';

await fixOwnership('/path/to/file-or-directory');
```

## 📋 Checklist for New Databases

1. **Directory Creation**: Ensure parent directory exists with proper ownership
2. **Database Creation**: Use `createDatabaseWithOwnership()` for new databases
3. **Permission Check**: Call `ensureWritableDatabase()` before operations
4. **Error Handling**: Catch and handle permission errors gracefully

## 🚨 Common Issues

- **Database owned by root**: Use `sudo chown -R $USER:$USER data/` to fix
- **Directory permissions**: Ensure data directories are writable by the Node.js process
- **File creation**: New files may inherit wrong ownership - always fix after creation

## 🔧 Manual Fix Commands

```bash
# Fix ownership of entire data directory
sudo chown -R $USER:$USER data/

# Check current ownership
ls -la data/

# Test database writability
sqlite3 data/mydatabase.db ".tables"
```

## 💡 Prevention Tips

1. Always run the Node.js process as the same user that owns the data files
2. Use the provided utility functions instead of direct file operations
3. Set proper umask to ensure new files have correct permissions
4. Test database operations in development before deploying 