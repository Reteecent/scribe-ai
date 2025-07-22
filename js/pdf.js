export async function generatePDF(aiMessageContainer) {
    // Validate input first
    if (!aiMessageContainer || typeof aiMessageContainer.querySelector !== 'function') {
        throw new Error('Invalid message container provided');
    }
    
    try {
        console.log('Starting PDF generation...');
        
        // Ensure jsPDF and html2canvas are loaded
        await ensurePDFLibraries();
        
        // Get content element
        const contentElement = aiMessageContainer.querySelector('.ai-message-content, .markdown-body');
        if (!contentElement) {
            throw new Error('No content found for PDF generation');
        }
        
        // Create temporary container for PDF rendering
        const tempContainer = createTempContainer();
        
        // Clone and prepare content
        const clonedContent = contentElement.cloneNode(true);
        prepareContentForPDF(clonedContent);
        
        // Create wrapper for proper scaling
        const pdfWrapper = document.createElement('div');
        pdfWrapper.className = 'pdf-wrapper';
        pdfWrapper.appendChild(clonedContent);
        tempContainer.appendChild(pdfWrapper);
        document.body.appendChild(tempContainer);
        
        // Generate PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            compress: true
        });
        
        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Render content to canvas
        const canvas = await window.html2canvas(pdfWrapper, {
            scale: 3,
            logging: false,
            useCORS: true,
            backgroundColor: '#FFFFFF',
            width: pdfWrapper.scrollWidth,
            height: pdfWrapper.scrollHeight
        });
        
        // Add canvas to PDF
        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgWidth = doc.internal.pageSize.getWidth() - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let position = 0;
        const pageHeight = doc.internal.pageSize.getHeight() - 40;
        
        while (position < imgHeight) {
            if (position > 0) {
                doc.addPage();
            }
            
            const heightToRender = Math.min(pageHeight, imgHeight - position);
            doc.addImage(
                imgData,
                'PNG',
                20,
                20 - position,
                imgWidth,
                imgHeight,
                0,
                position,
                imgWidth,
                heightToRender,
                null,
                'FAST'
            );
            
            position += pageHeight;
        }
        
        // Clean up
        document.body.removeChild(tempContainer);
        
        console.log('PDF generation completed successfully');
        return doc.output('blob');
        
    } catch (error) {
        console.error('PDF Generation Error:', error);
        
        // Clean up on error
        const tempContainer = document.querySelector('.pdf-temp-container');
        if (tempContainer) document.body.removeChild(tempContainer);
        
        throw new Error(`PDF generation failed: ${error.message}`);
    }
}

async function ensurePDFLibraries() {
    const promises = [];
    
    if (!window.jspdf) {
        promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'));
    }
    if (!window.html2canvas) {
        promises.push(loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'));
    }
    
    if (promises.length > 0) {
        console.log('Loading PDF libraries...');
        await Promise.all(promises);
        console.log('PDF libraries loaded successfully');
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if script already exists
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

function createTempContainer() {
    const container = document.createElement('div');
    container.className = 'pdf-temp-container';
    Object.assign(container.style, {
        position: 'absolute',
        left: '-9999px',
        top: '0',
        width: '800px',
        padding: '40px',
        backgroundColor: 'white',
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: '16px',
        lineHeight: '1.8',
        color: '#000000'
    });
    return container;
}

function prepareContentForPDF(content) {
    // Remove any existing buttons
    content.querySelectorAll('button').forEach(btn => btn.remove());
    
    // Ensure visibility
    content.style.opacity = '1';
    content.style.visibility = 'visible';
    content.style.display = 'block';
    
    // Improved PDF styling
    content.style.fontSize = '16px';
    content.style.lineHeight = '1.8';
    content.style.padding = '30px';
    content.style.maxWidth = '800px';
    content.style.margin = '0 auto';
    
    // Fix styles for PDF
    content.querySelectorAll('*').forEach(element => {
        // Remove any transform effects
        element.style.transform = 'none';
        
        // Ensure text is black for PDF
        element.style.color = '#000000';
        element.style.backgroundColor = '#ffffff';
        
        // Fix pre elements
        if (element.tagName === 'PRE') {
            element.style.backgroundColor = '#f6f8fa';
            element.style.border = '1px solid #d0d7de';
            element.style.padding = '20px';
            element.style.borderRadius = '8px';
            element.style.overflow = 'visible';
            element.style.fontSize = '14px';
            element.style.lineHeight = '1.5';
        }
        
        // Fix headers
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
            element.style.color = '#000000';
            element.style.marginBottom = '8px';
            element.style.marginTop = '25px';
            element.style.fontWeight = 'bold';
        }
        
        // Fix tables
        if (element.tagName === 'TABLE') {
            element.style.borderCollapse = 'collapse';
            element.style.width = '100%';
            element.style.backgroundColor = '#ffffff';
            element.style.border = '1px solid #000000';
            element.style.marginTop = '20px';
            element.style.marginBottom = '20px';
            element.style.fontSize = '14px';
        }
        
        if (element.tagName === 'TH' || element.tagName === 'TD') {
            element.style.border = '1px solid #000000';
            element.style.padding = '8px 12px';
            element.style.color = '#000000';
            element.style.backgroundColor = '#ffffff';
        }
        
        if (element.tagName === 'TH') {
            element.style.fontWeight = 'bold';
            element.style.backgroundColor = '#ffffff';
            element.style.color = '#000000';
        }
        
        // Better spacing for all elements
        if (['P', 'UL', 'OL', 'PRE', 'TABLE', 'BLOCKQUOTE'].includes(element.tagName)) {
            element.style.marginTop = '15px';
            element.style.marginBottom = '15px';
        }
    });
}