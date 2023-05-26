import * as vscode from 'vscode';
import { NotePanel } from "./panels/NotePanel";

import { R }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive }
  from "./utilities/libs/ReactiveMonad/reactive-monadOp";

import * as fs from "node:fs/promises";

export function activate(context: vscode.ExtensionContext) {

  console.log("!!!!!markdownnote Activated!!!!!");

  const fileNameR = R('');

  const mdTextR = NotePanel.rMdText();

  const saveR = NotePanel.rSave();
  saveR.mapR(
    text =>
      text !== undefined
        ? fs.writeFile(fileNameR.lastVal, text)
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

  // a markdown document may be already opened in the activeTextEditor
  f(vscode.window.activeTextEditor?.document);
  // to trigger in side-mode, need to focus the first pane
  vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
  // a markdown document may be newly opened in the activeTextEditor
  vscode.window.onDidChangeActiveTextEditor((evt) =>
    f(evt?.document)
  );

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
  // Add command to the extension context
  context.subscriptions.push(doNothingCommand);
  context.subscriptions.push(overlayCommand);
  context.subscriptions.push(toSideCommand);

}