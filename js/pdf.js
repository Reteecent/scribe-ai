import { showToast } from './chat.js';

export async function generatePDF(element) {
    if (!element) {
        showToast('No content to generate PDF', 'error');
        throw new Error('No element provided for PDF generation');
    }
    
    try {
        // Create a temporary container for PDF generation
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '800px';
        tempContainer.style.padding = '30px';
        tempContainer.style.backgroundColor = 'white';
        tempContainer.style.color = '#000000';
        tempContainer.style.fontFamily = 'Roboto, Arial, sans-serif';
        tempContainer.style.fontSize = '16px';
        tempContainer.style.lineHeight = '1.6';
        
        // Clone and prepare content
        const clone = element.cloneNode(true);
        
        // Remove interactive elements
        const elementsToRemove = clone.querySelectorAll(
            'button, .generate-btn, .download-pdf-btn, .scroll-to-bottom-btn, .loading-indicator'
        );
        elementsToRemove.forEach(el => el.remove());
        
        // Ensure proper styling for all elements
        clone.querySelectorAll('*').forEach(el => {
            el.style.color = '#000000';
            el.style.backgroundColor = 'white';
            
            if (el.tagName === 'PRE' || el.tagName === 'CODE') {
                el.style.backgroundColor = '#f6f8fa';
                el.style.border = '1px solid #e1e4e8';
                el.style.borderRadius = '6px';
                el.style.padding = '16px';
                el.style.overflow = 'auto';
            }
            
            if (el.tagName === 'TABLE') {
                el.style.borderCollapse = 'collapse';
                el.style.width = '100%';
                el.style.margin = '16px 0';
                el.style.border = '1px solid #000000';
            }
            
            if (el.tagName === 'TH' || el.tagName === 'TD') {
                el.style.border = '1px solid #000000';
                el.style.padding = '8px 12px';
            }
        });
        
        // Format footer properly
        const footer = clone.querySelector('.document-footer');
        if (footer) {
            footer.innerHTML = footer.innerHTML
                .replace('**Generated:**', '<strong>Generated:</strong>')
                .replace('**Version:**', '<strong>Version:</strong>');
            footer.style.fontWeight = 'bold';
            footer.style.color = '#666666';
            footer.style.marginTop = '20px';
            footer.style.paddingTop = '10px';
            footer.style.borderTop = '1px solid #e1e1e1';
        }
        
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);
        
        // Configure html2pdf options
        const options = {
            margin: 10,
            filename: `ScribeAI-Document-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: {
                type: 'jpeg',
                quality: 0.98
            },
            html2canvas: {
                scale: 2,
                logging: true,
                useCORS: true,
                backgroundColor: '#FFFFFF',
                ignoreElements: (element) => {
                    return element.classList &&
                        (element.classList.contains('generate-btn') ||
                            element.classList.contains('download-pdf-btn') ||
                            element.classList.contains('scroll-to-bottom-btn'));
                }
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };
        
        // Generate and save PDF
        await html2pdf().set(options).from(tempContainer).save();
        
        showToast('PDF generated successfully', 'success');
        return true;
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate PDF', 'error');
        throw error;
    } finally {
        // Clean up temporary container
        const tempContainer = document.querySelector('div[style*="left: -9999px"]');
        if (tempContainer && tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
        }
    }
}

function prepareContentForPDF(content) {
    // Apply consistent styling
    content.querySelectorAll('*').forEach(el => {
        el.style.color = '#000000';
        el.style.backgroundColor = '#ffffff';
        
        if (el.tagName === 'PRE') {
            el.style.backgroundColor = '#f6f8fa';
            el.style.border = '1px solid #d0d7de';
            el.style.padding = '20px';
            el.style.borderRadius = '8px';
            el.style.overflow = 'visible';
            el.style.fontSize = '14px';
            el.style.lineHeight = '1.5';
        }
        
        if (/^H[1-6]$/.test(el.tagName)) {
            el.style.color = '#000000';
            el.style.marginBottom = '8px';
            el.style.marginTop = '25px';
            el.style.fontWeight = 'bold';
        }
        
        if (el.tagName === 'TABLE') {
            el.style.borderCollapse = 'collapse';
            el.style.width = '100%';
            el.style.backgroundColor = '#ffffff';
            el.style.border = '1px solid #000000';
            el.style.marginTop = '20px';
            el.style.marginBottom = '20px';
            el.style.fontSize = '14px';
        }
        
        if (el.tagName === 'TH' || el.tagName === 'TD') {
            el.style.border = '1px solid #000000';
            el.style.padding = '8px 12px';
            el.style.color = '#000000';
            el.style.backgroundColor = '#ffffff';
        }
        
        if (el.tagName === 'TH') {
            el.style.fontWeight = 'bold';
        }
    });
}