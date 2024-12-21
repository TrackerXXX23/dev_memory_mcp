const { PineconeStore } = require('./core/store/pinecone');
require('dotenv').config();

async function testConnection() {
  const config = {
    apiKey: process.env.PINECONE_API_KEY!,
    environment: process.env.PINECONE_ENVIRONMENT!,
    indexName: process.env.PINECONE_INDEX_NAME!
  };

  console.log('Testing Pinecone connection with:');
  console.log(`Environment: ${config.environment}`);
  console.log(`Index: ${config.indexName}`);
  
  const store = new PineconeStore(config);
  
  try {
    console.log('\nInitializing connection...');
    const result = await store.initialize();
    
    if (result.success) {
      console.log('✅ Successfully connected to Pinecone!');
      
      // Test connection status
      const status = store.getConnectionStatus();
      console.log('\nConnection Status:');
      console.log(`Connected: ${status.isConnected}`);
      console.log(`Last Error: ${status.lastError}`);
      
      // Clean up
      store.dispose();
      process.exit(0);
    } else {
      console.error('❌ Failed to connect:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testConnection();
