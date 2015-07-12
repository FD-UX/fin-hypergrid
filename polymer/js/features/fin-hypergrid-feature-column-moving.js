'use strict';
/**
 *
 * @module features\column-moving
 * @description
 this feature is responsible for column drag and drop reordering
 *
 */
(function() {

    var noop = function() {};

    var columnAnimationTime = 150;
    var dragger;
    var draggerCTX;
    var floatColumn;
    var floatColumnCTX;

    Polymer({ /* jshint ignore:line */

        /**
         * @property {Array} floaterAnimationQueue - queue up the animations that need to play so they are done synchronously
         * @instance
         */
        floaterAnimationQueue: [],

        /**
         * @property {boolean} columnDragAutoScrollingRight - am I currently auto scrolling right
         * @instance
         */
        columnDragAutoScrollingRight: false,

        /**
         * @property {boolean} columnDragAutoScrollingLeft  - am I currently auto scrolling left
         * @instance
         */
        columnDragAutoScrollingLeft: false,

        /**
         * @property {boolean} dragArmed - is the drag mechanism currently enabled(armed)
         * @instance
         */
        dragArmed: false,

        /**
         * @property {boolean} dragging - am I dragging right now
         * @instance
         */
        dragging: false,

        /**
         * @property {integer} dragCol - return the column index of the currently dragged column
         * @instance
         */
        dragCol: -1,

        /**
         * @property {integer} dragOffset - an offset to position the dragged item from the cursor
         * @instance
         */
        dragOffset: 0,

        /**
        * @function
        * @instance
        * @description
        give me an opportunity to initialize stuff on the grid
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        */
        initializeOn: function(grid) {
            this.isFloatingNow = false;
            this.initializeAnimationSupport(grid);
            if (this.next) {
                this.next.initializeOn(grid);
            }
        },

        /**
        * @function
        * @instance
        * @description
        initialize animation support on the grid
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        */
        initializeAnimationSupport: function(grid) {
            noop(grid);
            if (!dragger) {
                dragger = document.createElement('canvas');
                dragger.setAttribute('width', '0px');
                dragger.setAttribute('height', '0px');

                document.body.appendChild(dragger);
                draggerCTX = dragger.getContext('2d');
            }
            if (!floatColumn) {
                floatColumn = document.createElement('canvas');
                floatColumn.setAttribute('width', '0px');
                floatColumn.setAttribute('height', '0px');

                document.body.appendChild(floatColumn);
                floatColumnCTX = floatColumn.getContext('2d');
            }

        },

        /**
        * @function
        * @instance
        * @description
         handle this event
         * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
         * @param {Object} event - the event details
        */
        handleMouseDrag: function(grid, event) {

            var gridCell = event.gridCell;
            var x, y;

            if (this.isFixedRow(grid, event) && this.dragArmed && !this.dragging) {
                this.dragging = true;
                this.dragCol = gridCell.x;
                this.dragOffset = event.mousePoint.x;
                this.detachChain();
                x = event.primitiveEvent.detail.mouse.x - this.dragOffset;
                y = event.primitiveEvent.detail.mouse.y;
                this.createDragColumn(grid, x, this.dragCol);
            } else if (this.next) {
                this.next.handleMouseDrag(grid, event);
            }
            if (this.dragging) {
                x = event.primitiveEvent.detail.mouse.x - this.dragOffset;
                y = event.primitiveEvent.detail.mouse.y;
                this.dragColumn(grid, x);
            }
        },

        /**
        * @function
        * @instance
        * @description
         handle this event
         * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
         * @param {Object} event - the event details
        */
        handleMouseDown: function(grid, event) {
            if (grid.getBehavior().isColumnReorderable()) {
                if (this.isFixedRow(grid, event)) {
                    this.dragArmed = true;
                }
            }
            if (this.next) {
                this.next.handleMouseDown(grid, event);
            }
        },

        /**
        * @function
        * @instance
        * @description
         handle this event
         * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
         * @param {Object} event - the event details
        */
        handleMouseUp: function(grid, event) {
            if (this.dragging) {
                this.cursor = null;
                //delay here to give other events a chance to be dropped
                var self = this;
                this.endDragColumn(grid);
                setTimeout(function() {
                    self.attachChain();
                }, 200);
            }
            this.dragCol = -1;
            this.dragging = false;
            this.dragArmed = false;
            grid.repaint();
            if (this.next) {
                this.next.handleMouseUp(grid, event);
            }

        },

        /**
        * @function
        * @instance
        * @description
         handle this event
         * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
         * @param {Object} event - the event details
        */
        handleMouseMove: function(grid, event) {

            this.cursor = null;
            if (this.next) {
                this.next.handleMouseMove(grid, event);
            }
            if (this.isFixedRow(grid, event) && this.dragging) {
                this.cursor = 'none'; //move';
            }

        },

        /**
        * @function
        * @instance
        * @description
        this is the main event handler that manages the dragging of the column
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {boolean} draggedToTheRight - are we moving to the right
        */
        floatColumnTo: function(grid, draggedToTheRight) {
            this.floatingNow = true;
            //var behavior = grid.getBehavior();
            var scrollLeft = grid.getHScrollValue();
            var floaterIndex = grid.renderOverridesCache.floater.columnIndex;
            var draggerIndex = grid.renderOverridesCache.dragger.columnIndex;
            var hdpiratio = grid.renderOverridesCache.dragger.hdpiratio;

            var draggerStartX;
            var floaterStartX;
            var draggerWidth = grid.getColumnWidth(draggerIndex + scrollLeft);
            //var floaterWidth = grid.getColumnWidth(floaterIndex + scrollLeft);

            var max = grid.getVisibleColumnsCount();
            if (draggedToTheRight) {
                draggerStartX = grid.getColumnEdge(Math.min(max, draggerIndex));
                floaterStartX = grid.getColumnEdge(Math.min(max, floaterIndex));

                grid.renderOverridesCache.dragger.startX = floaterStartX * hdpiratio;
                grid.renderOverridesCache.floater.startX = draggerStartX * hdpiratio;

                floaterStartX = draggerStartX + draggerWidth;
            } else {
                floaterStartX = grid.getColumnEdge(Math.min(max, floaterIndex));
                draggerStartX = floaterStartX + draggerWidth;

                grid.renderOverridesCache.dragger.startX = floaterStartX * hdpiratio;
                grid.renderOverridesCache.floater.startX = draggerStartX * hdpiratio;
            }
            grid.swapColumns(draggerIndex + scrollLeft, floaterIndex + scrollLeft);
            grid.renderOverridesCache.dragger.columnIndex = floaterIndex;
            grid.renderOverridesCache.floater.columnIndex = draggerIndex;


            this.floaterAnimationQueue.unshift(this.doColumnMoveAnimation(grid, floaterStartX, draggerStartX));

            this.doFloaterAnimation(grid);

        },

        /**
        * @function
        * @instance
        * @description
        manifest the column drag and drop animation
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} floaterStartX - the x start coordinate of the column underneath that floats behind the dragged column
        * @param {integer} draggerStartX - the x start coordinate of the dragged column
        */
        doColumnMoveAnimation: function(grid, floaterStartX, draggerStartX) {
            var self = this;
            return function() {
                var d = floatColumn;
                d.style.display = 'inline';
                self.setCrossBrowserProperty(d, 'transform', 'translate(' + floaterStartX + 'px, ' + 0 + 'px)');

                //d.style.webkit-webkit-Transform = 'translate(' + floaterStartX + 'px, ' + 0 + 'px)';
                //d.style.webkit-webkit-Transform = 'translate(' + floaterStartX + 'px, ' + 0 + 'px)';

                window.requestAnimationFrame(function() {
                    self.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + columnAnimationTime + 'ms ease');
                    self.setCrossBrowserProperty(d, 'transform', 'translate(' + draggerStartX + 'px, ' + -2 + 'px)');
                });
                grid.repaint();
                //need to change this to key frames

                setTimeout(function() {
                    self.setCrossBrowserProperty(d, 'transition', '');
                    grid.renderOverridesCache.floater = null;
                    grid.repaint();
                    self.doFloaterAnimation(grid);
                    requestAnimationFrame(function() {
                        d.style.display = 'none';
                        self.isFloatingNow = false;
                    });
                }, columnAnimationTime + 50);
            };
        },

        /**
        * @function
        * @instance
        * @description
        manifest the floater animation
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        */
        doFloaterAnimation: function(grid) {
            if (this.floaterAnimationQueue.length === 0) {
                this.floatingNow = false;
                grid.repaint();
                return;
            }
            var animation = this.floaterAnimationQueue.pop();
            animation();
        },

        /**
        * @function
        * @instance
        * @description
        create the float column at columnIndex underneath the dragged column
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} columnIndex - the index of the column that will be floating
        */
        createFloatColumn: function(grid, columnIndex) {
            var renderer = grid.getRenderer();
            var columnEdges = renderer.getColumnEdges();
            var scrollLeft = grid.getHScrollValue();
            var columnWidth = grid.getColumnWidth(columnIndex + scrollLeft);
            var colHeight = grid.clientHeight;
            var d = floatColumn;
            var style = d.style;
            var location = grid.getBoundingClientRect();

            style.top = (location.top - 2) + 'px';
            style.left = location.left + 'px';
            style.position = 'fixed';

            var hdpiRatio = grid.getHiDPI(floatColumnCTX);

            d.setAttribute('width', Math.round(columnWidth * hdpiRatio) + 'px');
            d.setAttribute('height', Math.round(colHeight * hdpiRatio) + 'px');
            style.boxShadow = '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)';
            style.width = columnWidth + 'px'; //Math.round(columnWidth / hdpiRatio) + 'px';
            style.height = colHeight + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';
            style.borderTop = '1px solid ' + renderer.resolveProperty('lineColor');
            style.backgroundColor = renderer.resolveProperty('backgroundColor');

            var startX = columnEdges[columnIndex];
            startX = startX * hdpiRatio;

            floatColumnCTX.scale(hdpiRatio, hdpiRatio);

            grid.renderOverridesCache.floater = {
                columnIndex: columnIndex,
                ctx: floatColumnCTX,
                startX: startX,
                width: columnWidth,
                height: colHeight,
                hdpiratio: hdpiRatio
            };

            style.zIndex = '4';
            this.setCrossBrowserProperty(d, 'transform', 'translate(' + startX + 'px, ' + -2 + 'px)');
            style.cursor = 'none';
            grid.repaint();
        },

        /**
        * @function
        * @instance
        * @description
        utility function for setting cross browser css properties
        * @param {HTMLElement} element - descripton
        * @param {string} property - the property
        * @param {string} value - the value to assign
        */
        setCrossBrowserProperty: function(element, property, value) {
            var uProperty = property[0].toUpperCase() + property.substr(1);
            this.setProp(element, 'webkit' + uProperty, value);
            this.setProp(element, 'Moz' + uProperty, value);
            this.setProp(element, 'ms' + uProperty, value);
            this.setProp(element, 'O' + uProperty, value);
            this.setProp(element, property, value);
        },

        /**
        * @function
        * @instance
        * @description
        utility function for setting properties on HTMLElements
        * @param {HTMLElement} element - descripton
        * @param {string} property - the property
        * @param {string} value - the value to assign
        */
        setProp: function(element, property, value) {
            if (property in element.style) {
                element.style[property] = value;
            }
        },

        /**
        * @function
        * @instance
        * @description
        create the dragged column at columnIndex above the floated column
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} x - the start position
        * @param {integer} columnIndex - the index of the column that will be floating
        */
        createDragColumn: function(grid, x, columnIndex) {
            var renderer = grid.getRenderer();
            var columnEdges = renderer.getColumnEdges();

            var scrollLeft = grid.getHScrollValue();

            var hdpiRatio = grid.getHiDPI(draggerCTX);

            var columnWidth = grid.getColumnWidth(columnIndex + scrollLeft);
            var colHeight = grid.clientHeight;
            var d = dragger;

            var location = grid.getBoundingClientRect();
            var style = d.style;

            style.top = location.top + 'px';
            style.left = location.left + 'px';
            style.position = 'fixed';
            style.opacity = 0.85;
            style.boxShadow = '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)';
            //style.zIndex = 100;
            style.borderTop = '1px solid ' + renderer.resolveProperty('lineColor');
            style.backgroundColor = grid.renderer.resolveProperty('backgroundColor');

            d.setAttribute('width', Math.round(columnWidth * hdpiRatio) + 'px');
            d.setAttribute('height', Math.round(colHeight * hdpiRatio) + 'px');

            style.width = columnWidth + 'px'; //Math.round(columnWidth / hdpiRatio) + 'px';
            style.height = colHeight + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';

            var startX = columnEdges[columnIndex];
            startX = startX * hdpiRatio;

            draggerCTX.scale(hdpiRatio, hdpiRatio);

            grid.renderOverridesCache.dragger = {
                columnIndex: columnIndex,
                ctx: draggerCTX,
                startX: startX,
                width: columnWidth,
                height: colHeight,
                hdpiratio: hdpiRatio
            };

            this.setCrossBrowserProperty(d, 'transform', 'translate(' + x + 'px, -5px)');
            style.zIndex = '5';
            style.cursor = 'none';
            grid.repaint();

        },

        /**
        * @function
        * @instance
        * @description
        this function is the main dragging logic
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} x - the start position
        */
        dragColumn: function(grid, x) {

            //TODO: this function is overly complex, refactor this in to something more reasonable
            var self = this;
            var renderer = grid.getRenderer();
            var columnEdges = renderer.getColumnEdges();

            var autoScrollingNow = this.columnDragAutoScrollingRight || this.columnDragAutoScrollingLeft;

            var hdpiRatio = grid.getHiDPI(draggerCTX);

            var dragColumnIndex = grid.renderOverridesCache.dragger.columnIndex;
            var columnWidth = grid.renderOverridesCache.dragger.width;
            var minX = 0; //grid.getFixedColumnsWidth();
            var maxX = grid.renderer.getFinalVisableColumnBoundry() - columnWidth;
            x = Math.min(x, maxX + 15);
            x = Math.max(minX - 15, x);

            //am I at my lower bound
            var atMin = x < minX && dragColumnIndex !== 0;

            //am I at my upper bound
            var atMax = x > maxX;

            var d = dragger;

            this.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + 0 + 'ms ease, box-shadow ' + columnAnimationTime + 'ms ease');

            this.setCrossBrowserProperty(d, 'transform', 'translate(' + x + 'px, ' + -10 + 'px)');
            requestAnimationFrame(function() {
                d.style.display = 'inline';
            });

            var overCol = grid.renderer.getColumnFromPixelX(x + (d.width / 2 / hdpiRatio));
            if (atMin) {
                overCol = 0;
            }
            if (atMax) {
                overCol = columnEdges[columnEdges.length - 1];
            }

            var doAFloat = dragColumnIndex > overCol;
            doAFloat = doAFloat || (overCol - dragColumnIndex > 1);

            if (doAFloat && !atMax && !autoScrollingNow) {
                var draggedToTheRight = dragColumnIndex < overCol;
                if (draggedToTheRight) {
                    overCol = overCol - 1;
                }
                if (this.isFloatingNow) {
                    return;
                }
                this.isFloatingNow = true;
                this.createFloatColumn(grid, overCol);
                this.floatColumnTo(grid, draggedToTheRight);
            } else {

                if (x < minX - 10) {
                    this.checkAutoScrollToLeft(grid, x);
                }
                if (x > minX - 10) {
                    this.columnDragAutoScrollingLeft = false;
                }
                //lets check for autoscroll to right if were up against it
                if (atMax || x > maxX + 10) {
                    this.checkAutoScrollToRight(grid, x);
                    return;
                }
                if (x < maxX + 10) {
                    this.columnDragAutoScrollingRight = false;
                }
            }
        },

        /**
        * @function
        * @instance
        * @description
        autoscroll to the right if necessary
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} x - the start position
        */
        checkAutoScrollToRight: function(grid, x) {
            if (this.columnDragAutoScrollingRight) {
                return;
            }
            this.columnDragAutoScrollingRight = true;
            this._checkAutoScrollToRight(grid, x);
        },

        _checkAutoScrollToRight: function(grid, x) {
            if (!this.columnDragAutoScrollingRight) {
                return;
            }
            var scrollLeft = grid.getHScrollValue();
            if (!grid.dragging || scrollLeft > (grid.sbHScrollConfig.rangeStop - 2)) {
                return;
            }
            var draggedIndex = grid.renderOverridesCache.dragger.columnIndex;
            grid.scrollBy(1, 0);
            var newIndex = draggedIndex + scrollLeft + 1;
            grid.swapColumns(newIndex, draggedIndex + scrollLeft);

            setTimeout(this._checkAutoScrollToRight.bind(this, grid, x), 250);
        },

        /**
        * @function
        * @instance
        * @description
        return the new column index for where I'm currently dragged at
        * #### returns: integer
        * @param {integer} dragIndex - descripton
        */
        findNewPositionOnScrollRight: function(dragIndex) {
            noop(dragIndex);
            //we need to compute the new index of dragIndex if it's assumed to be on the far right and we scroll one cell to the right
            var scrollLeft = this.getHScrollValue();
            var grid = this.getGrid();
            //var dragWidth = behavior.getColumnWidth(dragIndex + scrollLeft);
            var bounds = this.canvas.getBounds();

            //lets add the drag width in so we don't have to ignore it in the loop
            var viewWidth = bounds.width() - grid.getFixedColumnsWidth();
            var max = grid.getColumnCount();
            for (var c = 0; c < max; c++) {
                var eachColumnWidth = grid.getColumnWidth(scrollLeft + c);
                viewWidth = viewWidth - eachColumnWidth;
                if (viewWidth < 0) {
                    return c - 2;
                }
            }
            return max - 1;
        },

        /**
        * @function
        * @instance
        * @description
        autoscroll to the left if necessary
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        * @param {integer} x - the start position
        */
        checkAutoScrollToLeft: function(grid, x) {
            if (this.columnDragAutoScrollingLeft) {
                return;
            }
            this.columnDragAutoScrollingLeft = true;
            this._checkAutoScrollToLeft(grid, x);
        },

        _checkAutoScrollToLeft: function(grid, x) {
            if (!this.columnDragAutoScrollingLeft) {
                return;
            }

            var scrollLeft = grid.getHScrollValue();
            if (!grid.dragging || scrollLeft < 1) {
                return;
            }
            var draggedIndex = grid.renderOverridesCache.dragger.columnIndex;
            grid.swapColumns(draggedIndex + scrollLeft, draggedIndex + scrollLeft - 1);
            grid.scrollBy(-1, 0);
            setTimeout(this._checkAutoScrollToLeft.bind(this, grid, x), 250);
        },



        /**
        * @function
        * @instance
        * @description
        a column drag has completed, update data and cleanup
        * @param {fin-hypergrid} grid - [fin-hypergrid](module-._fin-hypergrid.html)
        */
        endDragColumn: function(grid) {
            var renderer = grid.getRenderer();
            var columnEdges = renderer.getColumnEdges();
            var self = this;
            var columnIndex = grid.renderOverridesCache.dragger.columnIndex;
            var startX = columnEdges[columnIndex];
            var d = dragger;

            self.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + columnAnimationTime + 'ms ease, box-shadow ' + columnAnimationTime + 'ms ease');
            self.setCrossBrowserProperty(d, 'transform', 'translate(' + startX + 'px, ' + -1 + 'px)');
            d.style.boxShadow = '0px 0px 0px #888888';

            setTimeout(function() {
                grid.renderOverridesCache.dragger = null;
                grid.repaint();
                requestAnimationFrame(function() {
                    d.style.display = 'none';
                    grid.endDragColumnNotification();
                });
            }, columnAnimationTime + 50);

        }

    });

})(); /* jshint ignore:line */
