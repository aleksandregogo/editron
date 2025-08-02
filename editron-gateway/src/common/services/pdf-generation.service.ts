import { Injectable, Logger } from '@nestjs/common';
import * as pdfmake from 'pdfmake';
import { JSDOM } from 'jsdom';
import { TDocumentDefinitions } from 'pdfmake/build/pdfmake';

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);
  private readonly printer: pdfmake.Tmp;
  private readonly pdfStyles: string = `
    /* --- Base Typography & Layout --- */
    body {
      font-family: 'Roboto', sans-serif;
      font-size: 11pt;
      line-height: 1.25;
      color: #171717;
      margin: 2cm;
    }

    p {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
    }

    /* --- Headings --- */
    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-top: 0;
      margin-bottom: 12pt;
      line-height: 1.2;
    }

    h2 {
      font-size: 20pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 8pt;
      line-height: 1.2;
    }

    h3 {
      font-size: 16pt;
      font-weight: bold;
      margin-top: 16pt;
      margin-bottom: 6pt;
      line-height: 1.2;
    }

    /* --- Text Formatting --- */
    strong, b {
      font-weight: bold;
    }

    em, i {
      font-style: italic;
    }

    /* --- Lists --- */
    ul, ol {
      margin-top: 0.5em;
      margin-bottom: 0.5em;
      padding-left: 1.5em;
    }

    li {
      margin-bottom: 0.25em;
    }

    /* --- Blockquotes & Other Elements --- */
    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 3px solid #a855f7;
      background-color: #f5f5f5;
      font-style: italic;
      color: #525252;
    }

    hr {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 1.5em 0;
    }
  `;

  constructor() {
    this.printer = new pdfmake({
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    });
    this.logger.log('PDF styles loaded successfully.');
  }

  async generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
    try {
      // 1. CRITICAL: Wrap the user's HTML with our style block.
      // This ensures the conversion library sees the styles.
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              ${this.pdfStyles}
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;

      // 2. Parse HTML and convert to pdfmake content
      const dom = new JSDOM(fullHtml);
      const document = dom.window.document;
      const body = document.body;
      
      const pdfmakeJson = this.convertHtmlToPdfmake(body);

      // 3. Define the document structure. The styles are now implicitly
      // handled by the HTML conversion, but we keep the default font.
      const docDefinition: TDocumentDefinitions = {
        content: pdfmakeJson,
        defaultStyle: {
          font: 'Roboto',
        },
      };

      // 4. Create the PDF buffer
      return new Promise((resolve, reject) => {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        pdfDoc.on('end', () => {
          const result = Buffer.concat(chunks);
          resolve(result);
        });

        pdfDoc.on('error', (error) => {
          reject(error);
        });

        pdfDoc.end();
      });
    } catch (error) {
      this.logger.error('Failed to generate PDF from HTML.', error);
      throw new Error('PDF generation failed.');
    }
  }

  private convertHtmlToPdfmake(element: Element): any {
    const children = Array.from(element.children);
    
    if (children.length === 0) {
      // Text content
      const text = element.textContent?.trim();
      if (text) {
        return { text };
      }
      return [];
    }

    const content: any[] = [];
    
    for (const child of children) {
      const tagName = child.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          content.push({
            text: child.textContent?.trim() || '',
            style: tagName,
            margin: [0, 10, 0, 5]
          });
          break;
          
        case 'p':
          content.push({
            text: child.textContent?.trim() || '',
            margin: [0, 5, 0, 5]
          });
          break;
          
        case 'ul':
        case 'ol':
          const listItems = Array.from(child.children).map(li => ({
            text: li.textContent?.trim() || '',
            margin: [0, 2, 0, 2]
          }));
          content.push({
            ul: listItems,
            margin: [0, 5, 0, 5]
          });
          break;
          
        case 'blockquote':
          content.push({
            text: child.textContent?.trim() || '',
            italics: true,
            margin: [10, 5, 0, 5],
            border: [false, false, false, true],
            borderColor: ['#a855f7']
          });
          break;
          
        case 'hr':
          content.push({
            canvas: [{
              type: 'line',
              x1: 0, y1: 0, x2: 515, y2: 0,
              lineWidth: 1,
              lineColor: '#e5e5e5'
            }],
            margin: [0, 10, 0, 10]
          });
          break;
          
        default:
          // Recursively process other elements
          const childContent = this.convertHtmlToPdfmake(child);
          if (Array.isArray(childContent)) {
            content.push(...childContent);
          } else {
            content.push(childContent);
          }
          break;
      }
    }
    
    return content;
  }
} 