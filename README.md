# PDF Editor Tool

> Secure PDF Page Editing Application That Works Entirely in Your Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)  
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)  
[![pdf-lib](https://img.shields.io/badge/pdf--lib-latest-red)](https://pdf-lib.js.org/)  

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [File Structure](#file-structure)
- [Setup](#setup)
- [How to Use](#how-to-use)
  - [Deleting Pages](#deleting-pages)
  - [Inserting Pages](#inserting-pages)
- [Technical Specifications](#technical-specifications)
- [Browser Compatibility](#browser-compatibility)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)
- [Change Log](#change-log)

## Overview

This tool is a PDF page editing application that runs in your web browser. Since no server upload is required and all processing is completed client-side, you can insert and delete PDF file pages in a secure environment.

### Features

- 🔒 **Completely Client-Side**: Files are never sent to a server; all processing happens within your browser
- 🚀 **Fast Processing**: Efficient PDF manipulation powered by pdf-lib
- 🎨 **Modern UI**: Intuitive and sophisticated design using Tailwind CSS
- 📱 **Responsive Design**: Works across various screen sizes from desktop to tablet
- 🖱️ **Drag & Drop**: Smooth and comfortable file selection experience

## Key Features

### Page Insertion
- ✅ Insert single page (e.g., `1`)
- ✅ Insert multiple pages (e.g., `1,3,5`)
- ✅ Insert page ranges (e.g., `1-3`)
- ✅ Flexible insertion position specification
  - Specify `0` to insert at the beginning
  - Specify `1` to insert after page 1
- ✅ Insert pages from different PDF files

### Page Deletion
- ✅ Delete single page (e.g., `2`)
- ✅ Delete multiple pages (e.g., `1,3,5`)
- ✅ Delete page ranges (e.g., `1-3`)
- ✅ Maintain at least 1 page (safety feature)

### UI/UX
- ✅ Drag & drop file loading
- ✅ Real-time file information display
- ✅ Intuitive page number specification
- ✅ File System Access API for save location selection (supported browsers)
- ✅ Error handling with detailed error messages

## File Structure

```
📁 Project Root
├── 📄 PDF-Editor.html           # Main HTML file
├── 📄 README.md                 # This file
├── 📁 css/
│   └── 📄 tailwind.css          # Tailwind CSS
├── 📁 js/
│   └── 📄 pdf-lib.min.js        # PDF manipulation library
└── 📁 img/
    ├── 📄 Delete.png            # Page deletion screen screenshot
    └── 📄 Insert.png            # Page insertion screen screenshot
```

### File Descriptions

#### `PDF-Editor.html`
Main HTML file containing all PDF editing logic, UI, and event handling.

#### `css/tailwind.css`
Tailwind CSS stylesheet providing responsive layouts and utility classes.

#### `js/pdf-lib.min.js`
pdf-lib library providing PDF loading, page manipulation, and save functionality.

#### `img/`
Directory containing screenshot images.

## Setup

### Requirements

- Modern web browser
  - **Recommended**: Chrome 90+, Edge 90+, Opera 76+
  - **Limited Support**: Firefox 88+ (File System Access API not supported)
  - **Not Recommended**: Safari (may have compatibility issues)

### Installation Steps

1. **Download Files**
   
   Download all files and maintain the following folder structure.

2. **File Placement**
   
   ```
   your-folder/
   ├── PDF-Editor.html
   ├── css/
   │   └── tailwind.css
   ├── js/
   │   └── pdf-lib.min.js
   └── img/
       ├── Delete.png
       └── Insert.png
   ```

3. **Open in Browser**
   
   Double-click `PDF-Editor.html` or drag and drop it into your browser.  
<br>

> **Note**:  
> When opening as a local file, some browsers may have restrictions on file selection functionality.  
> In that case, use a simple HTTP server.

<br>

```bash
# Example using Python's simple HTTP server
python -m http.server 8000
# Access http://localhost:8000/PDF-Editor.html in your browser
```

<br>

## How to Use

### Deleting Pages

#### Step 1: Select File
1. Click the **Target PDF File** area or drag and drop a file
2. Select the PDF file you want to edit
3. File information (name, size) will be displayed

#### Step 2: Select Delete Mode
1. Click the **Delete Pages** button
2. The deletion UI will be displayed

#### Step 3: Specify Page Numbers

Enter the page numbers you want to delete in the following formats:

**Deleting a Single Page**
```
2
```
→ Deletes only page 2

**Deleting Multiple Pages**
```
1,3,5
```
→ Deletes pages 1, 3, and 5

**Deleting a Range**
```
1-3
```
→ Deletes pages 1 through 3

**Combination**
```
1,3-5,7
```
→ Deletes pages 1, 3 through 5, and 7

#### Step 4: Execute Deletion
1. Click the **Execute Delete** button
2. Once processing is complete, the edited PDF will be downloaded

#### Step 5: Save File
- **Chrome/Edge/Opera**: A save location dialog will appear via File System Access API
- **Firefox**: Automatically saved to the browser's default download folder

### Inserting Pages

#### Step 1: Select Files

**Target PDF File**
1. Drag and drop the base PDF file to the **Target PDF File** area
2. Or select via the "Select File" button

**Source PDF File**
1. Click the **Insert Pages** button
2. Drag and drop the PDF file containing pages you want to insert to the **Source PDF File** area
3. Or select via the "Select File" button

#### Step 2: Specify Page Numbers and Insert Position

**Source Page Numbers**
```
1
```
→ Insert only page 1 from the source PDF

```
1,3,5
```
→ Insert pages 1, 3, and 5 from the source PDF

```
1-3
```
→ Insert pages 1 through 3 from the source PDF

**Insert Position**
```
0
```
→ Insert at the beginning of the target PDF

```
1
```
→ Insert after page 1 of the target PDF

```
5
```
→ Insert after page 5 of the target PDF

#### Step 3: Execute Insertion
1. Click the **Execute Insert** button
2. Once processing is complete, the edited PDF will be downloaded

#### Step 4: Save File
- **Chrome/Edge/Opera**: A dialog to select save location will appear
- **Firefox**: Automatically saved to the default download folder

## Technical Specifications

### Technologies Used

| Technology | Version | Purpose |
|------|----------|------|
| HTML5 | - | Page structure and markup |
| CSS3 | - | Styling |
| JavaScript (ES6+) | - | Application logic |
| Tailwind CSS | v4 | Responsive design and styling |
| pdf-lib | Latest | PDF manipulation library |
| File System Access API | - | File save dialog (supported browsers only) |

### Processing Mechanism

#### Page Deletion
1. Load PDF file and parse with pdf-lib
2. Parse specified page numbers (supports single, multiple, and ranges)
3. Copy pages not targeted for deletion to a new PDF document
4. Save and download the new PDF

#### Page Insertion
1. Load both target PDF and source PDF
2. Get specified pages from source
3. Copy pages to specified position in target
4. Save and download the new PDF

### File Size Limitations

- **Recommended Maximum Size**: 50MB
- **Theoretical Maximum Size**: Depends on browser memory

Large PDF files or PDFs with complex structures may take longer to process.

### Supported PDF Versions

- PDF 1.3 through 1.7
- PDF 2.0 (partial functionality)

### Page Count Limitations

- **Minimum Page Count**: 1 page (at least 1 page will remain after deletion)
- **Maximum Page Count**: No limit (but depends on browser memory)

### About File System Access API

This tool uses the File System Access API when saving files.

**Supported Browsers (Chrome, Edge, Opera)**
- File save dialog is displayed
- You can freely select the save location
- File name can be changed

**Unsupported Browsers (Firefox, Safari)**
- Automatically saved to the browser's default download folder
- File name is automatically assigned
- You can select save location by enabling "Always ask where to save files" in browser settings

> **Note**:  
> This is due to browser specifications, not a limitation of this tool.  
> Firefox plans to support File System Access API in the future.

### Tested Environments

- Google Chrome 120 and later
- Microsoft Edge 120 and later
- Opera 105 and later
- Firefox 120 and later (file save dialog not supported)

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
- Edited PDF is saved as a new file
- Original PDF quality is maintained

### Security Best Practices

#### 1. Create Backups
Always create a backup of the original PDF file before editing.  

#### 2. Use in Trusted Environment
- Avoid using on public computers
- Keep malware protection software up to date
- Use a trusted browser

#### 3. Verify Files
Open the edited PDF file to verify it has been edited as intended.  

### Security Limitations

⚠️ **Points to Note**

1. **Browser Security**
   - Browser extensions may be able to access data
   - Not protected from keyloggers or malware

2. **Data in Memory**
   - PDF data exists in memory during processing
   - Cleared when page is closed

3. **Protected PDFs**
   - Password-protected PDFs cannot be opened
   - PDFs with editing restrictions may not process correctly

4. **Metadata Retention**
   - Some metadata or form information may be lost
   - Be careful if important metadata is included

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
   - Recommended 50MB or less
   - Split large files before processing

4. **Browser memory shortage**
   - Close other tabs
   - Restart browser
   - Use a PC with more memory

#### ❌ Page number specification is invalid

**Solution:**

Enter in the correct format:
- ✅ Correct: `1,3,5` or `1-3`
- ❌ Wrong: `1, 3, 5` (spaces)
- ❌ Wrong: `1～3` (full-width tilde)
- ❌ Wrong: `a,b,c` (non-numeric)

#### ❌ File is not downloaded

**Solution:**
- Check browser download settings
- Check popup blocker
- Check download folder capacity
- Try a different browser

#### ❌ Error when trying to delete all pages

**Explanation:**  
This is intentional behavior. PDF files require at least 1 page, so all pages cannot be deleted.

**Solution:**  
Leave at least 1 page.

#### ❌ Cannot select save location in Firefox

**Explanation:**  
Firefox currently does not support File System Access API, so files are automatically saved to the default download folder.

**Solution:**
1. Enable "Always ask where to save files" in Firefox settings
2. Or use Chrome/Edge/Opera

### Debugging Methods

If the problem persists, check details in the browser's developer tools:

1. Press **F12** to open developer tools
2. Select **Console** tab
3. Check error messages
4. Copy error message and search

## FAQ

### Q1: Is this tool safe?

**A:**  
Yes, it is safe.  
All processing is completed within the browser, and PDF files are not sent over the internet.  
However, it is recommended to use in a trusted environment (your own PC, trusted browser).

### Q2: Is an internet connection required?

**A:**  
No, it is not required.  
If all files (HTML, CSS, JavaScript, pdf-lib) are placed locally, it works offline.  
Initial loading may require resource loading from CDN.

### Q3: How large PDF files can be processed?

**A:**  
It depends on browser memory, but 50MB or less is recommended.  
Larger files may take longer to process or cause memory shortage errors.

### Q4: Is the original PDF file modified?

**A:**  
No, it is not modified.  
The edited PDF is saved as a new file, and the original file remains unchanged.

### Q5: Can I edit multiple PDF files at once?

**A:**  
The current version processes one PDF file at a time.  
To process multiple files, edit them one by one.

### Q6: Can I use this on mobile devices?

**A:**  
Yes, you can.  
Due to responsive design, it can be used on smartphones and tablets.  
However, PC is recommended for processing large files.

### Q7: Does PDF quality degrade?

**A:**  
Basically, it does not degrade.  
pdf-lib maintains original PDF quality, but some metadata or form information may be lost.

### Q8: Can I edit password-protected PDFs?

**A:**  
No, you cannot.  
For password-protected or edit-restricted PDFs, first remove the protection before editing.

### Q9: Can I use this commercially?

**A:**  
Yes, you can.  
Distributed under MIT License, it can be freely used for both commercial and non-commercial purposes.

### Q10: Is there compatibility with other PDF editing tools?

**A:**  
Yes, there is compatibility.  
PDFs edited with this tool can be opened normally in Adobe Acrobat, PDF-XChange, and other PDF viewers.

### Q11: Can I change page order?

**A:**  
There is no direct page reordering function, but it can be achieved by:
1. Delete necessary pages
2. Save as a separate PDF file
3. Reconstruct in desired order using page insertion function

### Q12: What should I be careful about when using Firefox?

**A:**  
Please be careful of the following when using Firefox:
- Due to File System Access API not being supported, files are automatically saved to the default download folder
- You can select save location by enabling "Always ask where to save files" in Firefox settings
- All basic functions are available

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

- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [MDN Web Docs - PDF](https://developer.mozilla.org/en-US/docs/Glossary/PDF)

---

**Last Updated**: November 2025  
