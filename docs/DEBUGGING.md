# VS Code Debugging Guide

## 🐛 Quick Start

### Prerequisites
1. Install VS Code extensions:
   - **Debugger for Chrome** (for frontend debugging)
   - **Node.js Debugger** (usually built-in)

2. Ensure services are running:
   ```bash
   make docker-up  # Start PostgreSQL, Redis, Ollama
   ```

## 🎯 Debug Configurations

### Backend Debugging (Express Server)

1. **Set breakpoints** in any `.ts` file under `server/`
2. Press `F5` or go to Run → Start Debugging
3. Select **"Debug Backend (Express)"**
4. The server will start with debugger attached on port 9229

```typescript
// Example: Set breakpoint in server/routes/auth.ts
router.post("/login", async (req, res) => {
  // 🔴 Breakpoint here will pause execution
  const data = loginSchema.parse(req.body);
  // ... rest of code
});
```

### Frontend Debugging (React in Chrome)

1. **Set breakpoints** in any `.tsx` file under `client/src/`
2. Select **"Debug Frontend (Chrome)"**
3. Chrome will open with debugger attached
4. Breakpoints will work in VS Code

### Full Stack Debugging

1. Select **"Full Stack Debug"** to debug both frontend and backend simultaneously
2. Breakpoints work in both client and server code
3. Two debug consoles will be available

## 🔧 Common Debugging Scenarios

### 1. Debug API Endpoint

```typescript
// server/routes.ts
app.post("/api/cases", authenticate, async (req, res) => {
  console.log("Request body:", req.body);  // View in debug console
  debugger;  // Alternative to breakpoint
  
  const validatedData = insertCaseSchema.parse(req.body);
  // Step through validation...
});
```

### 2. Debug React Component

```tsx
// client/src/pages/CasesPage.tsx
export function CasesPage() {
  const { data, error } = useCases();
  
  // Add conditional breakpoint
  if (error) {
    debugger;  // Will pause when error occurs
  }
  
  return <div>...</div>;
}
```

### 3. Debug Database Queries

```typescript
// server/storage.ts
async getCases() {
  console.log("Fetching cases...");
  
  const cases = await db
    .select()
    .from(casesTable);
  
  console.log(`Found ${cases.length} cases`);
  return cases;
}
```

### 4. Debug Seed Script

1. Select **"Debug Seed Script"** configuration
2. Breakpoints in `scripts/seed.ts` will work
3. Step through database insertions

## 🎨 Debug Console Commands

While paused at a breakpoint, use the Debug Console:

```javascript
// Inspect variables
req.body
req.user
process.env.DATABASE_URL

// Call functions
JSON.stringify(data, null, 2)
await db.select().from(users)

// Modify variables
data.status = "active"
```

## 🚀 Advanced Debugging

### Conditional Breakpoints

Right-click on a breakpoint → Edit Breakpoint:
```javascript
// Only break when specific condition is true
req.user.role === "admin"
error.status === 500
cases.length > 10
```

### Logpoints

Right-click in gutter → Add Logpoint:
```javascript
// Logs without stopping execution
"User {req.user.username} accessing {req.path}"
```

### Watch Expressions

Add to Watch panel:
- `req.user`
- `process.env.NODE_ENV`
- `db.select().from(cases)`

## 🔍 Troubleshooting

### Backend debugger not attaching?

1. Check if port 9229 is free:
   ```bash
   lsof -i :9229
   ```

2. Use the debug script:
   ```bash
   npm run dev:debug
   ```

3. Try attaching manually:
   - Select **"Attach to Node Process"**
   - Choose the tsx process

### Frontend breakpoints not working?

1. Ensure source maps are enabled
2. Check that webpack dev server is running
3. Try setting `debugger;` statement in code
4. Clear browser cache and restart

### Database connection issues?

1. Check Docker services:
   ```bash
   docker-compose ps
   ```

2. Verify environment variables:
   ```bash
   cat .env | grep DATABASE_URL
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

## 📝 Debug Output Locations

- **Backend logs**: VS Code Debug Console
- **Frontend logs**: Chrome DevTools Console
- **Database queries**: Enable with `DEBUG=drizzle:*`
- **Express routes**: Enable with `DEBUG=express:*`

## 🎯 Debugging Best Practices

1. **Use structured logging**:
   ```typescript
   console.log({
     action: "case_created",
     caseId: newCase.id,
     userId: req.user.id,
     timestamp: new Date().toISOString()
   });
   ```

2. **Add error context**:
   ```typescript
   try {
     // ... code
   } catch (error) {
     console.error("Failed to create case", {
       error: error.message,
       userId: req.user?.id,
       body: req.body
     });
     throw error;
   }
   ```

3. **Use debug namespaces**:
   ```typescript
   import Debug from "debug";
   const debug = Debug("app:auth");
   
   debug("Login attempt for user: %s", username);
   ```

4. **Profile performance**:
   ```typescript
   console.time("database-query");
   const result = await db.select().from(cases);
   console.timeEnd("database-query");
   ```

## 🔗 Useful Resources

- [VS Code Debugging Guide](https://code.visualstudio.com/docs/editor/debugging)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Node.js Debugging](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [TypeScript Source Maps](https://www.typescriptlang.org/tsconfig#sourceMap)