import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config();

async function testPineconeConnection() {
  console.log('Testing Pinecone connection with:');
  console.log(`Environment: ${process.env.PINECONE_ENVIRONMENT}`);
  console.log(`Index: ${process.env.PINECONE_INDEX_NAME}`);

  try {
    console.log('\nInitializing Pinecone client...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    console.log('Getting index...');
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

    console.log('Testing connection by describing index...');
    const stats = await index.describeIndexStats();
    
    console.log('\n✅ Successfully connected to Pinecone!');
    console.log('Index stats:', stats);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to connect to Pinecone:', error.message);
    process.exit(1);
  }
}

testPineconeConnection();
