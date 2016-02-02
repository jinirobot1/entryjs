"use strict";

goog.provide("Entry.BlockMenu");

goog.require("Entry.Dom");
goog.require("Entry.Model");
goog.require("Entry.Utils");

/*
 *
 * @param {object} dom which to inject playground
 */
Entry.BlockMenu = function(dom, align, categoryData) {
    Entry.Model(this, false);
    this._align = align || "CENTER";

    if (typeof dom === "string") dom = $('#' + dom);
    else dom = $(dom);

    if (dom.prop("tagName") !== "DIV")
        return console.error("Dom is not div element");

    if (typeof window.Snap !== "function")
        return console.error("Snap library is required");

    this.view = dom;

    this._categoryCodes = null;
    this._categoryElems = {};
    this._selectedCategoryView = null;
    this.visible = true;
    this._snapId = 'blockMenu' + new Date().getTime();
    this._generateView(categoryData);

    this.offset = this.svgDom.offset();
    this._splitters = [];
    this.setWidth();


    //this.snap = Snap('#blockMenu');
    this.snap = Snap('#' + this._snapId);

    this.svgGroup = this.snap.group();

    this.svgThreadGroup = this.svgGroup.group();
    this.svgThreadGroup.board = this;

    this.svgBlockGroup = this.svgGroup.group();
    this.svgBlockGroup.board = this;


    this.changeEvent = new Entry.Event(this);
    //TODO scroller should be attached
    //this.scroller = new Entry.Scroller(this, false, true);
    //

    if (categoryData) {
        this._generateCategoryCodes(categoryData);
        //this.setMenu(Object.keys(this._categoryCodes)[0]);
    }

    if (Entry.documentMousedown)
        Entry.documentMousedown.attach(this, this.setSelectedBlock);
};

