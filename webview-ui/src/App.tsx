import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount } from 'solid-js';

import { provideVSCodeDesignSystem, vsCodeButton } from "@vscode/webview-ui-toolkit";
import { vscode } from "./utilities/vscode";

import { getRand } from './utilities/getRand'

import { R }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";

import { admonitionsPlugin } from "./utilities/admonitionsPlugin";
import { setEndOfContenteditable } from "./utilities/setEndOfContenteditable";

// Default SortableJS
import Sortable from 'sortablejs';

import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
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
const textList = {};
const ID = new Map(); //ID.get(cell)

const deletingID = R(0);

const historyEdit = [];
const undoHistoryEdit = [];

const isEdit = R(true);
const currentID = R("");

let imageRepository;

//==========================================

//==========================================

const newCellID = R('');

const cellAdd = id => {
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

const cellDelete = id => {
  console.log('on deleteCell');

  deletingID.nextR(id);

  cellUp(id);

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

const cellUp = id => {
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

const cellDown = id => {
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
    const text = elEdit.innerText;

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

  textList[id] =
    !!document.getElementById("edit" + id)
      ? document.getElementById("edit" + id).innerText
      : "";

  id === deletingID.lastVal
    ? undefined
    : markHtml(id);

};

//------------------------------------------------------
const replaceSelected =
  before => after => {
    const sel = window.getSelection();

    const selStr = sel.toString();
    const text = before + selStr + after;

    const range = sel.getRangeAt(0);

    range.deleteContents();
    range.insertNode(document.createTextNode(text));

  };

const newlinesPaste =
  key => {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);

    navigator.clipboard.readText()
      .then(
        clipText => {
          const text = key + '\n' + clipText + '\n' + key;
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
        }
      );
  };

const replaceURLpaste =
  key => {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const selStr = sel.toString();

    navigator.clipboard.readText()
      .then(
        clipText => {
          const text = key + '[' + selStr + '](' + clipText + ')';
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
        }
      );
  };

const bold = (id) => {
  //ev.preventDefault();
  replaceSelected(' **')('** ');
};
const italic = (id) => {
  //ev.preventDefault();
  replaceSelected(' *')('* ');
};

//======================================================

const inlineCode = id => {
  //ev.preventDefault();
  replaceSelected(' `')('` ');
};
const inlineMath = id => {
  //ev.preventDefault();
  replaceSelected(' $')('$ ');
};

const code = id => {
  //ev.preventDefault();
  newlinesPaste('```');
};

const math = id => {
  //ev.preventDefault();
  newlinesPaste('$$');
};


const urlPaste = id => {
  //ev.preventDefault();
  replaceURLpaste('');
};
const imgPaste = id => {
  //ev.preventDefault();
  replaceURLpaste('!');
};

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
    // ev.preventDefault();
    const sel = window.getSelection();
    // const selStr = sel.toString();
    const range = sel.getRangeAt(0);

    range.deleteContents();
    range.insertNode(document.createTextNode(text));

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
            ? undefined
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

  const history = historyEdit[id];

  history.length === 1
    ? console.log('no previous History')
    : (() => {

      //ev.preventDefault();

      const elEdit = document.getElementById("edit" + id);

      const undoHistory = undoHistoryEdit[id];

      undoHistory[undoHistory.length] = history[history.length - 1];

      const history1 =
        history.flatMap(
          (el, i) =>
            i === history.length - 1
              ? []
              : el
        );


      console.log(`history1`);
      console.log(history1);

      elEdit.innerText = history1[history1.length - 1];

      historyEdit[id] = history1;

      setEndOfContenteditable(elEdit);

      hStyle(id);
    })();
};


const redo = id => {

  console.log('redo');

  //ev.preventDefault();

  const elEdit = document.getElementById("edit" + id);

  const history = historyEdit[id];
  const undoHistory = undoHistoryEdit[id];

  undoHistory.length === 0
    ? console.log('no previous redoHistory')
    : (() => {

      history[history.length] = undoHistory[undoHistory.length - 1];

      elEdit.innerText = undoHistory[undoHistory.length - 1];

      undoHistoryEdit[id] =
        undoHistory.flatMap(
          (el, i) =>
            i === undoHistory.length - 1
              ? []
              : el
        );

      setEndOfContenteditable(elEdit);

      hStyle(id);
    })();

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
    const elEdit = document.getElementById("edit" + id);

    !!elEdit
      ? elEdit.style.display = 'none'
      : undefined;

    const parentEl = document.getElementById("html" + id);

    !!parentEl
      ? parentEl.style.display = ''
      : undefined;
  };

const showEdit =
  (id: string) => {
    console.log('showEdit');

    const elHtml = document.getElementById("html" + id);
    !!elHtml
      ? elHtml.style.display = 'none'
      : undefined;

    const elEdit = document.getElementById("edit" + id);
    !!elEdit
      ? elEdit.style.display = ''
      : undefined;

  };

const showEditFocus =
  (id: string) => {
    console.log('showEditFocus');

    const elHtml = document.getElementById("html" + id);
    !!elHtml
      ? elHtml.style.display = 'none'
      : undefined;

    const elEdit = document.getElementById("edit" + id);
    !!elEdit
      ? elEdit.style.display = ''
      : undefined;

    elEdit.focus(); // will trigger onFocusin

    //setEndOfContenteditable(elEdit);
  };
//---event----------------------------------------------
isEdit.mapR(val => {
  console.log('--isEdit changed--');
  console.log(val);
  return val;
});

const editOrHTML = id => {

  console.log('editOrHTML');
  console.log(isEdit.lastVal);

  isEdit.lastVal
    ? toHTMLmode(id)
    : toEdit(id);

};
const onFocus = id => {
  console.log('onFocus');

  isEdit.nextR(true);
  currentID.nextR(id);
};

const toEdit = id => {
  console.log('toEdit');

  // isEdit.nextR(true);   // redundant for onFocus
  // currentID.nextR(id);  // redundant for onFocus

  showEditFocus(id);
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

const onInput = id => {
  console.log("onInput");
  console.log("edit" + id);
  hStyle(id);

  const history = () => {
    console.log("history--------------");
    const elEdit = document.getElementById("edit" + id);
    const text = elEdit.innerText;
    console.log(text);
    const history = historyEdit[id];
    console.log(history);
    console.log(history[history.length - 1]);

    history[history.length - 1] === text
      ? undefined
      : history[history.length] = text;

    console.log(history);
  };

  window.setTimeout(history, 0);
};



const Cell: Component = (text: string) => {
  const id = getRand();
  console.log(id);
  newCellID.nextR(id);

  historyEdit[id] = [text];
  undoHistoryEdit[id] = [];

  const [contentStream, contentStreamNext] = createSignal();

  contentStreams[id] = contentStream;
  contentStreams[id].next = contentStreamNext;

  const div =

    <div class="cell" id={id}>

      <div class='celledit' id={"edit" + id}
        // chrome only !!! "plaintext-only"
        contenteditable={"plaintext-only" as any}
        onInput={ev => onInput(id)}
        onfocusin={ev => onFocus(id)}
        style={{ display: 'none' }}
      >
        {text}

      </div>

      <div class='cellhtml' id={"html" + id}
        contenteditable={false}
        //onKeyDown={ev => onKeyDown(ev)(id)}  does not work
        onClick={ev => toEdit(id)}>

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

  window.setTimeout(
    () => initCell()
    , 0);

  return div;
};

//=================================================================
const markHtml =
  (id: string) => {

    const div = document.createElement('div');

    const rmPromise =
      unified()
        .use(remarkParse)
        .use(remarkDirective)
        .use(admonitionsPlugin)
        .use(remarkGfm as any)
        .use(remarkBreaks)
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
        .process(textList[id])
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
            ? isEdit.nextR(true)
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

      Sortable.create(
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

      </div>
    </main>

  );
};

const cellToMarkSave = () =>
  window.setTimeout(
    () => save(cellToMark()),
    0);

const cellToMark = () => {

  const els = Array.from(document.getElementsByClassName('cell'));
  const texts = els.map((el: HTMLElement) => textList[el.id]);

  const text = texts.reduce((sum, a) => sum + '\n\n' + a);

  return text;

};

// ------------
const cellToExportHTML = () => exportHTML(cellToHTML());


const cellToHTML = () => {

  console.log("cellToHTML called!");

  const els = Array.from(document.getElementsByClassName('cell'));
  const htmls =
    els.map((el: HTMLElement) =>
      el.getElementsByClassName("cellhtml")[0].innerHTML);

  const html = htmls.reduce((sum, a) => sum + '\n\n' + a);

  return html;

};

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
const parseMd = (mdText: string) => {
  const codeBlockRegex = /`{3}[\S\s]+?`{3}/g;
  const splitText =
    mdText
      .split(codeBlockRegex);
  const codeBlocks =
    mdText
      .match(codeBlockRegex) || [];
  const result =
    splitText
      .flatMap((text, index) => {
        const blocks =
          text
            .split('\n\n')
            .filter(block => block.trim() !== '');
        return index < codeBlocks.length
          ? [...blocks, codeBlocks[index]]
          : blocks;
      });
  return result;
};



const mdtextR = R('Loading...');
//==========================================
mdtextR
  .mapR(mdText => parseMd(mdText))
  .mapR(mds => {

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

    }, 100);


  });
