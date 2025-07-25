
import { showToast } from './toast.js';

export async function generatePDF(element) {
    if (!element || !element.textContent.trim()) {
        showToast('No content to export', 'error');
        return;
    }
    
    if (!window.html2pdf) {
        showToast('PDF generation unavailable', 'error');
        return;
    }
    
    try {
        // Create a container for PDF export
        const pdfContainer = document.createElement('div');
        pdfContainer.className = 'pdf-export-container';
        
        // Clone the content and apply PDF-specific styles
        const contentClone = element.cloneNode(true);
        prepareContentForPDF(contentClone);
        pdfContainer.appendChild(contentClone);
        
        // Temporarily attach to DOM
        document.body.appendChild(pdfContainer);
        
        // PDF options
        const options = {
            margin: 10,
            filename: `ScribeAI-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#FFFFFF'
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            },
            pagebreak: { 
                mode: ['css', 'legacy'],
                before: '.page-break-before',
                after: '.page-break-after',
                avoid: ['table', 'pre', 'blockquote']
            }
        };
        
        // Generate and save PDF
        await html2pdf().set(options).from(pdfContainer).save();
        showToast('PDF exported successfully', 'success');
    } catch (error) {
        console.error('PDF export failed:', error);
        showToast('Failed to export PDF', 'error');
    } finally {
        const container = document.querySelector('.pdf-export-container');
        if (container) container.remove();
    }
}

function prepareContentForPDF(element) {
    // Reset all styles first
    element.querySelectorAll('*').forEach(el => {
        el.style.cssText = '';
    });
    
    // Apply PDF-specific styles
    element.style.maxWidth = '100%';
    element.style.padding = '20px';
    element.style.color = '#000000';
    element.style.backgroundColor = '#ffffff';
    
    // Style code blocks
    element.querySelectorAll('pre, code').forEach(el => {
        el.style.backgroundColor = '#f6f8fa';
        el.style.border = '1px solid #e1e4e8';
        el.style.borderRadius = '6px';
        el.style.padding = '16px';
        el.style.overflow = 'visible';
        el.style.whiteSpace = 'pre-wrap';
        el.style.fontFamily = 'monospace';
    });
    
    // Style tables with better page break handling (avoid breaking tables)
    element.querySelectorAll('table').forEach(table => {
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '16px 0';
        table.style.border = '1px solid #000000';
        table.style.pageBreakInside = 'avoid';
        table.style.breakInside = 'avoid';
        
        table.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #000000';
            cell.style.padding = '8px 12px';
            cell.style.pageBreakInside = 'avoid';
            cell.style.breakInside = 'avoid';
        });
        
        table.querySelectorAll('th').forEach(th => {
            th.style.fontWeight = 'bold';
            th.style.backgroundColor = '#f8f9fa';
        });
    });
    
    // Style code blocks to avoid breaking (keep code together)
    element.querySelectorAll('pre').forEach(pre => {
        pre.style.pageBreakInside = 'avoid';
        pre.style.breakInside = 'avoid';
    });
    
    // Style blockquotes to avoid breaking
    element.querySelectorAll('blockquote').forEach(blockquote => {
        blockquote.style.pageBreakInside = 'avoid';
        blockquote.style.breakInside = 'avoid';
        blockquote.style.borderLeft = '4px solid #6a0dad';
        blockquote.style.paddingLeft = '16px';
        blockquote.style.margin = '16px 0';
    });
    
    // Style headers (allow normal page breaks)
    element.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(header => {
        header.style.color = '#000000';
        header.style.fontWeight = 'bold';
        header.style.marginTop = '24px';
        header.style.marginBottom = '16px';
        // Remove page break restrictions - let headings break naturally
    });
    
    // Style paragraphs and lists (allow normal page breaks)
    element.querySelectorAll('p, li').forEach(el => {
        el.style.marginBottom = '16px';
        el.style.lineHeight = '1.5';
        // Remove page break restrictions - let text flow naturally
    });
    
    // Enhanced footer styling for PDF
    element.querySelectorAll('.document-footer').forEach(footer => {
        footer.style.fontSize = '12px';
        footer.style.color = '#666666';
        footer.style.marginTop = '24px';
        footer.style.paddingTop = '16px';
        footer.style.borderTop = '1px solid #e1e1e1';
        footer.style.textAlign = 'center';
        footer.style.pageBreakInside = 'avoid';
        footer.style.breakInside = 'avoid';
        footer.style.display = 'block';
        footer.style.visibility = 'visible';
        footer.style.opacity = '1';
        
        footer.querySelectorAll('strong').forEach(strong => {
            strong.style.fontWeight = '600';
            strong.style.color = '#333333';
        });
    });

    // Remove interactive elements
    element.querySelectorAll('button, a, input, textarea, select').forEach(el => {
        el.remove();
    });
}
