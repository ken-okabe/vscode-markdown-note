/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import { NotePanel } from "./panels/NotePanel";

import { R } from "./utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive } from "./utilities/libs/ReactiveMonad/reactive-monadOp";

import * as fs from "node:fs/promises";
import * as path from "path";

import * as https from "https";

export function activate(context: vscode.ExtensionContext) {
  console.log("!!!!!markdownnote Activated!!!!!");

  const fileNameR = R("");

  const cssR = NotePanel.rCSS();

  const mdTextR = NotePanel.rMdText();

  const saveR = NotePanel.rSave();
  saveR.mapR((text) => (text !== undefined ? fs.writeFile(fileNameR.lastVal, text) : undefined));

  const exportHTMLR = NotePanel.rExportHTML();

  //-------------------------------------------
  const exportHTML = (content: string) => {
    const html = `
<div xmlns="http://www.w3.org/1999/xhtml">

  <style>${cssR.lastVal}</style>

  <div class="container">
    ${content}
  </div>

</div>`;

    const defaultUri = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri
      : undefined;

    const options: vscode.SaveDialogOptions = { defaultUri };

    vscode.window
      .showSaveDialog(options)
      .then((uri) => uri && vscode.workspace.fs.writeFile(uri, Buffer.from(html)));
  };
  //-----------------------------------------------
  exportHTMLR.mapR((text) => (text !== undefined ? exportHTML(text) : undefined));

  //================================================================
  // load css files

  const readFile = (url: string) =>
    new Promise<string>((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(data);
          });
        })
        .on("error", (error) => {
          console.error(`Got an error trying to read the file: ${error.message}`);
          reject(error);
        });
    });

  const loadCSS = () => {
    console.log("load CSS");

    const cssURLs: string[] = vscode.workspace.getConfiguration("markdownnote.CSS").URLs;
    console.log(cssURLs);

    Promise.all(cssURLs.map((url) => readFile(url))).then((textDataArray) => {
      let css = textDataArray.reduce((acc, textData) => acc + "\n\n" + textData, "");
      cssR.nextR(css); // final purpose
      console.log("css loaded");

      start(); // start overlay or side mode
    });
  };

  vscode.workspace.onDidChangeConfiguration((event) =>
    event.affectsConfiguration("markdownnote.CSS") ? loadCSS() : undefined
  );

  // =================================================================

  const overlay = vscode.workspace.getConfiguration("markdownnote.start_overlay")["true OR false"];
  console.log("%%%%% start_overlay ? %%%%%");
  console.log(overlay);
  const modeR = R(overlay ? 1 : 2);

  const f = (document: vscode.TextDocument | undefined) => {
    console.log("!! onDidChangeActiveTextEditor !!");

    !!document && document.languageId === "markdown"
      ? document.fileName !== fileNameR.lastVal
        ? (() => {
          console.log("===============");
          console.log(document.fileName);
          fileNameR.lastVal = document.fileName;
          modeR.lastVal === 1
            ? vscode.commands.executeCommand("markdownnote.overlay")
            : vscode.commands.executeCommand("markdownnote.toSide");
        })()
        : undefined
      : undefined;
  };

  //================================================================
  const start = () => {
    console.log("start called");
    // a markdown document may be already opened in the activeTextEditor
    f(vscode.window.activeTextEditor?.document);
    // to trigger in side-mode, need to focus the first pane
    vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup");
    vscode.window.onDidChangeActiveTextEditor((evt) => f(evt?.document));
  };
  //================================================================

  // Initial Check--------------------------------------------------

  vscode.workspace.getConfiguration("markdownnote.initial_setup")["true OR false"]
    ? (() => {
      // setUP----------------------------------------------------
      console.log("Initial Setup");

      let autoLockGroups = vscode.workspace.getConfiguration("workbench.editor.autoLockGroups");

      const autoLockGroups1 = { ...autoLockGroups, "mainThreadWebview-MarkdownNote": true };

      let obj = {
        "files.autoSave": "afterDelay",
        "files.autoSaveDelay": 500, //<---- this is required to run without glitch
        "window.zoomLevel": 1,
        "workbench.startupEditor": "none",
        "workbench.colorTheme": "Visual Studio Light", // <--- initial clean look

        "workbench.editor.autoLockGroups": autoLockGroups1,
      };

      let markdownnoteObj = {
        "markdownnote.initial_setup": {
          "true OR false": false, // <------ initialSetup has changed to false
        },
        "markdownnote.CSS": {
          // same as the default in package.json
          URLs: [
            "https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css",
            "https://unpkg.com/prism-themes@1.9.0/themes/prism-coldark-dark.min.css",
          ],
        },
        "markdownnote.start_overlay": {
          // same as the default in package.json
          "true OR false": true,
        },
        "markdownnote.image_repository": {
          // same as the default in package.json
          repository: "USER/IMAGES-REPOSITORY",
          token: "ghp_xxxxxxxxxxxxxxxxxxxx",
        },
      };

      let obj1 = { ...obj, ...markdownnoteObj };

      //------------------------
      const setupPath =
        context.asAbsolutePath(path.join("assets", "setup.md"));
      fs.readFile(setupPath, "utf8")
        .then((mdText) => {
          //------------------------

          const setupMdText =
            JSON.stringify(obj1, null, 2)
            + "\n\n"
            + mdText;

          //-----------------------------------------
          mdTextR.nextR(setupMdText);
          NotePanel.render(context.extensionUri, 1);
          //-----------------------------------------
        });

      // monitor user's setup
      vscode.workspace.onDidChangeConfiguration((event) =>
        event.affectsConfiguration("markdownnote.initial_setup")
          ? vscode.workspace.getConfiguration("markdownnote.initial_setup")["true OR false"]
            ? undefined
            : (() => { //-------------------------------------------
              //initial_setup has been changed to false
              const setupdonePath =
                context.asAbsolutePath(path.join("assets", "setupdone.md"));
              fs.readFile(setupdonePath, "utf8")
                .then((mdText) => {
                  //------------------------

                  const completeMdText = mdText;

                  //-----------------------------------------
                  mdTextR.nextR(completeMdText);
                  NotePanel.render(context.extensionUri, 1);
                  //-----------------------------------------

                  vscode.window.showInformationMessage(
                    "The initial setup is complete and Markdown Note is now ready to use!"
                  );

                  loadCSS(); //including start()
                });

            })()   //-------------------------------------------
          : undefined
      );

      //------------------------------------------------------------------
    })()
    : (() => {
      // this triggers whole process
      loadCSS(); //including start()
    })();

  // =================================================================
  const overlayCommand = vscode.commands.registerCommand("markdownnote.overlay", () => {
    console.log("overlayCommand called-----");
    !!vscode.window.activeTextEditor
      ? mdTextR.nextR(vscode.window.activeTextEditor.document.getText())
      : undefined;
    modeR.nextR(1); // switch mode to 1
    NotePanel.render(context.extensionUri, 1);
  });
  const toSideCommand = vscode.commands.registerCommand("markdownnote.toSide", () => {
    console.log("toSideCommand called-----");
    !!vscode.window.activeTextEditor
      ? mdTextR.nextR(vscode.window.activeTextEditor.document.getText())
      : undefined;
    modeR.nextR(2); // switch mode to 2
    NotePanel.render(context.extensionUri, 2);
  });
  const exportHTMLCommand = vscode.commands.registerCommand("markdownnote.exportHTML", () => {
    console.log("exportHTML called-----");
    NotePanel.exportHTML();
  });
  //--------------------------------------------------------

  const _allHTML_EDIT = vscode.commands.registerCommand("markdownnote._AllHTML_EDIT", () => {
    NotePanel.sendKey("_AllHTML_EDIT");
  });
  const _radOnly_Writable = vscode.commands.registerCommand(
    "markdownnote._ReadOnly_Writable",
    () => {
      NotePanel.sendKey("_ReadOnly_Writable");
    }
  );
  const _cellAdd = vscode.commands.registerCommand("markdownnote._CellAdd", () => {
    NotePanel.sendKey("_CellAdd");
  });
  const _cellDelete = vscode.commands.registerCommand("markdownnote._CellDelete", () => {
    NotePanel.sendKey("_CellDelete");
  });
  const _cellUp = vscode.commands.registerCommand("markdownnote._CellUp", () => {
    NotePanel.sendKey("_CellUp");
  });
  const _cellDown = vscode.commands.registerCommand("markdownnote._CellDown", () => {
    NotePanel.sendKey("_CellDown");
  });
  const paste = vscode.commands.registerCommand("markdownnote.Paste", () => {
    NotePanel.sendKey("Paste");
  });
  const undo = vscode.commands.registerCommand("markdownnote.Undo", () => {
    NotePanel.sendKey("Undo");
  });
  const redo = vscode.commands.registerCommand("markdownnote.Redo", () => {
    NotePanel.sendKey("Redo");
  });
  const bold = vscode.commands.registerCommand("markdownnote.Bold", () => {
    NotePanel.sendKey("Bold");
  });
  const italic = vscode.commands.registerCommand("markdownnote.Italic", () => {
    NotePanel.sendKey("Italic");
  });
  const codeInline = vscode.commands.registerCommand("markdownnote.CodeInline", () => {
    NotePanel.sendKey("CodeInline");
  });
  const mathInline = vscode.commands.registerCommand("markdownnote.MathInline", () => {
    NotePanel.sendKey("MathInline");
  });
  const code = vscode.commands.registerCommand("markdownnote.Code", () => {
    NotePanel.sendKey("Code");
  });
  const math = vscode.commands.registerCommand("markdownnote.Math", () => {
    NotePanel.sendKey("Math");
  });
  const pasteURL = vscode.commands.registerCommand("markdownnote.PasteURL", () => {
    NotePanel.sendKey("PasteURL");
  });
  const pasteImageURL = vscode.commands.registerCommand("markdownnote.PasteImageURL", () => {
    NotePanel.sendKey("PasteImageURL");
  });
  const tex2svg = vscode.commands.registerCommand("markdownnote.Tex2SVG", () => {
    NotePanel.sendKey("Tex2SVG");
  });

  // Add command to the extension context
  context.subscriptions.push(overlayCommand);
  context.subscriptions.push(toSideCommand);
  context.subscriptions.push(exportHTMLCommand);
  //keybinding
  context.subscriptions.push(_allHTML_EDIT);
  context.subscriptions.push(_radOnly_Writable);
  context.subscriptions.push(_cellAdd);
  context.subscriptions.push(_cellDelete);
  context.subscriptions.push(_cellUp);
  context.subscriptions.push(_cellDown);
  context.subscriptions.push(paste);
  context.subscriptions.push(undo);
  context.subscriptions.push(redo);
  context.subscriptions.push(bold);
  context.subscriptions.push(italic);
  context.subscriptions.push(codeInline);
  context.subscriptions.push(mathInline);
  context.subscriptions.push(code);
  context.subscriptions.push(math);
  context.subscriptions.push(pasteURL);
  context.subscriptions.push(pasteImageURL);
  context.subscriptions.push(tex2svg);
}