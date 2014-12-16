(function (API) {
    'use strict';

    //CONSTANTS//

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
     * Renders table element to jsPDF object
     *
     * @param {jsPDF}
     * @param {DOM Element}
     * @returns {jsPDF}
     */
    function renderTable(pdf, tableElement) {
        var stack = [];
        return renderNode (pdf, appendToStack(stack, tableElement.childNodes));

        function renderNode (pdf, stack) { //TODO: refactor
            while (stack.length) {
                var node = stack.pop();
                if (node.nodeType === node.ELEMENT_NODE) {
                    if(isElementVisible(node)) renderAttributes(pdf, node);
                    if(/(hidden|scroll|auto)/.test(getCSS(node, "overflow")) === true) {
                        pdf.internal.write('q');  //save state
                        var bounds = getBounds(node);
                        var borderAttributes = getBorderAttributes(node);
                        pdf.rect(
                            bounds.left + borderAttributes[3].width,
                            bounds.top + borderAttributes[0].width,
                            bounds.width - (borderAttributes[1].width + borderAttributes[3].width),
                            bounds.height - (borderAttributes[0].width + borderAttributes[2].width),
                            null);
                        pdf.internal.write('h');  //complete path
                        pdf.internal.write('W');  //clip
                        pdf.internal.write('n');  //activate clip
                        //recursive it's easy to restore the clipping
                        renderNode(pdf, appendToStack([], node.childNodes));
                        pdf.internal.write('Q'); //restore
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
    }



    //PRIVATE FUNCTIONS//


    /**
     * Description
     *
     * @example 
     * @param {DOM Element} 
     * @returns {}
     */
    function appendToStack(stack, childNodes) {
        for (var i = childNodes.length; i > 0; i--) {
            stack[stack.length] = childNodes[i-1];
        }
        return stack;
    }


/**
     * Renders table element to jsPDF object
     *
     * @param {jsPDF}
     * @param {DOM Element}
     * @returns {jsPDF}
     */

    function renderAttributes (pdf, element) {
        drawFill(pdf, element);
        drawBorders(pdf, element);
        return pdf;
    }

    /**
     * Description
     *
     * @example 
     * @param {DOM Element} 
     * @returns {}
     */
    function renderText (pdf, element) { //TODO: finish, refactor
        var content = element.nodeValue.trim();
        if(content){
            var parent = element.parentElement;
            var wraper = document.createElement('span');
            //TODO: add temp style to head
            wraper.className = "textnode";
            var newTextNode = document.createTextNode(content);
            wraper.appendChild(newTextNode);
            element.remove();
            parent.appendChild(wraper);
            var bounds = getBounds(wraper);
            //TODO: font attributes, other fonts, etc
            var fontSize = getCSSFloat(wraper, 'fontSize');
            var points = fontSize * 1.3;
            pdf.setFont('helvetica');
            pdf.setFontSize(points);
            pdf.text(content, bounds.left, bounds.bottom);
        }
        return pdf;
    };


    /**
     * Description
     *
     * @example 
     * @param {DOM Element} 
     * @returns {}
     */
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

    /**
     * Description
     *
     * @example 
     * @param {DOM Element} 
     * @returns {}
     */
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

    /**
     * Description
     *
     * @example 
     * @param {DOM Element} 
     * @returns {}
     */
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
    
    //from html2canvas 
    function isElementVisible(element) {
        return (
            getCSS(element, 'display') !== "none" && 
            getCSS(element, 'visibility') !== "hidden"
            );
    }

})(jsPDF.API);