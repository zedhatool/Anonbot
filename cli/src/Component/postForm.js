import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

export default class PostForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.handleTextUpdate = this.handleTextUpdate.bind(this);
  }
  handleSubmit() {
    axios.post('/submission', {

    })
  }
  handleTextUpdate(e) {
    this.setState({text: e.target.value});
    console.log(e.target.value);
  }
  render() {
    return(
      <div>
        <textarea id="m" name="anon" type="text" cols="36" rows ="7" placeholder="Say something..." onChange={this.handleTextUpdate} autoFocus></textarea>
        <br />
        <button type="submit" onClick={this.handleSubmit}>
          <strong>Submit</strong>
        </button>
    </div>
    );
  }
}
