# User Interface Guide

A visual guide to understanding the Internal Client Application interface.

## Dashboard View (Home Page)

```
╔════════════════════════════════════════════════════════════════════╗
║  Client Dashboard                              [+ New Client]       ║
║  Manage your clients and their documents with AI-powered insights  ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  [🔍 Search clients...]                                            ║
║                                                                     ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               ║
║  │  [Image]    │  │  [Image]    │  │  [Image]    │               ║
║  │             │  │             │  │             │               ║
║  │ Client A    │  │ Client B    │  │ Client C    │               ║
║  │ Description │  │ Description │  │ Description │               ║
║  │ Jan 15 [🗑]│  │ Jan 14 [🗑]│  │ Jan 13 [🗑]│               ║
║  └─────────────┘  └─────────────┘  └─────────────┘               ║
║                                                                     ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               ║
║  │  [Image]    │  │  [Image]    │  │  [Image]    │               ║
║  │             │  │             │  │             │               ║
║  │ Client D    │  │ Client E    │  │ Client F    │               ║
║  │ Description │  │ Description │  │ Description │               ║
║  │ Jan 12 [🗑]│  │ Jan 11 [🗑]│  │ Jan 10 [🗑]│               ║
║  └─────────────┘  └─────────────┘  └─────────────┘               ║
║                                                                     ║
╚════════════════════════════════════════════════════════════════════╝
```

**Features**:
- Grid layout of client "folders"
- Each card shows thumbnail, name, description, and date
- Hover to reveal delete button
- Click card to open client workspace
- Search bar filters clients by name

## Create Client Modal

```
╔════════════════════════════════════════════════════════════════════╗
║  Create New Client                                           [✕]   ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Client Name *                                                     ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ Enter client name                                          │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                     ║
║  Description (Working Memory)                                      ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ Add context about this client...                           │   ║
║  │                                                             │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                     ║
║  Thumbnail                                                         ║
║  ┌────┐  ┌──────────────────────┐                               ║
║  │[📷]│  │ [📤 Choose Image]    │                               ║
║  └────┘  └──────────────────────┘                               ║
║                                                                     ║
║                                    [Cancel] [Create Client]        ║
╚════════════════════════════════════════════════════════════════════╝
```

**Features**:
- Simple form with 3 fields
- Image preview when thumbnail selected
- Required field validation
- Creates client and redirects to workspace

## Client Detail - Documents Tab

```
╔════════════════════════════════════════════════════════════════════╗
║  [←] [🖼️] Tech Corp                                               ║
║      Main client for all technical documentation                   ║
╠════════════════════════════════════════════════════════════════════╣
║  [📄 Documents (5)] [💬 AI Chat]                                  ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │          📤 Drag & drop files here                          │   ║
║  │              or click to browse                             │   ║
║  │   Supported: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV (max 10MB)│   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                     ║
║  ┌─────────────────────────────────────┐ ┌──────────────────────┐ ║
║  │ 📄 Q4 Financial Report              │ │ Document Details     │ ║
║  │    Finance                          │ │                      │ ║
║  │    [positive] ✅              [🗑] │ │ Title                │ ║
║  │                                     │ │ Q4 Financial Report  │ ║
║  │ 📄 Marketing Strategy 2024          │ │                      │ ║
║  │    Marketing                        │ │ Summary              │ ║
║  │    [positive] ✅              [🗑] │ │ This report analyzes │ ║
║  │                                     │ │ the fourth quarter...│ ║
║  │ 📄 Technical Specifications         │ │                      │ ║
║  │    Technical                        │ │ Tags                 │ ║
║  │    [neutral] ✅               [🗑] │ │ [finance] [Q4]       │ ║
║  │                                     │ │ [revenue] [growth]   │ ║
║  │ 📄 Meeting Notes - Jan 15           │ │                      │ ║
║  │    General                          │ │ Keywords             │ ║
║  │    [positive] ⏳              [🗑] │ │ revenue, profit...   │ ║
║  │                                     │ │                      │ ║
║  └─────────────────────────────────────┘ │ Sentiment: positive  │ ║
║                                           │ Score: 0.85          │ ║
║                                           │                      │ ║
║                                           │ [View Original File] │ ║
║                                           └──────────────────────┘ ║
╚════════════════════════════════════════════════════════════════════╝
```

**Features**:
- Drag-and-drop upload area at top
- List of documents with processing status
- Click document to view analysis in sidebar
- Each document shows: icon, title, topic, sentiment, actions
- Processing indicator (⏳) or complete (✅)
- Delete button per document

