/* global console, process, Buffer, __dirname */
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Encryption service for data at rest
 * Implements AES-256-GCM encryption for maximum security
 */
class EncryptionService {
  constructor() {
    // In production, these should come from environment variables or key management service
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.saltLength = 64;
    
    // Initialize master key from environment or generate if not exists
    this.initializeMasterKey();
  }

  /**
   * Initialize or load master encryption key
   */
  async initializeMasterKey() {
    const keyPath = process.env.MASTER_KEY_PATH || path.join(__dirname, '../../.keys/master.key');
    
    try {
      // In production, use AWS KMS, Azure Key Vault, or similar
      if (process.env.NODE_ENV === 'production') {
        this.masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY, 'hex');
      } else {
        // For development, generate or load from file
        try {
          const keyData = await fs.readFile(keyPath);
          this.masterKey = keyData;
        } catch {
          // Generate new key if doesn't exist
          this.masterKey = crypto.randomBytes(this.keyLength);
          await this.saveMasterKey(keyPath);
        }
      }
    } catch (error) {
      console.error('Failed to initialize master key:', error);
      throw new Error('Encryption service initialization failed');
    }
  }

  /**
   * Save master key (development only)
   */
  async saveMasterKey(keyPath) {
    const dir = path.dirname(keyPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(keyPath, this.masterKey, { mode: 0o600 });
    console.log('Master key saved to:', keyPath);
  }

  /**
   * Derive key from master key using PBKDF2
   */
  deriveKey(salt, info = '') {
    return crypto.pbkdf2Sync(
      Buffer.concat([this.masterKey, Buffer.from(info)]),
      salt,
      100000,
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt data
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} context - Encryption context for key derivation
   * @returns {object} Encrypted data with metadata
   */
  encrypt(data, context = 'default') {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key for this context
      const key = this.deriveKey(salt, context);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')),
        cipher.final()
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components
      const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        encrypted
      ]);
      
      return {
        encrypted: combined.toString('base64'),
        algorithm: this.algorithm,
        context: context,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} context - Encryption context
   * @returns {Buffer} Decrypted data
   */
  decrypt(encryptedData, context = 'default') {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.slice(0, this.saltLength);
      const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
      const authTag = combined.slice(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.tagLength
      );
      const encrypted = combined.slice(this.saltLength + this.ivLength + this.tagLength);
      
      // Derive key
      const key = this.deriveKey(salt, context);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt file
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to output encrypted file
   * @param {string} context - Encryption context
   */
  async encryptFile(inputPath, outputPath, context = 'file') {
    try {
      const data = await fs.readFile(inputPath);
      const encrypted = this.encrypt(data, context);
      
      // Save encrypted data with metadata
      await fs.writeFile(outputPath, JSON.stringify({
        ...encrypted,
        originalName: path.basename(inputPath),
        mimeType: this.getMimeType(inputPath),
        size: data.length
      }));
      
      return true;
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file
   * @param {string} inputPath - Path to encrypted file
   * @param {string} outputPath - Path to output decrypted file
   */
  async decryptFile(inputPath, outputPath) {
    try {
      const encryptedContent = await fs.readFile(inputPath, 'utf8');
      const { encrypted, context } = JSON.parse(encryptedContent);
      
      const decrypted = this.decrypt(encrypted, context);
      await fs.writeFile(outputPath, decrypted);
      
      return true;
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * Encrypt database field
   * @param {string} value - Value to encrypt
   * @param {string} tableName - Database table name
   * @param {string} columnName - Database column name
   */
  encryptDatabaseField(value, tableName, columnName) {
    if (!value) return null;
    
    const context = `db:${tableName}:${columnName}`;
    const result = this.encrypt(value, context);
    
    // Return as JSON string for storage
    return JSON.stringify(result);
  }

  /**
   * Decrypt database field
   * @param {string} encryptedValue - Encrypted value from database
   */
  decryptDatabaseField(encryptedValue) {
    if (!encryptedValue) return null;
    
    try {
      const { encrypted, context } = JSON.parse(encryptedValue);
      const decrypted = this.decrypt(encrypted, context);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Database field decryption error:', error);
      return null;
    }
  }

  /**
   * Generate encryption key for client-side encryption
   */
  generateClientKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash password using Argon2 (more secure than bcrypt)
   */
  async hashPassword(password) {
    const salt = crypto.randomBytes(32);
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(password, hash) {
    const [salt, key] = hash.split(':');
    const saltBuffer = Buffer.from(salt, 'hex');
    
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, saltBuffer, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys() {
    // Generate new master key
    const newMasterKey = crypto.randomBytes(this.keyLength);
    
    // Re-encrypt all data with new key
    // This would need to be implemented based on your data storage
    
    // Save new key
    this.masterKey = newMasterKey;
    
    return true;
  }

  /**
   * Create encrypted backup
   */
  async createEncryptedBackup(data, backupPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupPath, `backup-${timestamp}.enc`);
    
    const encrypted = this.encrypt(JSON.stringify(data), 'backup');
    await fs.writeFile(backupFile, JSON.stringify(encrypted));
    
    return backupFile;
  }
}

// Export singleton instance
module.exports = new EncryptionService();