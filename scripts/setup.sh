#!/bin/bash

# Configuration
PROJECT_ROOT="$(pwd)"
MCP_SETTINGS_FILE="/Users/chetpaslawski/Library/Application Support/Windsurf/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"

echo "Setting up Dev Memory system..."

# 1. Create necessary directories
mkdir -p "$PROJECT_ROOT/.dev-memory/"{context,interactions,metadata,logs}

# 2. Build the server
npm run build

# 3. Update MCP settings
if [ -f "$MCP_SETTINGS_FILE" ]; then
    # Backup existing settings
    cp "$MCP_SETTINGS_FILE" "${MCP_SETTINGS_FILE}.backup"
    
    # Update settings (using temp file to handle JSON properly)
    node -e "
        const fs = require('fs');
        const settings = JSON.parse(fs.readFileSync('$MCP_SETTINGS_FILE', 'utf8'));
        settings.mcpServers = settings.mcpServers || {};
        settings.mcpServers['dev-memory'] = {
            command: 'node',
            args: ['$PROJECT_ROOT/build/index.js']
        };
        fs.writeFileSync('$MCP_SETTINGS_FILE', JSON.stringify(settings, null, 2));
    "
else
    echo "{
        \"mcpServers\": {
            \"dev-memory\": {
                \"command\": \"node\",
                \"args\": [\"$PROJECT_ROOT/build/index.js\"]
            }
        }
    }" > "$MCP_SETTINGS_FILE"
fi

# 4. Set up Git hooks
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
if [ -d "$GIT_HOOKS_DIR" ]; then
    echo "Setting up Git hooks..."
    
    # Create post-commit hook
    cat > "$GIT_HOOKS_DIR/post-commit" << 'EOF'
#!/bin/bash
COMMIT_MSG=$(git log -1 HEAD --pretty=format:%B)
COMMIT_HASH=$(git rev-parse HEAD)
DIFF=$(git diff HEAD^)

# Store commit context
curl -X POST http://localhost:3000/api/memory/store \
  -H "Content-Type: application/json" \
  -d "{
    \"context_type\": \"development\",
    \"content\": \"$COMMIT_MSG\n\n$DIFF\",
    \"metadata\": {
      \"source\": \"git\",
      \"priority\": 3,
      \"commit\": \"$COMMIT_HASH\"
    }
  }"
EOF

    chmod +x "$GIT_HOOKS_DIR/post-commit"
fi

# 5. Start the server
echo "Starting Dev Memory server..."
npm start &

echo "Dev Memory system setup complete!"
echo "The server will now start automatically when needed."
echo "You can monitor it at:"
echo "- Logs: $PROJECT_ROOT/.dev-memory/logs/"
echo "- Status: ps aux | grep dev-memory-server"
