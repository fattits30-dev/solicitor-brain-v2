#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Solicitor Brain MFA Setup Script\n');

// Generate MFA encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated MFA encryption key');
console.log('⚠️  IMPORTANT: Store this key securely in your .env file:\n');
console.log(`MFA_ENCRYPTION_KEY=${encryptionKey}\n`);

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📋 No .env file found. Creating from .env.example...');
  
  if (fs.existsSync(envExamplePath)) {
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    envContent = envContent.replace(
      'MFA_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32_or_crypto_randomBytes_32_toString_hex',
      `MFA_ENCRYPTION_KEY=${encryptionKey}`
    );
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file with generated MFA key\n');
  } else {
    console.log('❌ .env.example not found. Please create .env manually.\n');
  }
} else {
  console.log('📝 .env file exists. Please add the MFA_ENCRYPTION_KEY manually.\n');
}

console.log('🚀 Next steps:');
console.log('1. Update your .env file with the MFA encryption key above');
console.log('2. Configure SMTP settings for email verification (optional)');
console.log('3. Configure Twilio settings for SMS verification (optional)');
console.log('4. Run database migration: npm run db:migrate');
console.log('5. Restart your server to apply changes\n');

console.log('📚 For detailed setup instructions, see:');
console.log('   docs/MFA_IMPLEMENTATION.md\n');

console.log('🔒 Security reminders:');
console.log('• Store the MFA_ENCRYPTION_KEY securely');
console.log('• Use environment-specific keys for different environments');
console.log('• Never commit the encryption key to version control');
console.log('• Backup the key securely for disaster recovery\n');

console.log('Setup script completed! 🎉');