# Dark Mode Testing Checklist ✅

## Pre-Flight Check

Before testing the application, ensure:
- [ ] Both frontend and backend npm packages are installed
- [ ] `.env` files are configured with API keys
- [ ] Backend server is running on port 3001
- [ ] Frontend dev server is running on port 5173
- [ ] Supabase project is set up with required tables

## Visual Testing

### Dashboard (ClientsView)
- [ ] Background gradient displays correctly
- [ ] Page title has cyan → purple gradient
- [ ] "+ New Client" button has neon glow on hover
- [ ] Client cards have glass morphism effect
- [ ] Each client card has a unique gradient
- [ ] Cards scale up on hover
- [ ] Status dots are colored correctly
- [ ] Empty state (if no clients) looks good

### Client Cards
- [ ] Border color changes on hover
- [ ] Shadow effects appear on hover
- [ ] Thumbnail images have colored borders
- [ ] Text is readable on all backgrounds
- [ ] Badges/tags are properly colored

### Client Detail Page
- [ ] Header has dark background with blur
- [ ] Back button is cyan and scales on hover
- [ ] Client name has gradient text
- [ ] Tabs change color when active (cyan for docs, purple for chat)
- [ ] Tab underline animates smoothly

### Document Upload
- [ ] Dropzone has dark background
- [ ] Border glows cyan when dragging files
- [ ] Upload button has purple/pink gradient
- [ ] Progress bar has cyan → purple gradient
- [ ] File icons are purple
- [ ] Success/error states show correct colors

### Document List
- [ ] Document cards have glass effect
- [ ] Selected document has cyan border and glow
- [ ] File icons are purple
- [ ] Sentiment badges have appropriate colors:
  - [ ] Positive = green
  - [ ] Negative = red
  - [ ] Neutral = gray
- [ ] Delete button turns red on hover
- [ ] Detail panel has dark background
- [ ] Tags have purple accent
- [ ] Keywords have dark background
- [ ] "View Original File" button has gradient

### Chat Interface
- [ ] Chat container has dark background with blur
- [ ] Header title has cyan → purple gradient
- [ ] Empty state has gradient icon background
- [ ] Feature cards have dark backgrounds
- [ ] User messages have cyan gradient bubble
- [ ] Bot messages have dark bubble with border
- [ ] Avatars have gradient backgrounds
- [ ] Code blocks:
  - [ ] Have dark background
  - [ ] Show copy/save buttons on hover
  - [ ] Buttons change color on hover
  - [ ] Syntax highlighting works
- [ ] Tables have dark styling
- [ ] Links are cyan and turn purple on hover
- [ ] Inline code has pink accent
- [ ] Export buttons work and change color on hover
- [ ] Text input has dark background
- [ ] Input focus ring is cyan
- [ ] Image upload button has purple/pink gradient
- [ ] Send button has cyan gradient
- [ ] Buttons scale on hover
- [ ] Image preview has cyan border

### Create Client Modal
- [ ] Backdrop is dark with blur
- [ ] Modal has dark background
- [ ] Header text has gradient
- [ ] Close button scales on hover
- [ ] Form inputs have dark backgrounds
- [ ] Input focus rings are cyan
- [ ] Thumbnail preview has cyan border
- [ ] "Choose Image" button has gradient
- [ ] Cancel button hovers correctly
- [ ] Create button has cyan gradient
- [ ] Loading spinner is cyan

## Interaction Testing

### Hover Effects
- [ ] All buttons scale slightly on hover
- [ ] Hover effects are smooth (not jumpy)
- [ ] Colors transition smoothly
- [ ] Shadow effects appear/disappear smoothly

### Click/Active States
- [ ] Buttons respond immediately to clicks
- [ ] Active states are clearly visible
- [ ] Selected items are clearly marked
- [ ] Focus states are visible for keyboard navigation

### Animations
- [ ] Page transitions are smooth
- [ ] Fade effects work correctly
- [ ] Scale transforms don't cause layout shift
- [ ] Loading spinners rotate smoothly

### Forms
- [ ] Input fields accept text properly
- [ ] Placeholders are visible but not too bright
- [ ] Focus rings appear correctly
- [ ] Error states (if any) are visible
- [ ] Submit buttons disable when invalid

## Functional Testing

### Chat Features
- [ ] Can send text messages
- [ ] Can upload images
- [ ] Image preview appears with cyan border
- [ ] Can remove image preview
- [ ] Code snippets render correctly
- [ ] Can copy code to clipboard
- [ ] Can download code files
- [ ] CSV detection works
- [ ] Can export as CSV
- [ ] Can save markdown responses
- [ ] Enter key sends message
- [ ] Shift+Enter creates new line
- [ ] Chat history loads correctly
- [ ] Clear history works

### Document Features
- [ ] Can drag and drop files
- [ ] Can click to browse files
- [ ] Upload progress shows correctly
- [ ] Multiple files can upload simultaneously
- [ ] Documents appear in list after processing
- [ ] Can select document to view details
- [ ] Can delete documents
- [ ] Can view original files

### Client Management
- [ ] Can create new clients
- [ ] Can upload thumbnails
- [ ] Client cards appear immediately
- [ ] Can click cards to open detail view
- [ ] Can navigate back to dashboard

## Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)

Check for:
- [ ] Gradient support
- [ ] Backdrop blur support
- [ ] CSS custom properties
- [ ] Smooth animations

## Responsive Testing

### Desktop (1920x1080)
- [ ] Layout looks good
- [ ] Text is readable
- [ ] Buttons are appropriately sized

### Laptop (1366x768)
- [ ] Everything fits properly
- [ ] No horizontal scrolling

### Tablet (768px width)
- [ ] Responsive layout activates
- [ ] Grid adjusts appropriately

## Accessibility Testing

### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Focus states are clearly visible
- [ ] Can activate buttons with Enter/Space
- [ ] Modal can be closed with Escape

### Screen Reader (Optional)
- [ ] Alt text on images
- [ ] Form labels are present
- [ ] Button labels are descriptive

### Color Contrast
- [ ] Text is readable on backgrounds
- [ ] Accent colors have sufficient contrast
- [ ] Disabled states are clearly different

## Performance Testing

- [ ] Page loads quickly
- [ ] No layout shifts during load
- [ ] Hover effects don't cause lag
- [ ] Large document lists scroll smoothly
- [ ] Image uploads don't freeze UI

## Common Issues to Watch For

### Visual Issues
- [ ] No white flashes during navigation
- [ ] No light-colored text on light backgrounds
- [ ] Gradients render smoothly (no banding)
- [ ] Borders are visible everywhere they should be

### Functional Issues
- [ ] Loading states show correctly
- [ ] Error messages are visible
- [ ] Empty states display properly
- [ ] API calls complete successfully

## Sign-Off

Once all items are checked:
- [ ] All visual elements display correctly
- [ ] All interactions work as expected
- [ ] Performance is acceptable
- [ ] No critical bugs found

**Dark mode implementation is ready for use! 🎉**

---

## Quick Troubleshooting

### Issue: Gradients not showing
**Fix**: Clear browser cache and hard refresh

### Issue: Blur effects not working
**Fix**: Check browser support for `backdrop-filter`

### Issue: Colors look wrong
**Fix**: Verify Tailwind config was updated correctly

### Issue: Hover effects laggy
**Fix**: Check CSS transitions are using `transform` not `width/height`
