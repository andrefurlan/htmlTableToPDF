(function (API) {
    'use strict';

    //CONSTANTS//

    var PIXELTOPOINTS = (96/72);
    var options = {
        
    };

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
     *
     * @param {}
     * @function
     * @returns {jsPDF}
     * @methodOf jsPDF#
     * @name saveState
     */
    API.saveState = function() {
        this.internal.write('q');  //save state
    };

    /**
     * Restores the current drawing state
     *
     * @param {}
     * @function
     * @returns {jsPDF}
     * @methodOf jsPDF#
     * @name restoreState
     */
    API.restoreState = function() {
        this.internal.write('Q'); //restore
    };

    /**
     * Clips the current drawing in the rectangle boundaries
     *
     * @param {number, number, number, number}
     * @function
     * @returns {jsPDF}
     * @methodOf jsPDF#
     * @name clipRect
     */
    API.clipRect = function(x,y,w,h) {
        this.rect(x,y,w,h,null);
        this.internal.write('h');  //complete path
        this.internal.write('W');  //clip
        this.internal.write('n');  //activate clip
    };

    API.applyTranslate = function(origin) {
        //this.internal.write('1 0 0 1 97.5 -103.5 cm');
    };

    API.applyTransform = function(transform) {
    };


    //PRIVATE FUNCTIONS//

    function renderTable(pdf, tableElement) {
        var stack = [];
        return renderNode (pdf, appendToStack(stack, tableElement.childNodes));

        function renderNode (pdf, stack) {
            while (stack.length) {
                var node = stack.pop();
                if (node.nodeType === node.ELEMENT_NODE) {
                    if(node.nodeName.toUpperCase() === 'SGV') canvg();
                    if(isElementVisible(node)) renderAttributes(pdf, node);
                    if(isOverFlowHidden(node)) {
                        pdf.saveState();
                        clipElement(pdf,node);
                        //TODO: transformations
                        //first, get the transformation matrix
                        //and the origin
                        //then get rid of the transform in the html
                        //then apply the transformation to the pdf
                        //and continue with the rest
                        renderNode(pdf, appendToStack([], node.childNodes));
                        pdf.restoreState();
                    } else {
                        appendToStack(stack, node.childNodes);
                    }
                } else if (node.nodeType === node.TEXT_NODE) {
                    renderText(pdf, node);
                    appendToStack(stack, node.childNodes);
                }
            }
            return pdf;
        }

        function appendToStack(stack, childNodes) {
            for (var i = childNodes.length; i > 0; i--) {
                stack[stack.length] = childNodes[i-1];
            }
            return stack;
        }
    }

    function renderAttributes (pdf, element) {
        drawFill(pdf, element);
        drawBorders(pdf, element);
        return pdf;
    }

    function renderText (pdf, textNode) { //TODO: finish, refactor, deal with multiple lines
        var content = textNode.nodeValue.trim();
        if(content){
            var parent = textNode.parentElement;
            var wrapper = document.createElement('span');
            //TODO: add temp style to head
            wrapper.className = "textnode";
            var newTextNode = document.createTextNode(content);
            wrapper.appendChild(newTextNode);
            textNode.remove();
            parent.appendChild(wrapper);
            var bounds = getBounds(wrapper);
            //TODO: font attributes, other fonts, etc
            var fontSize = getCSSFloat(wrapper, 'fontSize');
            var points = fontSize * PIXELTOPOINTS;
            pdf.setFont('helvetica');
            pdf.setFontSize(points);
            // in the PDF, the y position of a text is based on the
            // glyph's origin. In most fonts, the origin is not the
            // bottom of the glyph; it is the bottom of the letter 'o',
            // but the letter 'g' has a lower bottom. In this case,
            // to get the correct position for the text is necessary
            // to calculate the glyphs baseline position.
            var baseline = getBaseline(wrapper);
            pdf.text(content, bounds.left, baseline);
        }
        return pdf;
    };

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

    function insertTag () {
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

    function isOverFlowHidden(element) {

        return /(hidden|scroll|auto)/.test(getCSS(element, "overflow"));
    }

    function isTransformed(element) {
        var transform = getCSS(element, 'transform') || getCSS(element, '-ms-transform') || getCSS(element, '-o-transform')
            || getCSS(element, '-moz-transform') || getCSS(element, '-webkit-transform');
        return transform !== 'none';
    }

    function getTransform(element) { //TODO: finish this
        return {
            origin: [0,0],
            matrix: [0,0,0,0,0,0]
        };
    }

    function clipElement(pdf, node) {
        var bounds = getBounds(node);
        var borderAttributes = getBorderAttributes(node);
        pdf.clipRect(
            bounds.left + borderAttributes[3].width,
            bounds.top + borderAttributes[0].width,
            bounds.width - (borderAttributes[1].width + borderAttributes[3].width),
            bounds.height - (borderAttributes[0].width + borderAttributes[2].width)
        );
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

        // Calculate where the baseline was, percentage-wise.
        var baselineposition = smalldims.top - largedims.top;
        var bounds = getBounds(element);
        var height = largedims.height;

        return (bounds.top + (bounds.height * (baselineposition / height))) || 0;
    }

})(jsPDF.API);