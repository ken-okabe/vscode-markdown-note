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
import remarkDirective from 'remark-directive';

import remarkMdx from 'remark-mdx'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypePrism from 'rehype-prism-plus'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import rehypeFormat from 'rehype-format'
import rehypeStringify from 'rehype-stringify'

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

let imageRepository;
let keybinds;

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

  cellsStreamNext(cells => newCells(cells));

  setTimeout(() => showEditFocus(newCellID.lastVal), 0);

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
            setTimeout(() =>
              showEditFocus(targetID), 100);
            onBlur(ev)(id);
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
            setTimeout(() =>
              showEditFocus(targetID), 100);
            onBlur(ev)(id);
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

const html = id => {

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

const newlinesSelected =
  before => after => {
    const br1 = document.createElement('br');
    const br2 = document.createElement('br');

    const range = window.getSelection().getRangeAt(0);
    const clonedNode = range.cloneContents();
    range.deleteContents();
    range.insertNode(document.createTextNode(after));
    range.insertNode(br1);
    range.insertNode(clonedNode)
    range.insertNode(br2);
    range.insertNode(document.createTextNode(before));

  };

const replaceURLpaste =
  key => {
    const sel = window.getSelection();
    const selStr = sel.toString();

    navigator.clipboard.readText()
      .then(
        clipText => {
          const text = key + '[' + selStr + '](' + clipText + ')';
          const range = sel.getRangeAt(0);

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
  replaceSelected('`')('`');
};
const inlinemath = ev => id => {
  ev.preventDefault();
  replaceSelected('$')('$');
};

const code = ev => id => {
  ev.preventDefault();
  newlinesSelected('```')('```');
};

const math = ev => id => {
  ev.preventDefault();
  newlinesSelected('$$$')('$$$');
};
const admonition = ev => id => {
  ev.preventDefault();
  newlinesSelected(':::')(':::');
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
                  .then(() => onBlur(ev)(id));

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


//---event----------------------------------------------
const onClick = id => showEditFocus(id);

const onBlur = (ev) => id => {
  html(id);
  console.log('onBlur');
  cellToMarkSave();
};

const onInput = idEdit => {
  console.log("onInput");
  console.log(idEdit);
  hStyle(idEdit);
};

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

  const keyMatch = evt => cmd =>
    (keybinds[cmd].shiftKey === evt.shiftKey) &&
    (keybinds[cmd].ctrlKey === evt.ctrlKey) &&
    (keybinds[cmd].altKey === evt.altKey) &&
    (keybinds[cmd].code.includes(evt.code));

  keyMatch(ev)("paste")
    ? paste(ev)(id)
    : keyMatch(ev)("blur")
      ? onBlur(ev)(id)
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
                                  : keyMatch(ev)("admonition")
                                    ? admonition(ev)(id)
                                    : setTimeout(history, 0);


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
        onBlur={ev => onBlur(ev)(id)}
        style={{ display: 'none' }}
      >
        {text}

      </div>

      <div class='cellhtml' id={idHtml}
        contenteditable={false}
        onClick={ev => onClick(id)}>

        {contentStreams[id]()}

      </div>

    </div>;
  //------------------------------------------------------

  ID.set(div, id);

  const initCell = () => {
    hStyle(idEdit);
    html(id);
  };

  setTimeout(
    () => initCell()
    , 0);

  return div;
};

//=================================================================
const markHtml =
  (id: string) => {

    const rmPromise = remark()

      .use(remarkMdx)
      .use(remarkGfm)
      .use(remarkBreaks)
      .use(remarkMath)
      .use(remarkDirective)
      .use(admonitionsPlugin)
      .use(remarkRehype as any)
      .use(rehypePrism)
      .use(rehypeKatex)
      .use(rehypeFormat)
      .use(rehypeStringify)

      .process(textList[id])
      .catch(error => {
        console.log("%%%%% reMark parser ERROR");
        console.log(error.message)
      });;

    rmPromise
      .then((html) =>
        !!html
          ? checkHtml(id)(html)
          : undefined
      );
  };

const checkHtml = (id: string) => (html) => {

  const div = document.createElement('div');

  const f = () => {
    div.innerHTML = html.toString();

    const image = div.querySelector('img') != null;

    contentStreams[id].next(div);

    !image && div.innerText.length === 0
      ? showEdit(id)
      : showHtml(id);
  };

  setTimeout(f, 100);

};

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

    setEndOfContenteditable(elEdit);
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
  setTimeout(
    () => save(cellToMark()),
    0);

const cellToMark = () => {

  const els = Array.from(document.getElementsByClassName('cell'));
  const texts = els.map((el: HTMLElement) => textList[el.id]);

  const text = texts.reduce((sum, a) => sum + '\n\n' + a);

  return text;

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


const separator = "@@!!################!!@@";
const first3 = mdText => mdText.slice(0, 3);

//=============================================================
const parseMd = (mdText: string) =>
  mdText
    .replace(/:{3}(.+)\n([\S\s]+?)\n:{3}/g,
      match => separator + match + separator)
    .split(separator)
    .flatMap(mdtext1 =>
      (first3(mdtext1) === ':::')
        ? [mdtext1]
        : mdtext1
          .replace(/`{3}([\w]*)\n([\S\s]+?)\n`{3}/g,
            match => separator + match + separator)
          .replace(/\${3}([\w]*)\n([\S\s]+?)\n\${3}/g,
            match => separator + match + separator)
          .split(separator)
          .flatMap(mdtext2 =>
            (first3(mdtext2) === '```'
              || first3(mdtext2) === '$$$')
              ? [mdtext2]
              : mdtext2
                .split(/\n{2,}/g)
                .flatMap(mdtext3 =>
                  mdtext3 === ''
                    ? []
                    : [mdtext3]))

    );



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

  });
//==========================================

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
        : undefined;

});
//==========================================


export default App;