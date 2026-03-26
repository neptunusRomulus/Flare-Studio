# File Conflict Detection - Manual Testing Guide

## Prerequisites

- Flare Studio app running locally (npm run electron-dev)
- A test project with map files
- Git installed (for testing git-based conflicts)
- Text editor available (VS Code, Notepad, etc.)

## Test Environment Setup

### 1. Create a Test Project
```bash
# In Flare Studio:
1. File → New Map Project
2. Name: "ConflictTestProject"
3. Location: Desktop or Documents
4. Size: 20x15, Tile Size: 64
5. Click Create
```

### 2. Create a Test Map
```
1. Create new map or use default
2. Add some content (paint tiles, add objects)
3. Save (Ctrl+S)
4. Note the map file location (e.g., Desktop/ConflictTestProject/map.json)
```

## Test Scenarios

### Scenario 1: External File Edit (Text Editor)

**Objective**: Detect when file is modified externally by opening in text editor

**Steps**:
1. With app running and map open, open file manager
2. Navigate to project folder
3. Right-click on map.json → "Open with" → Text Editor
4. Modify a simple property (e.g., change "name": "Map" to "name": "Map_Modified")
5. Save file (Ctrl+S) in text editor
6. Switch back to Flare Studio
7. Make a small change in the map (paint a tile, add object)
8. Wait for autosave (~2 seconds)

**Expected Behavior**:
- ✅ ConflictDialog appears
- ✅ Shows file path: `Desktop/ConflictTestProject/map.json`
- ✅ Reason mentions external modification
- ✅ Severity shows "Critical" (red icon)
- ✅ Options: Reload External Version, Keep App Version, Cancel Save

**Outcome Verification**:
```
Choose "Keep App Version" → 
  Save proceeds with app's version (text edit lost)
  
Choose "Reload External Version" → 
  App reloads file from disk (app changes lost)
  
Choose "Cancel Save" → 
  Changes stay pending in app
  Try again later
```

### Scenario 2: Git Pull During Editing

**Objective**: Simulate git pulling changes while app is open

**Setup**:
```bash
# Initialize project as git repo
cd Desktop/ConflictTestProject
git init
git add .
git commit -m "Initial commit"

# Create a branch with changes
git checkout -b feature-branch
# (Make external change to map.json)
git commit -am "Feature changes"

# Switch back to main
git checkout main
```

**Steps**:
1. Open project in Flare Studio
2. In another terminal: `git merge feature-branch`
3. Make change in Flare Studio
4. Wait for autosave

**Expected Behavior**:
- ✅ Conflict detected (git pulled external changes)
- ✅ ConflictDialog shows critical severity
- ✅ Options allow user to choose which version to keep

### Scenario 3: File Sync Service (Simulated)

**Objective**: Detect when file is updated by background sync

**Steps**:
1. Copy test project to Dropbox/OneDrive folder
2. Open in Flare Studio
3. In another app, modify the map.json in Dropbox web interface
4. Wait for sync to update local file
5. Make change in Flare Studio
6. Trigger autosave

**Expected Behavior**:
- ✅ File size change detected
- ✅ Timestamp mismatch detected
- ✅ ConflictDialog appears appropriately

### Scenario 4: Rapid External Changes

**Objective**: Ensure no data loss with multiple rapid external edits

**Steps**:
1. Open project in Flare Studio
2. In text editor, edit map.json: change → save
3. Immediately edit again: change → save (repeat 3-5 times quickly)
4. Switch to Flare Studio
5. Make change and trigger autosave

**Expected Behavior**:
- ✅ Conflict detected (most recent external change)
- ✅ Prompt appears without freezing
- ✅ User can choose action without app hanging

### Scenario 5: Manual Save vs Autosave

**Objective**: Test conflict detection in both save paths

**Test A: Autosave**:
1. External file changed
2. Make app change
3. Wait for autosave to trigger
4. Verify dialog appears

**Test B: Manual Save**:
1. External file changed
2. Make app change
3. Press Ctrl+S (manual save)
4. Verify dialog appears

**Expected Behavior**:
- ✅ Both paths show conflict dialog
- ✅ Same options in both cases
- ✅ Dialog behavior consistent

### Scenario 6: Cancel and Retry

**Objective**: Verify user can cancel save and retry later

**Steps**:
1. External file changed
2. Make app change
3. Trigger save
4. ConflictDialog appears
5. Choose "Cancel Save"
6. Verify dialog closes
7. Make another change in app
8. Trigger save again
9. Dialog should appear again

