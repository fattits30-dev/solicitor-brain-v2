# Solicitor Brain v2 - Implementation Plan & Task Division
Date: 2025-09-02

## 🎯 Priority Fixes - Task Division

### Phase 1: Enable AI Infrastructure (Both)
1. **Enable AI features in .env** ✋ Claude
2. **Pull Ollama models** ✋ Claude
3. **Test pipeline** ✋ Claude

### Phase 2: UI Components - Work Division

## 👤 Claude's Tasks

### 1. Document Viewer Component
**Location:** `/client/src/components/documents/DocumentViewer.tsx`
```typescript
// Requirements:
- PDF rendering with page navigation
- OCR text overlay display
- Zoom controls
- Search within document
- Citation copying
- Responsive design
```

### 2. AI Chat Panel Component  
**Location:** `/client/src/components/AIChatPanel.tsx`
```typescript
// Requirements:
- Streaming message display
- Citation links to documents
- Tone control slider (professional ↔ trauma-aware)
- Message history
- Stop generation button
- Copy response feature
- Loading states
```

### Implementation Steps for Claude:
```bash
# 1. Enable AI
sed -i 's/ENABLE_AI_FEATURES=false/ENABLE_AI_FEATURES=true/' .env

# 2. Pull models
ollama pull llama3
ollama pull nomic-embed-text

# 3. Build Document Viewer
# - Install react-pdf or pdfjs
# - Create viewer with controls
# - Integrate with existing document API

# 4. Build AI Chat Panel
# - Use existing AIChatPanel.tsx as base
# - Add streaming support
# - Connect to /api/ai/chat endpoint
```

---

## 🤖 Copilot's Tasks

### 1. Search Interface Component
**Location:** `/client/src/pages/search.tsx`
```typescript
// Requirements:
- Search input with filters
- Results list with highlights
- Citation display (doc name + page)
- Filter by case/date/type
- Export results
- Pagination
```

**Copilot Prompt:**
```
Build a search interface component for Solicitor Brain v2 at /client/src/pages/search.tsx. Requirements:
- Use existing shadcn/ui components (Input, Card, Button, Badge)
- Query input with debouncing
- Display results with document citations
- Show matching text snippets with highlights
- Filter sidebar (case, date range, document type)
- Use React Query for API calls to POST /api/search
- Responsive grid layout
- Loading and empty states
```

### 2. Case Timeline Component
**Location:** `/client/src/components/cases/CaseTimeline.tsx`
```typescript
// Requirements:
- Vertical timeline layout
- Event types: document uploaded, draft created, message sent
- Clickable events linking to details
- Date grouping
- Filter by event type
- Expandable event details
```

**Copilot Prompt:**
```
Create a case timeline component at /client/src/components/cases/CaseTimeline.tsx for legal case management. Requirements:
- Vertical timeline with dates
- Event cards showing: type, title, user, timestamp
- Icons for different event types (Upload, Draft, Note, Email)
- Use Framer Motion for smooth animations
- Filter buttons for event types
- Integrate with GET /api/cases/{id}/events
- Mobile-responsive design
- Use existing shadcn/ui components
```

---

## 📋 Execution Order

### Round 1 (Claude - Now)
1. Enable AI in .env ✅
2. Pull Ollama models
3. Test document upload → OCR
4. Start Document Viewer component

### Round 2 (Copilot - Parallel)
1. Search Interface component
2. Test search API integration

### Round 3 (Claude)
1. Complete Document Viewer
2. Start AI Chat Panel
3. Test RAG pipeline

### Round 4 (Copilot)
1. Case Timeline component
2. Integrate with case detail page

### Round 5 (Both - Integration)
1. Connect all components
2. End-to-end testing
3. Fix integration issues
4. Update documentation

---

## 🧪 Testing Checklist

### After Each Component:
```bash
# Lint check
npm run lint

# Component test
npm test -- [component-name]

# Visual check
npm run dev
# Navigate to component route

# API integration test
curl -X POST http://localhost:3333/api/[endpoint] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{...}'
```

### Final Integration Tests:
1. Upload PDF → View in Document Viewer ✓
2. Search query → Results with citations ✓
3. Open AI chat → Ask about document → Get cited answer ✓
4. View case → See complete timeline ✓

---

## 📊 Success Metrics

### Phase 1 Complete When:
- [ ] AI models responding
- [ ] Document OCR working
- [ ] Vector search returning results

### Phase 2 Complete When:
- [ ] All 4 UI components rendering
- [ ] API integrations working
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessibility checks pass

### Project MVP Complete When:
- [ ] User can upload document
- [ ] OCR processes automatically
- [ ] Search finds content
- [ ] AI answers with citations
- [ ] Timeline shows all events
- [ ] No critical bugs

---

## 💡 Tips for Copilot

When implementing your components:

1. **Use existing patterns** from the codebase
2. **Import from @/components/ui** for shadcn components
3. **Follow the auth pattern** in existing components
4. **Use React Query** for data fetching (queryClient already configured)
5. **Add loading states** with the existing Spinner component
6. **Include error boundaries** for robustness
7. **Test with mock data first**, then integrate API

Example imports to use:
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
```

---

## 🚨 Common Issues & Fixes

1. **API returns HTML instead of JSON**
   - Check route order in server/routes.ts
   - Ensure /api routes are before static serving

2. **CORS errors**
   - Already handled in server middleware
   - Check auth token in headers

3. **Ollama not responding**
   ```bash
   # Check if running
   curl http://localhost:11434/api/tags
   # Restart if needed
   ollama serve
   ```

4. **TypeScript errors**
   ```bash
   # Regenerate types
   npm run types:generate
   ```

Good luck! Let's build these components! 🚀