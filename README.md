# PDF Editor Tool - Visual Editor

> Secure Visual PDF Page Editor That Works Entirely in Your Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)  
[![PDF.js](https://img.shields.io/badge/PDF.js-v3.11-red)](https://mozilla.github.io/pdf.js/)  
[![pdf-lib](https://img.shields.io/badge/pdf--lib-latest-orange)](https://pdf-lib.js.org/)  

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [File Structure](#file-structure)
- [Setup](#setup)
- [How to Use](#how-to-use)
  - [Switching Languages](#switching-languages)
  - [Loading PDF Files](#loading-pdf-files)
  - [Moving Pages](#moving-pages)
  - [Copying Pages](#copying-pages)
  - [Deleting Pages](#deleting-pages)
  - [Viewing Pages](#viewing-pages)
  - [Downloading Edited PDFs](#downloading-edited-pdfs)
- [Technical Specifications](#technical-specifications)
- [Browser Compatibility](#browser-compatibility)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)

## Overview

This tool is a visual PDF page editing application that runs in your web browser. Load two PDF files side by side and freely move, copy, and delete pages between them. Since no server upload is required and all processing is completed client-side, you can edit PDF files in a secure environment.

### Features

- 🔒 **Completely Client-Side**: Files are never sent to a server; all processing happens within your browser
- 👁️ **Visual Interface**: See thumbnail previews of all pages for intuitive editing
- 🔄 **Dual PDF Panel**: Load and work with two PDFs simultaneously
- 🖱️ **Drag & Drop**: Smooth page reordering and copying between PDFs
- 🎯 **Context Menu**: Right-click pages for quick actions
- 🔍 **Page Preview**: Click any page to view it in full size
- 📊 **Progress Tracking**: Real-time progress bar during PDF generation
- 🚀 **Fast Processing**: Efficient PDF manipulation powered by pdf-lib and PDF.js
- 🌐 **Multilingual Support**: Switch between Japanese and English with one click

## Key Features

### Visual Page Management
- ✅ Thumbnail preview of all pages
- ✅ Drag and drop to reorder pages within a PDF
- ✅ Drag and drop to copy pages between PDFs
- ✅ Visual feedback during drag operations
- ✅ Click to enlarge any page

### Page Operations
- ✅ **Move Pages**: Drag pages to reorder within the same PDF
- ✅ **Copy Pages**: Drag pages from one PDF to another
- ✅ **Delete Pages**: Right-click context menu or dedicated button
- ✅ **Batch Operations**: Work with multiple pages at once

### User Interface
- ✅ Side-by-side dual PDF panels
- ✅ Drag & drop file loading
- ✅ Modal window for enlarged page view
- ✅ Progress bar with cancellation support
- ✅ Real-time status messages
- ✅ Keyboard shortcuts (ESC to cancel operations)
- ✅ **Language Toggle**: Switch between Japanese and English instantly

### File Management
- ✅ Download edited PDFs independently
- ✅ Original files remain unchanged
- ✅ Automatic filename generation
- ✅ Support for large PDFs with progress tracking

### Language Support
- ✅ **Japanese/English Toggle**: Switch languages with a single click
- ✅ **Persistent Settings**: Language preference saved in browser
- ✅ **Complete Translation**: All UI elements, messages, and labels are translated
- ✅ **Real-time Updates**: Existing pages update immediately when language changes

## File Structure

```
📁 Project Root
├── 📄 PDF-Editor.html           # Main HTML file (standalone version)
├── 📄 index.php                 # PHP version with configuration support
├── 📄 config.php                # Configuration file (PHP version only)
├── 📄 .htaccess                 # Apache configuration (PHP version only)
├── 📄 README.md                 # This file
├── 📄 README_JP.md              # Japanese README
├── 📁 css/
│   ├── 📄 PDF-Editor.css        # Custom styles
│   └── 📄 tailwind.css          # Custom styles
├── 📁 js/
│   ├── 📄 pdf.min.js            # PDF.js library for rendering
│   ├── 📄 pdf-lib.min.js        # pdf-lib library for manipulation
│   └── 📄 PDF-Editor.js         # Main application logic with i18n
└── 📁 img/
    └── 📄 (screenshots)         # Usage screenshots
```

### File Descriptions

#### `PDF-Editor.html`
Standalone HTML file containing the application structure, dual-panel layout, modal window, progress overlay, and language toggle switch. This version works without a web server.

#### `index.php`
PHP version of the main file with additional configuration support. Provides enhanced security features and server-side configuration management. **Requires PHP 7.0 or higher and Apache web server.**

#### `config.php`
Configuration file for PHP version. Contains:
- Application settings (name, version)
- Path configurations
- Security settings (file size limits, allowed file types)
- Debug mode settings
- Timezone configuration
- Utility functions for validation

**Security Note**: Direct access to this file is blocked by .htaccess

#### `.htaccess`
Apache configuration file for PHP version. Provides:
- URL rewriting rules
- Security headers (XSS protection, clickjacking prevention)
- Access control (blocks direct access to config.php)
- MIME type configuration
- Cache control settings
- Compression settings
- PHP configuration overrides

#### `css/PDF-Editor.css`
Custom stylesheet providing visual design for the dual-panel interface, page thumbnails, drag-and-drop feedback, modal window, progress bar, and language toggle.

#### `css/tailwind.css`
Tailwind CSS framework file for utility-first styling. Provides responsive design utilities, spacing, colors, and layout classes used throughout the application. This can be either:
- A custom Tailwind build with only the utilities used in the project
- The full Tailwind CSS library
- A CDN-linked version (if using remote loading)

**Note**: If you're using a CDN version of Tailwind CSS, this file may be optional. Check the HTML file's `<link>` tags to see if Tailwind is loaded via CDN.

#### `js/PDF-Editor.js`
Main application logic including:
- PDF loading and rendering
- Drag and drop functionality
- Page manipulation (move, copy, delete)
- PDF generation with progress tracking
- Event handling and user interactions
- **Internationalization (i18n) system**
- **Language switching functionality**

#### `js/pdf.min.js`
PDF.js library for rendering PDF pages as canvas elements for thumbnail display.

#### `js/pdf-lib.min.js`
pdf-lib library for PDF manipulation - loading, modifying, and saving PDF documents.

## Setup

### Requirements

- Modern web browser
  - **Recommended**: Chrome 90+, Edge 90+, Opera 76+
  - **Supported**: Firefox 88+
  - **Limited Support**: Safari (may have compatibility issues)

**For PHP Version (index.php):**
- PHP 7.0 or higher
- Apache web server with mod_rewrite enabled
- Basic file permissions (read/write for application files)

### Installation Steps

#### Option 1: Standalone HTML Version (Recommended for Local Use)

1. **Download Files**
   
   Download all files and maintain the folder structure.

2. **File Placement**
   
   ```
   your-folder/
   ├── PDF-Editor.html
   ├── css/
   │   ├── PDF-Editor.css
   │   └── tailwind.css
   ├── js/
   │   ├── pdf.min.js
   │   ├── pdf-lib.min.js
   │   └── PDF-Editor.js
   └── img/
       └── (screenshots)
   ```

3. **Open in Browser**
   
   Double-click `PDF-Editor.html` or drag and drop it into your browser.

> **Note**:  
> When opening as a local file, some browsers may have restrictions on file selection functionality.  
> In that case, use a simple HTTP server.

```bash
# Example using Python's simple HTTP server
python -m http.server 8000
# Access http://localhost:8000/PDF-Editor.html in your browser
```

#### Option 2: PHP Version (Recommended for Web Server Deployment)

1. **Download All Files**
   
   Download all files including `index.php`, `config.php`, and `.htaccess`.

2. **File Placement**
   
   ```
   your-web-directory/
   ├── index.php
   ├── config.php
   ├── .htaccess
   ├── css/
   │   ├── PDF-Editor.css
   │   └── tailwind.css
   ├── js/
   │   ├── pdf.min.js
   │   ├── pdf-lib.min.js
   │   └── PDF-Editor.js
   └── img/
       └── (screenshots)
   ```

3. **Configure Apache**
   
   Ensure Apache has `mod_rewrite` and `mod_headers` enabled:
   
   ```bash
   # On Ubuntu/Debian
   sudo a2enmod rewrite
   sudo a2enmod headers
   sudo systemctl restart apache2
   ```

4. **Set File Permissions**
   
   ```bash
   # Make config.php readable by web server
   chmod 644 config.php
   
   # Make .htaccess readable
   chmod 644 .htaccess
   
   # Ensure proper ownership (adjust www-data to your web server user)
   chown -R www-data:www-data /path/to/your-web-directory
   ```

5. **Configure Settings (Optional)**
   
   Edit `config.php` to customize:
   - Application name and version
   - Maximum file size limit
   - Debug mode (set to `false` for production)
   - File paths if different from defaults

6. **Access the Application**
   
   Navigate to your web server URL (e.g., `http://localhost/` or `https://yourdomain.com/`)

7. **Security Check**
   
   - Verify that `config.php` cannot be accessed directly (should return 403 Forbidden)
   - Test URL: `http://your-domain/config.php`
   - Expected result: Access denied

> **Production Environment Checklist**:
> - [ ] Set `ENABLE_DEBUG` to `false` in config.php
> - [ ] Enable HTTPS redirect in .htaccess (uncomment lines 10-11)
> - [ ] Verify security headers are working
> - [ ] Test that config.php is not directly accessible
> - [ ] Check file upload limits match your requirements

### Loading External Libraries

The application automatically loads the following libraries from CDN:
- PDF.js worker: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

For offline use, download these libraries and update the URLs in the JavaScript file accordingly.

## How to Use

### Switching Languages

**Location**: Top-right corner of the application

**How to Switch**:
1. Look for the language toggle switch in the top-right corner
2. The current language is displayed (e.g., "日本語" or "English")
3. Click the toggle switch to change languages
4. The entire interface updates immediately:
   - All buttons and labels
   - Status messages
   - Page thumbnails
   - Modal windows
   - Progress indicators

**Language Persistence**:
- Your language preference is automatically saved in browser storage
- The selected language is remembered on your next visit
- No account or login required

**Supported Languages**:
- 🇯🇵 Japanese (日本語)
- 🇺🇸 English

### Loading PDF Files

#### Left Panel (Panel L)
1. Click the **"Select File"** button in the left panel or drag and drop a PDF file onto the upload area
2. The PDF will load and display page thumbnails
3. File information is shown at the top of the panel

#### Right Panel (Panel R)
1. Click the **"Select File"** button in the right panel or drag and drop a PDF file onto the upload area
2. The PDF will load and display page thumbnails
3. Both PDFs can now be edited independently

### Moving Pages

**Within the Same PDF:**
1. Click and hold on a page thumbnail
2. Drag it to the desired position within the same panel
3. Release to reorder the pages
4. A preview line shows where the page will be inserted

**Result**: Pages are reordered within the same PDF document.

### Copying Pages

**Between Different PDFs:**
1. Click and hold on a page thumbnail in one panel (e.g., left panel)
2. Drag it to a position in the other panel (e.g., right panel)
3. Release to copy the page to the other PDF
4. The original page remains in the source PDF

**Result**: The page is copied to the destination PDF, and the original remains unchanged.

### Deleting Pages

**Method 1: Context Menu**
1. Right-click on any page thumbnail
2. Select **"🗑️ Delete Page"** from the context menu
3. The page is immediately removed

**Method 2: Delete Button**
1. Click on a page thumbnail to select it
2. Use the delete option (if implemented in UI)

> **Note**: A PDF must have at least 1 page. You cannot delete all pages.

### Viewing Pages

**Enlarged View:**
1. Click on any page thumbnail
2. A modal window opens showing the page in full size
3. Page number and total pages are displayed at the top
4. Click the **✕** button or click outside the modal to close

### Downloading Edited PDFs

**Left PDF:**
1. Click the **"💾 Download Left PDF"** button at the bottom of the left panel
2. A progress bar appears showing the generation progress
3. You can cancel the operation by clicking **"✕ Cancel (ESC)"** or pressing the ESC key
4. When complete, the edited PDF is automatically downloaded

**Right PDF:**
1. Click the **"💾 Download Right PDF"** button at the bottom of the right panel
2. Follow the same process as the left PDF

> **Note**: The download button is only enabled after a PDF has been loaded.

### Keyboard Shortcuts

- **ESC**: Cancel PDF generation or close modal window
- **Right-click**: Open context menu on page thumbnail

## Technical Specifications

### Technologies Used

| Technology | Version | Purpose |
|------|----------|------|
| HTML5 | - | Page structure and markup |
| CSS3 | - | Styling and animations |
| Tailwind CSS | - | Utility-first CSS framework for responsive design |
| JavaScript (ES6+) | - | Application logic |
| PDF.js | v3.11 | PDF rendering and preview |
| pdf-lib | Latest | PDF manipulation and generation |
| Canvas API | - | Rendering page thumbnails |
| LocalStorage API | - | Storing language preferences |

### Internationalization (i18n) Implementation

#### Language System
- **Built-in Translation Dictionary**: Complete translations for Japanese and English
- **Dynamic Updates**: All UI elements update in real-time when language changes
- **Scope**: Covers all buttons, labels, messages, page indicators, and modal content
- **Storage**: Language preference saved in browser's localStorage

#### Translation Coverage
- Application title and subtitle
- File upload buttons and instructions
- PDF panel labels (Left/Right)
- Page thumbnails (L/R indicators)
- Status messages (success, error, info)
- Progress bar text and indicators
- Modal window content
- Context menu items
- Help/usage instructions
- All error and confirmation messages

### Processing Flow

#### PDF Loading
1. User selects a PDF file via file input or drag & drop
2. FileReader API loads the file into memory
3. PDF.js parses each page and renders them as canvas elements
4. Thumbnails are generated and displayed in the panel
5. pdf-lib loads the PDF for manipulation
6. Status messages appear in the selected language

#### Page Moving (Within Same PDF)
1. User drags a page thumbnail to a new position
2. JavaScript tracks the drag operation and target position
3. Page order array is updated on drop
4. UI updates to reflect new order
5. PDF is not regenerated until download

#### Page Copying (Between PDFs)
1. User drags a page from one panel to another
2. Source page data is retrieved from pdf-lib document
3. Page is copied to destination PDF's page array
4. Destination panel UI is updated with new page
5. Source PDF remains unchanged

#### Page Deletion
1. User right-clicks a page and selects delete
2. Page is removed from the page array
3. Validation ensures at least 1 page remains
4. UI updates immediately
5. PDF is not regenerated until download

#### PDF Generation
1. User clicks download button
2. Progress bar appears with page count information (in selected language)
3. New PDF document is created using pdf-lib
4. Pages are copied one by one with progress updates
5. Progress bar updates for each page copied
6. Completed PDF is converted to Blob
7. Blob is downloaded using browser's download API
8. Progress bar disappears on completion

### File Size Limits

- **Recommended Maximum**: 50MB per PDF
- **Theoretical Maximum**: Depends on browser memory
- **Note**: Large PDFs may take longer to load and process

### Supported PDF Versions

- PDF 1.3 to 1.7
- PDF 2.0 (partial support)

### Page Count Limits

- **Minimum Pages**: 1 page (at least 1 page must remain after deletion)
- **Maximum Pages**: No limit (but depends on browser memory)

### Performance Considerations

- **Thumbnail Generation**: May take time for PDFs with many pages
- **Drag Operations**: Optimized for smooth performance
- **PDF Generation**: Monitored with progress bar, cancellable
- **Memory Usage**: Increases with PDF size and page count

## Browser Compatibility

### Fully Supported Browsers

✅ **Google Chrome 90+**
- All features fully supported
- Best performance
- Hardware acceleration for canvas rendering

✅ **Microsoft Edge 90+**
- All features fully supported
- Chromium-based, same performance as Chrome

✅ **Opera 76+**
- All features fully supported
- Chromium engine based

### Partially Supported Browsers

⚠️ **Firefox 88+**
- All core features supported
- Drag & drop behavior may differ slightly
- May require CORS configuration for local testing

⚠️ **Safari**
- Basic functionality works
- May have performance issues with large PDFs
- Some CSS animations may differ

### Tested Environments

- Google Chrome 120 and later
- Microsoft Edge 120 and later
- Opera 105 and later
- Firefox 120 and later

## Security

### Security Features

✅ **Client-Side Processing**
- All PDF editing is completed within the browser
- PDF files are never sent to a server
- Works without internet connection (completely local)

✅ **Privacy Protection**
- Does not send file contents externally
- Processing only in browser memory
- All data is cleared when the page is closed

✅ **Data Integrity**
- Original PDF files are not modified
- Edited PDFs are saved as new files
- Original PDF quality is maintained

✅ **No External Dependencies**
- All processing is done locally
- No third-party services involved
- No tracking or analytics

✅ **Local Storage Only**
- Only language preference is stored locally
- No sensitive data is saved
- Clear storage anytime via browser settings

### Security Best Practices

#### 1. Create Backups
Always create a backup of the original PDF files before editing.

#### 2. Use in Trusted Environment
- Avoid using on public computers
- Keep malware protection software up to date
- Use a trusted browser

#### 3. Verify Files
Open the edited PDF files to verify they have been edited as intended.

#### 4. Clear Browser Cache
After working with sensitive PDFs, consider clearing your browser cache and history.

### Security Limitations

⚠️ **Points to Note**

1. **Browser Security**
   - Browser extensions may be able to access data
   - Not protected from keyloggers or malware

2. **Data in Memory**
   - PDF data exists in memory during processing
   - Cleared when page is closed or navigated away

3. **Protected PDFs**
   - Password-protected PDFs cannot be opened
   - PDFs with editing restrictions may not process correctly

4. **Metadata**
   - Some metadata may be lost during editing
   - Form fields and annotations may not be preserved

## Troubleshooting

### Common Issues and Solutions

#### ❌ "An error occurred" is displayed

**Causes and Solutions:**

1. **PDF file is corrupted**
   - Check if it can be opened in another PDF viewer
   - If possible, regenerate the PDF

2. **Protected PDF**
   - Remove password protection and try again
   - Verify you have editing permissions

3. **File size is too large**
   - Recommended 50MB or less per file
   - Split large files before processing

4. **Browser memory shortage**
   - Close other tabs
   - Restart browser
   - Use a PC with more memory

#### ❌ Pages not displaying correctly

**Solution:**
- Refresh the browser page
- Try loading the PDF again
- Check browser console for error messages (F12)

#### ❌ Drag and drop not working

**Solution:**
- Ensure JavaScript is enabled
- Try using Chrome or Edge for best compatibility
- Check if the file is a valid PDF

#### ❌ Cannot delete a page

**Explanation:**  
This is intentional behavior. PDF files require at least 1 page, so you cannot delete the last remaining page.

**Solution:**  
Leave at least 1 page in the PDF.

#### ❌ PDF generation is slow

**Solution:**
- This is normal for large PDFs with many pages
- Monitor progress using the progress bar
- Cancel and split the PDF if necessary

#### ❌ Download button is disabled

**Solution:**
- Ensure a PDF file has been loaded
- Check if the PDF loaded successfully (thumbnails should be visible)

#### ❌ Language not switching

**Solution:**
- Refresh the page
- Check if JavaScript is enabled
- Clear browser cache and try again
- Check browser console for errors (F12)

### Debugging Methods

If problems persist, check details in the browser's developer tools:

1. Press **F12** to open developer tools
2. Select **Console** tab
3. Check error messages
4. Look for any red error messages or warnings

## FAQ

### Q1: Is this tool safe?

**A:**  
Yes, it is safe. All processing is completed within the browser, and PDF files are not sent over the internet. However, it is recommended to use in a trusted environment (your own PC, trusted browser).

### Q2: Is an internet connection required?

**A:**  
Partially. Initial loading requires internet to fetch PDF.js worker from CDN. However, if you download all libraries locally and update the URLs, it can work completely offline.

### Q3: How large PDF files can be processed?

**A:**  
It depends on browser memory, but 50MB or less per PDF is recommended. Larger files may take longer to process or cause memory shortage errors.

### Q4: Are the original PDF files modified?

**A:**  
No, they are not modified. The edited PDFs are saved as new files, and the original files remain unchanged.

### Q5: Can I work with more than 2 PDFs?

**A:**  
The current version supports 2 PDFs at a time. To work with more files, you can load different PDFs after downloading your edits.

### Q6: Can I use this on mobile devices?

**A:**  
The application can load on mobile devices, but the drag-and-drop functionality and overall user experience are optimized for desktop use. A mouse or trackpad is recommended.

### Q7: Does PDF quality degrade?

**A:**  
Basically, it does not degrade. pdf-lib maintains original PDF quality, but some metadata, forms, or annotations may be lost during the process.

### Q8: Can I edit password-protected PDFs?

**A:**  
No, you cannot. For password-protected or edit-restricted PDFs, first remove the protection before editing.

### Q9: Can I use this commercially?

**A:**  
Yes, you can. Distributed under MIT License, it can be freely used for both commercial and non-commercial purposes.

### Q10: How do I reorder pages within a PDF?

**A:**  
Simply drag and drop page thumbnails within the same panel. The pages will be reordered based on where you drop them.

### Q11: Can I undo operations?

**A:**  
The current version does not have an undo feature. To revert changes, simply reload the original PDF file. Remember that changes are not saved until you click the download button.

### Q12: Why does the progress bar show when downloading?

**A:**  
PDF generation can take time, especially for large files. The progress bar shows how many pages have been processed and allows you to cancel if needed. This prevents the browser from appearing frozen.

### Q13: What happens if I close the browser during PDF generation?

**A:**  
The operation will be interrupted, and no file will be downloaded. The original PDFs remain unchanged. You can safely reload the page and try again.

### Q14: How do I switch languages?

**A:**  
Click the language toggle switch in the top-right corner of the application. The interface immediately switches between Japanese and English. Your preference is saved automatically.

### Q15: What gets translated when I switch languages?

**A:**  
Everything! All buttons, labels, status messages, page indicators, modal content, progress bar text, error messages, and help text are translated. Even the page thumbnails update to show "L/R" in English or "左/右" in Japanese.

### Q16: Will my language preference be remembered?

**A:**  
Yes, your language selection is saved in your browser's local storage. When you return to the application, it will automatically use your preferred language.

### Q17: Can I add more languages?

**A:**  
The current version supports Japanese and English. To add more languages, you would need to modify the translation dictionary in the JavaScript file. The system is designed to be extensible for additional languages.

### Q18: Should I use the HTML version or PHP version?

**A:**  
- **Use HTML version (PDF-Editor.html)** if:
  - You want to use it locally on your computer
  - You don't have access to a web server
  - You need a simple, standalone tool
  - You're testing or developing

- **Use PHP version (index.php)** if:
  - You're deploying on a web server
  - You need centralized configuration management
  - You want enhanced security features (access control, security headers)
  - You need to customize file size limits or other settings
  - You're using this in a production environment

Both versions have identical PDF editing functionality - the PHP version just adds configuration and security features.

### Q19: What is config.php and do I need it?

**A:**  
`config.php` is the configuration file for the PHP version. It contains application settings like file size limits, allowed file types, and security configurations. You only need it if you're using `index.php`. If you're using the standalone HTML version (`PDF-Editor.html`), you don't need config.php.

### Q20: Why can't I access config.php directly?

**A:**  
This is intentional and a security feature. The `.htaccess` file blocks direct access to `config.php` to prevent unauthorized users from viewing your configuration settings. This is a best practice for web applications. The file is only accessible by the PHP application itself.

### Q21: How do I change the maximum file size limit in PHP version?

**A:**  
Edit `config.php` and change the `MAX_FILE_SIZE` constant:

```php
// Default: 50MB
define('MAX_FILE_SIZE', 50 * 1024 * 1024);

// To change to 100MB:
define('MAX_FILE_SIZE', 100 * 1024 * 1024);
```

You may also need to adjust PHP and Apache settings in `.htaccess` or `php.ini` if the new limit exceeds server defaults.

### Q22: Do I need to install Tailwind CSS separately?

**A:**  
No installation is required if:
- The `css/tailwind.css` file is included in your download
- OR if the HTML file loads Tailwind via CDN (check for `<link>` tags pointing to a CDN)

If you want to customize Tailwind or build a smaller custom version:
1. Visit [Tailwind CSS documentation](https://tailwindcss.com/docs/installation)
2. Follow the installation guide for your preferred method
3. Build a custom version containing only the utilities you need
4. Replace the existing `tailwind.css` file with your custom build

For most users, the included Tailwind CSS file is sufficient and requires no additional setup.

### Q23: Can I use the application without Tailwind CSS?

**A:**  
While Tailwind CSS provides utility classes for responsive design and layout, the core PDF editing functionality does not strictly depend on it. However, removing Tailwind CSS will affect the visual appearance and responsive behavior of the interface. If you remove it, you may need to add custom CSS to maintain proper styling.

## License

```
MIT License

Copyright (c) 2025 Presire

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🔗 Related Links

- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDN Web Docs - Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- [MDN Web Docs - Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN Web Docs - LocalStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

**Last Updated**: December 2025  
**Version**: 0.3.0 (Visual Editor with i18n Support)
