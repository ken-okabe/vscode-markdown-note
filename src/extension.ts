import * as vscode from 'vscode';
import { NotePanel } from "./panels/NotePanel";

import { R }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";

import * as fs from "node:fs/promises";

import * as https from 'https';

const katexText = `
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/katex.min.css" integrity="sha384-3UiQGuEI4TTMaFmGIZumfRPtfKQ3trwQE2JgosJxCnGmQpL/lJdjpcHkaaFwHlcI" crossorigin="anonymous">
      <!-- The loading of KaTeX is deferred to speed up page rendering -->
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/katex.min.js" integrity="sha384-G0zcxDFp5LWZtDuRMnBkk3EphCK1lhEf4UEyEM693ka574TZGwo4IWwS6QLzM/2t" crossorigin="anonymous"></script>
      <!-- To automatically render math in text elements, include the auto-render extension: -->
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"
          onload="renderMathInElement(document.body);"></script>
`;

export function activate(context: vscode.ExtensionContext) {

  console.log("!!!!!markdownnote Activated!!!!!");


  const fileNameR = R('');

  const cssR = NotePanel.rCSS();
  const katexR = NotePanel.rKatex();

  const mdTextR = NotePanel.rMdText();

  const saveR = NotePanel.rSave();
  saveR.mapR(
    text =>
      text !== undefined
        ? fs.writeFile(fileNameR.lastVal, text)
        : undefined
  );

  const exportHTMLR = NotePanel.rExportHTML();

  //-------------------------------------------
  const exportHTML = (content: string) => {

    const html =
      `
<div xmlns="http://www.w3.org/1999/xhtml">

  <style>${cssR.lastVal}</style>

  ${katexR.lastVal}

  <div class="container">
    ${content}
  </div>

</div>`;

    const defaultUri =
      vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri
        : undefined;

    const options: vscode.SaveDialogOptions = { defaultUri };

    vscode.window.showSaveDialog(options)
      .then(uri =>
        uri && vscode.workspace.fs
          .writeFile(uri, Buffer.from(html))
      );
  };
  //-----------------------------------------------
  exportHTMLR.mapR(
    text =>
      text !== undefined
        ? exportHTML(text)
        : undefined
  );

  const overlay =
    vscode.workspace.getConfiguration("markdownnote.start_overlay");

  console.log("%%%%% start_overlay ? %%%%%");
  console.log(overlay["true/false"]);

  const modeR =
    R(overlay["true/false"]
      ? 1
      : 2);

  const f = (document: vscode.TextDocument | undefined) => {

    console.log("!! onDidChangeActiveTextEditor !!");

    !!document && document.languageId === 'markdown'
      ? document.fileName !== fileNameR.lastVal
        ? (() => {
          console.log("===============");
          console.log(document.fileName);
          fileNameR.lastVal = document.fileName;

          modeR.lastVal === 1
            ? vscode.commands
              .executeCommand("markdownnote.overlay")
            : vscode.commands
              .executeCommand("markdownnote.toSide");
        })()
        : undefined
      : undefined;
  };

  //================================================================
  const start = () => {
    // a markdown document may be already opened in the activeTextEditor
    f(vscode.window.activeTextEditor?.document);
    // to trigger in side-mode, need to focus the first pane
    vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    // a markdown document may be newly opened in the activeTextEditor
    vscode.window.onDidChangeActiveTextEditor((evt) =>
      f(evt?.document)
    );
  };
  //================================================================

  const cssURLs =
    vscode.workspace.getConfiguration("markdownnote.CSS").URLs;

  console.log(cssURLs);

  const readFile = (url: string) => new Promise<string>((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', error => {
      console.error(`Got an error trying to read the file: ${error.message}`);
      reject(error);
    });
  });

  const readFiles = (cssURLs: string[]) =>
    Promise.all(cssURLs.map(url => readFile(url)))
      .then(textDataArray => {

        cssR.nextR(
          textDataArray.reduce(
            (acc, textData) => acc + "\n\n" + textData
            , ''));

        console.log("css loaded");

        katexR.nextR(katexText);

        start();
      });


  readFiles(cssURLs); // this triggers whole process



  // ------------
  const doNothing = () => { console.log("..."); };
  const doNothingCommand =
    vscode.commands.registerCommand("markdownnote.doNothing",
      doNothing);
  const overlayCommand =
    vscode.commands.registerCommand("markdownnote.overlay",
      () => {
        console.log("overlayCommand called-----");
        !!vscode.window.activeTextEditor
          ? mdTextR.nextR(
            vscode.window.activeTextEditor.document.getText()
          )
          : undefined;
        modeR.nextR(1); // switch mode to 1
        NotePanel.render(context.extensionUri, 1);
      }
    );
  const toSideCommand =
    vscode.commands.registerCommand("markdownnote.toSide",
      () => {
        console.log("toSideCommand called-----");
        !!vscode.window.activeTextEditor
          ? mdTextR.nextR(
            vscode.window.activeTextEditor.document.getText()
          )
          : undefined;
        modeR.nextR(2); // switch mode to 2
        NotePanel.render(context.extensionUri, 2);
      }
    );

  const blurOrFocusCommand =
    vscode.commands.registerCommand("markdownnote.blurOrFocus",
      () => {
        console.log("blurOrFocus called-----");
        NotePanel.blurOrFocus();
      }
    );

  const exportHTMLCommand =
    vscode.commands.registerCommand("markdownnote.exportHTML",
      () => {
        console.log("exportHTML called-----");
        NotePanel.exportHTML();
      }
    );


  // Add command to the extension context
  context.subscriptions.push(doNothingCommand);
  context.subscriptions.push(overlayCommand);
  context.subscriptions.push(toSideCommand);
  context.subscriptions.push(blurOrFocusCommand);
  context.subscriptions.push(exportHTMLCommand);

}