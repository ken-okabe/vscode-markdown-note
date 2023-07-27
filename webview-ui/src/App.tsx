import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount } from 'solid-js';

import { provideVSCodeDesignSystem, vsCodeButton } from "@vscode/webview-ui-toolkit";
import { vscode } from "./utilities/vscode";

import { getRand } from './utilities/getRand'

import { R }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";

// Default SortableJS
import Sortable from 'sortablejs';

import rehypePrism from 'rehype-prism-plus'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import rehypeMermaid from 'rehype-mermaidjs'


// In order to use the Webview UI Toolkit web components they
// must be registered with the browser (i.e. webview) using the
// syntax below.
provideVSCodeDesignSystem().register(vsCodeButton());

// To register more toolkit components, simply import the component
// registration function and call it from within the register
// function, like so:
//
// provideVSCodeDesignSystem().register(
//   vsCodeButton(),
//   vsCodeCheckbox()
// );
//
// Finally, if you would like to register all of the toolkit
// components at once, there's a handy convenience function:
//
// provideVSCodeDesignSystem().register(allComponents.register());


//=================================================================
const hFont = {};

const [cellsStream, cellsStreamNext] = createSignal([]);

const contentStreams = {};
const ID = new Map(); //ID.get(cell)

const newCellID = R('');
const deletingID = R('');

const editHistory = [];
const undoHistory = [];

const isEdit = R(false);
const currentID = R("");

const isWritable = R(true);

let sortable: Sortable;
let imageRepository;

//==========================================

const _cellAdd = id => {
  console.log('on addCell');

  const newCells = cells =>
    cells.flatMap(
      (cell) =>
        id === ID.get(cell)
          ? [cell, Cell('')]
          : [cell]
    );

  toHTML(id);

  cellsStreamNext(cells => newCells(cells));
  window.setTimeout(() => toEdit(newCellID.lastVal), 0);

};

const _cellDelete = id => {
  console.log('on deleteCell');

  deletingID.nextR(id);

  _cellUp(id);

  const newCells = cells =>
    cells.flatMap(
      cell =>
        id === ID.get(cell)
          ? []
          : [cell]
    );

  cellsStream().length === 1
    ? undefined
    : cellsStreamNext(cells => newCells(cells));

};

const _cellUp = id => {
  console.log('on upCell');

  const f = (cell: Element, i: number, cells: Element[]) => {

    cell.id === id
      ? (() => {
        i === 0 //cell is top
          ? undefined
          : (() => {
            const targetCell = cells[i - 1];
            const targetID = ID.get(targetCell);
            toHTML(id);
            toEdit(targetID);
          })()
      })()
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};

const _cellDown = id => {
  console.log('on downCell');

  const f = (cell: Element, i: number, cells: Element[]) => {

    cell.id === id
      ? (() => {
        i === Array.from(cells).length - 1 //cell is buttom
          ? undefined
          : (() => {
            const targetCell = cells[i + 1];
            const targetID = ID.get(targetCell);
            toHTML(id);
            toEdit(targetID)
          })()
      })()
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};

const hStyle = id => {

  const elEdit = document.getElementById("edit" + id);

  const f0 = () => {
    const text = elEdit?.innerText;

    elEdit.style.font =
      text.substring(0, 6) === '######'
        ? hFont[6]
        : text.substring(0, 5) === '#####'
          ? hFont[5]
          : text.substring(0, 4) === '####'
            ? hFont[4]
            : text.substring(0, 3) === '###'
              ? hFont[3]
              : text.substring(0, 2) === '##'
                ? hFont[2]
                : text.substring(0, 1) === '#'
                  ? hFont[1]
                  : hFont[0];
  };

  !!elEdit
    ? f0()
    : undefined;

};

const renderHTML = id => {
  id === deletingID.lastVal
    ? undefined
    : markHtml(id);
};

//------------------------------------------------------
const replaceSelected = id =>
  before => after => {
    const sel = window.getSelection();

    const selStr = sel.toString();
    const text = before + selStr + after;

    const range = sel.getRangeAt(0);

    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    onInput(id);  // <-----------------
  };

const newlinesPaste = id =>
  key => {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);

    navigator.clipboard.readText()
      .then(
        clipText => {
          const text = key + '\n' + clipText + '\n' + key;
          range.deleteContents();
          range.insertNode(document.createTextNode(text));

          onInput(id);  // <-----------------
        }
      );
  };

const replacePasteURL = id =>
  key => {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const selStr = sel.toString();

    navigator.clipboard.readText()
      .then(
        clipText => {
          const selStr1 =
            selStr === ''
              ? key === '!'
                ? 'image'  // default image name
                : clipText // default link text
              : selStr;

          const text = key + '[' + selStr1 + '](' + clipText + ')';
          range.deleteContents();
          range.insertNode(document.createTextNode(text));

          onInput(id); // <-----------------
        }
      );
  };

const bold = id =>
  replaceSelected(id)(' **')('** ');

const italic = id =>
  replaceSelected(id)(' *')('* ');

const codeInline = id =>
  replaceSelected(id)(' `')('` ');

const mathInline = id =>
  replaceSelected(id)(' $')('$ ');

const code = id =>
  newlinesPaste(id)('```');

const math = id =>
  newlinesPaste(id)('$$');

const pasteURL = id =>
  replacePasteURL(id)('');

const pasteImageURL = id =>
  replacePasteURL(id)('!');
//===========================================

const blobToBase64 = (blob) =>
  new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const srcData = fileReader.result;
      resolve(srcData);
    };
    fileReader.readAsDataURL(blob);
  });

