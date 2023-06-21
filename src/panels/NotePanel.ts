import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";

import { R }
  from "../utilities/libs/ReactiveMonad/reactive-monadOp";
import type { Reactive }
  from "../utilities/libs/ReactiveMonad/reactive-monadOp";

import * as vscode from 'vscode';

const reloadWebview = () => {
  console.log("@@reloadWebview is called@@");
  vscode.commands
    .executeCommand("workbench.action.webview.reloadWebviewAction");
};

const mathjax = require("mathjax");

const lastCSSR = R('');
const cssR = R('');
const katexR = R('');
const mdTextR = R('');
const saveR = R(undefined);

const exportHTMLR = R(undefined);

console.log("NodePanel imported");


/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class NotePanel {

  public static currentPanel: NotePanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  public static rCSS() {
    return cssR;
  }
  public static rKatex() {  // for katex
    return katexR;
  }
  public static rMdText() {
    return mdTextR;
  }
  public static rSave() {
    return saveR;
  }
  public static rExportHTML() {
    return exportHTMLR;
  }
  public static editOrHTML() {
    NotePanel.currentPanel?._panel.webview.postMessage({
      cmd: 'editOrHTML'
    });
  }
  public static exportHTML() {
    NotePanel.currentPanel?._panel.webview.postMessage({
      cmd: 'exportHTML'
    });
  }
  /**
   * The NotePanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri) {

    console.log("%%%%%% NodePanel Constructor is called");

    this._panel = panel;
    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html =
      this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */


  public static render(extensionUri: Uri, mode: number) {

    console.log("@@@@@@@@@@@@ webview @@@@@@@@@@@@@");

    (NotePanel.currentPanel)
      // If the webview panel already exists reveal it
      ? (() => {
        console.log("^^^^^revealWebViewPanel");
        reloadWebview(); //clean up the exitisting webview
        NotePanel.currentPanel?._panel.reveal(mode);
      })()
      : (() => {
        // If a webview panel does not already exist create and show a new one
        console.log("^^^^^createWebviewPanel");
        const panel = window.createWebviewPanel(
          // Panel view type
          "MarkdownNote",
          // Panel title
          "MarkdownNoteView",
          // The editor column the panel should be displayed in
          mode,
          // Extra panel configurations
          {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
            localResourceRoots: [Uri.joinPath(extensionUri, "out"), Uri.joinPath(extensionUri, "webview-ui/build")],

            retainContextWhenHidden: true // defalut has been false :(
          }
        );

        NotePanel.currentPanel = new NotePanel(panel, extensionUri);
      })();

  };

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    NotePanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the SolidJS webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the SolidJS build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the SolidJS build output
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);

    const nonce = getNonce();

    //--------------------------------------

    const katexText = `
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/katex.min.css" integrity="sha384-3UiQGuEI4TTMaFmGIZumfRPtfKQ3trwQE2JgosJxCnGmQpL/lJdjpcHkaaFwHlcI" crossorigin="anonymous">
      <!-- The loading of KaTeX is deferred to speed up page rendering -->
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/katex.min.js" integrity="sha384-G0zcxDFp5LWZtDuRMnBkk3EphCK1lhEf4UEyEM693ka574TZGwo4IWwS6QLzM/2t" crossorigin="anonymous"></script>
      <!-- To automatically render math in text elements, include the auto-render extension: -->
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous"
          onload="renderMathInElement(document.body);"></script>
`;

    katexR.nextR(katexText);

    //------------------------------------------------------

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Markdown Note View</title>

          <style>${cssR.lastVal}</style>

          ${katexR.lastVal}
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {

    const tex2svg =
      (tex: string) => new Promise<string>((resolve, reject) => {

        mathjax.init({
          loader: { load: ['input/tex', 'output/svg'] }
        })
          .then((mj: any) => {
            const svg = mj.tex2svg(tex, { display: true });
            const svg1 = mj.startup.adaptor.innerHTML(svg);

            console.log('$$$$$tex2svg$$$$');
            console.log(svg1);
            resolve(svg1);
          })
          .catch((err: any) => console.log(err.message));

      });

    const tex2svgs =
      (texs: string[]) =>
        Promise
          .all(texs.map(tex => tex2svg(tex)))
          .then(svgs =>
            webview.postMessage({
              cmd: 'returnSVGs',
              obj: JSON.stringify(svgs)
            })
          );


    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        switch (command) {

          case "hello":
            // Code that should run in response to the hello message command
            window.showInformationMessage(message.text);
            return;

          case "requestLoad": // (re)loaded webView request to load
            console.log(
              'webView: loaded and requestLoad!!!!!!!!!!!'
            );

            const keybinds =
              vscode.workspace.getConfiguration(
                'markdownnote.webkeybindings');

            const imageRepository =
              vscode.workspace.getConfiguration(
                'markdownnote.image_repository');

            webview.postMessage({ // 1
              cmd: 'keybinds',
              obj: keybinds
            });

            webview.postMessage({ // 2
              cmd: 'imageRepository',
              obj: imageRepository
            });

            webview.postMessage({ // 3
              cmd: 'load',
              obj: mdTextR.lastVal
            }); // load from the source

            return;

          case "save": // save to the source
            saveR.nextR(message.text);
            return;

          case "exportHTML": // export to HTML
            exportHTMLR.nextR(message.text);
            return;

          case "requestSVGs":
            tex2svgs(JSON.parse(message.text));
            return;
        }
      },
      undefined,
      this._disposables
    );
  }
}