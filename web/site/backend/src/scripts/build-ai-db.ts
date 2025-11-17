/**
 * AI Info Database Builder - TypeScript Version
 * Builds a searchable database from BovisGL documentation and knowledge base
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
// When compiled, runs from web/site/backend/dist/scripts
// BovisGL root is ../../../../.. from the dist folder (5 levels up from dist/scripts)
const BOVISGL_ROOT = path.resolve(__dirname, '../../../../..');
const DOCS_DIR = path.join(BOVISGL_ROOT, 'AI/docs');
const KNOWLEDGE_BASE_PATH = path.join(BOVISGL_ROOT, 'AI/bovisgl-knowledge-base.json');
const DB_PATH = path.join(__dirname, '../../data/AI/ai-info.sqlite');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

interface DocumentMetadata {
  filename: string;
  title: string;
  section: string;
  keywords: string[];
}

interface KnowledgeSection {
  key: string;
  title: string;
  content: string;
}

/**
 * Split text into overlapping chunks for better search granularity
 */
function splitIntoChunks(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (end < text.length) {
      // Try to break at sentence or line boundaries
      const lastSentence = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastSentence, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.5) {
        chunks.push(text.slice(start, breakPoint + 1).trim());
        start = breakPoint + 1 - overlap;
      } else {
        chunks.push(chunk.trim());
        start = end - overlap;
      }
    } else {
      chunks.push(chunk.trim());
      break;
    }
  }
  
  return chunks.filter(chunk => chunk.length > 20);
}

/**
 * Extract metadata from document content
 */
function extractMetadata(filename: string, content: string): DocumentMetadata {
  const metadata: DocumentMetadata = {
    filename,
    title: '',
    section: '',
    keywords: []
  };
  
  // Extract title from markdown heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  } else {
    metadata.title = filename.replace('.md', '').replace(/-/g, ' ');
  }
  
  // Determine section based on filename
  if (filename.includes('server')) {
    metadata.section = 'servers';
  } else if (filename.includes('connection') || filename.includes('getting-started')) {
    metadata.section = 'setup';
  } else if (filename.includes('faq') || filename.includes('help')) {
    metadata.section = 'help';
  } else if (filename.includes('rules') || filename.includes('community')) {
    metadata.section = 'rules';
  } else if (filename.includes('network') || filename.includes('features')) {
    metadata.section = 'features';
  } else {
    metadata.section = 'general';
  }
  
  // Extract keywords
  const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'you', 'your', 'we', 'our', 'they', 'their', 'it', 'its']);
  
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));
    
  const wordCount: Record<string, number> = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  metadata.keywords = Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  return metadata;
}

/**
 * Create a simple hash-based embedding for text
 * This provides basic semantic similarity without requiring ML libraries
 */
function createSimpleEmbedding(text: string): Float32Array {
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/);
  const vector = new Array(384).fill(0);
  
  words.forEach((word, i) => {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff;
    }
    const index = Math.abs(hash) % vector.length;
    vector[index] += 1 / (words.length + 1);
  });
  
  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  const normalized = magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  
  return new Float32Array(normalized);
}

/**
 * Initialize the database with proper schema
 */