const paste = id => {
  console.log('on paste');

  const f = text => {
    const sel = window.getSelection();
    // const selStr = sel.toString();
    const range = sel.getRangeAt(0);

    range.deleteContents();
    range.insertNode(document.createTextNode(text));

    onInput(id); // <-----------------

    return true;
  };

  navigator.clipboard
    .read()
    .then(
      (clipboardItems) => {
        console.log("cliboard read done");
        const item = clipboardItems[0];
        // single copied item anyway
        // https://github.com/w3c/clipboard-apis/issues/93
        console.log(item);
        !item.types[0].startsWith("image/")
          ? item.getType("text/plain")
            .then((blob) =>
              blob.text()
                .then(f)
            )
          : imageRepository.repository === "USER/IMAGES-REPOSITORY" // left as default, no user config
            ? vscode.postMessage({
              command: "hello",
              text: "Image Paste is not available. Please configure your image repository.",
            })
            : item
              .getType(item.types[0])
              .then(blobToBase64)
              .then((srcData: string) => {

                const content = srcData.split('base64,')[1];

                //console.log(content);
                const ext = item.types[0].split("/")[1];
                const filename = "img_" + Date.now() + "." + ext;
                const data = {
                  name: filename,
                  content: content
                };
                return fetch(
                  `https://api.github.com/repos/${imageRepository.repository}/contents/${data.name}`,
                  {
                    method: "PUT",
                    headers: {
                      Accept: "application/vnd.github+json",
                      Authorization: `Bearer ${imageRepository.token}`
                    },
                    body: JSON.stringify({
                      message: "upload image from api",
                      content: data.content
                    })
                  }
                )
                  .then((res) => res.json())
                  .then(
                    (json) => json.content.download_url
                  )
                  .then((text: string) => "![image](" + text + ")")
                  .then(f)
                  .then(() => toHTMLmode(id));

              });


      });


};
//=======================================================

const undo = id => {

  console.log('undo');

  const editHistoryID = editHistory[id];
  const undoHistoryID = undoHistory[id];

  editHistoryID.length === 1
    ? console.log('no previous History')
    : (() => {

      //restore the previous state
      const elEdit = document.getElementById("edit" + id);
      const prevState =
        editHistoryID[editHistoryID.length - 2];
      elEdit.innerText = prevState.innerText;
      elEdit.focus();
      restoreSelection(elEdit, prevState);

      // move the current/last state to the undoHistory
      undoHistoryID[undoHistoryID.length] =
        editHistoryID[editHistoryID.length - 1];

      // remove the current/last state
      editHistory[id] = // mutable
        editHistoryID.flatMap(
          (el, i) =>
            i === editHistoryID.length - 1
              ? []
              : el
        );;

      hStyle(id);
    })();
};

