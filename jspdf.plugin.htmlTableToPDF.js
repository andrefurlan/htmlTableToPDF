(function (API) {
    'use strict';

    //CONSTANTS//
    var gOptions = {};

    //GLOBAL VARIABLES//
    

    //PUBLIC FUNCTIONS//
    /**
     * Renders a table in PDF from a table HTML element. It renders according
     * to the element position, and tries to maintain some css atributes
     * as borders, fill colors, and font.
     *
     * @param {DOM Element|HTML String}
     * @param {Object}
     * @function
     * @returns {jsPDF}
     * @methodOf jsPDF#
     * @name htmlTableToPDF
     */
    API.htmlTableToPDF = function(html, options) {
        var pdf = this;
        gOptions = options;
        var tableElement = getTableElement(html);
        //if (!tableElement) return pdf;
        return renderTable(pdf, html);

        function getTableElement(html) {
            //TODO: implement getTableElement()
            return html.getElementsByTagName('table')[0];
        };
    };

    /**
     * Saves the current drawing state
     */
    API.saveState = function() {
        this.internal.write('q');  //save state
    };

    /**
     * Restores the current drawing state
     */
    API.restoreState = function() {
        this.internal.write('Q'); //restore
    };

    /**
     * Clips the current drawing in the rectangle boundaries
     */
    API.clipRect = function(x,y,w,h) {
        this.rect(x,y,w,h,null);
        this.internal.write('h');  //complete path
        this.internal.write('W');  //clip
        this.internal.write('n');  //activate clip
    };



    //PRIVATE FUNCTIONS//

    function renderTable(pdf, tableElement) {
        var stack = [tableElement];
        return renderNodes (pdf, stack);
    }

    function renderNodes(pdf, stack) {
        var appendToStack = function(stack, nodes) {
            for (var i = nodes.length; i > 0; i--) {
                stack[stack.length] = nodes[i-1];
            }
            return stack;
        };

        while (stack.length) {
            var node = stack.pop();
            if (isSupportedElement(node)) {
                if (node.nodeType === node.ELEMENT_NODE) {
                    var clipped = isOverFlowHidden(node);
                    if(clipped) {
                        pdf.saveState();
                        if(isElementVisible(node)) renderAttributes(pdf, node);
                        if(clipped) clipElement(pdf,node);
                        renderNodes(pdf, appendToStack([], node.childNodes));
                        pdf.restoreState();
                    } else {
                        if(isElementVisible(node) && isSupportedElement(node)) renderAttributes(pdf, node);
                        appendToStack(stack, node.childNodes);
                    }
                } else if (node.nodeType === node.TEXT_NODE) {
                    if(isElementVisible(node.parentNode)) renderText(pdf, node);
                    appendToStack(stack, node.childNodes);
                }
            }
        }
        return pdf;
    }

    function renderAttributes (pdf, element) {
        drawFill(pdf, element);
        drawBorders(pdf, element);
        return pdf;
    }

    function renderText(pdf, textNode) { //TODO: finish, refactor, deal with multiple lines
        var content = textNode.nodeValue.replace(/(\r\n|\n|\r)/g, " ");
        if(content.trim()){
            var parent = textNode.parentNode;
            var wrap = getCSS(parent, 'whiteSpace');
            var words;
            if(wrap === 'nowrap') {
                words = [content.trim()];
            } else {
                words = content.match(/[^\s-]+(\s|-)?/g); //break down in words and keep the delimiter (\s and -)
                if(content.match(/^\s/)) words[0] = " " + words[0];  // handles the anowing case of a white space at the beggining
            }
            
            // set font size
            var fontSize = getCSSFloat(parent, 'fontSize');
            var points = fontSize * pdf.internal.scaleFactor;
            pdf.setFontSize(points);
            // set font color
            var fontColor = getCSS(parent, 'color');
            var rgb = fontColor.match(/rgb\((\d{0,3}), (\d{1,3}), (\d{1,3})\)/);
            pdf.setTextColor(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
            // set font style
            var fontWeight = getCSS(parent, 'fontWeight').toLowerCase();
            if (parseInt(fontWeight, 10) > 600) fontWeight = "bold";  // IE case
            var fontStyle = getCSS(parent, 'fontStyle').toLowerCase();
            if (fontWeight !== 'bold') fontWeight = '';
            if (fontStyle !== 'italic') fontStyle = '';
            pdf.setFontType((fontWeight + fontStyle) || 'normal');

            // set font family
            var fontFamily = getCSS(parent, 'fontFamily').toLowerCase().split(' ')[0].replace(/("|'|,)/gm, "");
            var fonts = pdf.getFontList();
            if (fontFamily in fonts) {
                pdf.setFont(fontFamily);
            } else {
                pdf.setFont('helvetica'); // for now, all non-supported fonts will roll back to helvetica
                parent.style.fontFamily = 'Helvetica';
            }
            // insert in the pdf word by word
            var offsetStart = 0;
            var offsetEnd = 0;
            var rect;
            for (var i = 0; i < words.length; i++) {
                offsetEnd += words[i].length;
                rect = getTextBounds(textNode, offsetStart, offsetEnd-1 || offsetEnd);
                // rect = parent.getBoundingClientRect();
                // in the PDF, the y position of a text is based on the
                // glyph's origin. In most fonts, the origin is not the
                // bottom of the glyph; it is the bottom of the letter 'o',
                // but the letter 'g' has a lower bottom. In this case,
                // to get the correct position for the text is necessary
                // to calculate the glyphs' baseline position.
                var baseline = (rect.top + (rect.height * getBaseline(parent)));
                pdf.text([words[i]], rect.left, baseline);
                offsetStart += words[i].length;
            }
        }
        return pdf;
    }

    function getTextBounds(textNode, offsetStart, offsetEnd) {
        var range = document.createRange()
        range.setStart(textNode, offsetStart);
        range.setEnd(textNode, offsetEnd);
        return getBounds(range);
    }

    function drawBorders(pdf, element) {
        var borderAttributes = getBorderAttributes(element);
        borderAttributes.forEach(
            function drawInPDF (border) {
                if (border.width > 0) {
                    pdf.setLineWidth(border.width);
                    var rgb = border.color.match(/rgb\((\d{0,3}), (\d{1,3}), (\d{1,3})\)/);
                    if (rgb) {
                        pdf.setDrawColor(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
                        pdf.line(
                            border.startX,
                            border.startY,
                            border.endX,
                            border.endY
                        );    
                    }
                }
            }
        );
        return pdf;
    }

    function drawFill(pdf, element) {
        var color = getCSS(element, 'backgroundColor');
        var rgb = color.match(/rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/);
        if (rgb) {
            pdf.setFillColor(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
            var bounds = getBounds(element);
            pdf.rect(
                bounds.left,
                bounds.top,
                bounds.width,
                bounds.height,
                'F');
        }
        return pdf;
    }

    function getBorderAttributes(element) {
        var bounds = getBounds(element);
        var borderAttributes = [];
        var borderTopWidth = getCSSFloat(element, 'borderTopWidth');
        var borderRightWidth = getCSSFloat(element, 'borderRightWidth');
        var borderBottomWidth = getCSSFloat(element, 'borderBottomWidth');
        var borderLeftWidth = getCSSFloat(element, 'borderLeftWidth');
        //top border
        borderAttributes[0] = {
            width: borderTopWidth,
            color: getCSS(element, 'borderTopColor'),
            startX: bounds.left,
            startY: bounds.top + borderTopWidth/2,
            endX: bounds.right,
            endY: bounds.top + borderTopWidth/2
        };
        //right border
        borderAttributes[1] = {
            width: borderRightWidth,
            color: getCSS(element, 'borderRightColor'),
            startX: bounds.right - borderRightWidth/2,
            startY: bounds.top + borderTopWidth,
            endX: bounds.right - borderRightWidth/2,
            endY: bounds.bottom - borderBottomWidth
        };
        //bottom border
        borderAttributes[2] = {
            width: borderBottomWidth,
            color: getCSS(element, 'borderBottomColor'),
            startX: bounds.left,
            startY: bounds.bottom - borderBottomWidth/2,
            endX: bounds.right,
            endY: bounds.bottom - borderBottomWidth/2
        };
        //left border
        borderAttributes[3] = {
            width: borderLeftWidth,
            color: getCSS(element, 'borderLeftColor'),
            startX: bounds.left + borderLeftWidth/2,
            startY: bounds.top + borderTopWidth ,
            endX: bounds.left + borderLeftWidth/2,
            endY: bounds.bottom - borderBottomWidth
        };
        return borderAttributes;
    }

    function insertTag() {
        console.log('insertTableTag stub');
        return;
    }

    function getCSS(element, attribute) {
        var computedCSS = document.defaultView.getComputedStyle(element, null);
        var value = computedCSS[attribute];
        return value;        
    }

    function getCSSFloat(element, attribute) {
        var val = parseFloat(getCSS(element, attribute), 10);
        return (isNaN(val)) ? 0 : val;
    }

    function getBounds(element) {
        var rect = element.getBoundingClientRect();
        var top = rect.top;
        var left = rect.left;
        var width = rect.width || element.offsetWidth;
        var height = rect.height || element.offsetHeight;
        var bottom = rect.bottom || (rect.top + height);
        var right = rect.right || (rect.left + width);
        return {
            'top': top,
            'left': left,
            'width': width,
            'height': height,
            'bottom': bottom,
            'right': right,
        };
    }
    
    function isElementVisible(element) {
        return (
            getCSS(element, 'display') !== "none" && 
            getCSS(element, 'visibility') !== "hidden"
            );
    }

    function isSupportedElement(element) {
        var doNotRender = function(nodeName) {
            return (element.nodeName.toUpperCase() === nodeName.toUpperCase());
        };
        var notSupported = gOptions.doNotRender || [];

        return !notSupported.filter(doNotRender).length;
    }

    function isOverFlowHidden(element) {

        return /(hidden|scroll|auto)/.test(getCSS(element, "overflow"));
    }

    function clipElement(pdf, element) {
        var bounds = getBounds(element);
        var borderAttributes = getBorderAttributes(element);
        pdf.clipRect(
            bounds.left + borderAttributes[3].width,
            bounds.top + borderAttributes[0].width,
            bounds.width - (borderAttributes[1].width + borderAttributes[3].width),
            bounds.height - (borderAttributes[0].width + borderAttributes[2].width)
        );
        return pdf;
    }

    // from https://github.com/nathanhammond/baseline-ratio/blob/master/baseline-ratio.js
    // really good idea of how to get the baseline of the glyph.
    function getBaseline(element) {
        // Get the baseline in the context of whatever element is passed in.
        element = element || document.body;

        // The container is a little defenseive.
        var container = document.createElement('div');
        container.style.display = "block";
        container.style.position = "absolute";
        container.style.bottom = "0";
        container.style.right = "0";
        container.style.width = "0px";
        container.style.height = "0px";
        container.style.margin = "0";
        container.style.padding = "0";
        container.style.visibility = "hidden";
        container.style.overflow = "hidden";

        // Intentionally unprotected style definition.
        var small = document.createElement('span');
        var large = document.createElement('span');

        // Large numbers help improve accuracy.
        small.style.fontSize = "0px";
        large.style.fontSize = "2000px";

        small.innerHTML = "X";
        large.innerHTML = "X";

        container.appendChild(small);
        container.appendChild(large);

        // Put the element in the DOM for a split second.
        element.appendChild(container);
        var smalldims = small.getBoundingClientRect();
        var largedims = large.getBoundingClientRect();
        element.removeChild(container);

        // Calculate where the baseline is
        var baselineposition = smalldims.top - largedims.top;
        var height = largedims.height;

        return (baselineposition / height) || 0;
    }

    function forceRedraw(element) {
        var disp = element.style.display;
        element.style.display = 'none';
        var trick = element.offsetHeight;
        element.style.display = disp;
    }

})(jsPDF.API);