# Dev Memory Usage Guide

## Initial Setup

1. Install Dependencies
```bash
cd /Documents/Cline/MCP/dev-memory-server
npm install
```

2. Configure MCP Settings
```json
{
  "mcpServers": {
    "dev-memory": {
      "command": "node",
      "args": ["/Users/chetpaslawski/Documents/Cline/MCP/dev-memory-server/build/index.js"]
    }
  }
}
```

3. Set up Git Hooks
```bash
chmod +x .git/hooks/post-commit
```

## Starting the Server

### Method 1: Automatic (Recommended)
```bash
# Start server with auto-restart
./scripts/start-dev-memory.sh
```

### Method 2: Manual
```bash
cd /Documents/Cline/MCP/dev-memory-server
npm start
```

## Verifying Operation

1. Check Server Status
```bash
ps aux | grep dev-memory-server
```

2. View Logs
```bash
tail -f .dev-memory/logs/server.log
```

3. Test Memory Storage
```bash
# Make a test commit
git commit --allow-empty -m "test: verify memory system"

# Check stored context
ls -l .dev-memory/interactions/
```

## Monitoring

1. System Dashboard
- Open the monitoring dashboard in the application
- Check the Dev Memory metrics panel
- Monitor real-time context capture

2. Log Files
- Server logs: `.dev-memory/logs/server.log`
- Memory metrics: `.dev-memory/metadata/memory-stats.json`

## Troubleshooting

### Server Won't Start
1. Check permissions:
```bash
ls -l scripts/start-dev-memory.sh
ls -l .git/hooks/post-commit
```

2. Verify MCP settings:
```bash
cat ~/Library/Application\ Support/Windsurf/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

3. Check logs:
```bash
cat .dev-memory/logs/server.log
```

### Memory Not Being Captured
1. Verify Git hooks:
```bash
ls -l .git/hooks/post-commit
cat .git/hooks/post-commit
```

2. Check server status:
```bash
ps aux | grep dev-memory-server
```

3. Test manual context storage:
```bash
curl -X POST http://localhost:3000/api/memory/store \
  -H "Content-Type: application/json" \
  -d '{"context_type":"test","content":"test content","metadata":{"source":"manual","priority":1}}'
```

## Maintenance

### Cleanup Old Data
```bash
# Use the optimize_memory tool
curl -X POST http://localhost:3000/api/memory/optimize \
  -H "Content-Type: application/json" \
  -d '{"strategy":"prune"}'
```

### Backup
```bash
# Backup the .dev-memory directory
tar -czf dev-memory-backup-$(date +%Y%m%d).tar.gz .dev-memory/
```

## Best Practices

1. Server Management
- Use the automatic startup script
- Monitor logs regularly
- Set up log rotation

2. Context Storage
- Use meaningful commit messages
- Keep context focused and relevant
- Clean up old data periodically

3. Integration
- Keep Git hooks up to date
- Verify MCP settings after updates
- Monitor system metrics

## Common Issues

1. "Server already running"
- Check for existing processes
- Remove stale PID file if necessary
- Restart the server

2. "Context not being stored"
- Verify server status
- Check Git hook permissions
- Review server logs

3. "High memory usage"
- Run cleanup operation
- Monitor context size
- Adjust retention policies
