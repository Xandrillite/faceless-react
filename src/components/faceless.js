import React from "react";
import {
    AtomicBlockUtils,
    Editor,
    EditorState,
    getDefaultKeyBinding,
    Modifier,
    RichUtils,
    SelectionState
} from "draft-js";

import 'draft-js/dist/Draft.css';
import './faceless.css';
import Immutable from "_immutable@4.1.0@immutable";

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
        this.handleReturn = this._handleReturn.bind(this);
    }

    _handleKeyCommand(command, editorState, eventTimestamp) {
        let newEditorState = editorState;

        let selection = newEditorState.getSelection();

        if (command === 'backspace' && selection.isCollapsed()) {
            let text = newEditorState.getCurrentContent().getPlainText();
            if (pairs[text.charAt(selection.getAnchorOffset() - 1)] === text.charAt(selection.getAnchorOffset())) {
                newEditorState = EditorState.push(
                    newEditorState,
                    Modifier.replaceText(
                        newEditorState.getCurrentContent(),
                        selection.merge({
                            anchorOffset: selection.getAnchorOffset() - 1,
                            focusOffset: selection.getFocusOffset() + 1
                        }),
                        '',
                    ),
                    'delete-character'
                );
                this.onChange(newEditorState);
                return 'handled';
            }
        }

        // if (command === 'split-block') {
        //     newEditorState = keyCommandInsertNewline(newEditorState);
        //     this.onChange(newEditorState);
        //     return 'handled';
        // }

        newEditorState = RichUtils.handleKeyCommand(newEditorState, command);
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

        if (pairs[character]) {
            newEditorState = EditorState.push(
                editorState,
                Modifier.insertText(
                    editorState.getCurrentContent(),
                    editorState.getSelection(),
                    character + pairs[character],
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

        // derender the selection
        block.getInlineStyleAt(position - 1).map((value, index, array) => {
            let decorator = inlineDecorators[value];
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

        if (block.getType() === 'unstyled') {
            // render block type
            Object.keys(blockTypeRegex).some((key) => {
                const re = new RegExp(blockTypeRegex[key]);
                let matchArr = re.exec(text);
                if (matchArr) {
                    let newPosition = position - matchArr[1].length
                    newEditorState = EditorState.push(
                        newEditorState,
                        Modifier.replaceText(
                            contentState,
                            selection.merge({
                                anchorOffset: matchArr.index,
                                focusOffset: matchArr.index + matchArr[0].length,
                            }),
                            matchArr[2]
                        ),
                        'delete-character'
                    );
                    newEditorState = EditorState.forceSelection(
                        newEditorState,
                        newEditorState.getSelection().merge({
                            anchorOffset: newPosition,
                            focusOffset: newPosition,
                        })
                    );
                    newEditorState = RichUtils.toggleBlockType(
                        newEditorState,
                        key,
                    );
                }
            });
        }

        // render the inline styles
        Object.keys(inlineStyleRegex).some((key) => {
            const re = new RegExp(inlineStyleRegex[key]);
            let matchArr = re.exec(text);
            if (matchArr) {
                if (!(selection.getAnchorOffset() > matchArr.index
                    && selection.getAnchorOffset() < matchArr.index + matchArr[0].length + 1)) {
                    let newPosition = position -
                    (position <= matchArr.index ? 0 : (inlineDecorators[key].length * 2));
                    newEditorState = EditorState.forceSelection(
                        EditorState.push(
                            newEditorState,
                            Modifier.replaceText(
                                contentState,
                                selection.merge({
                                    anchorOffset: matchArr.index,
                                    focusOffset: matchArr.index + matchArr[0].length,
                                }),
                                matchArr[1],
                                block.getInlineStyleAt(matchArr.index).add(key)
                            ),
                            'change-inline-style'
                        ),
                        selection.merge({
                            anchorOffset: newPosition,
                            focusOffset: newPosition,
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

        // render multimedia block
        Object.keys(mediaTypeRegex).some((key) => {
            const re = new RegExp(mediaTypeRegex[key]);
            let matchArr = re.exec(text);
            if (matchArr) {
                if (!(selection.getAnchorOffset() > matchArr.index
                    && selection.getAnchorOffset() < matchArr.index + matchArr[0].length + 1)) {
                    let contentStateWithEntity = Modifier.replaceText(
                        contentState,
                        SelectionState.createEmpty(blockKey).merge({
                            anchorOffset: matchArr.index,
                            focusOffset: matchArr.index + matchArr[0].length,
                        }),
                        ''
                    ).createEntity(
                        key,
                        'IMMUTABLE',
                        {src: matchArr[2], alt: matchArr[1], title: matchArr[5]||''}
                    );
                    let entityKey = contentStateWithEntity.getLastCreatedEntityKey();
                    newEditorState = EditorState.set(
                        newEditorState,
                        {currentContent: contentStateWithEntity}
                    );
                    newEditorState = AtomicBlockUtils.insertAtomicBlock(
                        newEditorState,
                        entityKey,
                        ' ',
                    );
                }
                return true;
            } else {
                return false;
            }
        });

        this.setState({editorState: newEditorState});
    }

    _handleReturn(e, editorState) {
        let newEditorState = editorState;
        headerTypes.some((type) => {
            if (type === newEditorState.getCurrentContent().getBlockForKey(newEditorState.getSelection().getStartKey()).getType()) {

                return true;
            }
        });
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
                        handleReturn={this.handleReturn}
                        blockRendererFn={atomicBlockRenderer}
                    />
                </div>
            </div>
        );
    }
}

function atomicBlockRenderer(block) {
    if (block.getType() === 'atomic') {
        return {
            component: Media,
            editable: false,
        };
    }
    return null;
}

const Media = (props) => {
    const entity = props.contentState.getEntity(
        props.block.getEntityAt(0)
    );
    const data = entity.getData();
    const type = entity.getType();

    let media;
    switch (type) {
        case 'image':
            media = <img alt={data.alt||''} src={data.src} title={data.title||''} />;
            break;
        case 'video':
            media = <video controls muted autoPlay loop src={data.src} title={data.title||''} />;
            break;
    }
    return media;
};

const mediaTypeRegex = {
    'image': /!\[(.*?)]\((.+?(bmp|jpg|png|tif|gif|pcx|tga|exif|fpx|svg|psd|cdr|pcd|dxf|ufo|eps|ai|raw|WMF|webp|jpeg).*?)(\s*"(.*)")?\)/g,
    'video': /!\[(.*?)]\((.+?(avi|mpg|rm|mov|wav|asf|3gp|mkv|rmvb|mp4|ogg|mp3|oga|aac|mpeg|webm).*?)(\s*"(.*)")?\)/g,
}


const blockTypeRegex = {
    'header-one': /^(# )(.*)$/,
    'header-two': /^(## )(.*)$/,
    'header-three': /^(### )(.*)$/,
    'header-four': /^(#### )(.*)$/,
    'header-five': /^(##### )(.*)$/,
    'header-six': /^(###### )(.*)$/,
    'unordered-list-item': /^\s*(- )(.*)$/,
    'ordered-list-item': /^\s*(\d. )(.*)$/,
    'blockquote': /^\s*(> )(.*)$/,
    // 'code-block': /^```
    // 'atomic'
    // 'paragraph':
    // 'unstyled
};

const headerTypes = [
    'header-one',
    'header-two',
    'header-three',
    'header-four',
    'header-five',
    'header-six',
];

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
    '"': '"',
    "'": "'",
    // '（': '）',
}

const blockRenderMap = Immutable.Map({
    'unstyled': {
        element: 'p'
    }
})

export default Faceless;