//==========================================

const getSVGurl = (svg: string) =>
  new Promise<string>(
    (resolve, reject) =>

      imageRepository.repository === "USER/IMAGES-REPOSITORY" // left as default, no config
        ? reject("no imageRepository")
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
    const text = elEdit.innerText;

    const comment
      = text =>
        `<!--${text}-->`
          .replace("$$", " ")
          .replace("$$", " ");

    const newText = comment(text) + "\n" + tag;

    elEdit.innerText = newText;
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
          //keys--------------------------------
          : message.cmd === 'editOrHTML'
            ? editOrHTML(currentID.lastVal)
            : message.cmd === 'paste'
              ? paste(currentID.lastVal)
              : message.cmd === 'undo'
                ? undo(currentID.lastVal)
                : message.cmd === 'redo'
                  ? redo(currentID.lastVal)
                  : message.cmd === 'cellAdd'
                    ? cellAdd(currentID.lastVal)
                    : message.cmd === 'cellDelete'
                      ? cellDelete(currentID.lastVal)
                      : message.cmd === 'cellUp'
                        ? cellUp(currentID.lastVal)
                        : message.cmd === 'cellDown'
                          ? cellDown(currentID.lastVal)
                          : message.cmd === 'bold'
                            ? bold(currentID.lastVal)
                            : message.cmd === 'italic'
                              ? italic(currentID.lastVal)
                              : message.cmd === 'inlineCode'
                                ? inlineCode(currentID.lastVal)
                                : message.cmd === 'inlineMath'
                                  ? inlineMath(currentID.lastVal)
                                  : message.cmd === 'code'
                                    ? code(currentID.lastVal)
                                    : message.cmd === 'math'
                                      ? math(currentID.lastVal)
                                      : message.cmd === 'urlPaste'
                                        ? urlPaste(currentID.lastVal)
                                        : message.cmd === 'imgPaste'
                                          ? imgPaste(currentID.lastVal)
                                          : message.cmd === 'tex2svg'
                                            ? tex2svg(currentID.lastVal)
                                            : undefined;

});
//==========================================


export default App;