## Upload Progress

```
╔════════════════════════════════════════════════════════════════════╗
║  📄 quarterly-report.pdf                                      [✕]  ║
║  2.4 MB                                                             ║
║  [⏳ 67%]                                                          ║
║  ██████████████████████░░░░░░░░░░                                 ║
╠════════════════════════════════════════════════════════════════════╣
║  📄 meeting-notes.docx                                        [✕]  ║
║  0.8 MB                                                             ║
║  [✅ Processing document with AI...]                               ║
╠════════════════════════════════════════════════════════════════════╣
║  📄 budget-2024.xlsx                                          [✕]  ║
║  1.2 MB                                                             ║
║  [❌ Error: File size too large]                                   ║
╚════════════════════════════════════════════════════════════════════╝
```

**Features**:
- Real-time upload progress bars
- Shows: filename, size, percentage
- Status indicators: uploading, processing, complete, error
- Can cancel/remove items
- Multiple simultaneous uploads

## Client Detail - Chat Tab

```
╔════════════════════════════════════════════════════════════════════╗
║  [←] [🖼️] Tech Corp                                               ║
║      Main client for all technical documentation                   ║
╠════════════════════════════════════════════════════════════════════╣
║  [📄 Documents (5)] [💬 AI Chat]                                  ║
╠════════════════════════════════════════════════════════════════════╣
║  AI Assistant                                        [🗑 Clear]    ║
║  Ask questions about Tech Corp's documents                         ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ┌────┐                                                            ║
║  │ 👤 │  What are the key findings from the Q4 report?            ║
║  └────┘                                                            ║
║                                                                     ║
║         ┌────┐                                                     ║
║         │ 🤖 │  Based on the Q4 Financial Report, the key         ║
║         └────┘  findings are:                                     ║
║                                                                     ║
║                 1. Revenue increased by 23% compared to Q3         ║
║                 2. Profit margins improved to 18.5%               ║
║                 3. Customer retention rate reached 94%            ║
║                                                                     ║
║                 📄 Referenced 1 document                           ║
║                                                                     ║
║  ┌────┐                                                            ║
║  │ 👤 │  What does the marketing strategy recommend?              ║
║  └────┘                                                            ║
║                                                                     ║
║         ┌────┐                                                     ║
║         │ 🤖 │  The Marketing Strategy 2024 document recommends... ║
║         └────┘                                                     ║
║                                                                     ║
║                                                                     ║
╠════════════════════════════════════════════════════════════════════╣
║  ┌────────────────────────────────────────────────────────┐  [▶] ║
║  │ Ask a question about your documents...                 │      ║
║  └────────────────────────────────────────────────────────┘      ║
║  Press Enter to send, Shift+Enter for new line                    ║
╚════════════════════════════════════════════════════════════════════╝
```

**Features**:
- Chat bubble interface
- User messages on right (blue)
- AI messages on left (gray)
- Source document indicators
- Text input with send button
- Clear history button
- Auto-scroll to bottom

## Document Analysis Panel

```
╔══════════════════════════════════════╗
║ Document Details                     ║
╠══════════════════════════════════════╣
║                                      ║
║ TITLE                                ║
║ Q4 Financial Performance Report      ║
║                                      ║
║ SUMMARY                              ║
║ This comprehensive report analyzes   ║
║ the company's financial performance  ║
║ during the fourth quarter of 2023.   ║
║ Key metrics show significant growth  ║
║ across all major categories...       ║
║                                      ║
║ 🏷️ TAGS                             ║
║ [finance] [Q4] [revenue]             ║
║ [growth] [profit] [analysis]         ║
║                                      ║
║ # KEYWORDS                           ║
║ [revenue] [profit] [growth]          ║
║ [analysis] [quarter] [performance]   ║
║ [metrics] [financial] [report]       ║
║                                      ║
║ 📊 SENTIMENT ANALYSIS                ║
║ [Positive]  Score: 0.85              ║
║                                      ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║ 📅 Jan 15, 2024 10:30 AM            ║
║ Size: 2.4 MB                         ║
║ Type: application/pdf                ║
║                                      ║
║ [View Original File]                 ║
║                                      ║
╚══════════════════════════════════════╝
```

