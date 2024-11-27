"use strict";

(function () {
    function loadConfig () {
        const elem = document.getElementById('pdf-preview-config')
        if (elem) {
            return JSON.parse(elem.getAttribute('data-config'))
        }
        throw new Error('Could not load configuration.')
    }
    function cursorTools (name) {
        if (name === 'hand') {
            return 1
        }
        return 0
    }
    function scrollMode (name) {
        switch (name) {
            case 'vertical':
                return 0
            case 'horizontal':
                return 1
            case 'wrapped':
                return 2
            default:
                return -1
        }
    }
    function spreadMode (name) {
        switch (name) {
            case 'none':
                return 0
            case 'odd':
                return 1
            case 'even':
                return 2
            default:
                return -1
        }
    }
    window.addEventListener('load', async function () {
        const config = loadConfig()
        PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
        PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
        const loadOpts = {
            url: config.path,
            useWorkerFetch: false,
            cMapUrl: config.cMapUrl,
            cMapPacked: true,
            standardFontDataUrl: config.standardFontDataUrl
        }
        PDFViewerApplication.initializedPromise.then(() => {
            const defaults = config.defaults
            const optsOnLoad = () => {
                PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(defaults.cursor))
                PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale
                PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode)
                PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode)
                if (defaults.sidebar) {
                    PDFViewerApplication.pdfSidebar.open()
                } else {
                    PDFViewerApplication.pdfSidebar.close()
                }
                PDFViewerApplication.eventBus.off('documentloaded', optsOnLoad)
            }
            PDFViewerApplication.eventBus.on('documentloaded', optsOnLoad)

            // load() cannot be called before pdf.js is initialized
            // open() makes sure pdf.js is initialized before load()
            PDFViewerApplication.open(config.path).then(async function () {
                const doc = await pdfjsLib.getDocument(loadOpts).promise
                doc._pdfInfo.fingerprints = [config.path]
                PDFViewerApplication.load(doc)
            })
        })

        window.addEventListener('message', async function () {
            // Prevents flickering of page when PDF is reloaded
            const oldResetView = PDFViewerApplication.pdfViewer._resetView
            PDFViewerApplication.pdfViewer._resetView = function () {
                this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)()
                this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)()
                this._pagesCapability = (0, pdfjsLib.createPromiseCapability)()

                this.viewer.textContent = ""
            }

            // Changing the fingerprint fools pdf.js into keeping scroll position
            const doc = await pdfjsLib.getDocument(loadOpts).promise
            doc._pdfInfo.fingerprints = [config.path]
            PDFViewerApplication.load(doc)

            PDFViewerApplication.pdfViewer._resetView = oldResetView
        });
    }, { once: true });

    window.onerror = function () {
        const msg = document.createElement('body')
        msg.innerText = 'An error occurred while loading the file. Please open it again.'
        document.body = msg
    }

    window.addEventListener('load', async function () {
        const config = loadConfig()
        const viewerContainer = document.getElementById('viewerContainer');

        const contextMenuHtml = `<div id="customContextMenu" style="display:none; position:absolute; background:white; border:1px solid #ccc; z-index:1000; box-shadow:0px 2px 5px rgba(0,0,0,0.2);">
    <div class="menu-item" onclick="LookUpWord()">LookUp</div>
</div>`;

        var selections = "";

        const contextMenuContainer = document.getElementById('contextMenuContainer');
        contextMenuContainer.innerHTML = contextMenuHtml;

        viewerContainer.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            selections = getSelectedTextFromPDF();
            showCustomContextMenu(event);
        });

        function showCustomContextMenu (event) {
            const contextMenu = document.getElementById('customContextMenu');
            if (!contextMenu) return;
            contextMenu.style.top = `${event.clientY}px`;
            contextMenu.style.left = `${event.clientX}px`;
            contextMenu.style.display = 'block';
            document.addEventListener('click', hideCustomContextMenu, { once: true });
        }

        function hideCustomContextMenu () {
            const contextMenu = document.getElementById('customContextMenu');
            if (!contextMenu) return;
            contextMenu.style.display = 'none';
        }
        function getSelectedTextFromPDF () {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return '';
            const range = selection.getRangeAt(0);
            const parentElement = range.commonAncestorContainer.parentElement;
            // Ensure the selection is within the text layer
            return parentElement.closest('.textLayer')
                ? selection.toString().trim()
                : '';
        }

        window.LookUpWord = async function () {
            var selection = selections;
            if (selection === '') return;
            try {
                const response = await fetch(config.defaults.lookupUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Origin': 'https://www.vocabulary.com',
                        'Orgin': 'https://www.vocabulary.com'
                    },
                    mode: 'cors',
                    body: JSON.stringify({ word: selection }),
                });
                const result = await response.json();
                console.log('Word sent to server:', result);
            } catch (error) {
                console.error('Error sending word to server:', error);
            }
        }
    }, { once: true });

}());
