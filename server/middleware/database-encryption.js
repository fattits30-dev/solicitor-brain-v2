const encryptionService = require('../services/encryption');

/**
 * Database encryption middleware
 * Automatically encrypts/decrypts sensitive fields
 */

// Define sensitive fields that should be encrypted
const ENCRYPTED_FIELDS = {
  users: ['email', 'phone', 'address'],
  clients: ['name', 'email', 'phone', 'address', 'nino', 'dob'],
  documents: ['content', 'metadata'],
  cases: ['sensitive_notes', 'client_instructions'],
  audit_logs: ['user_data', 'changes'],
  communications: ['message', 'recipient_details']
};

// Fields that should be hashed (one-way)
const HASHED_FIELDS = {
  users: ['password']
};

/**
 * Encrypt sensitive fields before database insert/update
 */
function encryptFields(tableName, data) {
  const encryptedData = { ...data };
  const fieldsToEncrypt = ENCRYPTED_FIELDS[tableName] || [];
  const fieldsToHash = HASHED_FIELDS[tableName] || [];

  // Encrypt specified fields
  fieldsToEncrypt.forEach(field => {
    if (encryptedData[field] !== undefined && encryptedData[field] !== null) {
      encryptedData[field] = encryptionService.encryptDatabaseField(
        encryptedData[field],
        tableName,
        field
      );
    }
  });

  // Hash specified fields
  fieldsToHash.forEach(async field => {
    if (encryptedData[field] !== undefined && encryptedData[field] !== null) {
      encryptedData[field] = await encryptionService.hashPassword(encryptedData[field]);
    }
  });

  return encryptedData;
}

/**
 * Decrypt sensitive fields after database read
 */
function decryptFields(tableName, data) {
  if (!data) return data;

  const decryptedData = Array.isArray(data) ? [...data] : { ...data };
  const fieldsToDecrypt = ENCRYPTED_FIELDS[tableName] || [];

  if (Array.isArray(decryptedData)) {
    return decryptedData.map(row => decryptRow(tableName, row, fieldsToDecrypt));
  } else {
    return decryptRow(tableName, decryptedData, fieldsToDecrypt);
  }
}

/**
 * Decrypt a single row
 */
function decryptRow(tableName, row, fieldsToDecrypt) {
  const decryptedRow = { ...row };
  
  fieldsToDecrypt.forEach(field => {
    if (decryptedRow[field] !== undefined && decryptedRow[field] !== null) {
      try {
        decryptedRow[field] = encryptionService.decryptDatabaseField(decryptedRow[field]);
      } catch (error) {
        console.error(`Failed to decrypt ${tableName}.${field}:`, error);
        decryptedRow[field] = '[DECRYPTION_ERROR]';
      }
    }
  });

  return decryptedRow;
}

/**
 * Create encrypted database query wrapper
 */
class EncryptedDatabase {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Execute SELECT query with automatic decryption
   */
  async query(text, params) {
    const result = await this.pool.query(text, params);
    
    // Extract table name from query (simple regex, enhance as needed)
    const tableMatch = text.match(/FROM\s+(\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      result.rows = decryptFields(tableName, result.rows);
    }
    
    return result;
  }

  /**
   * Execute INSERT with automatic encryption
   */
  async insert(tableName, data) {
    const encryptedData = encryptFields(tableName, data);
    
    const columns = Object.keys(encryptedData);
    const values = Object.values(encryptedData);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.pool.query(query, values);
    result.rows = decryptFields(tableName, result.rows);
    
    return result;
  }

  /**
   * Execute UPDATE with automatic encryption
   */
  async update(tableName, data, condition, conditionParams) {
    const encryptedData = encryptFields(tableName, data);
    
    const setClause = Object.keys(encryptedData)
      .map((col, i) => `${col} = $${i + 1}`)
      .join(', ');
    
    const values = [
      ...Object.values(encryptedData),
      ...conditionParams
    ];
    
    const query = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE ${condition}
      RETURNING *
    `;
    
    const result = await this.pool.query(query, values);
    result.rows = decryptFields(tableName, result.rows);
    
    return result;
  }

  /**
   * Search encrypted fields (requires special handling)
   */
  async searchEncrypted(tableName, field, searchTerm) {
    // For encrypted fields, we need to decrypt all and filter in memory
    // In production, consider using homomorphic encryption or searchable encryption
    
    const query = `SELECT * FROM ${tableName}`;
    const result = await this.query(query, []);
    
    // Filter in memory (not ideal for large datasets)
    const filtered = result.rows.filter(row => {
      const value = row[field];
      if (!value) return false;
      
      return value.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    return { rows: filtered };
  }

  /**
   * Backup with encryption
   */
  async createEncryptedBackup(tableName) {
    const query = `SELECT * FROM ${tableName}`;
    const result = await this.pool.query(query, []);
    
    // Don't decrypt for backup - keep encrypted
    const backupData = {
      tableName,
      timestamp: new Date().toISOString(),
      rowCount: result.rows.length,
      data: result.rows
    };
    
    return encryptionService.createEncryptedBackup(
      backupData,
      process.env.BACKUP_PATH || './backups'
    );
  }
}

/**
 * Express middleware for automatic encryption/decryption
 */
function encryptionMiddleware(req, res, next) {
  // Add encryption context to request
  req.encryption = {
    encrypt: (data, context) => encryptionService.encrypt(data, context),
    decrypt: (data, context) => encryptionService.decrypt(data, context),
    encryptField: (value, table, column) => 
      encryptionService.encryptDatabaseField(value, table, column),
    decryptField: (value) => 
      encryptionService.decryptDatabaseField(value)
  };

  // Override response.json to automatically redact sensitive data in responses
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Apply redaction for responses (separate from encryption)
    const redactedData = redactSensitiveData(data);
    return originalJson(redactedData);
  };

  next();
}

/**
 * Redact sensitive data from API responses
 */
function redactSensitiveData(data) {
  if (!data) return data;

  const redacted = JSON.parse(JSON.stringify(data));
  
  // Patterns to redact
  const patterns = [
    { regex: /\b[A-Z]{2}\d{6}[A-Z]\b/g, replacement: '[NINO_REDACTED]' }, // UK NINO
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' }, // US SSN
    { regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, replacement: '[CARD_REDACTED]' }, // Credit card
    { regex: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, replacement: '[IBAN_REDACTED]' } // IBAN
  ];

  function redactValue(value) {
    if (typeof value === 'string') {
      let redactedValue = value;
      patterns.forEach(({ regex, replacement }) => {
        redactedValue = redactedValue.replace(regex, replacement);
      });
      return redactedValue;
    }
    return value;
  }

  function redactObject(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactObject(obj[key]);
        } else {
          obj[key] = redactValue(obj[key]);
        }
      }
    }
  }

  if (Array.isArray(redacted)) {
    redacted.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        redactObject(item);
      }
    });
  } else if (typeof redacted === 'object' && redacted !== null) {
    redactObject(redacted);
  }

  return redacted;
}

module.exports = {
  EncryptedDatabase,
  encryptionMiddleware,
  encryptFields,
  decryptFields,
  redactSensitiveData
};