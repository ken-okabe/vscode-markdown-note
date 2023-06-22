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

import { remark } from 'remark';
import remarkBreaks from 'remark-breaks'
import remarkDirective from 'remark-directive'
import rehypePrism from 'rehype-prism-plus'
import rehypeMathjax from 'rehype-mathjax'
import remarkMath from 'remark-math'
import rehypeFormat from 'rehype-format'

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
const lastEditID = R("");



let imageRepository;
let keybinds;

//==========================================

//==========================================

const newCellID = R('');

const addCell = ev => id => {
  console.log('on addCell');

  const newCells = cells =>
    cells.flatMap(
      (cell) =>
        id === ID.get(cell)
          ? [cell, Cell('')]
          : [cell]
    );

  toHTML(ev)(id);

  cellsStreamNext(cells => newCells(cells));
  window.setTimeout(() => toEdit(ev)(newCellID.lastVal), 0);

};

const deleteCell = (ev) => id => {
  console.log('on deleteCell');

  deletingID.nextR(id);

  upCell(ev)(id);

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

const upCell = (ev) => id => {
  console.log('on upCell');

  const f = (cell: Element, i: number, cells: Element[]) => {

    cell.id === id
      ? (() => {
        i === 0 //cell is top
          ? undefined
          : (() => {
            const targetCell = cells[i - 1];
            const targetID = ID.get(targetCell);
            toHTML(ev)(id);
            toEdit(ev)(targetID);
          })()
      })()
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};

const downCell = (ev) => id => {
  console.log('on downCell');

  const f = (cell: Element, i: number, cells: Element[]) => {

    cell.id === id
      ? (() => {
        i === Array.from(cells).length - 1 //cell is buttom
          ? undefined
          : (() => {
            const targetCell = cells[i + 1];
            const targetID = ID.get(targetCell);
            toHTML(ev)(id);
            toEdit(ev)(targetID)
          })()
      })()
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};


const hStyle = idEdit => {

  const elEdit = document.getElementById(idEdit);

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

const bold = (ev) => (id) => {
  ev.preventDefault();
  replaceSelected(' **')('** ');
};
const italic = (ev) => (id) => {
  ev.preventDefault();
  replaceSelected(' *')('* ');
};

//======================================================

const inlinecode = ev => id => {
  ev.preventDefault();
  replaceSelected(' `')('` ');
};
const inlinemath = ev => id => {
  ev.preventDefault();
  replaceSelected(' $')('$ ');
};

const code = ev => id => {
  ev.preventDefault();
  newlinesPaste('```');
};

const math = ev => id => {
  ev.preventDefault();
  newlinesPaste('$$');
};


const urlPaste = ev => id => {
  ev.preventDefault();
  replaceURLpaste('');
};
const imgPaste = ev => id => {
  ev.preventDefault();
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

const paste = ev => id => {
  console.log('on paste');

  const f = text => {
    ev.preventDefault();
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
          ? undefined
          : imageRepository.repository === "username/webimages_repo" // left as default, no user config
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
                  .then(() => toHTMLmode(ev)(id));

              });


      });


};
//=======================================================

const undo = ev => id => {

  console.log('undo');

  const history = historyEdit[id];

  history.length === 1
    ? console.log('no previous History')
    : (() => {

      ev.preventDefault();

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

      hStyle("edit" + id);
    })();
};


const redo = ev => id => {

  console.log('redo');

  ev.preventDefault();

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

      hStyle("edit" + id);
    })();

};

const svgCellID = R(0);
const tex2svg = ev => id => {
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

    elEdit.focus();

    //setEndOfContenteditable(elEdit);
  };
//---event----------------------------------------------
isEdit.mapR(val => {
  console.log('--isEdit changed--');
  console.log(val);
  return val;
});

const editOrHTML = (ev) => id => {

  console.log('editOrHTML');
  console.log(isEdit.lastVal);

  isEdit.lastVal
    ? toHTMLmode(ev)(id)
    : toEdit(ev)(id);

};
const onEdit = (ev) => id => {
  console.log('onEdit');

  isEdit.nextR(true);
  lastEditID.nextR(id);
};

const toEdit = (ev) => id => {
  console.log('toEdit');

  isEdit.nextR(true);
  lastEditID.nextR(id);

  showEditFocus(id);
};

const toHTML = (ev) => id => {
  console.log('toHTML');

  renderHTML(id);
  cellToMarkSave();
};

const toHTMLmode = (ev) => id => {
  console.log('toHTMLmode');

  isEdit.nextR(false);
  //lastEditID.nextR(id);

  const f = (cell: Element) => {

    const elHtml = document.getElementById("html" + cell.id);
    elHtml?.style.display === 'none'
      ? toHTML(ev)(cell.id)
      : undefined;

    return cell;
  };

  Array
    .from(document.getElementsByClassName('cell'))
    .map(f);

};

