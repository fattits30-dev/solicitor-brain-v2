// Debug Test Endpoint for VS Code
// Add this to your server or run standalone

const express = require('express');
const app = express();
const PORT = 3334;

app.use(express.json());

// Test endpoint with multiple variables to inspect
app.get('/debug-test', (req, res) => {
  // Set a breakpoint on the next line (click in gutter or press F9)
  const message = 'Debug panels working!';
  
  // Various data types to inspect
  const simpleString = 'Hello World';
  const numberValue = 42;
  const booleanValue = true;
  const nullValue = null;
  const undefinedValue = undefined;
  
  // Complex objects
  const person = {
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
    role: 'solicitor'
  };
  
  // Array of objects
  const cases = [
    { id: 1, title: 'Case A', status: 'active' },
    { id: 2, title: 'Case B', status: 'pending' },
    { id: 3, title: 'Case C', status: 'closed' }
  ];
  
  // Nested object
  const complexData = {
    user: person,
    metadata: {
      created: new Date(),
      version: '1.0.0',
      permissions: ['read', 'write', 'delete']
    },
    stats: {
      total: 100,
      active: 75,
      completed: 25
    }
  };
  
  // Function
  const calculateSum = (a, b) => a + b;
  const result = calculateSum(10, 20);
  
  // Map and Set
  const userMap = new Map();
  userMap.set('user1', person);
  userMap.set('count', 42);
  
  const uniqueIds = new Set([1, 2, 3, 4, 5]);
  
  // Error object
  const sampleError = new Error('This is a test error');
  
  // Buffer (commented out to prevent Redis serialization issues)
  // const buffer = Buffer.from('Binary data here');
  const buffer = 'Binary data as string (safe for JSON)';
  
  // Regular expression
  const pattern = /test.*debug/gi;
  
  // Symbol
  const symbolKey = Symbol('debugSymbol');
  
  // This line will pause execution if you have a breakpoint
  // debugger; // <-- Uncomment this for automatic breakpoint
  
  // You should now see all variables in the VARIABLES panel
  console.log('Check your VS Code debug panels now!');
  
  res.json({
    message,
    testData: {
      simple: simpleString,
      number: numberValue,
      boolean: booleanValue,
      person,
      cases,
      complex: complexData,
      result,
      mapSize: userMap.size,
      setSize: uniqueIds.size
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Debug server running', port: PORT });
});

app.listen(PORT, () => {
  console.log(`
🐛 Debug Test Server Running!
📍 URL: http://localhost:${PORT}

To test VS Code debugging:
1. Open this file in VS Code
2. Set a breakpoint on line 13 (click in the gutter left of line number)
3. Press F5 or go to Run and Debug panel
4. Select "Node.js" or create a launch config
5. Visit: http://localhost:${PORT}/debug-test
6. VS Code should pause at the breakpoint
7. Check these panels:
   - VARIABLES (should show all local variables)
   - WATCH (add expressions to watch)
   - CALL STACK (shows function calls)
   
If panels are missing:
- Press Ctrl+Shift+D during debugging
- Go to View → Run
- Check View → Appearance → Side Bar is visible
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Debug server shutting down...');
  process.exit(0);
});

module.exports = app;