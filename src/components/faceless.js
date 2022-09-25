import React from "react";
import {Editor, EditorState, getDefaultKeyBinding, Modifier, SelectionState} from "draft-js";
import {RichUtils} from "_draft-js@0.11.7@draft-js";

import 'draft-js/dist/Draft.css';

class Faceless extends React.Component {
    constructor(props) {
        super(props);

        this.setDomEditorRef = ref => this.domEditor = ref;
        this.focus = () => this.domEditor.focus();
        this.onChange = this._onChange.bind(this);

        this.state = {
            editorState: EditorState.createEmpty(),
        };

        this.handleKeyCommand = this._handleKeyCommand.bind(this);
        this.mapKeyToEditorCommand = this._mapKeyToEditorCommand.bind(this);
        this.handleBeforeInput = this._handleBeforeInput.bind(this);
    }

    _handleKeyCommand(command, editorState, eventTimestamp) {
        let newEditorState;

        newEditorState = RichUtils.handleKeyCommand(editorState, command);
        if (newEditorState) {
            this.onChange(newEditorState);
            return 'handled';
        }
        return 'not-handled';
    }

    _mapKeyToEditorCommand(e) {
        return getDefaultKeyBinding(e);
    }

    _handleBeforeInput(character, editorState) {
        let newEditorState = editorState;

        let matcher = pairs[character];
        if (matcher) {
            newEditorState = EditorState.push(
                editorState,
                Modifier.insertText(
                    editorState.getCurrentContent(),
                    editorState.getSelection(),
                    character + matcher,
                ),
                'insert-characters'
            );

            newEditorState = EditorState.acceptSelection(
                newEditorState,
                newEditorState.getSelection().merge({
                    anchorOffset: newEditorState.getSelection().getAnchorOffset() - 1,
                    focusOffset: newEditorState.getSelection().getFocusOffset() - 1,
                })
            );
        }
        if (newEditorState !== editorState) {
            this.onChange(newEditorState);
            return 'handled';
        }
        return 'not-handled';
    }

    _onChange(editorState) {
        let contentState = editorState.getCurrentContent();
        let selection = editorState.getSelection();
        let blockKey = selection.getStartKey();
        let block = contentState.getBlockForKey(blockKey);
        let text = block.getText();
        let position = selection.getAnchorOffset();
        let newEditorState = editorState;

        block.getInlineStyleAt(position - 1).map((value, index, array) => {
            let decorator;
            switch (value) {
                case 'BOLD':
                    decorator = inlineDecorators[value];
                    break;
                default:
                    decorator = '';
            }
            block.findStyleRanges((metadata) => {
                return metadata.getStyle().has(value);
            }, (start, end) => {
                if (position >= start && position <= end) {
                    newEditorState = EditorState.push(
                        editorState,
                        Modifier.replaceText(
                            contentState,
                            selection.merge({
                                anchorOffset: start,
                                focusOffset: end,
                            }),
                            decorator + block.getText().slice(start, end) + decorator,
                        ),
                        'insert-characters'
                    );
                    newEditorState = EditorState.forceSelection(
                        newEditorState,
                        selection.merge({
                            anchorOffset: position + decorator.length,
                            focusOffset: position + decorator.length,
                        })
                    );
                }
            });
        });

        let matchArr;
        Object.keys(inlineStyleRegex).some((key) => {
            const re = new RegExp(inlineStyleRegex[key]);
            matchArr = re.exec(text);
            if (matchArr) {
                if (!(selection.getAnchorOffset() > matchArr.index
                    && selection.getAnchorOffset() < matchArr.index + matchArr[0].length + 1)) {
                    position += (selection.getAnchorOffset() <= matchArr.index) ? 0 : -(inlineDecorators[key].length * 2);
                    newEditorState = EditorState.forceSelection(
                        EditorState.push(
                            newEditorState,
                            Modifier.replaceText(
                                contentState,
                                SelectionState.createEmpty(blockKey).merge({
                                    anchorOffset: matchArr.index,
                                    focusOffset: matchArr.index + matchArr[0].length,
                                }),
                                matchArr[1],
                                block.getInlineStyleAt(matchArr.index).add(key)
                            ),
                            'change-inline-style'
                        ),
                        SelectionState.createEmpty(blockKey).merge({
                            anchorOffset: position,
                            focusOffset: position,
                        })
                    );
                    for (const style of newEditorState.getCurrentInlineStyle().values()) {
                        newEditorState = RichUtils.toggleInlineStyle(newEditorState, style);
                    }
                }
                return true;
            } else {
                return false;
            }
        });

        this.setState({editorState: newEditorState});
    }

    render() {
        return (
            <div className="editor-root">
                <div className="editor-container" onClick={this.focus}>
                    <Editor
                        editorState={this.state.editorState}
                        onChange={this.onChange}
                        ref={this.setDomEditorRef}
                        placeholder={"Write some text..."}
                        handleKeyCommand={this.handleKeyCommand}
                        keyBindingFn={this.mapKeyToEditorCommand}
                        handleBeforeInput={this.handleBeforeInput}
                    />
                </div>
            </div>
        );
    }
}

const inlineStyleRegex = {
    BOLD: /\*\*(.+?)\*\*/g,
    ITALIC: /\*(.+?)\*/g,
    CODE: /`(.+?)`/g,
    STRIKETHROUGH: /~~(.+?)~~/g,
}

const inlineDecorators = {
    BOLD: '**',
    ITALIC: '*',
    CODE: '`',
    STRIKETHROUGH: '~~',
}

const pairs = {
    '*': '*',
    '`': '`',
    '~': '~',
    '(': ')',
    '[': ']',
    '{': '}',
}

export default Faceless;