const onInput = idEdit => {
  console.log("onInput");
  console.log(idEdit);
  hStyle(idEdit);
};

const keyMatch = evt => cmd =>
  (keybinds[cmd].shiftKey === evt.shiftKey) &&
  (keybinds[cmd].ctrlKey === evt.ctrlKey) &&
  (keybinds[cmd].altKey === evt.altKey) &&
  (keybinds[cmd].code.includes(evt.code));


const onKeyDown = ev => id => {

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


  keyMatch(ev)("paste")
    ? paste(ev)(id)
    : keyMatch(ev)("undo")
      ? undo(ev)(id)
      : keyMatch(ev)("redo")
        ? redo(ev)(id)
        : keyMatch(ev)("cell-add")
          ? addCell(ev)(id)
          : keyMatch(ev)("cell-delete")
            ? deleteCell(ev)(id)
            : keyMatch(ev)("cell-up")
              ? upCell(ev)(id)
              : keyMatch(ev)("cell-down")
                ? downCell(ev)(id)
                : keyMatch(ev)("bold")
                  ? bold(ev)(id)
                  : keyMatch(ev)("italic")
                    ? italic(ev)(id)
                    : keyMatch(ev)("inlinecode")
                      ? inlinecode(ev)(id)
                      : keyMatch(ev)("code")
                        ? code(ev)(id)
                        : keyMatch(ev)("inlinemath")
                          ? inlinemath(ev)(id)
                          : keyMatch(ev)("math")
                            ? math(ev)(id)
                            : keyMatch(ev)("url-paste")
                              ? urlPaste(ev)(id)
                              : keyMatch(ev)("img-paste")
                                ? imgPaste(ev)(id)
                                : keyMatch(ev)("tex2svg")
                                  ? tex2svg(ev)(id)
                                  : window.setTimeout(history, 0);


};

const Cell: Component = (text: string) => {
  const id = getRand();
  console.log(id);
  newCellID.nextR(id);
  const idEdit = "edit" + id;
  const idHtml = "html" + id;

  historyEdit[id] = [text];
  undoHistoryEdit[id] = [];

  const [contentStream, contentStreamNext] = createSignal();

  contentStreams[id] = contentStream;
  contentStreams[id].next = contentStreamNext;

  const div =

    <div class="cell" id={id}>

      <div class='celledit' id={idEdit}
        // chrome only !!! "plaintext-only"
        contenteditable={"plaintext-only" as any}
        onKeyDown={ev => onKeyDown(ev)(id)}
        onInput={ev => onInput(idEdit)}
        // onBlur={ev => toHTML(ev)(id)}
        onClick={ev => onEdit(ev)(id)}
        style={{ display: 'none' }}
      >
        {text}

      </div>

      <div class='cellhtml' id={idHtml}
        contenteditable={false}
        //onKeyDown={ev => onKeyDown(ev)(id)}  does not work
        onClick={ev => toEdit(ev)(id)}>

        {contentStreams[id]()}

      </div>

    </div>;
  //------------------------------------------------------

  ID.set(div, id);

  const initCell = () => {
    hStyle(idEdit);
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
        .use(rehypeFormat, {
          indent: 2,
          indentInitial: true
        })
        .process(textList[id])
        .catch(error => {
          console.log("%%%%% reMark parser ERROR");
          console.log(error.message)
        });


    rmPromise
      .then((html) =>
        !!html
          ? finalHtml(id)(html)
          : undefined
      );
  };

const finalHtml = (id: string) => (html) => {

  const div = document.createElement('div');

  window.setTimeout(() => {
    // your code here
    div.innerHTML = html.toString();

    const image = div.querySelector('img') != null;

    contentStreams[id].next(div);

    !image && div.innerText.length === 0
      ? showEdit(id)
      : showHtml(id);
  }, 100); // 100ms timeout


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

      lastEditID.nextR(ID.get(cells[0])); //set focus

    }, 100);


  });
//==========================================

const getSVGurl = (svg: string) =>
  new Promise<string>(
    (resolve, reject) =>

      imageRepository.repository === "username/webimages_repo" // left as default, no user config
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
    : message.cmd === 'keybinds'
      ? (() => {
        console.log("keybinds!!!!!!!!!!!!!");
        keybinds = message.obj;
        console.log(keybinds);
      })()
      : message.cmd === 'load'
        ? mdtextR.nextR(message.obj)
        : message.cmd === 'editOrHTML'
          ? editOrHTML({})(lastEditID.lastVal)
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
              : undefined;

});
//==========================================


export default App;