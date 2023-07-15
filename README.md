![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/showcase.png)

## VSCode + Markdown + WYSIWYG = Productivity

---

# ✅ Seamless

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo00.gif)

 **Click**  on what you want to edit to enter input mode.

Once you finish editing, press the   `ESC`  key.

Press the   `ESC`   key again to return to input mode.

---

# ✅ Cell Editing

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo01.gif)

**Cell**  is familiar to Jupyter Notebook users.

---

# ✅ Headers

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo02.gif)

You can see the exact header size based on the current CSS  **before converting to HTML**  by entering  `#` .

---

# ✅ URL & ImageURL

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo_image.gif)

You can easily and quickly  **paste**   **URLs**  or  **imageURLs**  copied to the clipboard as Markdown with a shortcut key ( `Ctrl+L`  for URLs,  `Ctrl+P`  for images by default Key Bindings).

Here is how it goes:

0. Your clipboard has an imageURL:  [https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/octcat.png](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/octcat.png)
1. Type any image name in the Cell  (**octcat**) 
2. Select all, then Paste the imageURL  (`ctrl + A, P`)
3. Exit the Cell (`Esc`)

 **Alternatively, if you don't want to type the image name, you can just** 

1. Paste the imageURL (`ctrl + P`)
2. Exit the Cell (`Esc`)

 **and it will work just fine 😎** 

The operations to paste  **URLs**  &  **ImageURLs**  are identical but

- For  **imageURLs** , `image` is used as the default name.
- For  **URLs** , the pasted URL itself is used as the shown link text. So when you just paste `https://github.com/` with  `ctrl + L` , the result will be  [https://github.com/](https://github.com/).

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo_url.gif)

---

# ✅ Drag&Drop Cells

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo04.gif)

---

# ✅ GFM & features supported by GitHub 

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo05.gif)

---

# ✅ ReadOnly & Writable Mode

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo_readonly.gif)

By default,  **Markdown Note**  works in  **Writable Mode** , but some web elements need user's click action even in Markdown documents.

For example,  **Markdown used in GitHub**  ( *not GitHub Flavored Markdown Spec* ) supports `<details>` and `<summary>` html tags.

To test the native behavior, you can switch to  **ReadOnly Mode**  temporarily with `Ctrl+Esc`.

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo_detail.gif)

In  **ReadOnly Mode** , the default behavior of  **Markdown Note**  is paused and you can click the element in the standard manner.

This way, you can see how `<details>` and `<summary>` html tags work.

 Pressing `Ctrl+Esc` again  will return to the default  **Writable Mode**.

---

# ✅ Side-by-side mode is also WYSIWYG

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo06.gif)

---

# ✅ Unidirectional Data Flow

The bidirectional data flow might look cool, but in fact, it often causes confusion for both human and software architectural designs.

 **The conventional Markdown Preview**  have the unidirectional data flow:

- Markdown source code -> The read-only preview

 **Markdown Note**  also employs the same simple unidirectional design, but *the direction is opposite* :

- WYSIWYG Editor -> Markdown source code

---

# ✅ Reload to Side or Overlay

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo08.gif)

After native editing the Markdown source code in the standard VSCode editor, the user needs to **reload the contents explicitly since the data flow is unidirectional** .

At this point, the user will choose which panel to reload:
- to Side
- Overlay

The native editing can be a full modification of the document, and the reload action helps to  **reconstruct the entire markdown Cells with integrity** .

---

# ✅ Key Bindings (Extension Keyboard Shortcuts)

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/keybindings.png)

You can do everything with Key Bindings except for drag and drop; you can also customize them.

---

# ✅ Paste Images with one Keystroke

The general key binding of  `Ctrl+V`  for  **pasting**  supports  **not only text but also images** .

This feature allows you to **upload the clipboard image**  to  *your own image-only repository on GitHub*, and automatically insert its URL in the Cell to display it, with one Keystroke.

To use this feature, you need to create  *a dedicated image repository* and *an access token on GitHub* .  **Note that this feature does not work with secret repositories, and your images will be public.** 

Alternatively, you can use  *a secret Gist*  to store your images, but there is no API for that yet.

If you prefer not to use a public repository or a secret Gist, you can still display images by using your own URL as before.

---

# ✅ Works with VSCode’s full potential

![](https://raw.githubusercontent.com/ken-okabe/vscode-markdown-note/main/_images/demo07.gif)

For any operations that are not suitable for the Cell editing, you can use VSCode features, such as  **undo/redo/select the whole document** , or  **managing files with Git** .