function initDatabase(): Database.Database {
  // Ensure the directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  // Create tables and indexes for AI info
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT NOT NULL,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      chunk_index INTEGER NOT NULL
    )
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_chunks_section ON ai_chunks(section)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_chunks_filename ON ai_chunks(filename)`);
  
  // Clear existing data
  db.exec('DELETE FROM ai_chunks');
  
  console.log('✅ AI Info Database initialized');
  return db;
}

/**
 * Process the JSON knowledge base
 */
function processJsonKnowledgeBase(db: Database.Database, jsonPath: string): void {
  try {
    console.log('📖 Processing JSON knowledge base...');
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const knowledge = JSON.parse(jsonContent);
    
    // Convert JSON sections to searchable text chunks
    const sections: KnowledgeSection[] = [
      { key: 'general', title: 'General Information', content: JSON.stringify(knowledge.general, null, 2) },
      { key: 'servers', title: 'Server Information', content: JSON.stringify(knowledge.servers, null, 2) },
      { key: 'connection', title: 'Connection Information', content: JSON.stringify(knowledge.connection, null, 2) },
      { key: 'rules', title: 'Server Rules', content: JSON.stringify(knowledge.rules, null, 2) },
      { key: 'community', title: 'Community Information', content: JSON.stringify(knowledge.community, null, 2) },
      { key: 'technical', title: 'Technical Information', content: JSON.stringify(knowledge.technical, null, 2) },
      { key: 'getting_started', title: 'Getting Started Guide', content: JSON.stringify(knowledge.getting_started, null, 2) },
      { key: 'faq', title: 'Frequently Asked Questions', content: JSON.stringify(knowledge.faq, null, 2) }
    ];
    
    // Prepare insert statement for knowledge base
    const insertStmt = db.prepare(`
      INSERT INTO ai_chunks (filename, title, section, content, keywords, embedding, chunk_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    sections.forEach(section => {
      // Create a more readable version of the JSON content
      let readableContent = `${section.title}\n\n`;
      
      if (section.key === 'servers') {
        Object.entries(knowledge.servers).forEach(([serverKey, serverInfo]: [string, any]) => {
          readableContent += `${serverInfo.name}: ${serverInfo.description}\n`;
          readableContent += `Purpose: ${serverInfo.purpose}\n`;
          readableContent += `Features: ${serverInfo.features.join(', ')}\n\n`;
        });
      } else if (section.key === 'faq') {
        Object.entries(knowledge.faq).forEach(([question, answer]) => {
          readableContent += `Q: ${question.replace(/_/g, ' ')}\nA: ${answer}\n\n`;
        });
      } else if (section.key === 'connection') {
        readableContent += `Server Address: ${knowledge.connection.address}\n`;
        readableContent += `Java Port: ${knowledge.connection.java_port}\n`;
        readableContent += `Bedrock Port: ${knowledge.connection.bedrock_port}\n`;
        readableContent += `Version: ${knowledge.connection.version}\n`;
        readableContent += `Instructions: ${knowledge.connection.instructions}\n`;
      } else {
        readableContent += section.content.replace(/[{}",]/g, ' ').replace(/\s+/g, ' ');
      }
      
      const chunks = splitIntoChunks(readableContent);
      
      chunks.forEach((chunk, i) => {
        const embedding = createSimpleEmbedding(chunk);
        const embeddingBuffer = Buffer.from(embedding.buffer);
        
        try {
          insertStmt.run(
            'knowledge-base.json',
            section.title,
            section.key,
            chunk,
            JSON.stringify([section.key, 'bovisgl', 'server', 'minecraft']),
            embeddingBuffer,
            i
          );
        } catch (err) {
          console.error('Error inserting knowledge base chunk:', err);
        }
      });
    });
    
    console.log('✅ JSON knowledge base processed');
    
  } catch (error) {
    console.error('Error processing JSON knowledge base:', error);
  }
}

/**
 * Process markdown documentation files
 */
function processMarkdownFiles(db: Database.Database): void {
  if (!fs.existsSync(DOCS_DIR)) {
    console.log('📚 No documentation directory found, skipping markdown processing');
    return;
  }

  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.md'));
  console.log(`📚 Found ${files.length} documentation files`);
  
  if (files.length === 0) {
    return;
  }

  // Prepare insert statement for markdown docs
  const insertStmt = db.prepare(`
    INSERT INTO ai_chunks (filename, title, section, content, keywords, embedding, chunk_index)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let totalChunks = 0;
  
  for (const filename of files) {
    console.log(`📖 Processing ${filename}...`);
    
    const filePath = path.join(DOCS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const metadata = extractMetadata(filename, content);
    
    const chunks = splitIntoChunks(content);
    console.log(`  📄 Created ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = createSimpleEmbedding(chunk);
      const embeddingBuffer = Buffer.from(embedding.buffer);
      
      try {
        insertStmt.run(
          filename,
          metadata.title,
          metadata.section,
          chunk,
          JSON.stringify(metadata.keywords),
          embeddingBuffer,
          i
        );
        totalChunks++;
      } catch (err) {
        console.error(`Error inserting chunk for ${filename}:`, err);
      }
    }
  }
  
  console.log(`📊 Total chunks from markdown: ${totalChunks}`);
}

/**
 * Main function to build the AI info database
 */
function buildAIInfoDatabase(): void {
  console.log('🔧 Building BovisGL AI Info Database...');
  
  const db = initDatabase();
  
  try {
    // Process JSON knowledge base first
    if (fs.existsSync(KNOWLEDGE_BASE_PATH)) {
      processJsonKnowledgeBase(db, KNOWLEDGE_BASE_PATH);
    } else {
      console.log('📚 No knowledge base found, skipping JSON processing');
    }
    
    // Process markdown files
    processMarkdownFiles(db);
    
    // Get final statistics
    const totalChunks = db.prepare('SELECT COUNT(*) as count FROM ai_chunks').get() as { count: number };
    
    console.log(`✅ AI Info Database built successfully!`);
    console.log(`💾 Database saved to: ${DB_PATH}`);
    console.log(`📊 Total chunks: ${totalChunks.count}`);
    
  } catch (error) {
    console.error('❌ Error building AI Info Database:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the build process
buildAIInfoDatabase();