**Expected Behavior**:
- ✅ First cancel stops save
- ✅ Changes remain pending
- ✅ Second save attempt retries conflict check
- ✅ Dialog appears again

## Edge Case Testing

### Edge Case 1: File Deleted

**Steps**:
1. Open map in app
2. Delete map.json from disk
3. Make app change
4. Trigger save

**Expected Behavior**:
- ✅ Should detect missing file
- ✅ Handle gracefully (error message or conflict dialog)
- ✅ No app crash

### Edge Case 2: File Permissions

**Steps**:
1. Open map in app
2. Change file permissions: `chmod 444 map.json` (read-only)
3. Make app change
4. Trigger save

**Expected Behavior**:
- ✅ Should detect permission error
- ✅ Show appropriate error message
- ✅ Allow retry or cancel

### Edge Case 3: File Lock

**Steps**:
1. Open map in app
2. In text editor: Open map.json (but don't close it)
3. File is now "locked"
4. Make app change
5. Trigger save

**Expected Behavior**:
- ✅ System may show file lock error
- ✅ Handled gracefully
- ✅ User can retry after closing editor

### Edge Case 4: Very Large File

**Objective**: Ensure performance with large files

**Steps**:
1. Create project with very large map (100x100 tiles, 50 objects)
2. Save (generates large JSON)
3. Modify externally
4. Make app change
5. Trigger save with large file

**Expected Behavior**:
- ✅ Conflict check still completes quickly (< 100ms)
- ✅ No UI freezing
- ✅ Dialog appears responsively

### Edge Case 5: Timeout

**Objective**: Verify 5-minute timeout works

**Steps**:
1. Trigger conflict
2. Do NOT click any button
3. Leave dialog open for 5+ minutes
4. Wait and observe

**Expected Behavior**:
- ✅ After 5 minutes, dialog auto-resolves to "Cancel"
- ✅ Save cancelled automatically
- ✅ No hanging or frozen state

## Console Logging Verification

### Logs to Check

**ConflictDialog Mounting**:
```
[FileConflict] Registered file load: /path/to/file (size: 2048B)
```

**Conflict Detected**:
```
[FileConflict] External modification detected for /path/to/file
  - File size changed: 2048B → 2156B
  - Tracked time: 2024-01-30T10:00:00.000Z
  - Current time: 2024-01-30T10:05:30.000Z
```

**User Action**:
```
[ConflictResolution] Showing conflict prompt #1
[ConflictResolution] User chose: keep_app for /path/to/file
```

### How to Access Logs

**In Development**:
1. Press F12 to open DevTools
2. Click "Console" tab
3. Look for `[FileConflict]` and `[ConflictResolution]` prefixes

**In Main Process** (Electron):
```bash
# Watch Electron main process logs
npm run electron-dev 2>&1 | grep -E "\[.*Conflict"
```

## Performance Testing

### Measure Conflict Check Time

**Steps**:
1. Open DevTools Console
2. Monitor network/timing
3. Trigger save with conflict
4. Note time between save trigger and dialog appearance

**Expected Result**:
- ✅ Dialog appears within 500ms
- ✅ No noticeable delay
- ✅ UI remains responsive

### Memory Usage

**Steps**:
1. Open DevTools → Memory tab
2. Take heap snapshot before conflict test
3. Trigger 10 conflicts
4. Resolve each with different action
5. Take heap snapshot after

**Expected Result**:
- ✅ Memory increase minimal (< 1MB)
- ✅ Garbage collection working
- ✅ No memory leaks

## Regression Testing

### Before & After Conflict Detection

**Verify these still work**:
- ✅ Normal autosave (no external changes)
- ✅ Manual save (Ctrl+S)
- ✅ Settings persistence
- ✅ Undo/Redo
- ✅ Layer editing
- ✅ Object placement
- ✅ File export

**Test workflow**:
1. Create map
2. Add objects/layers
3. Save normally
4. Make edits
5. Autosave (should work without conflicts)
6. Manual save (should work)
7. Export (should work)
8. Verify all features still functional

## Visual Verification Checklist

### ConflictDialog Appearance
- [ ] Dialog appears as modal overlay
- [ ] Background dims
- [ ] Dialog centered on screen
- [ ] Text readable (good contrast)
- [ ] Icons display correctly
- [ ] Buttons visible and clickable
- [ ] Dark mode toggle tested

### Button States
- [ ] "Reload External Version" button shows proper color (blue)
- [ ] "Keep App Version" button shows proper color (green)
- [ ] "Cancel Save" button shows proper color (gray)
- [ ] Disabled state visible when processing
- [ ] Spinner animation shows during action
- [ ] Buttons become clickable after action completes

### Message Display
- [ ] File path displays correctly
- [ ] Reason text is clear and helpful
- [ ] Severity icon matches severity level
- [ ] Multiple file list shows if applicable
- [ ] Risk/Info box displays with appropriate color

## Multi-File Testing

### Scenario: Project with Multiple Maps

**Setup**:
1. Create project with 3 maps:
   - map1.json
   - map2.json
   - map3.json
2. All open/recent

**Steps**:
1. Have map1 active in editor
2. Externally modify map2.json (not the one being edited)
3. Make change to map1 in app
4. Trigger save

**Expected Behavior**:
- ✅ Only shows conflict for map1 (the one being saved)
- ✅ Not map2 (even though it changed)
- ✅ Correct file path shown

### Scenario: Batch Operations

**Steps**:
1. Multiple files changed externally
2. App tries to save all at once
3. Observe behavior

**Expected Behavior**:
- ✅ Shows dialog for first conflict
- ✅ Can choose action
- ✅ Then checks other files
- ✅ Shows dialog for each conflicted file

## Deployment Verification

### Pre-Release Checklist
- [ ] All TypeScript errors resolved
- [ ] No console errors on startup
- [ ] No console errors on conflict trigger
- [ ] No memory leaks over 1 hour of use
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Mobile responsiveness (if applicable)

### User Workflow Verification
- [ ] New user can understand conflict message
- [ ] Options are clear (Reload vs Keep App)
- [ ] Result of choice is as expected
- [ ] No data loss in any scenario
- [ ] Can work normally when no conflicts

## Testing Results Template

```markdown
# Conflict Detection Testing Results

**Date**: [DATE]
**Tester**: [NAME]
**Version**: [APP VERSION]

## Scenarios Tested

### Scenario 1: External File Edit
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Scenario 2: Git Pull
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Scenario 3: File Sync
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Scenario 4: Rapid Changes
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Scenario 5: Manual vs Autosave
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Scenario 6: Cancel and Retry
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

## Edge Cases

### Edge Case 1: File Deleted
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Edge Case 2: Permissions
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Edge Case 3: File Lock
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Edge Case 4: Large File
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

### Edge Case 5: Timeout
- Status: [PASS/FAIL]
- Notes: [OBSERVATIONS]

## Performance
- Conflict check time: [XXX]ms
- Memory overhead: [XXX]MB
- UI responsiveness: [GOOD/FAIR/POOR]

## Regression Testing
- Autosave (no conflict): [PASS/FAIL]
- Manual save (no conflict): [PASS/FAIL]
- Settings persist: [PASS/FAIL]
- Undo/Redo: [PASS/FAIL]
- Layer editing: [PASS/FAIL]
- Export: [PASS/FAIL]

## Overall Result
- [READY FOR RELEASE / NEEDS FIXES / BLOCKED]

## Issues Found
1. [Description]
2. [Description]

## Sign-off
- Tester: [NAME]
- Date: [DATE]
- Status: [APPROVED / REJECTED]
```

## Quick Test Script

For rapid testing of all scenarios:

```bash
#!/bin/bash
# quick-test.sh

PROJECT_PATH="$HOME/Desktop/ConflictTestProject"
MAP_FILE="$PROJECT_PATH/map.json"

echo "Starting quick conflict detection test..."

# Test 1: External modification
echo "Test 1: Modifying file externally..."
echo '{"modified": true}' >> "$MAP_FILE"
# → Trigger autosave in app
# → Verify dialog

# Test 2: File deletion
echo "Test 2: Deleting file..."
rm "$MAP_FILE"
# → Trigger autosave in app
# → Verify error handling

# Test 3: Permission change
echo "Test 3: Changing permissions..."
chmod 444 "$MAP_FILE"
# → Trigger autosave in app
# → Verify handling

chmod 644 "$MAP_FILE"  # Restore

echo "Quick test complete. Check app for conflict dialogs."
```

## Next Steps After Testing

1. **If All Tests Pass**:
   - ✅ Mark as "Ready for Production"
   - ✅ Create release notes
   - ✅ Deploy to staging
   - ✅ Final production verification

2. **If Issues Found**:
   - Fix issues identified
   - Re-run failing test scenarios
   - Regression test all fixes
   - Get sign-off before release

3. **After Release**:
   - Monitor user reports
   - Check analytics for conflict frequency
   - Gather user feedback
   - Plan improvements for next version
