/* @refresh reload */
import { render } from "solid-js/web";

//import 'bootstrap/scss/bootstrap.scss';
//import 'github-markdown-css/github-markdown-light.css';
//https://github.com/prismjs/prism-themes#readme
//import 'prism-themes/themes/prism-coldark-dark.min.css';
//import 'katex/dist/katex.min.css';
//buggy: errors occured

//import './css/custom_admonitions.scss'
import './css/custom.scss';

import App from './App';


render(() => <App />, document.getElementById("root") as HTMLElement);
