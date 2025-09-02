import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import { QueryDebugger, DebugLogger } from './utils/debug.js';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with query logging if enabled
const poolConfig = { connectionString: process.env.DATABASE_URL };

export const pool = new Pool(poolConfig);

// Add query debugging if enabled
if (process.env.ENABLE_QUERY_LOGGING === 'true') {
  const originalQuery = pool.query.bind(pool);
  
  pool.query = async function(queryTextOrConfig: any, values?: any[], callback?: any) {
    const start = Date.now();
    let query: string;
    let params: any[] | undefined;
    
    // Handle different query argument formats
    if (typeof queryTextOrConfig === 'string') {
      query = queryTextOrConfig;
      params = values;
    } else if (queryTextOrConfig && typeof queryTextOrConfig === 'object' && 'text' in queryTextOrConfig) {
      query = queryTextOrConfig.text;
      params = queryTextOrConfig.values;
    } else {
      query = 'Unknown query format';
    }
    
    try {
      const result = await originalQuery(queryTextOrConfig, values, callback);
      const duration = Date.now() - start;
      
      // Log successful query
      QueryDebugger.logQuery(query, params, duration);
      
      return result;
    } catch (error) {
      // Log failed query
      QueryDebugger.logError(query, error);
      throw error;
    }
  } as any;
  
  DebugLogger.info('Database query logging enabled', undefined, 'DATABASE');
}

// Log pool connection events in debug mode
if (process.env.DEBUG_LEVEL === 'DEBUG' || process.env.DEBUG_LEVEL === 'TRACE') {
  pool.on('connect', () => {
    DebugLogger.debug('Database pool: client connected', undefined, 'DATABASE');
  });
  
  pool.on('acquire', () => {
    DebugLogger.trace('Database pool: client acquired', undefined, 'DATABASE');
  });
  
  pool.on('error', (err) => {
    DebugLogger.error('Database pool error', err, 'DATABASE');
  });
  
  pool.on('remove', () => {
    DebugLogger.trace('Database pool: client removed', undefined, 'DATABASE');
  });
}

export const db = drizzle(pool, { schema });