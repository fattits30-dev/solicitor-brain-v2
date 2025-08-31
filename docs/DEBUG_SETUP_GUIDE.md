# VS Code Debug Panel Setup Guide

## Problem: Variables and Watch panels not showing

### Quick Fixes:

## 1. Check Debug Panel Visibility
- **During an active debug session**, look at the sidebar
- Click "Run and Debug" icon (play button with bug) in the Activity Bar (left side)
- You should see tabs for: VARIABLES, WATCH, CALL STACK, BREAKPOINTS

## 2. Reset Debug Layout
1. Start a debug session (F5 or click green play button)
2. Go to View menu → Appearance → Reset View Locations
3. Or use Command Palette (Ctrl+Shift+P): "View: Reset View Locations"

## 3. Show Debug Sidebar Manually
1. During debugging, press `Ctrl+Shift+D` to show Debug sidebar
2. Or go to View → Run
3. Make sure you have a breakpoint hit (code execution paused)

## 4. Check Panel Visibility Settings
1. While debugging, go to View menu
2. Ensure these are checked:
   - ✓ Appearance → Side Bar
   - ✓ Appearance → Panel (for bottom debug console)

## 5. Manual Panel Toggle Commands
Press `Ctrl+Shift+P` and run:
- "View: Show Run and Debug"
- "View: Focus on Variables View"
- "Debug: Focus on Watch View"

## 6. Check Your Launch Configuration
Make sure your launch.json has proper sourceMaps:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server",
  "program": "${workspaceFolder}/server/real-server.cjs",
  "sourceMaps": true,
  "stopOnEntry": false
}
```

## 7. Window Layout Issues
If panels are hidden or minimized:
1. Look for thin lines at edges of VS Code window
2. Hover over them to see resize cursor
3. Drag to expand hidden panels
4. Check bottom-right for minimized panels

## 8. Workspace Settings Check
Add to `.vscode/settings.json`:
```json
{
  "debug.showInlineBreakpointCandidates": true,
  "debug.showBreakpointsInOverviewRuler": true,
  "debug.toolBarLocation": "docked",
  "debug.openDebug": "openOnDebugBreak",
  "debug.internalConsoleOptions": "openOnSessionStart"
}
```

## 9. Complete Debug Setup Steps

### Step 1: Set a Breakpoint
- Click in the gutter (left of line numbers) to add red dot
- Or press F9 on a line of code

### Step 2: Start Debugging
```bash
# Method 1: VS Code Debug Panel
1. Open Run and Debug panel (Ctrl+Shift+D)
2. Select "Debug Server" from dropdown
3. Click green play button

# Method 2: F5 Key
1. Open the file you want to debug
2. Press F5 to start debugging
```

### Step 3: Trigger the Breakpoint
- Make a request to your server
- Or run code that hits the breakpoint

### Step 4: View Variables
When stopped at breakpoint:
- **VARIABLES panel**: Shows all local and global variables
- **WATCH panel**: Add expressions to watch
- **CALL STACK**: Shows function call hierarchy
- **Hover over variables** in code to see values

## 10. If Nothing Works - Full Reset

### Reset VS Code Debug UI:
1. Close VS Code completely
2. Delete these folders (backs up settings):
```bash
# Linux/Mac
rm -rf ~/.config/Code/User/workspaceStorage/
rm -rf ~/.config/Code/User/globalStorage/

# Windows
# Delete: %APPDATA%\Code\User\workspaceStorage\
# Delete: %APPDATA%\Code\User\globalStorage\
```
3. Restart VS Code
4. Reopen your project

### Alternative: Use VS Code Insiders
Download VS Code Insiders (separate install) if regular VS Code has persistent issues.

## 11. Debug Without UI Panels

If panels still don't work, use these alternatives:

### Console Logging
```javascript
// Add to your code
console.log('DEBUG:', { variable, anotherVar });
console.table(arrayOrObject);
```

### Debug Console Commands
While paused at breakpoint, type in DEBUG CONSOLE:
- Variable name to see value
- `typeof variable`
- `JSON.stringify(object, null, 2)`

### Use Logpoints (Non-breaking)
Right-click on line number → Add Logpoint
Enter: `Variable value: {variableName}`

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Panels missing | Ctrl+Shift+D during debug |
| Variables empty | Make sure you're paused at breakpoint |
| Can't see values | Hover over variables in code |
| Watch not working | Click + in WATCH panel, type expression |
| Debug won't start | Check launch.json configuration |
| Breakpoints ignored | Ensure sourceMaps are enabled |

## Quick Keyboard Shortcuts

- **F5** - Start/Continue debugging
- **F9** - Toggle breakpoint
- **F10** - Step over
- **F11** - Step into
- **Shift+F11** - Step out
- **Ctrl+Shift+D** - Show Debug panel
- **Shift+F5** - Stop debugging

## Test Your Debug Setup

1. Add this test endpoint to your server:
```javascript
app.get('/api/debug-test', (req, res) => {
  const testVar = 'Hello Debug';
  const testObject = { working: true, value: 42 };
  debugger; // This will pause here
  res.json({ testVar, testObject });
});
```

2. Set breakpoint on the `debugger;` line
3. Start debugging (F5)
4. Visit: http://localhost:3333/api/debug-test
5. You should see variables in the panel

---

If you still have issues after trying these steps, the problem might be:
- VS Code extension conflict (try disabling extensions)
- Corrupted VS Code installation (reinstall)
- Display/monitor issues (try different screen/resolution)