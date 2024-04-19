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

  const fileNameR = R('');

  const cssR = NotePanel.rCSS();

  const initialMdTextR = NotePanel.rInitialMdText();

  // const lastSavedTextR = R('');

  //mdTextR.next exclusively here on Setups and Reloads
  //mdTextR --mapR--> lastSavedTexR here, always
  /* initialMdTextR.mapR( // initial mdText
     initialMdText => lastSavedTextR.nextR(initialMdText)
   );*/
  const fileChangedR = NotePanel.rFileChanged();

  const obj: any = {};
  const workingEditorR = R(obj);

  vscode.workspace.onDidChangeTextDocument(changeEvent =>
    changeEvent.document === workingEditorR.lastVal.document
      ? savingR.lastVal
        ? savingR.nextR(false) // do nothing, just reset the flag
        //----------------------------------------------------------
        //--- Or file has been changed externally----------------------
        : (() => {
          //close the current webView
          NotePanel.currentPanel?.dispose();
        //  fileNameR.nextR("");

          /*
          fs.writeFile(
            fileNameR.lastVal + '--Snapshot.md', savedTextR.lastVal);

          let textBackground = workingEditorR.lastVal.document.getText();
          fs.writeFile(
            fileNameR.lastVal + '-BackgroundEdit.md', textBackground);

          //----send message to NotePanel->Webview->Dialog
          fileChangedR.nextR(true);
          */
        })()
      : undefined
  );

  const savedTextR = R('');
  const savingR = R(false);
  const saveR = NotePanel.rSave();
  saveR.mapR((text) =>
    text !== undefined
      ? (() => {
        savingR.nextR(true);
        fs.writeFile(fileNameR.lastVal, text);
        // preserve the text
        savedTextR.nextR(text);
      })()
      : undefined
  );

  const exportHTMLR = NotePanel.rExportHTML();

  vscode.workspace.onDidChangeConfiguration((evt) =>
    evt.affectsConfiguration("markdownnote.CSS")
      ? (() => {
        NotePanel.currentPanel?.dispose();
        fileNameR.nextR("");
        loadCSS();
      })()
      : undefined
  );

  vscode.window.onDidChangeActiveTextEditor((evt) =>
    vscode.workspace.getConfiguration("markdownnote.initial_setup")["true OR false"]
      ? undefined
      : f(evt?.document)
  );


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

    console.log(cssURLs.length);

    cssURLs.length !==0
    
    ? Promise.all(cssURLs.map((url) => readFile(url))).then((textDataArray) => {
      let css = textDataArray.reduce((acc, textData) => acc + "\n\n" + textData, "");
      cssR.nextR(css); // final purpose
      console.log("css loaded");

      start(); // start overlay or side mode
    })
    
    : start()
  };

  // =================================================================

  const overlay =
    vscode.workspace.getConfiguration("markdownnote.start_overlay")["true OR false"];
  console.log("%%%%% start_overlay ? %%%%%");
  console.log(overlay);
  const modeR = R(overlay ? 1 : 2);

  const f = (document: vscode.TextDocument | undefined) => {
    console.log("!! onDidChangeActiveTextEditor !!");

    document?.languageId === "markdown"
      ? document.fileName !== fileNameR.lastVal
        ? (() => {
          console.log("===============");

          workingEditorR.nextR(vscode.window.activeTextEditor);

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

      const cssURLs: string[] =
        vscode.workspace.getConfiguration("markdownnote.CSS").URLs;

      let markdownnoteObj = {
        "markdownnote.initial_setup": {
          "true OR false": false, // <------ initialSetup has changed to false
        },
        "markdownnote.CSS": {
          // same as the default in package.json
          URLs: cssURLs,
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
          initialMdTextR.nextR(setupMdText);
          NotePanel.render(context.extensionUri, 1);
          //-----------------------------------------
        });

      // monitor user's setup
      vscode.workspace.onDidChangeConfiguration((event) =>
        event.affectsConfiguration("markdownnote.initial_setup")
          ? vscode.workspace.getConfiguration("markdownnote.initial_setup")["true OR false"]
            ? undefined //true, so configured already
            : (() => { //-------------------------------------------
              //initial_setup has been changed to false
              const setupdonePath =
                context.asAbsolutePath(path.join("assets", "setupdone.md"));
              fs.readFile(setupdonePath, "utf8")
                .then((mdText) => {
                  //------------------------

                  const completeMdText = mdText;

                  //-----------------------------------------
                  initialMdTextR.nextR(completeMdText);
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
  // mdTextR activeTextEditor.document.getText() then
  // NodePanel.render()
  const overlayCommand = vscode.commands.registerCommand("markdownnote.overlay", () => {
    console.log("overlayCommand called-----");
    !!vscode.window.activeTextEditor
      ? initialMdTextR.nextR(vscode.window.activeTextEditor.document.getText())
      : undefined;

    modeR.nextR(1); // switch mode to 1
    savingR.nextR(true);
    NotePanel.render(context.extensionUri, 1);
  });
  const toSideCommand = vscode.commands.registerCommand("markdownnote.toSide", () => {
    console.log("toSideCommand called-----");
    !!vscode.window.activeTextEditor
      ? initialMdTextR.nextR(vscode.window.activeTextEditor.document.getText())
      : undefined;

    modeR.nextR(2); // switch mode to 2
    savingR.nextR(true);
    NotePanel.render(context.extensionUri, 2);
  });
  //--------------------------------------------------------
  const exportHTMLCommand = vscode.commands.registerCommand("markdownnote.exportHTML", () => {
    console.log("exportHTML called-----");
    NotePanel.exportHTML();
  });
  //--------------------------------------------------------




  const readDir = (dir: string): Promise<string[]> =>
    fs.readdir(dir).then((files) =>
      Promise.all(
        files
          .sort((a, b) => a.localeCompare(b))
          .map((file) =>
            fs.stat(path.join(dir, file)).then((stat) =>
              stat.isDirectory()
                ? readDir(path.join(dir, file))
                : [path.join(dir, file)]
            )
          )
      ).then((files) => files.flat())
    );

  const filterMdFiles = (files: string[]): string[] =>
    files.filter((file) => path.extname(file) === ".md");

  const readFiles = (files: string[]): Promise<string[]> =>
    Promise.all(files.map((file) => fs.readFile(file, "utf8")));

  const concatFiles = (files: string[]): string => files.join("\n");

  const saveFile = (filename: string, content: string): Promise<void> =>
    fs.writeFile(filename, content);

  const processDir = (
    dir: string,
    outputFilename: string
  ): Promise<void> =>
    readDir(dir)
      .then(filterMdFiles)
      .then(readFiles)
      .then(concatFiles)
      .then((content) => saveFile(outputFilename, content));

  const concatenateMarkdownCommand = vscode.commands.registerCommand(
    "markdownnote.concatenateMarkdown",
    () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: "Select Directory",
      };

      vscode.window.showOpenDialog(options).then((dirUri) =>
        dirUri && dirUri.length !== 0
          ? vscode.window
            .showInputBox({
              prompt: "Enter output filename",
              value: "output.md",
            })
            .then((outputFilename) =>
              outputFilename
                ? processDir(dirUri[0].fsPath, outputFilename).then(() =>
                  vscode.window.showInformationMessage(
                    `Concatenated markdown files saved to ${outputFilename}`
                  )
                )
                : undefined
            )
          : undefined
      );
    }
  );




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
  context.subscriptions.push(concatenateMarkdownCommand);
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