const redo = id => {

  console.log('redo');

  const editHistoryID = editHistory[id];
  const undoHistoryID = undoHistory[id];

  undoHistoryID.length === 0
    ? console.log('no previous redoHistory')
    : (() => {

      //restore the previous state
      const elEdit = document.getElementById("edit" + id);
      const prevState =
        undoHistoryID[undoHistoryID.length - 1];
      elEdit.innerText = prevState.innerText;
      elEdit.focus();
      restoreSelection(elEdit, prevState);

      // move the current/last state to the editHistory
      editHistoryID[editHistoryID.length] =
        undoHistoryID[undoHistoryID.length - 1];
      // remove the current/last state history
      undoHistory[id] = //mutable
        undoHistoryID.flatMap(
          (el, i) =>
            i === undoHistoryID.length - 1
              ? []
              : el
        );

      hStyle(id);
    })();

};

const restoreSelection = (elEdit, prevState) => {
  if (elEdit?.firstChild) {
    const range = document.createRange();
    range.setStart(
      elEdit?.firstChild,
      Math.min(prevState.selectionStart, elEdit?.firstChild.length)
    );
    range.setEnd(
      elEdit?.firstChild,
      Math.min(prevState.selectionEnd, elEdit?.firstChild.length)
    );
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
};


const svgCellID = R(0);
const tex2svg = id => {
  console.log('tex2svg');

  svgCellID.nextR(id);
  const text = document.getElementById("edit" + id).innerText;

  const tex =
    (text.match(/\${2}([\s\S]*?)\${2}/g) || [])
      .map(match =>
        match
          .slice(2, -2)
          .replace(/\n/g, ''))[0];

  console.log(tex);

  requestSVG(tex);

};

//------------------------------------------------------
const showHtml =
  (id: string) => {
    document.getElementById("edit" + id).style.display = 'none'
    document.getElementById("html" + id).style.display = ''
  };

const showEdit =
  (id: string) => {
    document.getElementById("edit" + id).style.display = ''
    document.getElementById("html" + id).style.display = 'none';
  };
//---event----------------------------------------------
isEdit.mapR(val => {
  console.log('--isEdit changed--');
  console.log(val);
  return val;
});

const _readOnly_Writable = id => {
  console.log('_readOnly_Writable');
  console.log(isWritable.lastVal);

  isWritable.lastVal
    ? toReadOnlymode(id)
    : toWritableMode(id);
};

const toReadOnlymode = id => {
  console.log('toReadOnlymode');
  vscode.postMessage({
    command: "hello",
    text: "ReadOnly Mode"
  });
  isWritable.nextR(false);
  toHTMLmode(id);
  sortable.option("disabled", true); //disable sortable

  Array
    .from(document.getElementsByClassName('cellhtml') as HTMLCollectionOf<HTMLElement>)
    .map(el => el.style.cursor = "default");
};

const toWritableMode = id => {
  console.log('toWritableMode');
  vscode.postMessage({
    command: "hello",
    text: "Writable Mode"
  });
  isWritable.nextR(true);
  toEdit(id);
  sortable.option("disabled", false); //enable sortable

  Array
    .from(document.getElementsByClassName('cellhtml') as HTMLCollectionOf<HTMLElement>)
    .map(el => el.style.cursor = "-webkit-grabbing");
};

const _allHTML_EDIT = id => {
  console.log('_AllHTML_EDIT');
  console.log(isEdit.lastVal);

  isEdit.lastVal
    ? toHTMLmode(id)
    : toEdit(id)

};
const onfocus = id => {
  console.log('onFocus');

  isEdit.nextR(true);
  currentID.nextR(id);
};

const toEdit = id => {
  console.log('toEdit');

  showEdit(id);
  document.getElementById("edit" + id).focus();

  isEdit.nextR(true);

};

const toHTML = id => {
  console.log('toHTML');

  renderHTML(id);
  cellToMarkSave();
};

const toHTMLmode = id => {
  console.log('toHTMLmode');

  isEdit.nextR(false);

  currentID.nextR(id);

  const f = (cell: Element) => {

    const elHtml = document.getElementById("html" + cell.id);
    elHtml?.style.display === 'none'
      ? toHTML(cell.id)
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};

const history = (id) => {
  console.log("history--------------");
  const elEdit = document.getElementById("edit" + id);
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(elEdit);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const start = preSelectionRange.toString().length;
  preSelectionRange.setEnd(range.endContainer, range.endOffset);
  const end = preSelectionRange.toString().length;

  const state = {
    innerText: elEdit?.innerText,
    cursorPosition: end,
    selectionStart: start,
    selectionEnd: end,
  };

  const editHistoryID = editHistory[id];
  editHistoryID[editHistoryID.length] = state;
  console.log(editHistoryID);
};


const onInput = id => {
  console.log("onInput");
  console.log("edit" + id);
  hStyle(id);
  history(id);
};

const onfocusout = id => {
  console.log("onfocusout");
  console.log("edit" + id);
  cellToMarkSave();
};


//=======================================================
const Cell: Component = (text: string) => {
  const id = getRand();
  console.log(id);
  newCellID.nextR(id);

  const state = {
    innerText: text,
    cursorPosition: undefined,
    selectionStart: undefined,
    selectionEnd: undefined,
  };

  editHistory[id] = [state];
  undoHistory[id] = [];

  const [contentStream, contentStreamNext] = createSignal();

  contentStreams[id] = contentStream;
  contentStreams[id].next = contentStreamNext;

  const div =

    <div class="cell" id={id}>

      <div class='celledit' id={"edit" + id}
        contenteditable={"plaintext-only" as any}
        onInput={ev => onInput(id)}
        onfocusin={ev => onfocus(id)}
        onfocusout={ev => onfocusout(id)}
        style={{ display: 'none' }}
      >
        {text}

      </div>

      <div class='cellhtml' id={"html" + id}
        contenteditable={false}
        onClick={ev =>
          isWritable.lastVal
            ? toEdit(id)
            : undefined // usual web UI click works
        }
      >

        {contentStreams[id]()}

      </div>

    </div>;
  //------------------------------------------------------

  ID.set(div, id);

  const initCell = () => {
    hStyle(id);
    currentID.nextR(id);
    renderHTML(id);
  };

  window.setTimeout(initCell, 0);

  return div;
};

//=================================================================
const markHtml =
  (id: string) => {

    const div = document.createElement('div');

    const text = document.getElementById("edit" + id).innerText;

    const rmPromise =
      unified()
        .use(remarkParse)
        .use(remarkGfm as any)
        .use(remarkMath)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw) // *Parse* the raw HTML strings embedded in the tree
        .use(rehypePrism)
        .use(rehypeMathjax)
        .use(rehypeMermaid, {
          // The default strategy is 'inline-svg'
          // strategy: 'img-png'
          // strategy: 'img-svg'
          // strategy: 'inline-svg'
          // strategy: 'pre-mermaid'
        })
        .use(rehypeStringify)
        .process(text)
        .catch(error => {
          console.log("%%%%% reMark parser ERROR");
          console.log(error.message)
        });

    rmPromise
      .then((html) =>
        !!html
          ? finalHtml(id)(html)(div)
          : undefined
      );
  };

const isHTML = str => {
  const doc = new DOMParser().parseFromString(str, "text/html");
  return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
}

const finalHtml =
  (id: string) => (html) => (div) => {

    const f = () => {

      const editIDtext = document.getElementById("edit" + id).innerText;
      const isMarkdownTxt =
        !isHTML(editIDtext);

      div.innerHTML = html.toString();

      const isImage = div.querySelector('img') != null;

      const hasText = div.innerText.length > 0;

      contentStreams[id].next(div);

      const isVisible =
        isMarkdownTxt && editIDtext !== "" //non empty markdown text
          ? true
          : isImage
            ? true
            : hasText;

      isVisible
        ? showHtml(id)
        : (() => {

          id === currentID.lastVal
            ? toEdit(id)
            : undefined;

          showEdit(id);
        })();
    };

    window.setTimeout(f, 10);
  };

//=================================================================

const onSort = evt => {
  console.log('onSort');

  console.log(evt.to);

  cellToMarkSave();
}

const App: Component = () => {

  onMount(() => {
    console.log('onMount');

    document.addEventListener("DOMContentLoaded", function (event) {

      /*===== LINK ACTIVE =====*/
      const linkColor = document.querySelectorAll('.nav_link')

      function colorLink() {
        if (linkColor) {
          linkColor.forEach(l => l.classList.remove('active'))
          this.classList.add('active')
        }
      }
      linkColor.forEach(l => l.addEventListener('click', colorLink))

      // Your code to run since DOM is loaded and ready

      sortable = Sortable.create(
        document.getElementById('items'),
        {
          animation: 150,
          ghostClass: "ghost",
          onEnd: onSort
        });

      hFont[0] = getComputedStyle(document.getElementById('p')).font;
      hFont[1] = getComputedStyle(document.getElementById('h1')).font;
      hFont[2] = getComputedStyle(document.getElementById('h2')).font;
      hFont[3] = getComputedStyle(document.getElementById('h3')).font;
      hFont[4] = getComputedStyle(document.getElementById('h4')).font;
      hFont[5] = getComputedStyle(document.getElementById('h5')).font;
      hFont[6] = getComputedStyle(document.getElementById('h6')).font;

      hFont['bold'] = getComputedStyle(document.getElementById('bold')).font;
      hFont['italic'] = getComputedStyle(document.getElementById('italic')).font;

      console.log('requestLoad');
      requestLoad();

    });


  });

  return (

    <main class="markdown-body">
      <div class="container">

        <div id="items">
          {cellsStream()}
        </div>

        <h1 id='h1'></h1>
        <h2 id='h2'></h2>
        <h3 id='h3'></h3>
        <h4 id='h4'></h4>
        <h5 id='h5'></h5>
        <h6 id='h6'></h6>
        <p id='p'></p>
        <p><strong id='bold'></strong></p>
        <p><em id='italic'></em></p>

        <dialog>
          <h2>The working file has been changed in the background</h2>
          <p>To protect the data, Markdown Note cannot overwrite and save with the current edits.</p>
          <p>Please copy the parts you edited in Markdown Note to the clipboard, then reload from the source file tab and merge the contents of the clipboard.
          </p>
          <button class="close-button">OK</button>
        </dialog>


      </div>
    </main>

  );
};

const cellToMark = () => {

  const els = Array.from(document.getElementsByClassName('celledit'));
  const texts = els.map((el: HTMLElement) => el.innerText);

  const text = texts.reduce((sum, a) => sum + '\n\n' + a);

  return text;

};

const cellToMarkSave = () =>
  window.setTimeout(
    () => save(cellToMark()),
    0);

// ------------

const cellToHTML = () => {

  console.log("cellToHTML called!");

  const els = Array.from(document.getElementsByClassName('cellhtml'));
  const htmls = els.map((el: HTMLElement) => el.innerHTML);

  const html = htmls.reduce((sum, a) => sum + '\n\n' + a);

  return html;

};

const cellToExportHTML = () =>
  exportHTML(cellToHTML());

const requestLoad = () =>
  vscode.postMessage({
    command: "requestLoad",
    text: "",
  });

const save = (text: string) =>
  vscode.postMessage({
    command: "save",
    text: text,
  });

const exportHTML = (html: string) =>
  vscode.postMessage({
    command: "exportHTML",
    text: html,
  });


const requestSVG = (tex: string) => {

  const text = JSON.stringify(tex);
  vscode.postMessage({
    command: "requestSVG",
    text: text,
  });

};

//=============================================================
const mdtextR = R('Loading...');
//==========================================
//-----------------------------------------------
mdtextR
  .mapR(mdText => {

    const domParser = new DOMParser();
    const doc = domParser.parseFromString(mdText, "text/html");
    const tagBlocks = Array.from(doc.body.children).map((el) => el.outerHTML);

    const prefixTag = '#%#y#8#%%%%a%%#7%%#c#replacing#Tag#Block#%%5#%%x%m%%##q#6#%##w#';
    const regexTag = new RegExp(`(${prefixTag})(\\d+)`, 'g');

    const replaceTagBlocks =
      (mdText) => (tagBlocks) =>
        tagBlocks.reduce(
          (result, tag, index) =>
            result.replace(tag, `${prefixTag}${index}`),
          mdText
        );
    // HTML tag blocks are replaced with a special string
    const mdText1: string = replaceTagBlocks(mdText)(tagBlocks);
    //--------------------------------------------------
    const codeBlockRegex = /`{3}[\S\s]+?`{3}/g;

    const codeBlocks =
      [...mdText1.matchAll(codeBlockRegex)]
        .map((match) => match[0]);

    const prefixCode = '#%#y#8#%%%%a%%#7%%#c#replacing#Code#Block#%%5#%%x%m%%##q#6#%##w#';
    const regexCode = new RegExp(`(${prefixCode})(\\d+)`, 'g');

    const replaceCodeBlocks =
      (mdText) => (codeBlocks) =>
        codeBlocks.reduce(
          (result, code, index) =>
            result.replace(code, `${prefixCode}${index}`),
          mdText
        );
    // Code blocks are replaced with a special string
    const mdText2: string = replaceCodeBlocks(mdText1)(codeBlocks);
    //--------------------------------------------------
    const mds2 = mdText2.split(/\n\n+/);
    //--------------------------------------------------
    const restoreTagBlocks =
      mds => tagBlocks =>
        mds.flatMap(
          (md) =>
            md.match(regexTag)
              ? (() => {
                const index =
                  Number(md.match(regexTag)[0].replace(prefixTag, ''));
                return [tagBlocks[index]];
              })()
              : [md]
        );

    const restoreCodelocks =
      mds => codeBlocks =>
        mds.flatMap(
          (md) =>
            md.match(regexCode)
              ? (() => {
                const index =
                  Number(md.match(regexCode)[0].replace(prefixCode, ''));
                return [codeBlocks[index]];
              })()
              : [md]
        );

    // Code blocks are restored
    const mds1 = restoreCodelocks(mds2)(codeBlocks);
    // HTML tag blocks are restored
    const mds0 = restoreTagBlocks(mds1)(tagBlocks);

    const mds =
      mds0.flatMap(
        md =>
          md === ''
            ? []
            : [md]
      );
    //--------------------------------------------------
    console.log(mds.length);
    console.log(mds);
    const cells =
      mds.length === 0 // if markdown text is empty
        ? [Cell("# Title")]
        : mds.map(md => Cell(md));

    console.log(cells);

    cellsStreamNext(cells); //update cells

    window.setTimeout(() => {
      let cells =
        Array
          .from(document.getElementsByClassName('cell'));

      console.log(ID.get(cells[0]));

      currentID.nextR(ID.get(cells[0])); //set focus

      cellToMarkSave(); // load and save (trim empty lines etc)

    }, 100);

  });



//==========================================

const getSVGurl = (svg: string) =>
  new Promise<string>(
    (resolve, reject) =>

      imageRepository.repository === "USER/IMAGES-REPOSITORY" // left as default, no config
        ? vscode.postMessage({
          command: "hello",
          text: "Image Paste is not available. Please configure your image repository.",
        })
        : (() => {
          const content = btoa(svg);
          const ext = "svg";
          const filename = "img_" + Date.now() + "." + ext;
          const data = {
            name: filename,
            content: content
          };
          return fetch(
            `https://api.github.com/repos/${imageRepository.repository}/contents/${data.name}`,
            {
              method: "PUT",
              headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${imageRepository.token}`
              },
              body: JSON.stringify({
                message: "upload image from api",
                content: data.content
              })
            }
          )
            .then((res) => res.json())
            .then(
              (json) => resolve(json.content.download_url)
            )

        })()
  );

const svgF = svg => {
  console.log("svg");
  console.log(svg);

  getSVGurl(svg).then(url => {
    const tag = `<p align="center"><img src= "${url}"></p>`;

    const elEdit = document.getElementById("edit" + svgCellID.lastVal);
    const text = elEdit?.innerText;

    const comment
      = text =>
        `<!--${text}-->`
          .replace("$$", " ")
          .replace("$$", " ");

    const newText = comment(text) + "\n" + tag;

    elEdit.innerText = newText;

    onInput(svgCellID.lastVal); // <------------------
  });
};


const fileChanged = () => {

  const dialog = document.querySelector('dialog');
  const closeButton = document.querySelector('.close-button');

  dialog.showModal();

  closeButton.addEventListener('click', () => {
    dialog.close();
  });

};
//==========================================
window.addEventListener('message', event => {

  const message = event.data;

  message.cmd === 'imageRepository'
    ? (() => {
      console.log("imageRepository!!!!!!!!!!!!!");
      imageRepository = message.obj;
      console.log(imageRepository);
    })()
    : message.cmd === 'load'
      ? mdtextR.nextR(message.obj)
      : message.cmd === 'exportHTML'
        ? (() => {
          console.log("exportHTML!!!!!!!!!!!!!");
          cellToExportHTML();
        })()
        : message.cmd === 'returnSVG'
          ? (() => {
            console.log("returnSVG!!!!!!!!!!!!!");
            svgF(JSON.parse(message.obj));
          })()
          : message.cmd === 'fileChanged'
            ? (() => {
              console.log("file changed background msg");
              fileChanged();
            })()
            //keys--------------------------------
            : message.cmd === '_ReadOnly_Writable'
              ? _readOnly_Writable(currentID.lastVal)
              : message.cmd === '_AllHTML_EDIT'
                ? isWritable.lastVal
                  ? _allHTML_EDIT(currentID.lastVal)
                  : vscode.postMessage({
                    command: "hello",
                    text: "ReadOnly Mode",
                  })
                : message.cmd === '_CellAdd'
                  ? isWritable.lastVal
                    ? _cellAdd(currentID.lastVal)
                    : vscode.postMessage({
                      command: "hello",
                      text: "ReadOnly Mode",
                    })
                  : message.cmd === '_CellDelete'
                    ? isWritable.lastVal
                      ? _cellDelete(currentID.lastVal)
                      : vscode.postMessage({
                        command: "hello",
                        text: "ReadOnly Mode",
                      })
                    : message.cmd === '_CellUp'
                      ? isWritable.lastVal
                        ? _cellUp(currentID.lastVal)
                        : vscode.postMessage({
                          command: "hello",
                          text: "ReadOnly Mode",
                        })
                      : message.cmd === '_CellDown'
                        ? isWritable.lastVal
                          ? _cellDown(currentID.lastVal)
                          : vscode.postMessage({
                            command: "hello",
                            text: "ReadOnly Mode",
                          })
                        : message.cmd === 'Paste'
                          ? paste(currentID.lastVal)
                          : message.cmd === 'Undo'
                            ? undo(currentID.lastVal)
                            : message.cmd === 'Redo'
                              ? redo(currentID.lastVal)
                              : message.cmd === 'Bold'
                                ? bold(currentID.lastVal)
                                : message.cmd === 'Italic'
                                  ? italic(currentID.lastVal)
                                  : message.cmd === 'CodeInline'
                                    ? codeInline(currentID.lastVal)
                                    : message.cmd === 'MathInline'
                                      ? mathInline(currentID.lastVal)
                                      : message.cmd === 'Code'
                                        ? code(currentID.lastVal)
                                        : message.cmd === 'Math'
                                          ? math(currentID.lastVal)
                                          : message.cmd === 'PasteURL'
                                            ? pasteURL(currentID.lastVal)
                                            : message.cmd === 'PasteImageURL'
                                              ? pasteImageURL(currentID.lastVal)
                                              : message.cmd === 'Tex2SVG'
                                                ? tex2svg(currentID.lastVal)
                                                : undefined;

});
//==========================================


export default App;