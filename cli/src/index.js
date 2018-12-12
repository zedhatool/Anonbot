import React from 'react';
import ReactDOM from 'react-dom';
import './index.scss';
import * as serviceWorker from './serviceWorker';

import PostForm from './Component/postForm.js';

/* <a href="https://anonbotwl.glitch.me/respond"><p>Want to anonymously respond to a post instead?</p></a> */

ReactDOM.render(<div>
  <h1>Anonbot WL</h1>
  <PostForm />

  <br/>
  <a href="https://github.com/MatthewStanciu/Anonbotv2" target="_blank"><p>View code on GitHub</p></a>
  </div>, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