**Features**:
- Structured display of AI analysis
- Title (AI-generated)
- Summary (200-500 words)
- Tags (5-10, clickable chips)
- Keywords (10-15, smaller chips)
- Sentiment with color coding
- File metadata
- Link to original file

## Mobile Responsive Views

### Mobile Dashboard
```
┌─────────────────────┐
│ Client Dashboard    │
│                  [+]│
├─────────────────────┤
│ [🔍 Search...]     │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │    [Image]      │ │
│ │   Client A      │ │
│ │   Description   │ │
│ └─────────────────┘ │
│                     │
│ ┌─────────────────┐ │
│ │    [Image]      │ │
│ │   Client B      │ │
│ │   Description   │ │
│ └─────────────────┘ │
│                     │
└─────────────────────┘
```

### Mobile Chat
```
┌─────────────────────┐
│ [←] Tech Corp   [🗑]│
├─────────────────────┤
│ 📄    💬            │
│ Docs  Chat          │
├─────────────────────┤
│                     │
│  What are...?       │
│                     │
│    Based on the     │
│    documents...     │
│                     │
│                     │
├─────────────────────┤
│ [Ask question...][▶]│
└─────────────────────┘
```

## Color Scheme

### Primary Colors
- **Primary Blue**: #0ea5e9 (buttons, links, active states)
- **Primary Dark**: #0369a1 (hover states)
- **Primary Light**: #bae6fd (backgrounds)

### Sentiment Colors
- **Positive**: #16a34a (green) with #dcfce7 background
- **Negative**: #dc2626 (red) with #fee2e2 background
- **Neutral**: #6b7280 (gray) with #f3f4f6 background

### Status Colors
- **Success**: #16a34a (green) - ✅
- **Processing**: #0ea5e9 (blue) - ⏳
- **Error**: #dc2626 (red) - ❌
- **Warning**: #f59e0b (orange) - ⚠️

### UI Colors
- **Background**: #f9fafb (light gray)
- **Card Background**: #ffffff (white)
- **Border**: #e5e7eb (light gray)
- **Text Primary**: #111827 (dark gray)
- **Text Secondary**: #6b7280 (medium gray)

## Icons Used

### Lucide React Icons
- **FolderOpen** - Empty state, client folders
- **Plus** - Add new client
- **Search** - Search functionality
- **Upload** - File uploads
- **FileText** - Documents
- **MessageSquare** - Chat
- **Trash2** - Delete actions
- **ArrowLeft** - Back navigation
- **User** - User avatar in chat
- **Bot** - AI avatar in chat
- **Send** - Send message
- **Loader2** - Loading spinner
- **CheckCircle** - Success state
- **AlertCircle** - Error state
- **X** - Close/cancel
- **Tag** - Tags
- **Hash** - Keywords
- **TrendingUp** - Sentiment
- **Calendar** - Dates

## Interaction Patterns

### Hover States
- **Cards**: Slight shadow increase, border color change
- **Buttons**: Background darkens
- **Delete buttons**: Appear on hover (folders, documents)
- **Links**: Color change, underline

### Loading States
- **Upload**: Progress bar with percentage
- **Processing**: Spinning loader with text
- **API calls**: Loader icon, disabled buttons

### Error States
- **Upload fail**: Red alert with message
- **Network error**: Toast notification
- **Validation**: Red border, error text

### Success States
- **Upload complete**: Green checkmark
- **Action success**: Brief success message
- **Processing done**: Status icon change

## Animations

### Transitions
- **Page transitions**: Smooth fade
- **Modal open/close**: Scale + fade
- **Dropdown**: Slide down
- **Notifications**: Slide in from top

### Micro-interactions
- **Button clicks**: Scale down slightly
- **Card hover**: Smooth scale up
- **Progress bars**: Smooth width transition
- **Spinners**: Rotate animation

## Accessibility

### Keyboard Navigation
- **Tab order**: Logical flow through interface
- **Enter**: Activates buttons, submits forms
- **Escape**: Closes modals
- **Arrow keys**: Navigate lists

### Screen Reader Support
- **Alt text**: All images have descriptions
- **ARIA labels**: Interactive elements labeled
- **Semantic HTML**: Proper heading hierarchy
- **Focus indicators**: Visible keyboard focus

### Color Contrast
- **Text**: WCAG AA compliant
- **Buttons**: High contrast
- **Status indicators**: Both color + icon

---

This UI provides an intuitive, modern interface for document management and AI-powered analysis. The design emphasizes clarity, efficiency, and ease of use.