(function(p) {
    p.schema = {
        code: null,
        dragBlock: null,
        closeBlock: null,
        selectedBlockView: null
    };

    p._generateView = function(categoryData) {
        var parent = this.view;
        var that = this;

        if (categoryData) {
            var categoryCol = Entry.Dom('ul', {
                class: 'entryCategoryListWorkspace',
                parent: parent
            });

            for (var i=0; i<categoryData.length; i++) {
                var name = categoryData[i].category;
                var element = Entry.Dom('li', {
                    id: 'entryCategory' + name,
                    class: 'entryCategoryElementWorkspace',
                    parent: categoryCol
                });

                (function(elem, name){
                    elem.text(Lang.Blocks[name.toUpperCase()]);
                    that._categoryElems[name] = elem;
                    elem.bindOnClick(function(e){that.setMenu(name);});
                })(element, name);
            }
        }

        this.blockMenuContainer = Entry.Dom('div', {
            'class':'blockMenuContainer',
            'parent':parent
        });

        this.svgDom = Entry.Dom(
            $('<svg id="' + this._snapId +'" class="blockMenu" version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>'),
            { parent: this.blockMenuContainer }
        );

        this.svgDom.mouseenter(function(e) {
            if (!Entry.playground || Entry.playground.resizing) return;
            Entry.playground.focusBlockMenu = true;
            var width = that.expandWidth + 64;
            if (width > Entry.interfaceState.menuWidth) {
                this.widthBackup = Entry.interfaceState.menuWidth - 64;
                $(this).stop().animate({
                    width: width - 64
                }, 200);
            }
        });

        this.svgDom.mouseleave(function(e) {
            if (!Entry.playground || Entry.playground.resizing) return;

            var widthBackup = this.widthBackup;
            if (widthBackup)
                $(this).stop().animate({
                    width: widthBackup
                }, 200);
            delete this.widthBackup;
            delete Entry.playground.focusBlockMenu;
        });

    };

    p.changeCode = function(code) {
        if (!(code instanceof Entry.Code))
            return console.error("You must inject code instance");
        if (this.codeListener)
            this.code.changeEvent.detach(this.codeListener);
        var that = this;
        this.set({code:code});;
        this.codeListener = this.code.changeEvent.attach(
            this,
            function() {that.changeEvent.notify();}
        );
        code.createView(this);
        this.align();
    };

    p.bindCodeView = function(codeView) {
        this.svgBlockGroup.remove();
        this.svgThreadGroup.remove();
        this.svgBlockGroup = codeView.svgBlockGroup;
        this.svgThreadGroup = codeView.svgThreadGroup;
        this.svgGroup.append(this.svgThreadGroup);
        this.svgGroup.append(this.svgBlockGroup);
    };

    p.align = function() {
        var threads = this.code.getThreads();
        var vPadding = 15,
            marginFromTop = 10,
            hPadding = this._align == 'LEFT' ? 20 : this.svgDom.width()/2;

        var pastClass;
        for (var i=0,len=threads.length; i<len; i++) {
            var thread = threads[i];
            var block = thread.getFirstBlock();
            var blockView = block.view;

            var className = Entry.block[block.type].class;
            if (pastClass && pastClass !== className) {
                this._createSplitter(marginFromTop);
                marginFromTop += vPadding;
            }
            pastClass = className;

            blockView._moveTo(hPadding, marginFromTop, false);
            marginFromTop += blockView.height + vPadding;

        }

        this.changeEvent.notify();
        this.expandWidth = this.svgGroup.getBBox().width + hPadding;
    };

    p.cloneToGlobal = function(e) {
        if (this.dragBlock === null) return;
        if (this._boardBlockView) return;

        var workspace = this.workspace;
        var workspaceMode = workspace.getMode();
        var blockView = this.dragBlock;

        var svgWidth = this._svgWidth;

        var board = workspace.selectedBoard;

        if (board && (workspaceMode == Entry.Workspace.MODE_BOARD ||
                      workspaceMode == Entry.Workspace.MODE_OVERLAYBOARD)) {
            var block = blockView.block;
            var clonedThread;
            var code = this.code;
            var currentThread = block.getThread();
            if (block && currentThread) {
                this._boardBlockView = board.code.
                    cloneThread(currentThread, workspaceMode).getFirstBlock().view;

                var distance = this.offset.top - board.offset.top;

                this._boardBlockView._moveTo(
                    blockView.x-svgWidth,
                    blockView.y+distance,
                    false
                );
                this._boardBlockView.onMouseDown.call(this._boardBlockView, e);
                this._dragObserver =
                    this._boardBlockView.observe(this, "_editDragInstance", ['x', 'y'], false);
            }
        } else {
            //TODO move by global svg
            Entry.GlobalSvg.setView(blockView, workspace.getMode());

        }
    };

    p._editDragInstance = function() {
        if (this._boardBlockView)
            this._boardBlockView.dragInstance.set({isNew:true});
        if (this._dragObserver)
            this._dragObserver.destroy();
    };

    p.terminateDrag = function() {
        if (!this._boardBlockView) return;

        var boardBlockView = this._boardBlockView;
        if (!boardBlockView) return;
        var thisCode = this.code;
        var workspace = this.workspace;
        var boardCode = workspace.getBoard().code;

        this._boardBlockView = null;

        //board block should be removed below the amount of range
        var blockLeft = Entry.GlobalSvg.left;
        var width = Entry.GlobalSvg.width/2;
        var boardLeft = boardBlockView.getBoard().offset.left;
        return blockLeft < boardLeft - width;
    };

    p.getCode = function(thread) {return this._code;};

    p.setSelectedBlock = function(blockView) {
        var old = this.selectedBlockView;

        if (old) old.removeSelected();

        if (blockView instanceof Entry.BlockView) {
            blockView.addSelected();
        } else blockView = null;

        this.set({selectedBlockView:blockView});
    };

    p.hide = function() {this.view.addClass('entryRemove');};

    p.show = function() {this.view.removeClass('entryRemove');};

    p.renderText = function() {
        var threads = this.code.getThreads();
        for (var i=0; i<threads.length; i++)
            threads[i].view.renderText();
    };

    p.renderBlock = function() {
        var threads = this.code.getThreads();
        for (var i=0; i<threads.length; i++)
            threads[i].view.renderBlock();
    };

    p._createSplitter = function(topPos) {
        var width = this._svgWidth;
        var hPadding = 30;
        var svgBlockGroup = this.svgBlockGroup;
        var line = svgBlockGroup.line(hPadding, topPos, width-hPadding, topPos);
        line.attr({'stroke' : '#b5b5b5'});
        this._splitters.push(line);
    };

    p._updateSplitters = function() {
        var splitters = this._splitters;
        var width = this._svgWidth;
        var hPadding = 30;
        var dest = width - hPadding;
        splitters.forEach(function(line) {
            line.attr({x2: dest});
        });
    };

    p._clearSplitters = function() {
        var splitters = this._splitters;
        for (var i = splitters.length-1; i>=0; i--) {
            splitters[i].remove();
            splitters.pop();
        }
    };

    p.setWidth = function() {
        this._svgWidth = this.svgDom.width();
        this._updateSplitters();
        this.offset = this.svgDom.offset();
    };

    p.setMenu = function(name) {
        var elem = this._categoryElems[name];
        var oldView = this._selectedCategoryView;
        var className = 'entrySelectedCategory';
        var animate = false;
        var board = this.workspace.board,
            boardView = board.view;

        if (oldView) oldView.removeClass(className);

        if (elem == oldView) {
            boardView.addClass('folding');
            this._selectedCategoryView = null;
            elem.removeClass(className);
            Entry.playground.hideTabs();
            animate = true;
            this.visible = false;
        } else if (!oldView) {
            boardView.addClass('foldOut');
            boardView.removeClass('folding');
            Entry.playground.showTabs();
            this.visible = true;
            animate = true;
        }

        if (animate) {
            Entry.bindAnimationCallbackOnce(boardView, function(){
                board.scroller.resizeScrollBar.call(board.scroller);
                boardView.removeClass('foldOut');
            });
        }

        if (this.visible) {
            elem.addClass(className);
            var code = this._categoryCodes[name];

            this._selectedCategoryView = elem;
            elem.addClass(className);
            if (code.constructor !== Entry.Code)
                code = this._categoryCodes[name] = new Entry.Code(code);

            this.changeCode(code);
        }
    };

    p._generateCategoryCodes = function(categoryData) {
        this._categoryCodes = {};
        for (var i=0; i<categoryData.length; i++) {
            var datum = categoryData[i];
            var blocks = datum.blocks;
            var codesJSON = [];
            //TODO blockJSON by blockName
            blocks.forEach(function(b){
                codesJSON.push([{
                    type:b
                }]);
            });
            this._categoryCodes[datum.category] = codesJSON;
        }
    };
})(Entry.BlockMenu.prototype);
