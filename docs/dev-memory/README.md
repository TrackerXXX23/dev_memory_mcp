# Dev Memory System

## Overview
The Dev Memory system is an autonomous development context capture system that automatically records and organizes development activities, code changes, and user interactions. It provides persistent memory across development sessions without requiring manual intervention.

## Current Status (Dec 19, 2024)

### Implemented Features
1. Git Integration
   - Automatic commit context capture
   - Stores commit messages and diffs
   - Millisecond-precision timestamps
   - JSON-formatted storage

2. File Organization
```
.dev-memory/
├── interactions/     # Stored development contexts
├── metadata/        # System metrics and stats
└── logs/           # Server and operation logs
```

3. Automatic Server
   - Auto-start on system boot
   - Crash recovery
   - Health monitoring

## Setup

### 1. Initial Installation
```bash
# From project root
./scripts/setup-dev-memory.sh
```

This will:
- Install the Dev Memory server
- Configure Git hooks
- Set up auto-start service
- Create necessary directories

### 2. Verify Installation
```bash
# Check server status
ps aux | grep dev-memory-server

# View logs
tail -f .dev-memory/logs/server.log

# Test with a commit
git commit --allow-empty -m "test: verify dev memory system"
```

### 3. Monitor Operation
```bash
# Check stored contexts
ls -l .dev-memory/interactions/

# View latest context
ls -t .dev-memory/interactions/ | head -n 1 | xargs cat
```

## Architecture

### Components

1. MCP Server
   - Stdio-based communication
   - Integrated with VSCode
   - Provides context storage and retrieval

2. Git Hooks
   - Post-commit hook for automatic capture
   - JSON-formatted context storage
   - Millisecond precision timestamps

3. System Monitor
   - Health checks
   - Automatic restart
   - Log rotation

## Usage

### Automatic Context Capture
The system automatically captures:
1. Git commits (messages and diffs)
2. Development events
3. System metrics

### Manual Operations
```bash
# Start server manually (if needed)
./scripts/start-dev-memory.sh

# Stop server
pkill -f dev-memory-server

# Clear old contexts
rm -rf .dev-memory/interactions/*
```

## Maintenance

### Log Management
- Logs stored in `.dev-memory/logs/`
- Automatic rotation
- Health check logs

### Backup
```bash
# Backup all contexts
tar -czf dev-memory-backup-$(date +%Y%m%d).tar.gz .dev-memory/
```

### Troubleshooting

1. Server Issues
```bash
# Check logs
tail -f .dev-memory/logs/server.log

# Restart server
./scripts/start-dev-memory.sh
```

2. Git Hook Issues
```bash
# Check permissions
ls -l .git/hooks/post-commit

# Verify hook content
cat .git/hooks/post-commit
```

3. Storage Issues
```bash
# Check space
du -sh .dev-memory/

# Clear old data
find .dev-memory/interactions -mtime +30 -delete
```

## Future Development

### Phase 1: Robustness
- [ ] Cross-platform testing
- [ ] Enhanced error recovery
- [ ] Better logging

### Phase 2: Intelligence
- [ ] Context relevance scoring
- [ ] Pattern recognition
- [ ] Smart pruning

### Phase 3: Integration
- [ ] CI/CD pipeline hooks
- [ ] Team collaboration
- [ ] External tool integration

## Best Practices

1. Git Commits
   - Use descriptive messages
   - Keep changes focused
   - Regular commits

2. System Monitoring
   - Check logs regularly
   - Monitor disk usage
   - Verify captures

3. Maintenance
   - Regular backups
   - Clean old data
   - Update hooks

## Contributing
1. Follow JSON format for contexts
2. Test hooks thoroughly
3. Document changes
4. Update monitoring
