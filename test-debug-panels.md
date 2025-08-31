# Quick Debug Panel Test

## Immediate Steps to See Variables Panel:

### 1. Quick Keyboard Fix (Try First)
While VS Code is open:
1. Press `Ctrl+Shift+D` - Opens Debug sidebar
2. Press `Ctrl+Shift+Y` - Opens Debug Console
3. Start debugging (F5)
4. Look for tabs: **VARIABLES**, **WATCH**, **CALL STACK**

### 2. Reset Your View (If panels hidden)
1. Press `Ctrl+Shift+P` (Command Palette)
2. Type: **"Reset View Locations"**
3. Press Enter
4. Restart debugging

### 3. Manual Panel Check
During debugging, check if panels are minimized:
- Look at **left sidebar** - should show Run and Debug
- Look at **bottom** of VS Code - Debug Console
- **Hover** on edges to find hidden panels
- **Drag** edges if panels are collapsed

### 4. Test with Simple File
Create `test.js`:
```javascript
const x = 10;
const y = 20;
debugger; // Will pause here
const sum = x + y;
console.log(sum);
```

1. Open `test.js`
2. Press **F5** (starts debugging)
3. Code stops at `debugger;`
4. **VARIABLES panel** should show `x: 10`, `y: 20`

### 5. Run Debug Test Server
```bash
# In terminal:
node server/debug-test.cjs
```

In another terminal:
```bash
curl http://localhost:3334/debug-test
```

### 6. VS Code Window Commands
If still not visible, run these commands (`Ctrl+Shift+P`):
- **View: Show Run and Debug**
- **View: Focus on Variables View** 
- **View: Toggle Side Bar Visibility**
- **View: Toggle Panel Visibility**

### 7. Emergency Fix - New Debug Session
1. Close all VS Code windows
2. Open VS Code fresh
3. Open folder: `/home/mine/ai/claude-home/projects/solicitor-brain-v2`
4. Press `Ctrl+Shift+D` immediately
5. You should see debug sidebar with sections

### 8. Check These Locations

The debug panels appear in these places:

```
┌─────────────────────────────────────┐
│  File  Edit  View  ...               │  <- Menu Bar
├────┬────────────────────────────────┤
│ 📁 │                                 │
│ 🔍 │     CODE EDITOR                │  <- Main Editor
│ 🐛 │ <-- Debug Icon (click this)    │
│ 🧩 │                                 │
│    │  When debugging, you see:      │
│    │  ┌──────────────┐              │
│    │  │ VARIABLES    │ <- This      │
│    │  │ WATCH       │ <- This      │
│    │  │ CALL STACK  │              │
│    │  │ BREAKPOINTS │              │
│    │  └──────────────┘              │
├────┴────────────────────────────────┤
│  TERMINAL   DEBUG CONSOLE   ...     │  <- Bottom Panel
└─────────────────────────────────────┘
```

### Still Not Working?

The panels might be:
1. **Hidden behind another panel** - Check all tabs
2. **Collapsed to zero width** - Look for thin lines to drag
3. **On wrong monitor** (multi-monitor setup)
4. **Disabled by extension** - Try: `code --disable-extensions`

### Alternative: Use Debug Console
If panels won't show, while paused at breakpoint, type in **DEBUG CONSOLE**:
- `x` (shows value of x)
- `process.env` (shows environment)
- `Object.keys(this)` (shows context)

---

**To verify it's working:**
You should see something like:
```
VARIABLES
├── Local
│   ├── x: 10
│   ├── y: 20
│   └── sum: 30
└── Global
    ├── console: Console
    └── process: Process
```