# 🛡️ Database Permission Issue Prevention Guide

## Problem Summary
Database files sometimes get created with `root` ownership, causing `SQLITE_READONLY` errors when the Node.js process (running as `elijah`) tries to write to them.

## 🔧 Prevention Measures Implemented

### 1. **Proactive Permission Checking**
- All database write operations now check permissions before executing
- Automatic ownership fixing when issues are detected
- Located in: `src/modules/auth/services/database.ts`

### 2. **Proper Umask Configuration**
- Set `process.umask(0o002)` in main application
- Ensures new files are created with group write permissions
- Located in: `src/index.ts`

### 3. **Systemd Service Configuration**
- Service runs as `User=elijah` and `Group=elijah`
- Prevents root ownership of new files
- Located in: `systemd-services/bovisgl-web.service`

### 4. **Automatic Maintenance Script**
- Run `./scripts/fix-database-permissions.sh` to fix issues
- Can be automated via cron if needed
- Tests database access after fixing

### 5. **Enhanced Database Operations**
- All write operations include permission checks
- Automatic fixing before database operations
- Prevents errors before they occur

## 🚨 If Issues Still Occur

### Quick Fix Commands:
```bash
# Manual fix
sudo chown -R elijah:elijah data/
sudo chmod -R 755 data/
sudo chmod 664 data/admins/*.db

# Or use the script
./scripts/fix-database-permissions.sh
```

### Emergency Debugging:
```bash
# Check current ownership
ls -la data/admins/

# Check process user
ps aux | grep node

# Test database access
sqlite3 data/admins/admins.db ".tables"
```

## 🔍 Root Causes to Monitor

1. **Process Elevation**: Check if Node.js process ever runs as root
2. **SQLite Behavior**: Monitor if SQLite creates temporary files as root
3. **File System**: Ensure proper mount options and directory permissions
4. **Service Restart**: Verify service doesn't restart with wrong user

## 📅 Maintenance Schedule

- **Daily**: Automatic permission checks (built into app)
- **Weekly**: Run permission fix script as preventive measure
- **Monthly**: Review logs for permission-related errors

## 🎯 Success Metrics

- ✅ No `SQLITE_READONLY` errors in logs
- ✅ All database files owned by `elijah:elijah`
- ✅ Permissions: `755` (directories), `664` (database files)
- ✅ Successful passkey registrations and authentications

## 📞 Troubleshooting Contacts

If issues persist:
1. Check the logs: `tail -f logs/backend-error.log`
2. Run diagnostics: `./scripts/fix-database-permissions.sh`
3. Review systemd service: `systemctl status bovisgl-web`

This prevention system should eliminate database permission issues permanently! 🎉 