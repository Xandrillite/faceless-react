import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {
    MyEditor,
    LinkEditor,
    EntityEditor,
    TweetEditor,
    TeXEditor,
    MediaEditor,
    ColorfulEditor
} from "./components/draftDemo";

import Game from "./components/tic-tac-toe";
import Calculator from "./components/calculator";
import Faceless from "./components/faceless";

// ========================================

const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(<Game />);
// root.render(<Calculator/>);
// root.render(<MyEditor />);
// root.render(<LinkEditor />);
// root.render(<EntityEditor />);
// root.render(<TweetEditor />);
// root.render(<TeXEditor />);
// root.render(<MediaEditor />);
// root.render(<ColorfulEditor/>);
const complex =
    <div>
        <MyEditor/>
        <LinkEditor/>
        <EntityEditor/>
        <TweetEditor/>
        <TeXEditor/>
        <MediaEditor/>
        <ColorfulEditor/>
    </div>;

root.render(<Faceless/>);
// root.render(complex);
